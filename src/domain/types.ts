// Domain types. Pure TypeScript: no React, no database access.

export const SCORING_VERSION = "1.0.0";

export type Ordinal = 0 | 1 | 2 | 3 | 4;

export const SUITABILITY_FACTORS = [
  "repetitiveness",
  "process_standardization",
  "policy_clarity",
  "input_predictability",
  "outcome_verifiability",
  "structured_data",
  "low_exception_frequency",
] as const;

export const RISK_FACTORS = [
  "consequence_of_error",
  "irreversibility",
  "financial_consequence",
  "account_security_sensitivity",
  "privacy_sensitivity",
  "human_judgment",
  "escalation_sensitivity",
] as const;

export const EFFORT_FACTORS = [
  "integration_complexity",
  "data_readiness_gap",
  "process_maturity_gap",
  "policy_maturity_gap",
  "tool_fragmentation",
] as const;

export type SuitabilityFactor = (typeof SUITABILITY_FACTORS)[number];
export type RiskFactor = (typeof RISK_FACTORS)[number];
export type EffortFactor = (typeof EFFORT_FACTORS)[number];
export type FactorKey = SuitabilityFactor | RiskFactor | EffortFactor;
export const ALL_FACTORS: readonly FactorKey[] = [
  ...SUITABILITY_FACTORS,
  ...RISK_FACTORS,
  ...EFFORT_FACTORS,
];

export type ActionType = "read_only" | "reversible_write" | "irreversible_write" | "financial_transaction";
export type Category = "billing" | "accounts" | "product" | "technical" | "security";

/** Authoritative workflow-level attributes. Restrictions derived from these cannot be removed by assessment inputs. */
export interface WorkflowAttributes {
  monthly_volume: number;
  aht_minutes: number;
  action_type: ActionType;
  handles_account_access: boolean;
  accesses_sensitive_data: boolean;
}

export interface DecisionAttributes {
  language_reasoning: Ordinal | null;
  authoritative_policy_available: boolean | null;
  /** Only meaningful (and only required) when the workflow handles account access. */
  verified_recovery_control: boolean | null;
}

export interface DeclaredRisks {
  suspected_account_compromise: boolean;
  other_declared_risk: string | null;
}

/** All fractions are in [0,1]. null = not provided. */
export interface ImpactAssumptions {
  addressable_fraction: number | null;
  coverage: number | null;
  expected_reduction: number | null;
  reviewed_fraction: number | null;
  review_minutes: number | null;
}

export type Provenance = "observed" | "estimate" | "synthetic";

export interface AssessmentInputs {
  factors: Partial<Record<FactorKey, Ordinal | null>>;
  attributes: DecisionAttributes;
  declared: DeclaredRisks;
  impact: ImpactAssumptions;
}

export type OperatingModel = "deterministic" | "ai_assisted" | "ai_autonomous" | "human_led";
export type ModelOutcome = OperatingModel | "insufficient_data";

export type RestrictionCode =
  | "R1_account_compromise"
  | "R2_identity_access"
  | "R3_irreversible_financial"
  | "R4_sensitive_data"
  | "R5_policy_unclear"
  | "R6_outcome_unverifiable";

export interface Restriction {
  code: RestrictionCode;
  source: "declared" | "derived";
  label: string;
  effect: string;
}

export interface ExplanationItem {
  code: string;
  text: string;
}

export interface ImpactResult {
  available: boolean;
  missing: string[];
  eligible: number | null;
  affected: number | null;
  gross_hours: number | null;
  review_hours: number | null;
  net_hours: number | null;
  unfavorable: boolean;
}

export type CandidateCategory =
  | "automation_candidate"
  | "not_automation_candidate"
  | "needs_assessment"
  | "needs_reassessment"
  | "impact_unavailable";

export interface PriorityResult {
  category: CandidateCategory;
  control_process_improvement: boolean;
  score: number | null;
  impact_index: number | null;
  control_readiness: number | null;
}

export interface AssessmentResult {
  scoring_version: string;
  complete: boolean;
  missing: string[];
  scores: { suitability: number | null; risk: number | null; effort: number | null };
  model: ModelOutcome;
  rule: string;
  restrictions: Restriction[];
  drivers: ExplanationItem[];
  limits: ExplanationItem[];
  controls: ExplanationItem[];
  next_step: ExplanationItem;
  impact: ImpactResult;
  priority: PriorityResult;
}

export interface ValidationError {
  field: string;
  message: string;
}

export const MODEL_LABEL: Record<ModelOutcome, string> = {
  deterministic: "Deterministic Automation",
  ai_assisted: "AI-Assisted",
  ai_autonomous: "AI Autonomous (bounded)",
  human_led: "Human-Led",
  insufficient_data: "Insufficient Data",
};

export const ACTION_LABEL: Record<ActionType, string> = {
  read_only: "Read-only",
  reversible_write: "Reversible write",
  irreversible_write: "Irreversible write",
  financial_transaction: "Financial transaction",
};

export const CATEGORY_LABEL: Record<Category, string> = {
  billing: "Billing",
  accounts: "Accounts",
  product: "Product",
  technical: "Technical",
  security: "Security",
};

export function emptyInputs(): AssessmentInputs {
  return {
    factors: {},
    attributes: { language_reasoning: null, authoritative_policy_available: null, verified_recovery_control: null },
    declared: { suspected_account_compromise: false, other_declared_risk: null },
    impact: { addressable_fraction: null, coverage: null, expected_reduction: null, reviewed_fraction: null, review_minutes: null },
  };
}
