import type { FactorKey } from "./types";

export interface FactorDef {
  key: FactorKey;
  dimension: "suitability" | "risk" | "effort";
  label: string;
  weight: number; // fraction, weights per dimension sum to 1
  description: string;
  anchors: [string, string, string, string, string]; // 0..4
}

// Suitability: higher = more suitable. Risk: higher = more risk. Effort: higher = more effort ("gaps").
export const FACTORS: FactorDef[] = [
  { key: "repetitiveness", dimension: "suitability", label: "Repetitiveness", weight: 0.2,
    description: "How often requests in this workflow follow the same pattern.",
    anchors: ["Every case is unique", "Few recurring patterns", "About half recur", "Mostly recurring", "Nearly identical every time"] },
  { key: "process_standardization", dimension: "suitability", label: "Process standardization", weight: 0.2,
    description: "Whether agents follow a single documented procedure.",
    anchors: ["No defined process", "Tribal knowledge", "Partly documented", "Documented, minor variation", "Single documented procedure"] },
  { key: "policy_clarity", dimension: "suitability", label: "Policy clarity", weight: 0.15,
    description: "How unambiguous the governing policy is.",
    anchors: ["No policy / contradictory", "Vague policy", "Policy with frequent interpretation", "Clear with rare edge cases", "Fully explicit rules"] },
  { key: "input_predictability", dimension: "suitability", label: "Input predictability", weight: 0.15,
    description: "How predictable the customer's request content is.",
    anchors: ["Free-form, unpredictable", "Highly variable", "Moderately variable", "Mostly predictable", "Structured / form-like"] },
  { key: "outcome_verifiability", dimension: "suitability", label: "Outcome verifiability", weight: 0.15,
    description: "Whether a correct outcome can be objectively checked. ≤1 triggers restriction R6.",
    anchors: ["Cannot be verified", "Only by expert review", "Partly verifiable", "Verifiable with a check", "System-confirmed outcome"] },
  { key: "structured_data", dimension: "suitability", label: "Structured-data availability", weight: 0.1,
    description: "Whether required data exists in structured systems.",
    anchors: ["Not captured", "Scattered notes", "Partly structured", "Mostly structured", "Fully structured via API"] },
  { key: "low_exception_frequency", dimension: "suitability", label: "Low exception frequency", weight: 0.05,
    description: "Higher = fewer exceptions.",
    anchors: [">50% exceptions", "25–50%", "10–25%", "5–10%", "<5% exceptions"] },

  { key: "consequence_of_error", dimension: "risk", label: "Consequence of error", weight: 0.2,
    description: "Customer or business impact if the outcome is wrong.",
    anchors: ["Negligible", "Minor inconvenience", "Noticeable impact", "Significant harm", "Severe / contractual harm"] },
  { key: "irreversibility", dimension: "risk", label: "Irreversibility", weight: 0.15,
    description: "How hard the action is to undo. Must be ≥3 for irreversible/financial actions, ≤1 for read-only.",
    anchors: ["Nothing to undo", "Trivially undone", "Undone with effort", "Hard to undo", "Cannot be undone"] },
  { key: "financial_consequence", dimension: "risk", label: "Financial consequences", weight: 0.15,
    description: "Money at stake. Must be ≥2 for financial transactions.",
    anchors: ["None", "Trivial", "Moderate", "Material", "High value"] },
  { key: "account_security_sensitivity", dimension: "risk", label: "Account-security sensitivity", weight: 0.15,
    description: "Exposure of credentials or account access. Must be ≥3 when the workflow handles account access.",
    anchors: ["None", "Low", "Moderate", "High", "Critical"] },
  { key: "privacy_sensitivity", dimension: "risk", label: "Privacy / data sensitivity", weight: 0.1,
    description: "Personal or confidential data involved. Must be ≥2 when sensitive data is accessed.",
    anchors: ["None", "Low", "Moderate", "High", "Regulated / critical"] },
  { key: "human_judgment", dimension: "risk", label: "Required human judgment", weight: 0.1,
    description: "Degree of discretionary judgment. 4 forces Human-Led.",
    anchors: ["None", "Minimal", "Some", "Substantial", "Essential"] },
  { key: "escalation_sensitivity", dimension: "risk", label: "Escalation / customer-impact sensitivity", weight: 0.15,
    description: "Likelihood that mishandling escalates or damages the relationship.",
    anchors: ["None", "Low", "Moderate", "High", "Critical accounts / exec visibility"] },

  { key: "integration_complexity", dimension: "effort", label: "Integration complexity", weight: 0.3,
    description: "Systems and permissions needed to implement.",
    anchors: ["No integration", "One existing API", "Two systems", "Several systems / new APIs", "Major new integration"] },
  { key: "data_readiness_gap", dimension: "effort", label: "Data readiness gap", weight: 0.2,
    description: "Work needed to make data usable.",
    anchors: ["Ready", "Minor cleanup", "Moderate gaps", "Significant gaps", "Data not captured"] },
  { key: "process_maturity_gap", dimension: "effort", label: "Process maturity gap", weight: 0.2,
    description: "Work needed to standardize the process.",
    anchors: ["Mature", "Minor tweaks", "Moderate redesign", "Significant redesign", "Undefined"] },
  { key: "policy_maturity_gap", dimension: "effort", label: "Policy maturity gap", weight: 0.2,
    description: "Work needed to codify policy.",
    anchors: ["Codified", "Minor updates", "Moderate rewrite", "Significant authoring", "No policy"] },
  { key: "tool_fragmentation", dimension: "effort", label: "Tool / workflow fragmentation", weight: 0.1,
    description: "How many tools agents switch between.",
    anchors: ["Single tool", "Two tools", "Three tools", "Four+ tools", "Fragmented, manual handoffs"] },
];

export const FACTOR_BY_KEY: Record<FactorKey, FactorDef> = Object.fromEntries(
  FACTORS.map((f) => [f.key, f]),
) as Record<FactorKey, FactorDef>;

export const LANGUAGE_REASONING_ANCHORS = [
  "None (structured fields only)",
  "Minimal (simple keyword routing)",
  "Moderate (interpret short free text)",
  "High (multi-turn understanding)",
  "Very high (nuanced diagnosis / negotiation)",
] as const;
