import { describe, expect, it } from "vitest";
import { buildReport } from "./report";
import type { PortfolioItem } from "./portfolio";
import { buildRoadmap } from "./roadmap";
import { getDemoRows } from "@/lib/demo";

// Meridian-style org: real engine output for a single refund workflow (AI-Assisted, Later, financial + sensitive-data restrictions).
const meridianOrg = { name: "Meridian-style test org", industry: "B2B SaaS", support_agent_count: 8, monthly_ticket_volume: 2000, support_channels: ["Email"], synthetic: true };
const rows = getDemoRows();
const lane = (l: "now" | "next" | "later" | "human_led") => { const ids = new Set(buildRoadmap(rows).entries[l].map((e) => e.id)); return rows.filter((r) => ids.has(r.id)); };
const seqText = (items: PortfolioItem[]) => { const s = buildReport(meridianOrg, items).sequence; return { s, all: [...s.define, ...s.prepare, ...s.pilot, ...s.expand].join(" ") }; };

describe("implementation sequence edge cases", () => {
  it("Now portfolio: Define names Now candidates, Prepare lists required controls", () => {
    const { s } = seqText(rows);
    expect(s.define[0]).toMatch(/Now candidates: .*Password reset/);
    expect(s.prepare.some((p) => /Password reset: establish \d+ required control\(s\), status unverified/.test(p))).toBe(true);
    expect(s.pilot.join(" ")).toMatch(/without triggered safety restrictions.*establish and verify required safeguards.*before a limited pilot/);
    expect(s.pilot.join(" ")).toMatch(/with triggered safety restrictions.*pilot only after all required safeguards are established and verified/);
    expect(s.pilot.join(" ")).not.toMatch(/Pilot unrestricted/);
  });

  it("Next-only portfolio never mentions Now candidates as existing", () => {
    const { s, all } = seqText(lane("next"));
    expect(s.define[0]).toMatch(/^There are no Now candidates\. .*Next candidates:/);
    expect(all).not.toMatch(/Pilot unrestricted Now|for the Now candidates/);
    expect(s.pilot.join(" ")).toMatch(/No pilot is proposed yet/);
    expect(s.prepare.length).toBeGreaterThan(0);
  });

  it("Later-only (Meridian refund) mentions neither Now nor Next and gives actionable Prepare", () => {
    const refund = rows.filter((r) => r.id === "refund-request");
    const rm = buildRoadmap(refund);
    expect(rm.entries.later.map((e) => e.id)).toEqual(["refund-request"]);
    const { s, all } = seqText(refund);
    expect(all).not.toMatch(/\bNow\b|\bNext\b/);
    expect(s.define[0]).toMatch(/Review deferred opportunities \(Refund request\).*No near-term automation implementation is currently recommended/);
    expect(s.prepare[0]).toMatch(/Only if reassessment is pursued/);
    const prep = s.prepare.slice(1).join(" ");
    expect(prep).toMatch(/Refund request: establish \d+ required control\(s\), status unverified/);
    expect(prep).toMatch(/approv/i);
    expect(s.pilot).toEqual(["No pilot is proposed: all automation candidates are deferred (Later)."]);
    expect(all).not.toMatch(/implemented|completed|in place\b(?! and verified)/i);
  });

  it("Human-Led-only portfolio invents no automation work", () => {
    const { s, all } = seqText(lane("human_led"));
    expect(s.define[0]).toMatch(/All current assessments are Human-Led/);
    expect(all).not.toMatch(/Pilot unrestricted|establish \d+ required control/);
    expect(s.pilot[0]).toMatch(/No pilot is proposed/);
  });

  it("empty organization yields limited, truthful guidance", () => {
    const r = buildReport(meridianOrg, []);
    expect(r.hasFindings).toBe(false);
    expect(r.sequence.define[0]).toMatch(/No workflows have been assessed/);
    expect(r.sequence.prepare[0]).toMatch(/Not applicable/);
  });

  it("stale/incomplete-only portfolio contributes no outdated findings", () => {
    const items: PortfolioItem[] = rows.slice(0, 3).map((x, i) => ({ ...x, status: i ? "stale" : "incomplete" }));
    const { s, all } = seqText(items);
    expect(s.define[0]).toMatch(/Complete or refresh the 3 stale, incomplete or unassessed workflow/);
    for (const x of items) expect(all).not.toContain(x.name);
  });

  it("non-positive net value is flagged, not treated as an opportunity", () => {
    const refund = rows.filter((r) => r.id === "refund-request").map((x) => ({ ...x, result: { ...x.result!, impact: { ...x.result!.impact, net_hours: -3, unfavorable: true } } }));
    expect(seqText(refund).s.define.join(" ")).toMatch(/Modeled net value is zero, negative or unavailable for Refund request/);
  });

  it("unspecified dependencies are never presented as Prepare facts", () => {
    const { s } = seqText(rows);
    expect(s.prepare.join(" ")).not.toMatch(/Requires definition|unspecified/i);
  });

  it("is deterministic for identical inputs", () => {
    expect(JSON.stringify(buildReport(meridianOrg, getDemoRows()))).toBe(JSON.stringify(buildReport(meridianOrg, getDemoRows())));
  });
});
