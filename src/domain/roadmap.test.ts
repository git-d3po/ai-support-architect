import { describe, expect, it } from "vitest";
import { buildRoadmap, planEntry, PHASE_ACTION } from "./roadmap";
import { summarize, type PortfolioItem } from "./portfolio";
import { getDemoRows } from "@/lib/demo";
import type { AssessmentResult } from "./types";

const rows = () => getDemoRows();
const find = (id: string) => rows().find((r) => r.id === id)!;
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

describe("roadmap planning", () => {
  it("baseline: phases reconcile with portfolio totals (755 gross / 616 net)", () => {
    const items = rows();
    const s = summarize(items, 18000);
    const rm = buildRoadmap(items);
    expect(Math.round(rm.totals.all.net)).toBe(Math.round(s.netHours));
    expect(Math.round(rm.totals.all.gross)).toBe(Math.round(s.grossHours));
    expect(rm.totals.all.count).toBe(s.candidates.length);
    expect(Math.round(s.grossHours)).toBe(755);
    expect(Math.round(s.netHours)).toBe(616);
    expect(rm.entries.human_led).toHaveLength(3);
  });

  it("current high-value, low-effort workflow lands in Now", () => {
    const e = planEntry(find("product-how-to"));
    expect(e.section).toBe("now");
    expect(e.reason).toMatch(/Priority/);
  });

  it("Human-Led workflows never enter automation lanes", () => {
    const rm = buildRoadmap(rows());
    for (const l of ["now", "next", "later"] as const) expect(rm.entries[l].every((x) => x.model !== "human_led")).toBe(true);
  });

  it("restrictions stay visible and drive next action; controls carry no completion state", () => {
    const e = planEntry(find("password-reset"));
    expect(e.section).toBe("now");
    expect(e.restrictions.length).toBeGreaterThan(0);
    expect(e.dependency?.source).toBe("restriction");
    expect(e.next_action).toMatch(/control/i);
    for (const c of e.required_controls) expect(Object.keys(c).sort()).toEqual(["code", "text"]);
  });

  it("stale assessments are excluded from totals and lanes", () => {
    const items = rows();
    const before = buildRoadmap(items).totals.all;
    const pr = items.find((x) => x.id === "product-how-to")!;
    const stale: PortfolioItem[] = items.map((x) => (x === pr ? { ...x, status: "stale" } : x));
    const rm = buildRoadmap(stale);
    expect(rm.entries.reassess.map((x) => x.id)).toContain("product-how-to");
    expect(rm.totals.all.count).toBe(before.count - 1);
    expect(rm.entries.reassess[0]!.net_hours).toBeNull();
    expect(rm.entries.reassess[0]!.priority).toBeNull();
  });

  it("incomplete assessments get no fabricated priority or impact", () => {
    const it0 = { ...find("password-reset"), status: "incomplete" as const };
    const e = planEntry(it0);
    expect(e.section).toBe("reassess");
    expect(e.priority).toBeNull();
    expect(e.net_hours).toBeNull();
  });

  it("changed assessment output updates the derived phase", () => {
    const it0 = find("product-how-to");
    const r = clone(it0.result!) as AssessmentResult;
    r.priority.score = 55;
    expect(planEntry({ ...it0, result: r }).section).toBe("next");
  });

  it("deleted workflow disappears from aggregates", () => {
    const items = rows();
    const full = buildRoadmap(items).totals.all;
    const e = planEntry(find("product-how-to"));
    const rm = buildRoadmap(items.filter((x) => x.id !== "product-how-to"));
    expect(rm.totals.all.count).toBe(full.count - 1);
    expect(rm.totals.all.net).toBeCloseTo(full.net - e.net_hours!, 2);
  });

  it("is deterministic for identical inputs", () => {
    expect(JSON.stringify(buildRoadmap(rows()))).toBe(JSON.stringify(buildRoadmap(rows())));
  });

  it("negative net estimate is preserved and placed in Later", () => {
    const it0 = find("product-how-to");
    const r = clone(it0.result!) as AssessmentResult;
    r.impact.net_hours = -12;
    const e = planEntry({ ...it0, result: r });
    expect(e.section).toBe("later");
    expect(e.net_hours).toBe(-12);
    expect(buildRoadmap([{ ...it0, result: r }]).totals.all.net).toBe(-12);
  });

  it("phase boundaries", () => {
    const it0 = find("product-how-to");
    const at = (p: number, eff: number) => {
      const r = clone(it0.result!) as AssessmentResult;
      r.priority.score = p; r.scores.effort = eff;
      return planEntry({ ...it0, result: r }).section;
    };
    expect(at(70, 39)).toBe("now");
    expect(at(69, 39)).toBe("next");
    expect(at(70, 40)).toBe("next");
    expect(at(50, 59)).toBe("next");
    expect(at(49, 10)).toBe("later");
    expect(at(90, 60)).toBe("later");
  });
});

describe("phase-aware next action", () => {
  const PILOT = /\bpilot (agent-assist|with)|run a bounded pilot/i;
  const at = (id: string, p: number, e: number, net?: number) => {
    const it = clone(find(id));
    it.result!.priority.score = p; it.result!.scores.effort = e;
    if (net != null) it.result!.impact.net_hours = net;
    return planEntry(it);
  };

  it("Now unrestricted keeps safeguard-gated pilot step", () => {
    const e = planEntry(find("product-how-to"));
    expect([e.section, e.model, e.priority]).toEqual(["now", "ai_autonomous", 88]);
    expect(e.required_controls.length).toBeGreaterThan(0);
    expect(e.next_action).toMatch(/^After the implementing team establishes and verifies required safeguards/);
  });
  it("Now restricted keeps restriction action", () => {
    const e = planEntry(find("password-reset"));
    expect([e.section, e.model, e.priority, e.required_controls.length]).toEqual(["now", "deterministic", 79, 4]);
    expect(e.next_action).toBe("Prepare and validate the verified recovery control before any automation build.");
  });
  it("Next unrestricted gets preparation guidance, no pilot", () => {
    const e = planEntry(find("api-authentication-error"));
    expect(e.section).toBe("next");
    expect(e.next_action).toBe(PHASE_ACTION.next);
    expect(e.required_controls.length).toBeGreaterThan(0);
  });
  it("Next restricted keeps restriction action", () => {
    const e = planEntry(find("billing-address-update"));
    expect(e.section).toBe("next");
    expect(e.next_action).toMatch(/authorization and data-permission/);
  });
  it("Later unrestricted gets reassessment guidance", () => {
    for (const id of ["failed-login", "plan-downgrade"]) {
      const e = planEntry(find(id));
      expect(e.section).toBe("later");
      expect(e.next_action).toBe(PHASE_ACTION.later);
      expect(e.next_action).not.toMatch(PILOT);
    }
  });
  it("Later restricted keeps restriction action", () => {
    for (const id of ["duplicate-charge", "refund-request"]) {
      const e = planEntry(find(id));
      expect(e.section).toBe("later");
      expect(e.next_action).toMatch(/approval thresholds/);
    }
  });
  it("non-positive net → Later with unfavorable-impact guidance, value kept", () => {
    for (const net of [0, -12.5]) {
      const e = at("api-authentication-error", 90, 10, net);
      expect(e.section).toBe("later");
      expect(e.net_hours).toBe(net);
      expect(e.next_action).toBe(PHASE_ACTION.later_nonpositive);
    }
  });
  it("boundary cases: action follows phase", () => {
    const cases: [number, number, string][] = [[70, 39, "now"], [69, 39, "next"], [70, 40, "next"], [50, 59, "next"], [49, 10, "later"], [90, 60, "later"]];
    for (const [p, ef, lane] of cases) {
      const e = at("api-authentication-error", p, ef);
      expect(e.section).toBe(lane);
      if (lane === "now") expect(e.next_action).toMatch(/^After the implementing team/);
      else expect(e.next_action).toBe(lane === "next" ? PHASE_ACTION.next : PHASE_ACTION.later);
    }
  });
  it("no Next/Later entry carries a pilot instruction; deterministic output", () => {
    const a = buildRoadmap(rows()), b = buildRoadmap(rows());
    expect(a).toEqual(b);
    for (const e of [...a.entries.next, ...a.entries.later]) expect(e.next_action).not.toMatch(PILOT);
    expect([a.totals.now.count, a.totals.next.count, a.totals.later.count]).toEqual([4, 3, 5]);
    expect([Math.round(a.totals.now.net), Math.round(a.totals.next.net), Math.round(a.totals.later.net)]).toEqual([408, 93, 115]);
  });
});
