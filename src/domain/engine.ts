// Deterministic, versioned assessment engine (v1.0.0). See SCORING.md.
import { FACTORS } from "./rubrics";
import type {
  AssessmentInputs,
  AssessmentResult,
  ExplanationItem,
  FactorKey,
  ImpactResult,
  ModelOutcome,
  PriorityResult,
  Restriction,
  RestrictionCode,
  WorkflowAttributes,
} from "./types";
import { SCORING_VERSION, SUITABILITY_FACTORS, RISK_FACTORS, EFFORT_FACTORS } from "./types";

export const THRESHOLDS = {
  humanLedRisk: 70, // risk >= 70 -> Human-Led
  deterministicSuitability: 70, // >=
  deterministicMaxRiskExclusive: 50, // risk < 50
  deterministicMaxLanguage: 1, // <=
  autonomousSuitability: 75, // >=
  autonomousMaxRisk: 30, // <=
  autonomousMinPolicyClarity: 3,
  autonomousMaxDataGap: 1,
  assistedSuitability: 40, // >=
  assistedMinLanguage: 2,
  assistedMaxRiskExclusive: 70,
  impactCapHours: 150,
} as const;

export const PRIORITY_WEIGHTS = { impact: 0.4, effort: 0.25, risk: 0.2, readiness: 0.15 } as const;

function dimensionScore(keys: readonly FactorKey[], inputs: AssessmentInputs): number | null {
  let sum = 0;
  for (const k of keys) {
    const v = inputs.factors[k];
    if (v == null) return null;
    const def = FACTORS.find((f) => f.key === k)!;
    sum += def.weight * (v / 4) * 100;
  }
  // Guard against floating-point drift, then clamp to the documented 0–100 range.
  return Math.min(100, Math.max(0, Math.round(Math.round(sum * 1e6) / 1e6)));
}

export function computeScores(inputs: AssessmentInputs) {
  return {
    suitability: dimensionScore(SUITABILITY_FACTORS, inputs),
    risk: dimensionScore(RISK_FACTORS, inputs),
    effort: dimensionScore(EFFORT_FACTORS, inputs),
  };
}

export function findMissing(w: WorkflowAttributes, i: AssessmentInputs): string[] {
  const missing: string[] = [];
  for (const f of FACTORS) if (i.factors[f.key] == null) missing.push(`factors.${f.key}`);
  if (i.attributes.language_reasoning == null) missing.push("attributes.language_reasoning");
  if (i.attributes.authoritative_policy_available == null) missing.push("attributes.authoritative_policy_available");
  if (w.handles_account_access && i.attributes.verified_recovery_control == null)
    missing.push("attributes.verified_recovery_control");
  return missing;
}

const R: Record<RestrictionCode, { label: string; effect: string }> = {
  R1_account_compromise: { label: "Suspected account compromise", effect: "Human/security-led disposition required." },
  R2_identity_access: { label: "Identity or account access", effect: "No AI autonomy. Deterministic only with a verified recovery control; otherwise Human-Led." },
  R3_irreversible_financial: { label: "Irreversible or financial action", effect: "No AI autonomy. Human approval required before execution." },
  R4_sensitive_data: { label: "Sensitive data access", effect: "No AI autonomy. Permission-scoped access checks required." },
  R5_policy_unclear: { label: "Policy unclear", effect: "Blocks deterministic automation and AI autonomy." },
  R6_outcome_unverifiable: { label: "Outcome not verifiable", effect: "Blocks deterministic automation and AI autonomy." },
};

/** Union of derived (mandatory) and declared restrictions. Inputs can only add, never remove. */
export function effectiveRestrictions(w: WorkflowAttributes, i: AssessmentInputs): Restriction[] {
  const out: Restriction[] = [];
  const add = (code: RestrictionCode, source: "declared" | "derived") => out.push({ code, source, ...R[code] });
  if (i.declared.suspected_account_compromise) add("R1_account_compromise", "declared");
  if (w.handles_account_access) add("R2_identity_access", "derived");
  if (w.action_type === "financial_transaction" || w.action_type === "irreversible_write") add("R3_irreversible_financial", "derived");
  if (w.accesses_sensitive_data) add("R4_sensitive_data", "derived");
  const pc = i.factors.policy_clarity;
  if ((pc != null && pc <= 1) || i.attributes.authoritative_policy_available === false) add("R5_policy_unclear", "derived");
  const ov = i.factors.outcome_verifiability;
  if (ov != null && ov <= 1) add("R6_outcome_unverifiable", "derived");
  return out;
}

const CONTROL_FOR: Partial<Record<RestrictionCode, ExplanationItem[]>> = {
  R1_account_compromise: [{ code: "C_SECURITY_QUEUE", text: "Route to the security team queue; lock the account pending review." }],
  R2_identity_access: [
    { code: "C_VERIFIED_RECOVERY", text: "Use a verified recovery factor (e.g. email/MFA token); never grant access from conversation alone." },
    { code: "C_AUDIT_LOG", text: "Audit-log every account access change." },
    { code: "C_NO_AI_ACCESS", text: "No agent or AI may grant account access outside the verified flow." },
  ],
  R3_irreversible_financial: [{ code: "C_HUMAN_APPROVAL", text: "Human approval required before refund or financial execution." }],
  R4_sensitive_data: [{ code: "C_PERMISSION_SCOPE", text: "Permission-scoped data access with requester authorization check." }],
  R5_policy_unclear: [{ code: "C_POLICY_AUTHORING", text: "Codify an authoritative policy before automating." }],
  R6_outcome_unverifiable: [{ code: "C_OUTCOME_CHECK", text: "Define an objective outcome check before automating." }],
};

const MODEL_CONTROLS: Record<Exclude<ModelOutcome, "insufficient_data">, ExplanationItem[]> = {
  deterministic: [{ code: "C_RULE_TESTS", text: "Version-controlled rules with regression tests and failure fallback to an agent." }],
  ai_assisted: [{ code: "C_HUMAN_REVIEW", text: "Agent reviews and approves every AI suggestion before it reaches the customer." }],
  ai_autonomous: [
    { code: "C_SCOPE_LIMIT", text: "Restrict to informational responses grounded in approved content." },
    { code: "C_HANDOFF", text: "Confidence-based handoff to an agent and customer opt-out to human." },
    { code: "C_SAMPLING_QA", text: "Sampled QA review of autonomous resolutions." },
  ],
  human_led: [{ code: "C_AGENT_TOOLING", text: "Improve agent tooling and knowledge; consider AI summaries only." }],
};

const NEXT_STEP: Record<ModelOutcome, ExplanationItem> = {
  deterministic: { code: "N_DESIGN_RULES", text: "Specify the rule flow and required integrations." },
  ai_assisted: { code: "N_PILOT_ASSIST", text: "After the implementing team establishes and verifies required safeguards, pilot agent-assist with a review loop and measure acceptance rate." },
  ai_autonomous: { code: "N_BOUNDED_PILOT", text: "After the implementing team establishes and verifies required safeguards, run a bounded pilot with handoff and QA sampling before scaling." },
  human_led: { code: "N_IMPROVE_PROCESS", text: "Improve the human process and controls; reassess once policy and risk change." },
  insufficient_data: { code: "N_COMPLETE", text: "Complete the missing assessment inputs." },
};

interface Decision {
  model: ModelOutcome;
  rule: string;
  drivers: ExplanationItem[];
  limits: ExplanationItem[];
}

export function decide(
  w: WorkflowAttributes,
  i: AssessmentInputs,
  scores: { suitability: number | null; risk: number | null; effort: number | null },
  restrictions: Restriction[],
  missing: string[],
): Decision {
  const T = THRESHOLDS;
  const limits: ExplanationItem[] = [];
  const drivers: ExplanationItem[] = [];
  if (missing.length > 0) {
    return { model: "insufficient_data", rule: "1_completeness", drivers, limits: [{ code: "L_MISSING", text: `${missing.length} required input(s) missing.` }] };
  }
  const s = scores.suitability!, r = scores.risk!;
  const lang = i.attributes.language_reasoning!;
  const has = (c: RestrictionCode) => restrictions.some((x) => x.code === c);
  const f = i.factors as Record<FactorKey, number>;

  if (has("R1_account_compromise")) {
    return { model: "human_led", rule: "2_R1", drivers, limits: [{ code: "L_R1", text: "Suspected account compromise requires security-led handling." }] };
  }
  if (r >= T.humanLedRisk) limits.push({ code: "L_RISK_HIGH", text: `Operational risk ${r} ≥ ${T.humanLedRisk}.` });
  if (f.human_judgment === 4) limits.push({ code: "L_JUDGMENT", text: "Essential human judgment required." });
  if (f.policy_clarity === 0) limits.push({ code: "L_NO_POLICY", text: "No usable policy." });
  if (limits.length > 0) return { model: "human_led", rule: "3_human_led", drivers, limits };

  const r2 = has("R2_identity_access");
  const verified = i.attributes.verified_recovery_control === true;
  const detOk =
    s >= T.deterministicSuitability &&
    r < T.deterministicMaxRiskExclusive &&
    lang <= T.deterministicMaxLanguage &&
    !has("R5_policy_unclear") &&
    !has("R6_outcome_unverifiable") &&
    (!r2 || verified);
  if (detOk) {
    drivers.push({ code: "D_STANDARDIZED", text: `High suitability (${s}) with low language reasoning (${lang}/4).` });
    drivers.push({ code: "D_LOW_RISK", text: `Risk ${r} below ${T.deterministicMaxRiskExclusive}.` });
    if (r2) drivers.push({ code: "D_VERIFIED_RECOVERY", text: "Recovery control marked present in assessment inputs; not independently verified." });
    if (s >= T.autonomousSuitability) limits.push({ code: "L_NO_GENAI_NEEDED", text: "Generative AI is not needed: rules suffice." });
    return { model: "deterministic", rule: "4_deterministic", drivers, limits };
  }
  if (r2) {
    return { model: "human_led", rule: "5_R2_unverified", drivers, limits: [{ code: "L_R2", text: "Account access without a verified recovery control or deterministic fit." }] };
  }

  const autoBlockers: ExplanationItem[] = [];
  if (s < T.autonomousSuitability) autoBlockers.push({ code: "L_AUTO_SUIT", text: `Suitability ${s} < ${T.autonomousSuitability} for autonomy.` });
  if (r > T.autonomousMaxRisk) autoBlockers.push({ code: "L_AUTO_RISK", text: `Risk ${r} > ${T.autonomousMaxRisk} for autonomy.` });
  if (f.policy_clarity < T.autonomousMinPolicyClarity) autoBlockers.push({ code: "L_AUTO_POLICY", text: "Policy clarity below 3." });
  if (f.data_readiness_gap > T.autonomousMaxDataGap) autoBlockers.push({ code: "L_AUTO_DATA", text: "Data readiness gap above 1." });
  if (!(w.action_type === "read_only" || w.action_type === "reversible_write")) autoBlockers.push({ code: "L_AUTO_ACTION", text: "Action is not reversible." });
  for (const x of restrictions) autoBlockers.push({ code: `L_AUTO_${x.code}`, text: `${x.label} blocks autonomy.` });

  if (autoBlockers.length === 0) {
    drivers.push({ code: "D_AUTO_ALL", text: `All autonomy gates passed (suitability ${s}, risk ${r}, clear policy, verifiable, reversible).` });
    return { model: "ai_autonomous", rule: "6_autonomous", drivers, limits };
  }

  if (s >= T.assistedSuitability && lang >= T.assistedMinLanguage && r < T.assistedMaxRiskExclusive) {
    drivers.push({ code: "D_LANGUAGE", text: `Language reasoning ${lang}/4 benefits from AI support.` });
    drivers.push({ code: "D_SUIT_OK", text: `Suitability ${s} ≥ ${T.assistedSuitability}.` });
    return { model: "ai_assisted", rule: "7_assisted", drivers, limits: autoBlockers };
  }
  const fb: ExplanationItem[] = [];
  if (s < T.assistedSuitability) fb.push({ code: "L_SUIT_LOW", text: `Suitability ${s} < ${T.assistedSuitability}.` });
  if (lang < T.assistedMinLanguage) fb.push({ code: "L_LANG_LOW", text: "Low language reasoning but not deterministic-eligible." });
  if (!detOk && lang <= 1) fb.push({ code: "L_DET_FAIL", text: "Deterministic criteria not met." });
  return { model: "human_led", rule: "8_fallback", drivers, limits: [...fb, ...autoBlockers] };
}

export function computeImpact(w: WorkflowAttributes, i: AssessmentInputs): ImpactResult {
  const im = i.impact;
  const missing: string[] = [];
  if (im.addressable_fraction == null) missing.push("impact.addressable_fraction");
  if (im.coverage == null) missing.push("impact.coverage");
  if (im.expected_reduction == null) missing.push("impact.expected_reduction");
  const reviewMissing: string[] = [];
  if (im.reviewed_fraction == null) reviewMissing.push("impact.reviewed_fraction");
  if (im.review_minutes == null) reviewMissing.push("impact.review_minutes");
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const eligible = im.addressable_fraction != null ? w.monthly_volume * im.addressable_fraction : null;
  const affected = eligible != null && im.coverage != null ? eligible * im.coverage : null;
  const gross = affected != null && im.expected_reduction != null ? (affected * w.aht_minutes * im.expected_reduction) / 60 : null;
  const review = affected != null && reviewMissing.length === 0 ? (affected * im.reviewed_fraction! * im.review_minutes!) / 60 : null;
  const net = gross != null && review != null ? gross - review : null;
  return {
    available: net != null,
    missing: [...missing, ...reviewMissing],
    eligible: eligible == null ? null : r2(eligible),
    affected: affected == null ? null : r2(affected),
    gross_hours: gross == null ? null : r2(gross),
    review_hours: review == null ? null : r2(review),
    net_hours: net == null ? null : r2(net),
    unfavorable: net != null && net < 0,
  };
}

export function computePriority(
  model: ModelOutcome,
  restrictions: Restriction[],
  scores: { risk: number | null; effort: number | null },
  i: AssessmentInputs,
  impact: ImpactResult,
): PriorityResult {
  const cpi = restrictions.length > 0;
  if (model === "insufficient_data")
    return { category: "needs_assessment", control_process_improvement: cpi, score: null, impact_index: null, control_readiness: null };
  if (model === "human_led")
    return { category: "not_automation_candidate", control_process_improvement: cpi, score: null, impact_index: null, control_readiness: null };
  const f = i.factors as Record<FactorKey, number>;
  const readiness = (100 * (f.policy_clarity + (4 - f.data_readiness_gap) + (4 - f.process_maturity_gap))) / 12;
  if (!impact.available || impact.net_hours == null)
    return { category: "impact_unavailable", control_process_improvement: cpi, score: null, impact_index: null, control_readiness: Math.round(readiness) };
  const idx = Math.min(100, Math.max(0, (impact.net_hours / THRESHOLDS.impactCapHours) * 100));
  const W = PRIORITY_WEIGHTS;
  const score = W.impact * idx + W.effort * (100 - scores.effort!) + W.risk * (100 - scores.risk!) + W.readiness * readiness;
  return {
    category: "automation_candidate",
    control_process_improvement: cpi,
    score: Math.round(score),
    impact_index: Math.round(idx),
    control_readiness: Math.round(readiness),
  };
}

/** The single entry point used by the demo, the client preview and the trusted server save path. */
export function assess(w: WorkflowAttributes, i: AssessmentInputs): AssessmentResult {
  const scores = computeScores(i);
  const missing = findMissing(w, i);
  const restrictions = effectiveRestrictions(w, i);
  const d = decide(w, i, scores, restrictions, missing);
  const controls: ExplanationItem[] = [];
  const seen = new Set<string>();
  const push = (x: ExplanationItem) => { if (!seen.has(x.code)) { seen.add(x.code); controls.push(x); } };
  for (const r of restrictions) for (const c of CONTROL_FOR[r.code] ?? []) push(c);
  if (d.model !== "insufficient_data") for (const c of MODEL_CONTROLS[d.model]) push(c);
  const impact = computeImpact(w, i);
  const priority = computePriority(d.model, restrictions, scores, i, impact);
  return {
    scoring_version: SCORING_VERSION,
    complete: missing.length === 0,
    missing,
    scores,
    model: d.model,
    rule: d.rule,
    restrictions,
    drivers: d.drivers,
    limits: d.limits,
    controls,
    next_step: NEXT_STEP[d.model],
    impact,
    priority,
  };
}
