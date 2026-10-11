import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getWorkflowDetail } from "@/lib/workspace.functions";
import { deriveStatus } from "@/domain/portfolio";
import { buildBlueprint } from "@/domain/blueprint";
import { BlueprintView } from "@/components/blueprint/BlueprintView";

export const Route = createFileRoute("/_authenticated/workspace/blueprint/$workflowId")({
  head: () => ({
    meta: [
      { title: "Implementation blueprint — Support Automation Architect" },
      { name: "description", content: "Proposed future-state design derived from your saved workflow assessment." },
      { property: "og:title", content: "Implementation blueprint — Support Automation Architect" },
      { property: "og:description", content: "Proposed future-state design derived from your saved workflow assessment." },
    ],
  }),
  component: WorkspaceBlueprint,
});

function WorkspaceBlueprint() {
  const { workflowId } = Route.useParams();
  const fetchDetail = useServerFn(getWorkflowDetail);
  const q = useQuery({ queryKey: ["workflow", workflowId], queryFn: () => fetchDetail({ data: { id: workflowId } }) });
  if (q.isPending) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (q.isError) return <p className="text-sm text-restrict">Could not load this workflow.</p>;
  const w = q.data.workflow;
  if (!w) return <div className="py-16 text-center text-sm text-muted-foreground">Workflow not found. <Link to="/workspace" className="underline">Back to workspace</Link></div>;
  const latest = q.data.latest;
  const result = latest?.results ?? null;
  const status = deriveStatus(result, latest?.workflow_attributes_version ?? null, w.attributes_version, latest?.scoring_version ?? null);
  const bp = buildBlueprint({ name: w.name, description: w.description, required_systems: w.required_systems, attrs: w.attrs, inputs: latest?.inputs ?? null, result, status, revision: latest?.revision ?? null });
  return (
    <BlueprintView bp={bp} result={bp.current ? result : null} name={w.name} description={w.description}
      links={<>
        <Link to="/workspace/workflows/$workflowId" params={{ workflowId }} className="underline">{bp.current ? "Open assessment" : "Complete or refresh the assessment"}</Link>
        <Link to="/workspace/roadmap" className="underline">Back to roadmap</Link>
      </>} />
  );
}
