import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { ReportView } from "@/components/report/ReportView";
import { buildReport } from "@/domain/report";
import { getDemoRows } from "@/lib/demo";
import { FIXTURE_VERSION, NORTHSTAR_ORG } from "@/fixtures/northstar";

export const Route = createFileRoute("/demo/report")({
  head: () => ({
    meta: [
      { title: "Executive assessment report — Northstar Cloud demo" },
      { name: "description", content: "Executive summary, operating models, modeled impact, priorities, risks and implementation sequence for 15 synthetic support workflows." },
      { property: "og:title", content: "Executive assessment report — Northstar Cloud demo" },
      { property: "og:description", content: "A deterministic, evidence-aware support automation assessment for a synthetic B2B SaaS team." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DemoReport,
});

function DemoReport() {
  const report = useMemo(() => buildReport({ ...NORTHSTAR_ORG, synthetic: true }, getDemoRows()), []);
  return (
    <ReportView r={report} sourceNote={`fixture ${FIXTURE_VERSION}`} links={{
      workflow: (id, c) => <Link to="/demo/workflows/$workflowId" params={{ workflowId: id }} className="underline-offset-2 hover:underline">{c}</Link>,
      blueprint: (id, c) => <Link to="/demo/blueprint/$workflowId" params={{ workflowId: id }} className="underline-offset-2 hover:underline">{c}</Link>,
      roadmap: (c) => <Link to="/demo/roadmap">{c}</Link>,
    }} />
  );
}
