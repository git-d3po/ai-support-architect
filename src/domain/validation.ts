import { z } from "zod";
import type { AssessmentInputs, ValidationError, WorkflowAttributes } from "./types";
import { ALL_FACTORS } from "./types";

const ordinal = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).nullable();
const fraction = z.number().min(0).max(1).nullable();

export const assessmentInputsSchema = z
  .object({
    factors: z.object(Object.fromEntries(ALL_FACTORS.map((k) => [k, ordinal.optional()]))).strict(),
    attributes: z
      .object({
        language_reasoning: ordinal,
        authoritative_policy_available: z.boolean().nullable(),
        verified_recovery_control: z.boolean().nullable(),
      })
      .strict(),
    declared: z
      .object({
        suspected_account_compromise: z.boolean(),
        other_declared_risk: z.string().max(500).nullable(),
      })
      .strict(),
    impact: z
      .object({
        addressable_fraction: fraction,
        coverage: fraction,
        expected_reduction: fraction,
        reviewed_fraction: fraction,
        review_minutes: z.number().min(0).max(240).nullable(),
      })
      .strict(),
  })
  .strict();

export const workflowAttributesSchema = z.object({
  monthly_volume: z.number().int().min(0).max(10_000_000),
  aht_minutes: z.number().gt(0).max(1440),
  action_type: z.enum(["read_only", "reversible_write", "irreversible_write", "financial_transaction"]),
  handles_account_access: z.boolean(),
  accesses_sensitive_data: z.boolean(),
});

/**
 * Cross-field consistency between authoritative workflow attributes and assessment inputs.
 * Contradictions are rejected so the engine never sees inputs that would produce different
 * recommendations depending on which field is checked.
 */
export function validateConsistency(w: WorkflowAttributes, i: AssessmentInputs): ValidationError[] {
  const e: ValidationError[] = [];
  const f = i.factors;
  const irr = f.irreversibility;
  if (irr != null) {
    if ((w.action_type === "irreversible_write" || w.action_type === "financial_transaction") && irr < 3)
      e.push({ field: "factors.irreversibility", message: "Irreversibility must be ≥3 for irreversible or financial actions." });
    if (w.action_type === "read_only" && irr > 1)
      e.push({ field: "factors.irreversibility", message: "Irreversibility must be ≤1 for read-only actions." });
  }
  if (w.action_type === "financial_transaction" && f.financial_consequence != null && f.financial_consequence < 2)
    e.push({ field: "factors.financial_consequence", message: "Financial consequences must be ≥2 for financial transactions." });
  if (w.handles_account_access && f.account_security_sensitivity != null && f.account_security_sensitivity < 3)
    e.push({ field: "factors.account_security_sensitivity", message: "Account-security sensitivity must be ≥3 when the workflow handles account access." });
  if (w.accesses_sensitive_data && f.privacy_sensitivity != null && f.privacy_sensitivity < 2)
    e.push({ field: "factors.privacy_sensitivity", message: "Privacy sensitivity must be ≥2 when sensitive data is accessed." });
  if (i.attributes.authoritative_policy_available === false && f.policy_clarity != null && f.policy_clarity > 2)
    e.push({ field: "factors.policy_clarity", message: "Policy clarity cannot exceed 2 when no authoritative policy is available." });
  if (!w.handles_account_access && i.attributes.verified_recovery_control === true)
    e.push({ field: "attributes.verified_recovery_control", message: "Verified recovery control applies only to workflows that handle account access." });
  if (i.impact.reviewed_fraction != null && i.impact.reviewed_fraction > 0 && i.impact.review_minutes === 0)
    e.push({ field: "impact.review_minutes", message: "Review minutes must be >0 when cases are reviewed." });
  return e;
}
