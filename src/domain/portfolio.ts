import type { AssessmentResult, ModelOutcome, WorkflowAttributes } from "./types";
import { SCORING_VERSION } from "./types";

export type AssessmentStatus = "not_assessed" | "incomplete" | "stale" | "assessed";

export function deriveStatus(
  result: AssessmentResult | null,
  snapshotAttrVersion: number | null,
  currentAttrVersion: number | null,
  scoringVersion: string | null = result?.scoring_version ?? null,
): AssessmentStatus {
  if (!result) return "not_assessed";
  if (
    (snapshotAttrVersion != null && currentAttrVersion != null && snapshotAttrVersion !== currentAttrVersion) ||
    scoringVersion !== SCORING_VERSION
  )
    return "stale";
  if (!result.complete) return "incomplete";
  return "assessed";
}

export const STATUS_LABEL: Record<AssessmentStatus, string> = {
  not_assessed: "Not assessed",
  incomplete: "Incomplete",
  stale: "Stale",
  assessed: "Assessed",
};

export interface PortfolioItem {
  id: string;
  name: string;
  attrs: WorkflowAttributes;
  result: AssessmentResult | null;
  status: AssessmentStatus;
}

export interface PortfolioSummary {
  workflowCount: number;
  assessedCount: number;
  excludedCount: number; // stale / incomplete / not assessed
  classifiedVolume: number; // sum of all workflow volumes (mutually exclusive intents)
  orgVolume: number;
  otherIntentsVolume: number;
  overCommitted: boolean; // sum of intents exceeds org volume
  distribution: Record<ModelOutcome, number>;
  grossHours: number;
  netHours: number;
  impactAvailableCount: number;
  candidates: PortfolioItem[]; // ranked automation candidates
  restrictionCounts: Record<string, number>;
}

export function summarize(items: PortfolioItem[], orgVolume: number): PortfolioSummary {
  const distribution: Record<ModelOutcome, number> = {
    deterministic: 0, ai_assisted: 0, ai_autonomous: 0, human_led: 0, insufficient_data: 0,
  };
  let grossHours = 0, netHours = 0, impactAvailableCount = 0, assessedCount = 0;
  const restrictionCounts: Record<string, number> = {};
  const classifiedVolume = items.reduce((a, x) => a + x.attrs.monthly_volume, 0);
  for (const it of items) {
    if (it.status !== "assessed" || !it.result) continue;
    assessedCount++;
    distribution[it.result.model]++;
    for (const r of it.result.restrictions) restrictionCounts[r.label] = (restrictionCounts[r.label] ?? 0) + 1;
    if (it.result.model !== "human_led" && it.result.impact.available) {
      grossHours += it.result.impact.gross_hours!;
      netHours += it.result.impact.net_hours!;
      impactAvailableCount++;
    }
  }
  const candidates = items
    .filter((x) => x.status === "assessed" && x.result?.priority.category === "automation_candidate")
    .sort((a, b) => b.result!.priority.score! - a.result!.priority.score! || a.name.localeCompare(b.name));
  return {
    workflowCount: items.length,
    assessedCount,
    excludedCount: items.length - assessedCount,
    classifiedVolume,
    orgVolume,
    otherIntentsVolume: Math.max(0, orgVolume - classifiedVolume),
    overCommitted: classifiedVolume > orgVolume,
    distribution,
    grossHours: Math.round(grossHours * 100) / 100,
    netHours: Math.round(netHours * 100) / 100,
    impactAvailableCount,
    candidates,
    restrictionCounts,
  };
}
