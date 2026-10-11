/**
 * Implementation Blueprint + dependency analysis (pure, deterministic).
 * Derived only from authoritative workflow attributes, assessment inputs and assess() output.
 * Never recomputes scores, models, restrictions, impact or roadmap phase.
 * A Blueprint is a proposed future-state design — not an implemented, validated or approved automation.
 */
import type { AssessmentInputs, AssessmentResult, ExplanationItem, ModelOutcome, RestrictionCode, WorkflowAttributes } from "./types";
import type { AssessmentStatus, PortfolioItem } from "./portfolio";
import { futureState, type ArchStep } from "./architecture";
import { planEntry, type Section } from "./roadmap";

export const BLUEPRINT_VERSION = "blueprint-1";

export type Provenance = "assessment" | "mandatory" | "inference" | "unspecified";
export const PROVENANCE_LABEL: Record<Provenance, string> = {
  assessment: "Assessment-derived",
  mandatory: "Mandatory control",
  inference: "Planning inference",
  unspecified: "Unspecified",
};

export type DepCategory = "systems" | "data" | "policy" | "security" | "approval" | "outcome";
export const DEP_CATEGORY_LABEL: Record<DepCategory, string> = {
  systems: "Systems and integrations",
  data: "Data access and availability",
  policy: "Policy and process definition",
  security: "Identity, privacy and security",
  approval: "Human approval and escalation",
  outcome: "Outcome verification and evaluation",
};
export const DEP_CATEGORY_ACTION: Record<DepCategory, string> = {
  systems: "Confirm systems of record and the integration scope during discovery.",
  data: "Confirm data availability, quality and access permissions.",
  policy: "Document the authoritative policy, scope and exceptions.",
  security: "Specify identity verification, authorization and audit requirements.",
  approval: "Define approval points, review steps and escalation paths.",
  outcome: "Define how correct outcomes will be measured during a pilot.",
};
const DEP_ORDER: DepCategory[] = ["systems", "data", "policy", "security", "approval", "outcome"];

export interface Dependency { key: string; category: DepCategory; text: string; provenance: Provenance }

export interface DependencyContext {
  model: ModelOutcome;
  restrictions: RestrictionCode[];
  attrs: WorkflowAttributes;
  inputs: AssessmentInputs | null;
  required_systems: string[];
}

const REQUIRES_DEFINITION = "Requires definition";

/** Canonical dependency generator, shared by Blueprints and the portfolio Shared Dependencies view. */
export function analyzeDependencies(c: DependencyContext): Dependency[] {
  const out: Dependency[] = [];
  const seen = new Set<string>();
  const add = (key: string, category: DepCategory, text: string, provenance: Provenance) => {
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ key, category, text, provenance });
  };
  const has = (r: RestrictionCode) => c.restrictions.includes(r);
  const f = c.inputs?.factors ?? {};
  const automating = c.model === "deterministic" || c.model === "ai_assisted" || c.model === "ai_autonomous";

  // Systems
  const systems = [...new Set(c.required_systems.map((s) => s.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  for (const s of systems) add(`systems:${s.toLowerCase()}`, "systems", `Access to ${s} (listed as a required system)`, "assessment");
  if (systems.length === 0 && automating) add("systems:unspecified", "systems", "Systems of record not specified — to be confirmed during implementation discovery", "unspecified");
  if ((f.integration_complexity ?? 0) >= 3) add("systems:complex", "systems", `Integration complexity rated ${f.integration_complexity}/4`, "assessment");
  if ((f.tool_fragmentation ?? 0) >= 3) add("systems:fragmented", "systems", `Tool fragmentation rated ${f.tool_fragmentation}/4`, "assessment");

  // Data
  if (has("R4_sensitive_data")) add("data:permission", "data", "Permission-scoped data access with requester authorization", "mandatory");
  if ((f.data_readiness_gap ?? 0) >= 2) add("data:readiness", "data", `Data readiness gap rated ${f.data_readiness_gap}/4`, "assessment");
  if ((f.structured_data ?? 4) <= 1) add("data:structured", "data", `Structured data availability rated ${f.structured_data}/4`, "assessment");

  // Policy
  if (has("R5_policy_unclear")) add("policy:authoritative", "policy", "Codified authoritative policy", "mandatory");
  else if (c.inputs?.attributes.authoritative_policy_available == null && automating) add("policy:unknown", "policy", "Availability of an authoritative policy not stated", "unspecified");
  if ((f.policy_maturity_gap ?? 0) >= 2) add("policy:maturity", "policy", `Policy maturity gap rated ${f.policy_maturity_gap}/4`, "assessment");
  if ((f.process_maturity_gap ?? 0) >= 2) add("policy:process", "policy", `Process maturity gap rated ${f.process_maturity_gap}/4`, "assessment");

  // Security
  if (has("R1_account_compromise")) add("security:queue", "security", "Security-team escalation and account protection", "mandatory");
  if (has("R2_identity_access")) {
    add("security:recovery", "security", "Verified identity-recovery control", "mandatory");
    const v = c.inputs?.attributes.verified_recovery_control;
    if (v === false) add("security:recovery-missing", "security", "Assessment states no verified recovery control is in place", "assessment");
    else if (v == null) add("security:recovery-unknown", "security", "Whether a verified recovery control exists is not stated", "unspecified");
  }
  if (c.attrs.accesses_sensitive_data && !has("R4_sensitive_data")) add("security:privacy", "security", "Privacy handling for sensitive data", "assessment");

  // Approval / escalation
  if (has("R3_irreversible_financial")) add("approval:financial", "approval", `Human approval before financial or irreversible execution (thresholds: ${REQUIRES_DEFINITION.toLowerCase()})`, "mandatory");
  if (c.model === "ai_assisted") add("approval:review", "approval", "Agent review-and-approve step for every AI suggestion", "inference");
  if (c.model === "ai_autonomous") add("approval:handoff", "approval", "Confidence-based handoff and customer opt-out to an agent", "inference");
  if (c.model === "deterministic") add("approval:fallback", "approval", "Fallback to an agent when rules or systems fail", "inference");
  if ((f.escalation_sensitivity ?? 0) >= 3) add("approval:escalation", "approval", `Escalation path design (escalation sensitivity ${f.escalation_sensitivity}/4)`, "assessment");

  // Outcome
  if (has("R6_outcome_unverifiable")) add("outcome:check", "outcome", "Objective outcome check", "mandatory");
  if (automating) add("outcome:pilot", "outcome", "Pilot evaluation criteria and measurement", "inference");

  return out.sort((a, b) => DEP_ORDER.indexOf(a.category) - DEP_ORDER.indexOf(b.category));
}

// ---------- Responsibilities ----------
export interface Responsibilities { deterministic: string[]; ai: string[]; human: string[]; aiNote?: string | undefined }

function responsibilities(model: ModelOutcome, rs: RestrictionCode[], attrs: WorkflowAttributes): Responsibilities {
  const has = (r: RestrictionCode) => rs.includes(r);
  const checks = [
    ...(has("R2_identity_access") ? ["Verified identity / recovery-token check"] : []),
    ...(has("R4_sensitive_data") ? ["Requester authorization and permission checks"] : []),
  ];
  const writes = attrs.action_type !== "read_only";
  switch (model) {
    case "deterministic":
      return {
        deterministic: ["Structured intake and routing", "Input and data validation", ...checks, "Versioned eligibility rules", writes ? "Authorized system action with audit log" : "Authorized data retrieval and response"],
        ai: [],
        aiNote: "None. Rules are sufficient; generative AI is not part of this design.",
        human: ["Exception handling when rules or systems fail", ...(has("R3_irreversible_financial") ? ["Approval of financial or irreversible actions"] : []), ...(has("R2_identity_access") ? ["Escalation of failed or suspicious verification"] : [])],
      };
    case "ai_assisted":
      return {
        deterministic: ["Routing and queue assignment", "Policy and record retrieval", ...checks],
        ai: ["Intent classification", "Context summarization", "Draft response or recommended next step"],
        human: ["Review and approve every AI suggestion", "Final decision and customer communication", "All system actions", ...(has("R3_irreversible_financial") ? ["Financial approval under the required approval process"] : [])],
      };
    case "ai_autonomous":
      return {
        deterministic: ["Scope gating to approved intents", "Retrieval of approved content", "Handoff routing", ...checks],
        ai: ["Language understanding", "Grounded informational responses within approved scope"],
        human: ["Handling of handed-off and out-of-scope cases", "Sampled QA review of autonomous resolutions", "Content ownership and updates"],
      };
    case "human_led":
      return {
        deterministic: ["Optional record lookups for agents"],
        ai: has("R1_account_compromise") ? [] : ["Optional summaries for agents — no decisions or actions"],
        aiNote: has("R1_account_compromise") ? "None for account-security decisions." : undefined,
        human: ["All decisions and actions", ...(has("R1_account_compromise") ? ["Security escalation and account protection"] : []), "Exception and sensitive-case judgment"],
      };
    default:
      return { deterministic: [], ai: [], human: [] };
  }
}

// ---------- Control matrix ----------
const MANDATORY_CONTROL_CODES = new Set(["C_SECURITY_QUEUE", "C_VERIFIED_RECOVERY", "C_AUDIT_LOG", "C_NO_AI_ACCESS", "C_HUMAN_APPROVAL", "C_PERMISSION_SCOPE", "C_POLICY_AUTHORING", "C_OUTCOME_CHECK"]);

export interface Safeguard extends ExplanationItem { provenance: Provenance }
export interface ControlMatrix { automated: string[]; approval: string[]; prohibited: string[]; escalation: string[]; safeguards: Safeguard[] }

function controlMatrix(model: ModelOutcome, rs: RestrictionCode[], resp: Responsibilities, controls: ExplanationItem[]): ControlMatrix {
  const has = (r: RestrictionCode) => rs.includes(r);
  const automated = model === "human_led" ? [] : [...resp.deterministic, ...(model === "ai_autonomous" ? resp.ai : [])];
  const approval: string[] = [];
  if (model === "ai_assisted") approval.push("Any customer-facing response or action proposed by AI");
  if (has("R3_irreversible_financial")) approval.push(`Refund or financial execution (approval thresholds: ${REQUIRES_DEFINITION})`);
  if (model === "human_led") approval.push("All outcomes are decided by people");
  const prohibited: string[] = [];
  if (has("R1_account_compromise")) prohibited.push("Automated account-security decisions");
  if (has("R2_identity_access")) prohibited.push("Granting account access outside the verified recovery flow");
  if (has("R3_irreversible_financial")) prohibited.push("Financial or irreversible execution without human approval");
  if (has("R4_sensitive_data")) prohibited.push("Returning sensitive data without an authorization check");
  if (model === "deterministic") prohibited.push("Generative-AI decisions in this flow");
  if (model === "ai_assisted") prohibited.push("AI executing actions or messaging customers without agent approval");
  if (model === "ai_autonomous") prohibited.push("Irreversible, financial or account actions by AI", "Answers outside approved content");
  const escalation: string[] = [];
  if (model === "deterministic") escalation.push("Rule, validation or system failure");
  if (model === "ai_autonomous") escalation.push("Low confidence or out-of-scope intent", "Customer requests a human");
  if (model === "ai_assisted") escalation.push("Agent rejects or cannot verify the AI suggestion");
  if (has("R2_identity_access")) escalation.push("Failed or suspicious identity verification");
  if (has("R1_account_compromise")) escalation.push("Any sign of account compromise → security team");
  escalation.push(`Further escalation criteria: ${REQUIRES_DEFINITION.toLowerCase()} during discovery`);
  const safeguards = controls.map((c) => ({ ...c, provenance: (MANDATORY_CONTROL_CODES.has(c.code) ? "mandatory" : "assessment") as Provenance }));
  return { automated, approval, prohibited, escalation, safeguards };
}

// ---------- Approach & validation ----------
export interface Approach { define: string[]; prepare: string[]; pilot: string[]; expand: string[]; pilotBlockedBy: string[] }

function approach(model: ModelOutcome, deps: Dependency[], m: ControlMatrix): Approach {
  const mandatory = deps.filter((d) => d.provenance === "mandatory").map((d) => d.text);
  const unspecified = deps.filter((d) => d.provenance === "unspecified").map((d) => d.text);
  if (model === "human_led") {
    return {
      define: ["Document the specialist process, decision criteria and escalation ownership.", ...unspecified],
      prepare: ["Improve agent tooling and knowledge access; consider read-only summaries only."],
      pilot: ["Not proposed: this workflow is not an automation candidate."],
      expand: ["Re-assess if risk factors materially change. The operating model is not changed by this Blueprint."],
      pilotBlockedBy: [],
    };
  }
  return {
    define: ["Confirm scope, exclusions and exceptions for this workflow.", "Name an accountable process owner (to be confirmed).", ...unspecified],
    prepare: [...mandatory.map((t) => `Establish: ${t}`), ...deps.filter((d) => d.provenance === "assessment" && d.category !== "systems").map((d) => `Address: ${d.text}`), ...deps.filter((d) => d.category === "systems" && d.provenance === "assessment").map((d) => d.text)],
    pilot: [
      model === "ai_autonomous" ? "Limited pilot on a small share of in-scope traffic with handoff and sampled QA." : model === "ai_assisted" ? "Agent-assist pilot with a subset of agents; measure suggestion acceptance and corrections." : "Pilot on a limited request subset with agent fallback and full audit logging.",
      "Only after every mandatory control above is in place and verified by the implementing team.",
    ],
    expand: ["Consider broader rollout only if pilot validation criteria are met and controls remain effective.", "Re-assess the workflow if volume, action type or data access change."],
    pilotBlockedBy: mandatory,
  };
}

function validation(model: ModelOutcome, rs: RestrictionCode[]): string[] {
  const v = ["Correct routing of in-scope vs out-of-scope requests", "Policy adherence of outcomes"];
  if (model === "ai_assisted" || model === "ai_autonomous") v.push("Quality and accuracy of generated guidance");
  if (model === "ai_autonomous") v.push("Appropriate escalation on low confidence or customer request");
  if (model === "ai_assisted") v.push("Human approval enforced before any customer-facing output");
  if (rs.includes("R3_irreversible_financial")) v.push("Financial approval enforcement");
  if (rs.includes("R2_identity_access") || rs.includes("R4_sensitive_data")) v.push("Unauthorized-action and unauthorized-access prevention");
  if (model === "deterministic") v.push("Rule regression tests and failure fallback");
  v.push("Outcome verification against an agreed definition of success");
  return v;
}

// ---------- Blueprint ----------
export interface BlueprintInput {
  name: string;
  description: string;
  required_systems: string[];
  attrs: WorkflowAttributes;
  inputs: AssessmentInputs | null;
  result: AssessmentResult | null;
  status: AssessmentStatus;
  revision: number | null;
}

export type Blueprint =
  | { current: false; version: string; status: AssessmentStatus; reason: string }
  | {
      current: true;
      version: string;
      scoring_version: string;
      revision: number | null;
      model: ModelOutcome;
      phase: Section;
      phaseReason: string;
      scores: AssessmentResult["scores"];
      restrictions: { code: RestrictionCode; label: string; effect: string }[];
      boundary: string;
      assumptions: string[];
      responsibilities: Responsibilities;
      sequence: ArchStep[];
      matrix: ControlMatrix;
      dependencies: Dependency[];
      approach: Approach;
      validation: string[];
    };

const BOUNDARY: Partial<Record<ModelOutcome, string>> = {
  deterministic: "Rules and authorized system operations handle in-scope requests; anything else falls back to an agent.",
  ai_assisted: "AI prepares classifications, summaries and drafts; agents decide and act.",
  ai_autonomous: "AI may resolve informational requests within approved content only; everything else hands off to an agent.",
  human_led: "People own the outcome. Systems provide lookups and, where permitted, summaries.",
};

export function buildBlueprint(b: BlueprintInput): Blueprint {
  const res = b.result;
  if (b.status !== "assessed" || !res || res.model === "insufficient_data") {
    const reason =
      b.status === "stale" ? "Workflow details or scoring changed after the last saved assessment. This design is not current."
      : b.status === "incomplete" || res?.model === "insufficient_data" ? "The assessment is incomplete, so no current design can be produced."
      : "This workflow has not been assessed yet.";
    return { current: false, version: BLUEPRINT_VERSION, status: b.status, reason };
  }
  const rs = res.restrictions.map((r) => r.code);
  const entry = planEntry({ id: "", name: b.name, attrs: b.attrs, result: res, status: b.status });
  const resp = responsibilities(res.model, rs, b.attrs);
  const deps = analyzeDependencies({ model: res.model, restrictions: rs, attrs: b.attrs, inputs: b.inputs, required_systems: b.required_systems });
  const matrix = controlMatrix(res.model, rs, resp, res.controls);
  const assumptions = [
    `Volume ${b.attrs.monthly_volume.toLocaleString("en-US")}/month and handling time ${b.attrs.aht_minutes} min as entered.`,
    res.impact.available ? "Impact figures are scenario estimates from the entered assumptions, not observed savings." : "Impact estimate unavailable.",
    "Controls, integrations or policies marked present in assessment inputs are declarations only; the application has not independently verified that they exist or work.",
  ];
  return {
    current: true,
    version: BLUEPRINT_VERSION,
    scoring_version: res.scoring_version,
    revision: b.revision,
    model: res.model,
    phase: entry.section,
    phaseReason: entry.reason,
    scores: res.scores,
    restrictions: res.restrictions.map((r) => ({ code: r.code, label: r.label, effect: r.effect })),
    boundary: BOUNDARY[res.model] ?? "",
    assumptions,
    responsibilities: resp,
    sequence: futureState(res) ?? [],
    matrix,
    dependencies: deps,
    approach: approach(res.model, deps, matrix),
    validation: validation(res.model, rs),
  };
}

// ---------- Portfolio shared dependencies ----------
export interface SharedDependency {
  category: DepCategory;
  workflows: { id: string; name: string; humanLed: boolean }[];
  provenance: Provenance[]; // distinct origins present
  action: string;
}

export function sharedDependencies(items: PortfolioItem[]): SharedDependency[] {
  const map = new Map<DepCategory, { wf: Map<string, { id: string; name: string; humanLed: boolean }>; prov: Set<Provenance> }>();
  for (const it of items) {
    if (it.status !== "assessed" || !it.result || it.result.model === "insufficient_data") continue;
    const deps = analyzeDependencies({
      model: it.result.model, restrictions: it.result.restrictions.map((r) => r.code), attrs: it.attrs,
      inputs: it.inputs ?? null, required_systems: it.required_systems ?? [],
    });
    for (const d of deps) {
      const g = map.get(d.category) ?? { wf: new Map(), prov: new Set<Provenance>() };
      g.wf.set(it.id, { id: it.id, name: it.name, humanLed: it.result.model === "human_led" });
      g.prov.add(d.provenance);
      map.set(d.category, g);
    }
  }
  return DEP_ORDER.filter((c) => map.has(c)).map((c) => {
    const g = map.get(c)!;
    return {
      category: c,
      workflows: [...g.wf.values()].sort((a, b) => a.name.localeCompare(b.name)),
      provenance: (["mandatory", "assessment", "inference", "unspecified"] as Provenance[]).filter((p) => g.prov.has(p)),
      action: DEP_CATEGORY_ACTION[c],
    };
  });
}
