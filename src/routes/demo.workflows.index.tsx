import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { WorkflowTable } from "@/components/workflow/WorkflowTable";
import { SyntheticBadge } from "@/components/assessment/ModelBadge";
import { getDemoRows } from "@/lib/demo";

export const Route = createFileRoute("/demo/workflows/")({
  head: () => ({
    meta: [
      { title: "Workflow inventory — Northstar Cloud demo" },
      { name: "description", content: "Searchable inventory of 15 synthetic support workflows with suitability, risk, effort and recommended operating model." },
      { property: "og:title", content: "Workflow inventory — Northstar Cloud demo" },
      { property: "og:description", content: "Compare support workflows across separate suitability, risk and effort scores." },
    ],
  }),
  component: DemoWorkflows,
});

function DemoWorkflows() {
  const rows = useMemo(() => getDemoRows(), []);
  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1 flex items-center gap-2"><span className="eyebrow">Northstar Cloud</span><SyntheticBadge /></div>
        <h1 className="text-2xl font-semibold">Workflow inventory</h1>
      </div>
      <WorkflowTable rows={rows} renderName={(r) => <Link to="/demo/workflows/$workflowId" params={{ workflowId: r.id }} className="hover:underline">{r.name}</Link>} />
    </div>
  );
}
