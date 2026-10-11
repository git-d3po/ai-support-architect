import { describe, expect, it } from "vitest";
import { analyzeDependencies, buildBlueprint, sharedDependencies, type Blueprint } from "./blueprint";
import { buildRoadmap } from "./roadmap";
import { summarize } from "./portfolio";
import { getDemoRows } from "@/lib/demo";
import { getNorthstarWorkflow } from "@/fixtures/northstar";
import { assess } from "./engine";

function bpFor(id: string, status: "assessed" | "stale" | "incomplete" = "assessed") {
  const w = getNorthstarWorkflow(id)!;
  const result = assess(w.attrs, w.inputs);
  return { w, result, bp: buildBlueprint({ name: w.name, description: w.description, required_systems: w.required_systems, attrs: w.attrs, inputs: w.inputs, result, status, revision: null }) };
}
const cur = (b: Blueprint) => { if (!b.current) throw new Error("not current"); return b; };
const byModel = (m: string) => getDemoRows().find((r) => r.result?.model === m)!.id;

describe("blueprint", () => {
  it("each operating model produces a blueprint matching its model", () => {
    for (const m of ["deterministic", "ai_assisted", "ai_autonomous", "human_led"]) {
      const b = cur(bpFor(byModel(m)).bp);
      expect(b.model).toBe(m);
      expect(b.sequence.length).toBeGreaterThan(0);
    }
  });

  it("deterministic (password reset) has no generative-AI responsibilities and keeps identity controls", () => {
    const b = cur(bpFor("password-reset").bp);
    expect(b.model).toBe("deterministic");
    expect(b.responsibilities.ai).toEqual([]);
    expect(b.sequence.some((s) => s.kind === "ai")).toBe(false);
    expect(b.matrix.prohibited.join(" ")).toMatch(/verified recovery/i);
    expect(b.dependencies.some((d) => d.key === "security:recovery" && d.provenance === "mandatory")).toBe(true);
  });

  it("AI-assisted keeps human authority; refund keeps financial approval", () => {
    const b = cur(bpFor("refund-request").bp);
    expect(b.model).toBe("ai_assisted");
    expect(b.responsibilities.human.join(" ")).toMatch(/approve/i);
    expect(b.matrix.approval.join(" ")).toMatch(/financial/i);
    expect(b.matrix.prohibited.join(" ")).toMatch(/financial.*without human approval/i);
  });

  it("bounded autonomous preserves permission limits and escalation", () => {
    const b = cur(bpFor("product-how-to").bp);
    expect(b.model).toBe("ai_autonomous");
    expect(b.matrix.prohibited.join(" ")).toMatch(/Irreversible, financial or account actions by AI/);
    expect(b.matrix.escalation.join(" ")).toMatch(/Low confidence/);
  });

  it("Human-Led (suspicious activity) gets no automated execution", () => {
    const b = cur(bpFor("suspicious-activity").bp);
    expect(b.model).toBe("human_led");
    expect(b.matrix.automated).toEqual([]);
    expect(b.responsibilities.ai).toEqual([]);
    expect(b.approach.pilot[0]).toMatch(/Not proposed/);
    expect(b.sequence.some((s) => s.kind === "escalate")).toBe(true);
  });

  it("mandatory restrictions appear as mandatory safeguards and block pilot", () => {
    const { bp, result } = bpFor("invoice-copy");
    const b = cur(bp);
    expect(result.restrictions.length).toBeGreaterThan(0);
    expect(b.matrix.safeguards.some((s) => s.code === "C_PERMISSION_SCOPE" && s.provenance === "mandatory")).toBe(true);
    expect(b.approach.pilotBlockedBy.length).toBeGreaterThan(0);
  });

  it("provenance distinguishes assessment-derived from inference", () => {
    const b = cur(bpFor("product-how-to").bp);
    const prov = new Set(b.dependencies.map((d) => d.provenance));
    expect(prov.has("assessment")).toBe(true); // required systems listed
    expect(prov.has("inference")).toBe(true);
  });

  it("unknown inputs produce 'unspecified', not fabricated integrations or completion", () => {
    const w = getNorthstarWorkflow("password-reset")!;
    const inputs = structuredClone(w.inputs);
    inputs.attributes.verified_recovery_control = null;
    inputs.attributes.authoritative_policy_available = null;
    const deps = analyzeDependencies({ model: "deterministic", restrictions: ["R2_identity_access"], attrs: w.attrs, inputs, required_systems: [] });
    expect(deps.find((d) => d.key === "systems:unspecified")?.provenance).toBe("unspecified");
    expect(deps.find((d) => d.key === "security:recovery-unknown")?.provenance).toBe("unspecified");
    expect(deps.filter((d) => d.category === "systems").every((d) => d.provenance === "unspecified")).toBe(true);
    for (const d of deps) expect(Object.keys(d).sort()).toEqual(["category", "key", "provenance", "text"]);
  });

  it("deduplicates equivalent dependencies (repeated / differently cased systems)", () => {
    const w = getNorthstarWorkflow("invoice-copy")!;
    const deps = analyzeDependencies({ model: "deterministic", restrictions: ["R4_sensitive_data", "R4_sensitive_data"], attrs: w.attrs, inputs: w.inputs, required_systems: ["Billing", " Billing", "billing"] });
    expect(deps.filter((d) => d.key.startsWith("systems:billing"))).toHaveLength(1);
    expect(deps.filter((d) => d.key === "data:permission")).toHaveLength(1);
  });

  it("shared dependency counts match their workflow sets with no double counting", () => {
    const items = getDemoRows();
    const shared = sharedDependencies(items);
    for (const s of shared) {
      expect(new Set(s.workflows.map((w) => w.id)).size).toBe(s.workflows.length);
      const expected = items.filter((it) => it.result && analyzeDependencies({ model: it.result.model, restrictions: it.result.restrictions.map((r) => r.code), attrs: it.attrs, inputs: it.inputs ?? null, required_systems: it.required_systems ?? [] }).some((d) => d.category === s.category));
      expect(s.workflows.map((w) => w.id).sort()).toEqual(expected.map((e) => e.id).sort());
    }
    const sec = shared.find((s) => s.category === "security")!;
    expect(sec.workflows.some((w) => w.id === "password-reset")).toBe(true);
  });

  it("stale and incomplete assessments do not produce a current blueprint", () => {
    for (const st of ["stale", "incomplete"] as const) {
      const b = bpFor("product-how-to", st).bp;
      expect(b.current).toBe(false);
      expect(JSON.stringify(b)).not.toMatch(/ai_autonomous|priority/);
    }
    const items = getDemoRows().map((x) => (x.id === "password-reset" ? { ...x, status: "stale" as const } : x));
    expect(sharedDependencies(items).some((s) => s.workflows.some((w) => w.id === "password-reset"))).toBe(false);
  });

  it("identical inputs and versions produce identical output", () => {
    expect(JSON.stringify(bpFor("refund-request").bp)).toBe(JSON.stringify(bpFor("refund-request").bp));
    expect(JSON.stringify(sharedDependencies(getDemoRows()))).toBe(JSON.stringify(sharedDependencies(getDemoRows())));
  });

  it("Northstar baseline unchanged; blueprint phase matches roadmap", () => {
    const items = getDemoRows();
    const s = summarize(items, 18000);
    expect(s.distribution).toMatchObject({ deterministic: 4, ai_assisted: 6, ai_autonomous: 2, human_led: 3 });
    expect([Math.round(s.grossHours), Math.round(s.netHours)]).toEqual([755, 616]);
    const rm = buildRoadmap(items);
    expect([rm.totals.now.count, rm.totals.next.count, rm.totals.later.count, rm.entries.human_led.length]).toEqual([4, 3, 5, 3]);
    for (const l of ["now", "next", "later", "human_led"] as const)
      for (const e of rm.entries[l]) expect(cur(bpFor(e.id).bp).phase).toBe(l);
  });
});
