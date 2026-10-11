import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { RoadmapView } from "@/components/roadmap/RoadmapView";
import { SyntheticBadge } from "@/components/assessment/ModelBadge";
import { getDemoRows } from "@/lib/demo";

export const Route = createFileRoute("/demo/roadmap")({
  head: () => ({
    meta: [
      { title: "Implementation roadmap — Northstar Cloud demo" },
      { name: "description", content: "Now, Next and Later support automation phases with required controls and dependencies for 15 synthetic workflows." },
      { property: "og:title", content: "Implementation roadmap — Northstar Cloud demo" },
      { property: "og:description", content: "Which support automation opportunities to investigate first, and what must be in place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DemoRoadmap,
});

function DemoRoadmap() {
  const rows = useMemo(() => getDemoRows(), []);
  return (
    <div className="space-y-5">
      <div>
        <div className="mb-1 flex items-center gap-2"><span className="eyebrow">Northstar Cloud</span><SyntheticBadge /></div>
        <h1 className="text-2xl font-semibold">Implementation roadmap</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Derived from the current assessment of each workflow. Read-only; changes made on a workflow page are not saved and do not affect this roadmap.</p>
      </div>
      <RoadmapView bpLink={(id, c) => <Link to="/demo/blueprint/$workflowId" params={{ workflowId: id }} className="hover:underline">{c}</Link>} items={rows} link={(id, c) => <Link to="/demo/workflows/$workflowId" params={{ workflowId: id }} className="hover:underline">{c}</Link>} />
    </div>
  );
}
