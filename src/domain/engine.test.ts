import { describe, expect, it } from "vitest";
import { assess, computeImpact, computeScores, decide, effectiveRestrictions, findMissing } from "./engine";
import { validateConsistency, assessmentInputsSchema } from "./validation";
import { summarize, deriveStatus } from "./portfolio";
import { futureState } from "./architecture";
import type { AssessmentInputs, Ordinal, WorkflowAttributes } from "./types";
import { ALL_FACTORS, emptyInputs } from "./types";
import { getNorthstarWorkflows, getNorthstarWorkflow, NORTHSTAR_ORG } from "@/fixtures/northstar";

const attrs = (o: Partial<WorkflowAttributes> = {}): WorkflowAttributes => ({
  monthly_volume: 1000, aht_minutes: 10, action_type: "read_only", handles_account_access: false, accesses_sensitive_data: false, ...o,
});
function inputs(fill: Ordinal, o: Partial<AssessmentInputs["factors"]> = {}, lang: Ordinal = 3): AssessmentInputs {
  const i = emptyInputs();
  for (const k of ALL_FACTORS) i.factors[k] = fill;
  Object.assign(i.factors, o);
  i.attributes = { language_reasoning: lang, authoritative_policy_available: true, verified_recovery_control: null };
  i.impact = { addressable_fraction: 0.8, coverage: 0.5, expected_reduction: 0.5, reviewed_fraction: 0.1, review_minutes: 2 };
  return i;
}
/** An "ideal informational" input: max suitability, minimal risk and effort. */
function ideal(lang: Ordinal = 3): AssessmentInputs {
  return inputs(4, {
    consequence_of_error: 0, irreversibility: 0, financial_consequence: 0, account_security_sensitivity: 0,
    privacy_sensitivity: 0, human_judgment: 0, escalation_sensitivity: 0,
    integration_complexity: 0, data_readiness_gap: 0, process_maturity_gap: 0, policy_maturity_gap: 0, tool_fragmentation: 0,
  }, lang);
}
const decideWith = (w: WorkflowAttributes, i: AssessmentInputs, s: number, r: number) =>
  decide(w, i, { suitability: s, risk: r, effort: 20 }, effectiveRestrictions(w, i), findMissing(w, i)).model;

describe("spec tests", () => {
  it("1. standardized, low-language workflow -> deterministic", () => {
    expect(assess(attrs(), ideal(0)).model).toBe("deterministic");
  });
  it("2. high suitability does not override high risk", () => {
    const i = inputs(4, { integration_complexity: 0 });
    const r = assess(attrs({ action_type: "reversible_write" }), i);
    expect(r.scores.suitability).toBe(100);
    expect(r.scores.risk).toBeGreaterThanOrEqual(70);
    expect(r.model).toBe("human_led");
  });
  it("3. account-security restriction prevents autonomy", () => {
    const i = ideal(3); i.factors.account_security_sensitivity = 3; i.attributes.verified_recovery_control = true;
    const r = assess(attrs({ handles_account_access: true }), i);
    expect(r.model).not.toBe("ai_autonomous");
  });
  it("4. irreversible financial action cannot be autonomous", () => {
    const i = ideal(3); i.factors.irreversibility = 3; i.factors.financial_consequence = 2;
    const r = assess(attrs({ action_type: "financial_transaction" }), i);
    expect(r.model).not.toBe("ai_autonomous");
    expect(r.controls.map((c) => c.code)).toContain("C_HUMAN_APPROVAL");
  });
  it("5. low-risk informational workflow can be bounded-autonomous", () => {
    expect(assess(attrs(), ideal(3)).model).toBe("ai_autonomous");
  });
  it("6. missing critical inputs prevent classification", () => {
    const i = ideal(3); i.factors.policy_clarity = null;
    const r = assess(attrs(), i);
    expect(r.model).toBe("insufficient_data");
    expect(r.missing).toContain("factors.policy_clarity");
    expect(r.scores.suitability).toBeNull();
    expect(r.priority.category).toBe("needs_assessment");
  });
  it("6b. missing values are never treated as zero", () => {
    const i = emptyInputs();
    expect(assess(attrs(), i).model).toBe("insufficient_data");
  });
  it("7. changing a factor changes scores deterministically", () => {
    const a = ideal(); const b = ideal(); b.factors.repetitiveness = 3;
    expect(computeScores(a).suitability! - computeScores(b).suitability!).toBe(5);
  });
  it("8. declaring a risk flag overrides the recommendation", () => {
    const i = ideal(3); expect(assess(attrs(), i).model).toBe("ai_autonomous");
    i.declared.suspected_account_compromise = true;
    expect(assess(attrs(), i).model).toBe("human_led");
  });
  it("9. identical inputs produce identical results", () => {
    for (const w of getNorthstarWorkflows()) expect(assess(w.attrs, w.inputs)).toEqual(assess(w.attrs, structuredClone(w.inputs)));
  });
  it("10. scores stay within 0–100", () => {
    for (const v of [0, 1, 2, 3, 4] as Ordinal[]) {
      const s = computeScores(inputs(v));
      for (const x of Object.values(s)) { expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(100); }
    }
    expect(computeScores(inputs(0)).suitability).toBe(0);
    expect(computeScores(inputs(4)).suitability).toBe(100);
  });
});

describe("threshold boundaries (via decide with explicit scores)", () => {
  const w = attrs();
  it("human-led at risk 70, not at 69", () => {
    expect(decideWith(w, ideal(3), 90, 70)).toBe("human_led");
    expect(decideWith(w, ideal(3), 90, 69)).toBe("ai_assisted");
  });
  it("deterministic at suitability 70, not 69", () => {
    expect(decideWith(w, ideal(0), 70, 20)).toBe("deterministic");
    expect(decideWith(w, ideal(0), 69, 20)).toBe("human_led");
  });
  it("deterministic requires risk < 50", () => {
    expect(decideWith(w, ideal(0), 90, 49)).toBe("deterministic");
    expect(decideWith(w, ideal(0), 90, 50)).toBe("human_led");
  });
  it("autonomy at suitability 75, not 74", () => {
    expect(decideWith(w, ideal(3), 75, 10)).toBe("ai_autonomous");
    expect(decideWith(w, ideal(3), 74, 10)).toBe("ai_assisted");
  });
  it("autonomy at risk 29/30, not 31", () => {
    expect(decideWith(w, ideal(3), 90, 29)).toBe("ai_autonomous");
    expect(decideWith(w, ideal(3), 90, 30)).toBe("ai_autonomous");
    expect(decideWith(w, ideal(3), 90, 31)).toBe("ai_assisted");
  });
  it("assisted at suitability 40, fallback at 39", () => {
    expect(decideWith(w, ideal(3), 40, 40)).toBe("ai_assisted");
    expect(decideWith(w, ideal(3), 39, 40)).toBe("human_led");
  });
  it("seed: API auth error at 74 suitability is assisted (one point below autonomy)", () => {
    const r = assess(getNorthstarWorkflow("api-authentication-error")!.attrs, getNorthstarWorkflow("api-authentication-error")!.inputs);
    expect(r.scores.suitability).toBe(74);
    expect(r.model).toBe("ai_assisted");
  });
});

describe("restrictions R1–R6 win at suitability 100", () => {
  const cases: Array<[string, WorkflowAttributes, (i: AssessmentInputs) => void]> = [
    ["R1", attrs(), (i) => (i.declared.suspected_account_compromise = true)],
    ["R2", attrs({ handles_account_access: true }), (i) => { i.factors.account_security_sensitivity = 3; i.attributes.verified_recovery_control = false; }],
    ["R3", attrs({ action_type: "financial_transaction" }), (i) => { i.factors.irreversibility = 3; i.factors.financial_consequence = 2; }],
    ["R4", attrs({ accesses_sensitive_data: true }), (i) => (i.factors.privacy_sensitivity = 2)],
    ["R5", attrs(), (i) => (i.attributes.authoritative_policy_available = false)],
    ["R6", attrs(), (i) => (i.factors.outcome_verifiability = 1)],
  ];
  for (const [code, w, mut] of cases) {
    it(`${code} blocks autonomy`, () => {
      const i = ideal(3); mut(i);
      if (code === "R5") i.factors.policy_clarity = 2;
      expect(decideWith(w, i, 100, 0)).not.toBe("ai_autonomous");
      expect(effectiveRestrictions(w, i).some((r) => r.code.startsWith(code))).toBe(true);
    });
  }
  it("R5/R6 also block deterministic", () => {
    const i = ideal(0); i.factors.outcome_verifiability = 1;
    expect(decideWith(attrs(), i, 100, 0)).toBe("human_led");
  });
  it("mandatory restrictions cannot be removed by inputs", () => {
    const i = ideal(3); i.factors.irreversibility = 3; i.factors.financial_consequence = 2;
    expect(effectiveRestrictions(attrs({ action_type: "financial_transaction" }), i).map((r) => r.code)).toContain("R3_irreversible_financial");
  });
});

describe("identity recovery", () => {
  const w = attrs({ handles_account_access: true, action_type: "reversible_write" });
  it("Human-Led without verified control, deterministic with it", () => {
    const i = ideal(0); i.factors.account_security_sensitivity = 3;
    i.attributes.verified_recovery_control = false;
    expect(assess(w, i).model).toBe("human_led");
    i.attributes.verified_recovery_control = true;
    const r = assess(w, i);
    expect(r.model).toBe("deterministic");
    expect(r.controls.map((c) => c.code)).toEqual(expect.arrayContaining(["C_VERIFIED_RECOVERY", "C_AUDIT_LOG", "C_NO_AI_ACCESS"]));
  });
  it("verified control is required input for account-access workflows", () => {
    const i = ideal(0); i.factors.account_security_sensitivity = 3;
    expect(findMissing(w, i)).toContain("attributes.verified_recovery_control");
  });
});

describe("consistency validation", () => {
  it("rejects contradictory attributes", () => {
    const i = ideal(3);
    expect(validateConsistency(attrs({ action_type: "financial_transaction" }), i).map((e) => e.field))
      .toEqual(expect.arrayContaining(["factors.irreversibility", "factors.financial_consequence"]));
    expect(validateConsistency(attrs({ handles_account_access: true }), i).map((e) => e.field)).toContain("factors.account_security_sensitivity");
    expect(validateConsistency(attrs({ accesses_sensitive_data: true }), i).map((e) => e.field)).toContain("factors.privacy_sensitivity");
    const p = ideal(3); p.attributes.authoritative_policy_available = false;
    expect(validateConsistency(attrs(), p).map((e) => e.field)).toContain("factors.policy_clarity");
    const ro = ideal(3); ro.factors.irreversibility = 3;
    expect(validateConsistency(attrs(), ro).map((e) => e.field)).toContain("factors.irreversibility");
  });
  it("seed fixture is internally consistent", () => {
    for (const w of getNorthstarWorkflows()) expect(validateConsistency(w.attrs, w.inputs)).toEqual([]);
  });
  it("schema rejects client-supplied result fields", () => {
    const i = ideal(3);
    expect(assessmentInputsSchema.safeParse(i).success).toBe(true);
    expect(assessmentInputsSchema.safeParse({ ...i, results: { model: "ai_autonomous" } }).success).toBe(false);
    expect(assessmentInputsSchema.safeParse({ ...i, factors: { ...i.factors, suitability_score: 100 } }).success).toBe(false);
  });
});

describe("impact", () => {
  it("computes the eligible -> affected -> gross -> review -> net chain", () => {
    const r = computeImpact(attrs({ monthly_volume: 1000, aht_minutes: 12 }), {
      ...ideal(), impact: { addressable_fraction: 0.5, coverage: 0.5, expected_reduction: 0.5, reviewed_fraction: 1, review_minutes: 1 },
    });
    expect(r).toMatchObject({ eligible: 500, affected: 250, gross_hours: 25, review_hours: 4.17, net_hours: 20.83, unfavorable: false });
  });
  it("missing assumptions -> estimate unavailable", () => {
    const i = ideal(); i.impact.coverage = null;
    const r = assess(attrs(), i);
    expect(r.impact.available).toBe(false);
    expect(r.impact.gross_hours).toBeNull();
    expect(r.priority.category).toBe("impact_unavailable");
    expect(r.priority.score).toBeNull();
  });
  it("negative net is visible, not clamped", () => {
    const i = ideal(); i.impact = { addressable_fraction: 1, coverage: 1, expected_reduction: 0.1, reviewed_fraction: 1, review_minutes: 5 };
    const r = assess(attrs({ aht_minutes: 10 }), i);
    expect(r.impact.net_hours).toBeLessThan(0);
    expect(r.impact.unfavorable).toBe(true);
    expect(r.priority.impact_index).toBe(0);
    expect(r.priority.category).toBe("automation_candidate");
  });
  it("impact index caps at 150 h", () => {
    const i = ideal(); i.impact = { addressable_fraction: 1, coverage: 1, expected_reduction: 1, reviewed_fraction: 0, review_minutes: 0 };
    expect(assess(attrs({ monthly_volume: 900, aht_minutes: 10 }), i).priority.impact_index).toBe(100); // 150 h
    expect(assess(attrs({ monthly_volume: 1800, aht_minutes: 10 }), i).priority.impact_index).toBe(100); // 300 h
  });
});

describe("portfolio and seed", () => {
  const items = getNorthstarWorkflows().map((w) => {
    const result = assess(w.attrs, w.inputs);
    return { id: w.id, name: w.name, attrs: w.attrs, result, status: deriveStatus(result, null, null) };
  });
  it("seed distribution regression snapshot", () => {
    expect(Object.fromEntries(items.map((x) => [x.id, x.result.model]))).toMatchInlineSnapshot(`
      {
        "api-authentication-error": "ai_assisted",
        "api-integration-troubleshooting": "ai_assisted",
        "billing-address-update": "deterministic",
        "data-export-request": "deterministic",
        "duplicate-charge": "ai_assisted",
        "failed-login": "ai_assisted",
        "feature-availability": "ai_autonomous",
        "invoice-copy": "deterministic",
        "password-reset": "deterministic",
        "plan-downgrade": "ai_assisted",
        "product-how-to": "ai_autonomous",
        "refund-request": "ai_assisted",
        "service-outage-escalation": "human_led",
        "subscription-cancellation": "human_led",
        "suspicious-activity": "human_led",
      }
    `);
  });
  it("volumes are mutually exclusive and within org volume", () => {
    const s = summarize(items, NORTHSTAR_ORG.monthly_ticket_volume);
    expect(s.classifiedVolume).toBe(15600);
    expect(s.otherIntentsVolume).toBe(2400);
    expect(s.overCommitted).toBe(false);
    expect(Object.values(s.distribution).reduce((a, b) => a + b, 0)).toBe(s.assessedCount);
  });
  it("aggregate net hours equals sum of non-human-led available items", () => {
    const s = summarize(items, 18000);
    const expected = items.filter((x) => x.result.model !== "human_led" && x.result.impact.available)
      .reduce((a, x) => a + x.result.impact.net_hours!, 0);
    expect(s.netHours).toBeCloseTo(expected, 2);
  });
  it("Human-Led workflows are never ranked as automation candidates", () => {
    const s = summarize(items, 18000);
    expect(s.candidates.some((c) => c.result!.model === "human_led")).toBe(false);
    expect(s.candidates.length).toBe(12);
  });
  it("stale and incomplete are excluded from aggregates", () => {
    const stale = items.map((x, idx) => (idx === 0 ? { ...x, status: deriveStatus(x.result, 1, 2) } : x));
    expect(stale[0]!.status).toBe("stale");
    const s = summarize(stale, 18000);
    expect(s.assessedCount).toBe(14);
    expect(s.candidates.some((c) => c.id === items[0]!.id)).toBe(false);
  });
  it("scoring version mismatch marks stale", () => {
    expect(deriveStatus(items[0]!.result, 1, 1, "0.9.0")).toBe("stale");
  });
});

describe("future-state architecture", () => {
  it("has no AI step for deterministic or human-led", () => {
    for (const id of ["invoice-copy", "suspicious-activity"]) {
      const w = getNorthstarWorkflow(id)!;
      expect(futureState(assess(w.attrs, w.inputs))!.some((s) => s.kind === "ai")).toBe(false);
    }
  });
  it("includes an approval gate for assisted refunds", () => {
    const w = getNorthstarWorkflow("refund-request")!;
    expect(futureState(assess(w.attrs, w.inputs))!.some((s) => s.kind === "gate")).toBe(true);
  });
});

describe("browser-test boundary fixture", () => {
  it("refund request crosses to Human-Led when escalation sensitivity rises to 4", () => {
    const w = getNorthstarWorkflow("refund-request")!;
    expect(assess(w.attrs, w.inputs).model).toBe("ai_assisted");
    const i = structuredClone(w.inputs); i.factors.escalation_sensitivity = 4;
    const r = assess(w.attrs, i);
    expect(r.scores.risk).toBeGreaterThanOrEqual(70);
    expect(r.model).toBe("human_led");
  });
});
