import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { OverviewView } from "@/components/overview/OverviewView";
import { ReportView } from "@/components/report/ReportView";
import { buildReport } from "@/domain/report";
import { getDemoRows } from "@/lib/demo";
import { NORTHSTAR_ORG } from "@/fixtures/northstar";

const rows = getDemoRows();
const link = (_: string, content: React.ReactNode) => <span>{content}</span>;

describe("public controls and restrictions presentation", () => {
  it("overview exposes required controls even for candidates without triggered restrictions", () => {
    const html = renderToStaticMarkup(
      <OverviewView items={rows} orgVolume={NORTHSTAR_ORG.monthly_ticket_volume}
        renderLink={(_, children) => <span>{children}</span>} onSelectWorkflow={() => {}} />,
    );
    expect(html).toContain("No triggered safety restrictions");
    expect(html).toContain("3 required controls");
    expect(html).toContain("status unverified");
    expect(html).not.toContain("No mandatory restrictions");
  });

  it("report phase table distinguishes controls from triggered restrictions", () => {
    const report = buildReport({ ...NORTHSTAR_ORG, synthetic: true }, rows);
    const html = renderToStaticMarkup(
      <ReportView r={report} sourceNote="test" links={{ workflow: link, blueprint: link, roadmap: (content) => <span>{content}</span> }} />,
    );
    expect(html).toContain("Controls &amp; safety restrictions");
    expect(html).toContain("3 required controls");
    expect(html).toContain("4 required controls");
    expect(html).toContain("No triggered safety restrictions");
    expect(html).toContain("Triggered safety restrictions: ");
    expect(html).not.toContain("None mandated");
  });
});
