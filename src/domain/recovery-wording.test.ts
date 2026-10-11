import { describe, it, expect } from "vitest";
import { getNorthstarWorkflow } from "@/fixtures/northstar";
import { assess } from "./engine";

describe("password reset: declared vs verified recovery control", () => {
  const w = getNorthstarWorkflow("password-reset")!;

  it("keeps recommendation, scores and controls; wording marks a declaration", () => {
    const r = assess(w.attrs, w.inputs);
    expect(r.model).toBe("deterministic");
    expect(r.scores).toEqual({ suitability: 99, risk: 34, effort: 15 });
    expect((r.priority as { score: number | null }).score).toBe(79);
    expect(r.controls.map((c) => c.code)).toContain("C_VERIFIED_RECOVERY");
    const d = r.drivers.find((x) => x.code === "D_VERIFIED_RECOVERY")!;
    expect(d.text).toMatch(/marked present in assessment inputs; not independently verified/);
  });

  it("true / false / unknown keep their decision behavior", () => {
    const run = (v: boolean | null) => {
      const i = structuredClone(w.inputs);
      i.attributes.verified_recovery_control = v;
      return assess(w.attrs, i).model;
    };
    expect(run(true)).toBe("deterministic");
    expect(run(false)).toBe("human_led");
    expect(run(null)).toBe("insufficient_data");
  });
});

describe("policy/data/process index (control_readiness) unchanged", () => {
  it("password reset index stays 92", () => {
    const w = getNorthstarWorkflow("password-reset")!;
    expect(assess(w.attrs, w.inputs).priority.control_readiness).toBe(92);
  });
});
