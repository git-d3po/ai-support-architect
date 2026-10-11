import { describe, expect, it } from "vitest";
import { buildReport } from "./report";
import { summarize, type PortfolioItem } from "./portfolio";
import { buildRoadmap } from "./roadmap";
import { getDemoRows } from "@/lib/demo";
import { NORTHSTAR_ORG } from "@/fixtures/northstar";
import type { AssessmentResult } from "./types";

const org = { ...NORTHSTAR_ORG, synthetic: true };
const demo = () => buildReport(org, getDemoRows());
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

describe("executive report", () => {
  it("Northstar reference values", () => {
    const r = demo();
    expect(r.coverage).toMatchObject({ workflows: 15, current: 15, stale: 0, incomplete: 0, classifiedVolume: 15600, otherIntentsVolume: 2400, orgVolume: 18000 });
    expect(Object.fromEntries(r.distribution.map((d) => [d.model, d.count]))).toEqual({ deterministic: 4, ai_assisted: 6, ai_autonomous: 2, human_led: 3 });
    expect([Math.round(r.impact.gross), Math.round(r.impact.net)]).toEqual([755, 616]);
    expect([r.roadmap.totals.now.count, Math.round(r.roadmap.totals.now.net), r.roadmap.totals.next.count, Math.round(r.roadmap.totals.next.net), r.roadmap.totals.later.count, Math.round(r.roadmap.totals.later.net), r.roadmap.humanLed.length]).toEqual([4, 408, 3, 93, 5, 115, 3]);
  });

  it("counts and impact reconcile with authoritative aggregates", () => {
    const items = getDemoRows(); const r = buildReport(org, items); const s = summarize(items, 18000); const rm = buildRoadmap(items);
    expect(r.coverage.current + r.coverage.stale + r.coverage.incomplete + r.coverage.notAssessed).toBe(r.coverage.workflows);
    expect(r.impact.gross).toBe(s.grossHours); expect(r.impact.net).toBe(s.netHours);
    expect(r.impact.gross - r.impact.review).toBeCloseTo(r.impact.net, 1);
    expect(r.impact.contributors.length).toBe(s.impactAvailableCount);
    expect(rm.totals.all.net).toBeCloseTo(r.impact.net, 1);
    expect(r.distribution.reduce((a, d) => a + d.count, 0)).toBe(r.coverage.current);
  });

  it("Human-Led excluded from automation claims", () => {
    const r = demo();
    const hl = new Set(r.distribution.find((d) => d.model === "human_led")!.workflows);
    for (const c of r.impact.contributors) expect(hl.has(c.name)).toBe(false);
    for (const l of [r.roadmap.now, r.roadmap.next, r.roadmap.later]) expect(l.every((e) => e.model !== "human_led")).toBe(true);
  });

  it("mandatory controls retained, unverified, with correct provenance", () => {
    const r = demo();
    const pw = r.roadmap.now.find((e) => e.id === "password-reset")!;
    expect(pw.restrictions.length).toBeGreaterThan(0);
    const id = r.risks.find((g) => g.code === "R2_identity_access")!;
    expect(id.workflows.map((w) => w.id)).toContain("password-reset");
    expect(id.controls.length).toBeGreaterThan(0);
    expect(JSON.stringify(r)).not.toMatch(/"(completed|implemented|done|status_complete)"\s*:/i);
    for (const d of r.shared) expect(d.provenance.length).toBeGreaterThan(0);
    for (const g of r.risks) expect(new Set(g.workflows.map((w) => w.id)).size).toBe(g.workflows.length);
  });

  it("stale and incomplete excluded from findings", () => {
    const items: PortfolioItem[] = getDemoRows().map((x) => x.id === "product-how-to" ? { ...x, status: "stale" } : x.id === "password-reset" ? { ...x, status: "incomplete" } : x);
    const r = buildReport(org, items);
    expect(r.coverage).toMatchObject({ current: 13, stale: 1, incomplete: 1 });
    expect(r.impact.contributors.some((c) => c.id === "product-how-to" || c.id === "password-reset")).toBe(false);
    expect(r.roadmap.reassess.map((e) => e.id).sort()).toEqual(["password-reset", "product-how-to"]);
    expect(r.risks.flatMap((g) => g.workflows).some((w) => w.id === "password-reset")).toBe(false);
    expect(r.summary.join(" ")).toMatch(/2 workflow\(s\) are stale, incomplete or not assessed/);
  });

  it("empty organization yields limited report without fabricated findings", () => {
    const r = buildReport({ ...org, name: "Empty", synthetic: false }, []);
    expect(r.hasFindings).toBe(false);
    expect(r.summary[0]).toMatch(/no current, complete workflow assessments/);
    expect(r.distribution.every((d) => d.share === null)).toBe(true);
    expect(r.impact.contributors).toEqual([]);
  });

  it("unavailable estimates listed, not zero; negative net disclosed", () => {
    const items = getDemoRows();
    const a = items.find((x) => x.id === "product-how-to")!; const ra = clone(a.result!) as AssessmentResult;
    ra.impact = { ...ra.impact, available: false, gross_hours: null, review_hours: null, net_hours: null };
    const b = items.find((x) => x.id === "api-authentication-error")!; const rb = clone(b.result!) as AssessmentResult;
    rb.impact = { ...rb.impact, gross_hours: 5, review_hours: 9, net_hours: -4, unfavorable: true };
    const r = buildReport(org, items.map((x) => x === a ? { ...x, result: ra } : x === b ? { ...x, result: rb } : x));
    expect(r.impact.unavailable.map((x) => x.id)).toContain("product-how-to");
    expect(r.impact.contributors.some((c) => c.id === "product-how-to")).toBe(false);
    expect(r.impact.negative).toEqual([{ id: "api-authentication-error", name: b.name, net: -4 }]);
  });

  it("deterministic and organization-scoped", () => {
    expect(JSON.stringify(demo())).toBe(JSON.stringify(demo()));
    const mine = getDemoRows().slice(0, 2);
    const r = buildReport({ ...org, name: "A" }, mine);
    expect(r.lineage.map((x) => x.id).sort()).toEqual(mine.map((x) => x.id).sort());
    expect(r.shared.flatMap((d) => d.workflows).every((w) => mine.some((m) => m.id === w.id))).toBe(true);
  });
});

describe("report next actions match roadmap", () => {
  it("Section E next_action equals buildRoadmap() for every lane", () => {
    const items = getDemoRows(); const r = buildReport(org, items); const rm = buildRoadmap(items);
    for (const l of ["now", "next", "later"] as const)
      expect(r.roadmap[l].map((e) => [e.id, e.next_action])).toEqual(rm.entries[l].map((e) => [e.id, e.next_action]));
  });
});
