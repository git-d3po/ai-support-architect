/**
 * Executive Assessment Report (pure, deterministic).
 * Assembles one coherent snapshot from existing modules: summarize(), buildRoadmap(), sharedDependencies(), analyzeDependencies().
 * Introduces no new scores, phases or impact formulas. Narrative is templated from structured findings only.
 */
import { summarize, type PortfolioItem } from "./portfolio";
import { buildRoadmap, type RoadmapEntry } from "./roadmap";
import { analyzeDependencies, sharedDependencies, PROVENANCE_LABEL, type SharedDependency } from "./blueprint";
import { MODEL_LABEL, SCORING_VERSION, type OperatingModel, type RestrictionCode } from "./types";
import { BLUEPRINT_VERSION } from "./blueprint";
import { ROADMAP_VERSION } from "./roadmap";

export const REPORT_VERSION = "report-1";

export interface ReportOrg {
  name: string;
  industry: string;
  support_agent_count: number;
  monthly_ticket_volume: number;
  support_channels: string[];
  synthetic: boolean;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const MODELS: OperatingModel[] = ["deterministic", "ai_assisted", "ai_autonomous", "human_led"];

export const MODEL_IMPLICATION: Record<OperatingModel, string> = {
  deterministic: "Standardized, predictable work suited to rules and authorized system actions. Traditional automation is preferable to generative AI here.",
  ai_assisted: "Language-heavy work where AI can classify, summarize and draft, while agents keep every decision and action.",
  ai_autonomous: "Low-risk informational requests that AI could resolve within approved content, strict scope limits and handoff rules. Conditional, not deployed.",
  human_led: "Work requiring judgment or carrying high risk. Kept with people by design; not a failed automation opportunity.",
};

export interface RiskGroup {
  code: RestrictionCode;
  label: string;
  effect: string;
  workflows: { id: string; name: string; humanLed: boolean }[];
  controls: string[];
}

export interface Report {
  version: string;
  scoring_version: string;
  roadmap_version: string;
  blueprint_version: string;
  org: ReportOrg;
  lineage: { id: string; name: string; status: string; revision: number | null }[];
  coverage: {
    workflows: number; current: number; incomplete: number; stale: number; notAssessed: number;
    classifiedVolume: number; otherIntentsVolume: number; overCommitted: boolean; orgVolume: number;
    observedInputs: number | null;
  };
  hasFindings: boolean;
  distribution: { model: OperatingModel; count: number; share: number | null; implication: string; workflows: string[] }[];
  impact: {
    gross: number; review: number; net: number; contributors: { id: string; name: string; gross: number; review: number; net: number }[];
    unavailable: { id: string; name: string }[]; negative: { id: string; name: string; net: number }[];
  };
  roadmap: { now: RoadmapEntry[]; next: RoadmapEntry[]; later: RoadmapEntry[]; humanLed: RoadmapEntry[]; reassess: RoadmapEntry[]; totals: ReturnType<typeof buildRoadmap>["totals"] };
  risks: RiskGroup[];
  unspecified: { id: string; name: string; text: string }[];
  shared: SharedDependency[];
  sequence: { define: string[]; prepare: string[]; pilot: string[]; expand: string[] };
  summary: string[];
}

const fmtH = (n: number) => Math.round(n).toLocaleString("en-US");

export function buildReport(org: ReportOrg, items: PortfolioItem[], provenance?: Record<string, string>): Report {
  const s = summarize(items, org.monthly_ticket_volume);
  const rm = buildRoadmap(items);
  const current = items.filter((x) => x.status === "assessed" && x.result);
  const count = (st: string) => items.filter((x) => x.status === st).length;

  const distribution = MODELS.map((m) => ({
    model: m, count: s.distribution[m],
    share: s.assessedCount ? s.distribution[m] / s.assessedCount : null,
    implication: MODEL_IMPLICATION[m],
    workflows: current.filter((x) => x.result!.model === m).map((x) => x.name).sort(),
  }));

  // Impact: same eligible population as summarize() (current, non-Human-Led, estimate available).
  const eligible = current.filter((x) => x.result!.model !== "human_led" && x.result!.impact.available);
  const contributors = eligible.map((x) => ({ id: x.id, name: x.name, gross: x.result!.impact.gross_hours!, review: x.result!.impact.review_hours ?? 0, net: x.result!.impact.net_hours! }))
    .sort((a, b) => b.net - a.net || a.name.localeCompare(b.name));
  const review = r2(contributors.reduce((a, c) => a + c.review, 0));
  const unavailable = current.filter((x) => x.result!.model !== "human_led" && !x.result!.impact.available).map((x) => ({ id: x.id, name: x.name }));
  const negative = contributors.filter((c) => c.net < 0).map((c) => ({ id: c.id, name: c.name, net: c.net }));

  // Risks: group by restriction code, each workflow once per group.
  const riskMap = new Map<RestrictionCode, RiskGroup>();
  for (const x of current) {
    for (const r of x.result!.restrictions) {
      const g = riskMap.get(r.code) ?? { code: r.code, label: r.label, effect: r.effect, workflows: [], controls: [] };
      if (!g.workflows.some((w) => w.id === x.id)) g.workflows.push({ id: x.id, name: x.name, humanLed: x.result!.model === "human_led" });
      riskMap.set(r.code, g);
    }
  }
  const CTRL: Record<RestrictionCode, string[]> = {
    R1_account_compromise: ["C_SECURITY_QUEUE"], R2_identity_access: ["C_VERIFIED_RECOVERY", "C_AUDIT_LOG", "C_NO_AI_ACCESS"],
    R3_irreversible_financial: ["C_HUMAN_APPROVAL"], R4_sensitive_data: ["C_PERMISSION_SCOPE"], R5_policy_unclear: ["C_POLICY_AUTHORING"], R6_outcome_unverifiable: ["C_OUTCOME_CHECK"],
  };
  for (const g of riskMap.values()) {
    const texts = new Set<string>();
    for (const x of current) for (const c of x.result!.controls) if (CTRL[g.code].includes(c.code)) texts.add(c.text);
    g.controls = [...texts];
    g.workflows.sort((a, b) => a.name.localeCompare(b.name));
  }
  const risks = [...riskMap.values()].sort((a, b) => b.workflows.length - a.workflows.length || a.code.localeCompare(b.code));

  const unspecified: Report["unspecified"] = [];
  for (const x of current) {
    for (const d of analyzeDependencies({ model: x.result!.model, restrictions: x.result!.restrictions.map((r) => r.code), attrs: x.attrs, inputs: x.inputs ?? null, required_systems: x.required_systems ?? [] }))
      if (d.provenance === "unspecified") unspecified.push({ id: x.id, name: x.name, text: d.text });
  }

  const shared = sharedDependencies(items);
  const now = rm.entries.now;
  const sequence = buildSequence(rm, current, unspecified, shared, items.length - current.length);

  const top = now.slice(0, 3);
  const summary: string[] = [];
  if (!current.length) {
    summary.push(`${org.name} has no current, complete workflow assessments, so no operating-model, impact or roadmap findings can be established yet.`);
  } else {
    const dist = distribution.filter((d) => d.count).map((d) => `${d.count} ${MODEL_LABEL[d.model]}`).join(", ");
    summary.push(`${s.assessedCount} of ${s.workflowCount} workflows have current, complete assessments, covering ${s.classifiedVolume.toLocaleString("en-US")} of ${org.monthly_ticket_volume.toLocaleString("en-US")} monthly tickets. Recommended operating models: ${dist}.`);
    summary.push(`Under the stated assumptions, these workflows model ${fmtH(s.grossHours)} gross and ${fmtH(s.netHours)} net handling-time hours per month after review effort. This is a scenario estimate, not observed production performance.`);
    if (top.length) summary.push(`Highest-priority opportunities (Now): ${top.map((e) => `${e.name} (${MODEL_LABEL[e.model as OperatingModel]}, priority ${e.priority})`).join("; ")}. Now means prioritize for preparation, not ready to deploy.`);
    if (risks.length) summary.push(`Most frequent mandatory restriction: ${risks[0]!.label.toLowerCase()} (${risks[0]!.workflows.length} workflows). Required controls are not assumed to be implemented.`);
    if (s.distribution.human_led) summary.push(`${s.distribution.human_led} workflow(s) remain Human-Led because of risk or required judgment.`);
  }
  if (count("stale") || count("incomplete") || count("not_assessed"))
    summary.push(`${count("stale") + count("incomplete") + count("not_assessed")} workflow(s) are stale, incomplete or not assessed and are excluded from these findings.`);

  const obs = provenance ? Object.values(provenance) : null;
  return {
    version: REPORT_VERSION, scoring_version: SCORING_VERSION, roadmap_version: ROADMAP_VERSION, blueprint_version: BLUEPRINT_VERSION,
    org,
    lineage: items.map((x) => ({ id: x.id, name: x.name, status: x.status, revision: x.revision ?? null })).sort((a, b) => a.name.localeCompare(b.name)),
    coverage: {
      workflows: s.workflowCount, current: s.assessedCount, incomplete: count("incomplete"), stale: count("stale"), notAssessed: count("not_assessed"),
      classifiedVolume: s.classifiedVolume, otherIntentsVolume: s.otherIntentsVolume, overCommitted: s.overCommitted, orgVolume: org.monthly_ticket_volume,
      observedInputs: obs ? obs.filter((p) => p === "observed").length : null,
    },
    hasFindings: current.length > 0,
    distribution,
    impact: { gross: s.grossHours, review, net: s.netHours, contributors, unavailable, negative },
    roadmap: { now: rm.entries.now, next: rm.entries.next, later: rm.entries.later, humanLed: rm.entries.human_led, reassess: rm.entries.reassess, totals: rm.totals },
    risks, unspecified, shared, sequence, summary,
  };
}

type Sequence = Report["sequence"];
const names = (es: { name: string }[]) => es.map((e) => e.name).join(", ");

/**
 * Deterministic Define/Prepare/Pilot/Expand guidance. Branches on which roadmap lanes actually contain
 * current candidates, so it never references a nonexistent phase. Content comes only from roadmap entries
 * (restrictions, required controls) and analyzeDependencies(); nothing is marked as implemented.
 */
export function buildSequence(
  rm: ReturnType<typeof buildRoadmap>, current: PortfolioItem[],
  unspecified: Report["unspecified"], shared: SharedDependency[], excluded: number,
): Sequence {
  const { now, next, later, human_led: hl } = rm.entries;
  const unspecLine = unspecified.length
    ? [`Resolve ${unspecified.length} unspecified item(s) identified in the assessment (e.g. ${unspecified[0]!.text.toLowerCase()} for ${unspecified[0]!.name}).`] : [];

  if (!now.length && !next.length && !later.length) {
    if (hl.length) return {
      define: [`All current assessments are Human-Led (${names(hl)}). No automation implementation is proposed; review whether agent tooling or manual-process improvement is warranted.`, ...unspecLine],
      prepare: ["No automation preparation is proposed: there are no automation candidates."],
      pilot: ["No pilot is proposed: there are no automation candidates."],
      expand: ["No expansion is proposed. Re-assess if volume, action type, data access or policy change."],
    };
    const na = "Not applicable until at least one current, complete assessment exists.";
    return {
      define: [excluded ? `No current, complete assessments. Complete or refresh the ${excluded} stale, incomplete or unassessed workflow(s) before planning implementation.` : "No workflows have been assessed. Add and assess workflows before planning implementation."],
      prepare: [na], pilot: [na], expand: [na],
    };
  }

  const lane = now.length ? "Now" : next.length ? "Next" : "Later";
  const focus = now.length ? now : next.length ? next : later;
  const byId = new Map(current.map((x) => [x.id, x]));
  const valueGaps = focus.filter((e) => e.net_hours == null || e.net_hours <= 0);

  const define: string[] = lane === "Now"
    ? [`Confirm scope, exceptions, process ownership and approval boundaries for the Now candidates: ${names(focus)}.`]
    : lane === "Next"
      ? [`There are no Now candidates. Confirm scope, exceptions, process ownership and approval boundaries for the Next candidates: ${names(focus)}.`]
      : [`Review deferred opportunities (${names(focus)}) and identify whether changes in required controls, implementation effort, or modeled business value would justify reassessment. No near-term automation implementation is currently recommended.`];
  if (valueGaps.length) define.push(`Modeled net value is zero, negative or unavailable for ${names(valueGaps)}; confirm impact assumptions before further planning.`);
  define.push(...unspecLine);

  const prepare: string[] = [];
  if (lane === "Later") prepare.push("Only if reassessment is pursued, these prerequisites from the assessment would apply:");
  for (const e of focus.slice(0, 6)) {
    const x = byId.get(e.id);
    const deps = x ? analyzeDependencies({ model: x.result!.model, restrictions: x.result!.restrictions.map((r) => r.code), attrs: x.attrs, inputs: x.inputs ?? null, required_systems: x.required_systems ?? [] })
      .filter((d) => d.provenance !== "unspecified") : [];
    const parts: string[] = [];
    if (e.required_controls.length) parts.push(`establish ${e.required_controls.length} required control(s), status unverified: ${e.required_controls.map((c) => c.text.replace(/\.$/, "")).join("; ")}`);
    const other = deps.filter((d) => d.provenance !== "mandatory");
    if (other.length) parts.push(`address ${other.map((d) => `${d.text.replace(/\.$/, "")} (${PROVENANCE_LABEL[d.provenance].toLowerCase()})`).join("; ")}`);
    if (parts.length) prepare.push(`${e.name}: ${parts.join(". Also ")}.`);
  }
  if (prepare.length <= (lane === "Later" ? 1 : 0))
    prepare.splice(0, prepare.length, `No mandatory controls or documented dependencies were identified for the ${lane} candidates; confirm against each blueprint before building.`);
  const focusIds = new Set(focus.map((e) => e.id));
  for (const d of shared) {
    const n = d.workflows.filter((w) => !w.humanLed && focusIds.has(w.id)).length;
    if (n >= 2 && prepare.length < 10) prepare.push(`Shared need across ${n} ${lane} candidates: ${d.action}`);
  }

  const restrictedNow = now.filter((e) => e.restrictions.length > 0);
  const freeNow = now.filter((e) => !e.restrictions.length);
  const pilot = lane === "Now"
    ? [ ...(freeNow.length ? [`Pilot unrestricted Now candidates first (${names(freeNow)}), with human oversight and measured outcomes.`] : []),
        ...(restrictedNow.length ? [`Pilot restricted candidates (${names(restrictedNow)}) only after their mandatory controls are in place and verified.`] : []) ]
    : lane === "Next"
      ? ["No pilot is proposed yet. Next candidates need the preparation above first; re-assess once prerequisites are addressed."]
      : ["No pilot is proposed: all automation candidates are deferred (Later)."];
  const expand = lane === "Later"
    ? ["No expansion is proposed while all candidates are deferred. Re-assess when volume, action type, data access, controls or policy change."]
    : ["Consider broader operation only after pilot validation criteria are met and controls remain effective.", "Re-assess workflows when volume, action type, data access or policy change."];
  return { define, prepare, pilot, expand };
}
