import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { getNorthstarWorkflow } from "@/fixtures/northstar";
import { assess } from "@/domain/engine";
import { validateConsistency } from "@/domain/validation";
import { WorkflowDetailView } from "@/components/workflow/WorkflowDetailView";
import { AssessmentEditor, CompletenessMeter, WorkflowAttributesEditor } from "@/components/assessment/AssessmentEditor";
import { SyntheticBadge } from "@/components/assessment/ModelBadge";
import { MODEL_LABEL } from "@/domain/types";

export const Route = createFileRoute("/demo/workflows/$workflowId")({
  loader: ({ params }) => {
    const w = getNorthstarWorkflow(params.workflowId);
    if (!w) throw notFound();
    return { name: w.name, description: w.description };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Workflow not found" }, { name: "robots", content: "noindex" }] };
    const t = `${loaderData.name} — Northstar Cloud demo assessment`;
    return { meta: [
      { title: t }, { name: "description", content: loaderData.description },
      { property: "og:title", content: t }, { property: "og:description", content: loaderData.description },
    ] };
  },
  notFoundComponent: DemoWorkflowNotFound,
  component: DemoWorkflowDetail,
});

function DemoWorkflowNotFound() {
  return <div className="py-16 text-center"><p className="text-sm text-muted-foreground">This demo workflow doesn't exist.</p><Link to="/demo/workflows" className="mt-3 inline-block text-sm underline">Back to inventory</Link></div>;
}

function DemoWorkflowDetail() {
  const { workflowId } = Route.useParams();
  const canonical = useMemo(() => getNorthstarWorkflow(workflowId)!, [workflowId]);
  const [inputs, setInputs] = useState(() => structuredClone(canonical.inputs));
  const [attrs, setAttrs] = useState(() => ({ ...canonical.attrs }));
  const [key, setKey] = useState(workflowId);
  if (key !== workflowId) { setKey(workflowId); setInputs(structuredClone(canonical.inputs)); setAttrs({ ...canonical.attrs }); }

  const canonicalResult = useMemo(() => assess(canonical.attrs, canonical.inputs), [canonical]);
  const errors = validateConsistency(attrs, inputs);
  const result = assess(attrs, inputs);
  const dirty = JSON.stringify(inputs) !== JSON.stringify(canonical.inputs) || JSON.stringify(attrs) !== JSON.stringify(canonical.attrs);
  const reset = () => { setInputs(structuredClone(canonical.inputs)); setAttrs({ ...canonical.attrs }); };
  const total = 21 + (attrs.handles_account_access ? 1 : 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-4 text-sm"><Link to="/demo/workflows" className="text-muted-foreground hover:underline">← Workflow inventory</Link><Link to="/demo/blueprint/$workflowId" params={{ workflowId }} className="font-medium underline">View implementation blueprint</Link></div>
      <WorkflowDetailView
        meta={canonical}
        attrs={attrs}
        result={result}
        contradictions={errors}
        badges={<SyntheticBadge />}
        actions={<CompletenessMeter missing={result.missing.length} total={total} />}
        banner={dirty ? (
          <div role="status" data-testid="simulation-banner" className="flex flex-wrap items-center justify-between gap-3 rounded border border-sim/40 bg-sim-soft px-4 py-2.5 text-sm">
            <span><span className="font-semibold">Unsaved simulation.</span> Changes are local to this page and are never stored. Canonical result: {MODEL_LABEL[canonicalResult.model]}.</span>
            <button onClick={reset} className="rounded border border-sim/50 bg-card px-2.5 py-1 text-xs font-medium">Reset to canonical</button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Read-only demo. Adjust any input to run a local what-if simulation.</p>
        )}
        editor={
          <div className="space-y-4">
            <div className="panel p-4"><h3 className="mb-3 text-sm font-semibold">Workflow attributes (simulation)</h3><WorkflowAttributesEditor attrs={attrs} onChange={setAttrs} /></div>
            <AssessmentEditor inputs={inputs} onChange={setInputs} errors={errors} attrs={attrs} />
          </div>
        }
      />
    </div>
  );
}
