import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo } from "react";
import { getNorthstarWorkflow } from "@/fixtures/northstar";
import { assess } from "@/domain/engine";
import { deriveStatus } from "@/domain/portfolio";
import { buildBlueprint } from "@/domain/blueprint";
import { BlueprintView } from "@/components/blueprint/BlueprintView";
import { SyntheticBadge } from "@/components/assessment/ModelBadge";

export const Route = createFileRoute("/demo/blueprint/$workflowId")({
  loader: ({ params }) => {
    const w = getNorthstarWorkflow(params.workflowId);
    if (!w) throw notFound();
    return { name: w.name, description: w.description };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Blueprint not found" }, { name: "robots", content: "noindex" }] };
    const t = `${loaderData.name} — implementation blueprint (Northstar Cloud demo)`;
    const d = `Proposed future-state design, responsibilities, controls and dependencies for ${loaderData.name}.`;
    return { meta: [{ title: t }, { name: "description", content: d }, { property: "og:title", content: t }, { property: "og:description", content: d }, { property: "og:type", content: "article" }, { name: "twitter:card", content: "summary" }] };
  },
  notFoundComponent: () => <div className="py-16 text-center text-sm text-muted-foreground">This demo workflow doesn't exist. <Link to="/demo/roadmap" className="underline">Back to roadmap</Link></div>,
  component: DemoBlueprint,
});

function DemoBlueprint() {
  const { workflowId } = Route.useParams();
  const w = getNorthstarWorkflow(workflowId)!;
  const result = useMemo(() => assess(w.attrs, w.inputs), [w]);
  const bp = buildBlueprint({ name: w.name, description: w.description, required_systems: w.required_systems, attrs: w.attrs, inputs: w.inputs, result, status: deriveStatus(result, null, null), revision: null });
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2"><span className="eyebrow">Northstar Cloud</span><SyntheticBadge /></div>
      <BlueprintView bp={bp} result={result} name={w.name} description={w.description}
        links={<>
          <Link to="/demo/workflows/$workflowId" params={{ workflowId }} className="underline">Open assessment</Link>
          <Link to="/demo/roadmap" className="underline">Back to roadmap</Link>
        </>} />
    </div>
  );
}
