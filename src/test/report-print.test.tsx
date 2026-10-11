import { describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { ReportView } from "@/components/report/ReportView";
import { buildReport } from "@/domain/report";
import { getDemoRows } from "@/lib/demo";
import { NORTHSTAR_ORG } from "@/fixtures/northstar";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("executive report print", () => {
  it("opens collapsed disclosures for print and restores on-screen state afterwards", async () => {
    const el = document.createElement("div"); document.body.appendChild(el);
    const root = createRoot(el);
    const r = buildReport({ ...NORTHSTAR_ORG, synthetic: true }, getDemoRows());
    const l = (_: string, c: React.ReactNode) => <span>{c}</span>;
    await act(async () => { root.render(<ReportView r={r} sourceNote="test" links={{ workflow: l, blueprint: l, roadmap: (c) => <span>{c}</span> }} />); });
    const details = [...el.querySelectorAll("details")];
    expect(details.length).toBeGreaterThanOrEqual(2);
    details[0]!.open = true; // user expanded one on screen
    const closedBefore = details.filter((d) => !d.open).length;
    expect(closedBefore).toBeGreaterThan(0);
    act(() => { window.dispatchEvent(new Event("beforeprint")); });
    expect(details.every((d) => d.open)).toBe(true);
    expect(el.textContent).toContain("Source assessment lineage");
    act(() => { window.dispatchEvent(new Event("afterprint")); });
    expect(details[0]!.open).toBe(true);
    expect(details.filter((d) => !d.open).length).toBe(closedBefore);
    act(() => root.unmount());
  });
});
