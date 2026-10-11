/**
 * Roadmap planning layer (pure, deterministic).
 * Consumes authoritative assessment results; never recomputes scores, model, restrictions, impact or priority.
 * Placement is a planning recommendation, not deployment approval or evidence that controls exist.
 */
import type { PortfolioItem } from "./portfolio";
import type { ExplanationItem, ModelOutcome, RestrictionCode } from "./types";

export const ROADMAP_VERSION = "roadmap-1";

export const PHASE_RULES = {
  nowMinPriority: 70, // priority >= 70
  nowMaxEffortExclusive: 40, // effort < 40
  nextMinPriority: 50, // priority >= 50
  nextMaxEffortExclusive: 60, // effort < 60
} as const;

export type Lane = "now" | "next" | "later";
export type Section = Lane | "human_led" | "reassess";

export const SECTION_LABEL: Record<Section, string> = {
  now: "Now",
  next: "Next",
  later: "Later",
  human_led: "Human-Led — not proposed for automation",
  reassess: "Needs reassessment",
};

export interface Dependency {
  text: string;
  /** "restriction" = documented by a triggered safety restriction; "inferred" = suggested from model/effort, not documented evidence. */
  source: "restriction" | "inferred";
}

export interface RoadmapEntry {
  id: string;
  name: string;
  section: Section;
  reason: string;
  model: ModelOutcome | null;
  priority: number | null;
  effort: number | null;
  risk: number | null;
  net_hours: number | null;
  gross_hours: number | null;
  primary_risk: string | null;
  restrictions: string[];
  /** Required controls from the engine. Status is always "required / unverified" — the app holds no evidence of implementation. */
  required_controls: ExplanationItem[];
  dependency: Dependency | null;
  next_action: string;
}

const RESTRICTION_ORDER: RestrictionCode[] = [
  "R1_account_compromise", "R2_identity_access", "R3_irreversible_financial", "R4_sensitive_data", "R5_policy_unclear", "R6_outcome_unverifiable",
];

const RESTRICTION_DEPENDENCY: Record<RestrictionCode, string> = {
  R1_account_compromise: "Security-team queue and account lock procedure",
  R2_identity_access: "Verified identity-recovery flow (e.g. email/MFA token)",
  R3_irreversible_financial: "Authorized financial-approval process",
  R4_sensitive_data: "Authorized, permission-scoped data access",
  R5_policy_unclear: "Authoritative, codified policy",
  R6_outcome_unverifiable: "Objective outcome check",
};

const RESTRICTION_ACTION: Record<RestrictionCode, string> = {
  R1_account_compromise: "Keep security-led handling; improve triage tooling only.",
  R2_identity_access: "Prepare and validate the verified recovery control before any automation build.",
  R3_irreversible_financial: "Define approval thresholds and the required human review step before automating resolution.",
  R4_sensitive_data: "Confirm requester authorization and data-permission scoping before building retrieval.",
  R5_policy_unclear: "Codify the authoritative policy before automating.",
  R6_outcome_unverifiable: "Define how a correct outcome will be verified before automating.",
};

const MODEL_DEPENDENCY: Partial<Record<ModelOutcome, string>> = {
  deterministic: "Integration with the required systems and rule regression tests",
  ai_assisted: "Agent review-and-approve step for AI suggestions",
  ai_autonomous: "Approved grounding content, scope limits and confidence-based handoff",
};

function sortedRestrictions(it: PortfolioItem) {
  const rs = it.result?.restrictions ?? [];
  return [...rs].sort((a, b) => RESTRICTION_ORDER.indexOf(a.code) - RESTRICTION_ORDER.indexOf(b.code));
}

function dependencyFor(it: PortfolioItem): Dependency | null {
  const r = sortedRestrictions(it)[0];
  if (r) return { text: RESTRICTION_DEPENDENCY[r.code], source: "restriction" };
  const m = it.result?.model;
  const eff = it.result?.scores.effort;
  if (eff != null && eff >= PHASE_RULES.nextMaxEffortExclusive) return { text: `Integration, data and process preparation (effort score ${eff})`, source: "inferred" };
  const t = m ? MODEL_DEPENDENCY[m] : undefined;
  return t ? { text: t, source: "inferred" } : null;
}

export function planEntry(it: PortfolioItem): RoadmapEntry {
  const res = it.result;
  const rs = sortedRestrictions(it);
  const base = {
    id: it.id,
    name: it.name,
    model: res?.model ?? null,
    risk: res?.scores.risk ?? null,
    primary_risk: rs[0]?.label ?? null,
    restrictions: rs.map((r) => r.label),
    required_controls: res?.controls ?? [],
    dependency: dependencyFor(it),
  };
  const blank = { priority: null, effort: null, net_hours: null, gross_hours: null };

  if (it.status !== "assessed" || !res) {
    const reason =
      it.status === "stale" ? "Workflow details changed after the last saved assessment; the saved result is not current."
      : it.status === "incomplete" ? "Assessment is incomplete; no priority or impact is assigned."
      : "Not yet assessed.";
    const action = it.status === "stale" ? "Re-assess this workflow to restore a current result." : "Complete the assessment.";
    return { ...base, ...blank, section: "reassess", reason, next_action: action, model: null, risk: null, primary_risk: null, restrictions: [], required_controls: [], dependency: null };
  }
  if (res.model === "human_led") {
    const reason = rs[0] ? `Safety restriction: ${rs[0].label}. ${rs[0].effect}` : res.limits[0]?.text ?? `Operational risk ${res.scores.risk} requires human handling.`;
    return { ...base, ...blank, section: "human_led", reason, next_action: res.next_step.text, effort: res.scores.effort };
  }
  if (res.priority.category !== "automation_candidate" || res.priority.score == null || res.impact.net_hours == null) {
    const reason = res.model === "insufficient_data" ? "Insufficient data to recommend an operating model." : `Impact estimate unavailable (missing: ${res.impact.missing.join(", ") || "assumptions"}); not ranked.`;
    return { ...base, ...blank, section: "reassess", reason, next_action: "Provide the missing assessment inputs." };
  }

  const p = res.priority.score, e = res.scores.effort!, net = res.impact.net_hours;
  const R = PHASE_RULES;
  let section: Lane, reason: string;
  if (net <= 0) {
    section = "later";
    reason = `Modeled net hours are ${net} (review effort meets or exceeds gross savings).`;
  } else if (p >= R.nowMinPriority && e < R.nowMaxEffortExclusive) {
    section = "now";
    reason = `Priority ${p} ≥ ${R.nowMinPriority} and effort ${e} < ${R.nowMaxEffortExclusive}.`;
  } else if (p >= R.nextMinPriority && e < R.nextMaxEffortExclusive) {
    section = "next";
    reason = p < R.nowMinPriority ? `Priority ${p} is below ${R.nowMinPriority}; good but less compelling value.` : `Effort ${e} ≥ ${R.nowMaxEffortExclusive}; more preparation needed.`;
  } else {
    section = "later";
    reason = p < R.nextMinPriority ? `Priority ${p} is below ${R.nextMinPriority}.` : `Effort ${e} ≥ ${R.nextMaxEffortExclusive}; complex implementation.`;
  }
  const next_action = rs[0] ? RESTRICTION_ACTION[rs[0].code] : res.next_step.text;
  return { ...base, section, reason, next_action, priority: p, effort: e, net_hours: net, gross_hours: res.impact.gross_hours };
}

export interface Roadmap {
  version: string;
  entries: Record<Section, RoadmapEntry[]>;
  totals: Record<Lane, { count: number; net: number; gross: number }> & { all: { count: number; net: number; gross: number } };
  assessedCount: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function buildRoadmap(items: PortfolioItem[]): Roadmap {
  const entries: Record<Section, RoadmapEntry[]> = { now: [], next: [], later: [], human_led: [], reassess: [] };
  for (const it of items) { const e = planEntry(it); entries[e.section].push(e); }
  for (const k of ["now", "next", "later"] as Lane[])
    entries[k].sort((a, b) => b.priority! - a.priority! || a.name.localeCompare(b.name));
  entries.human_led.sort((a, b) => a.name.localeCompare(b.name));
  entries.reassess.sort((a, b) => a.name.localeCompare(b.name));
  const tot = (l: RoadmapEntry[]) => ({ count: l.length, net: r2(l.reduce((s, x) => s + x.net_hours!, 0)), gross: r2(l.reduce((s, x) => s + (x.gross_hours ?? 0), 0)) });
  const now = tot(entries.now), next = tot(entries.next), later = tot(entries.later);
  return {
    version: ROADMAP_VERSION,
    entries,
    totals: { now, next, later, all: tot([...entries.now, ...entries.next, ...entries.later]) },
    assessedCount: items.filter((x) => x.status === "assessed").length,
  };
}
