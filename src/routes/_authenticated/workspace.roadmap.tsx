import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getWorkspace } from "@/lib/workspace.functions";
import { toRows } from "@/lib/workspace-queries";
import { RoadmapView } from "@/components/roadmap/RoadmapView";

export const Route = createFileRoute("/_authenticated/workspace/roadmap")({
  head: () => ({
    meta: [
      { title: "My roadmap — Support Automation Architect" },
      { name: "description", content: "Implementation roadmap derived from your private workflow assessments." },
      { property: "og:title", content: "My roadmap — Support Automation Architect" },
      { property: "og:description", content: "Implementation roadmap derived from your private workflow assessments." },
    ],
  }),
  component: WorkspaceRoadmap,
});

function WorkspaceRoadmap() {
  const fetchWs = useServerFn(getWorkspace);
  const q = useQuery({ queryKey: ["workspace"], queryFn: () => fetchWs() });
  if (q.isPending) return <p className="text-sm text-muted-foreground">Loading roadmap…</p>;
  if (q.isError) return <p className="text-sm text-restrict">Could not load your workspace. Try refreshing.</p>;
  const { org, workflows, latest } = q.data;
  if (!org) return <p className="text-sm">Set up your organization in <Link to="/workspace" className="underline">My workspace</Link> first.</p>;
  const rows = toRows(workflows, latest);
  return (
    <div className="space-y-5">
      <div>
        <span className="eyebrow">Private workspace</span>
        <h1 className="text-2xl font-semibold">{org.name} — implementation roadmap</h1>
        <p className="mt-1 text-sm text-muted-foreground">Derived from your latest saved assessments. Stale or incomplete results are listed separately and not counted.</p>
      </div>
      {rows.length === 0 ? <p className="panel p-8 text-center text-sm text-muted-foreground">No workflows yet.</p> : (
        <RoadmapView bpLink={(id, c) => <Link to="/workspace/blueprint/$workflowId" params={{ workflowId: id }} className="hover:underline">{c}</Link>} items={rows} link={(id, c) => <Link to="/workspace/workflows/$workflowId" params={{ workflowId: id }} className="hover:underline">{c}</Link>} />
      )}
    </div>
  );
}
