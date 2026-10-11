import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { deleteWorkflow, getWorkflowDetail, saveAssessment, upsertWorkflow } from "@/lib/workspace.functions";
import { assess } from "@/domain/engine";
import { validateConsistency } from "@/domain/validation";
import { deriveStatus } from "@/domain/portfolio";
import { emptyInputs, MODEL_LABEL, type AssessmentInputs } from "@/domain/types";
import { WorkflowDetailView } from "@/components/workflow/WorkflowDetailView";
import { AssessmentEditor, CompletenessMeter } from "@/components/assessment/AssessmentEditor";
import { StatusBadge } from "@/components/assessment/ModelBadge";
import { WorkflowForm } from "@/components/workflow/WorkflowForm";

export const Route = createFileRoute("/_authenticated/workspace/workflows/$workflowId")({
  head: () => ({
    meta: [
      { title: "Workflow assessment — Support Automation Architect" },
      { name: "description", content: "Assess and save a private support workflow." },
      { property: "og:title", content: "Workflow assessment — Support Automation Architect" },
      { property: "og:description", content: "Assess and save a private support workflow." },
    ],
  }),
  component: WorkspaceWorkflow,
});

function WorkspaceWorkflow() {
  const { workflowId } = Route.useParams();
  const fetchDetail = useServerFn(getWorkflowDetail);
  const q = useQuery({ queryKey: ["workflow", workflowId], queryFn: () => fetchDetail({ data: { id: workflowId } }) });
  if (q.isPending) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (q.isError) return <p className="text-sm text-restrict">Could not load this workflow.</p>;
  if (!q.data.workflow) return <div className="py-16 text-center text-sm text-muted-foreground">Workflow not found. <Link to="/workspace" className="underline">Back to workspace</Link></div>;
  return <Editor key={`${workflowId}:${q.data.latest?.revision ?? 0}:${q.data.workflow.attributes_version}`} data={q.data as Required<typeof q.data> & { workflow: NonNullable<typeof q.data.workflow> }} />;
}

function Editor({ data }: { data: Awaited<ReturnType<typeof getWorkflowDetail>> & { workflow: NonNullable<Awaited<ReturnType<typeof getWorkflowDetail>>["workflow"]> } }) {
  const { workflow: w, latest, revisionCount } = data;
  const initial = useMemo<AssessmentInputs>(() => (latest ? structuredClone(latest.inputs) : emptyInputs()), [latest]);
  const [inputs, setInputs] = useState(initial);
  const [provenance, setProvenance] = useState<"observed" | "estimate">((latest?.provenance?.["all"] as "observed" | "estimate") ?? "estimate");
  const [saving, setSaving] = useState(false);
  const [editingDetails, setEditingDetails] = useState(false);
  const save = useServerFn(saveAssessment);
  const saveWf = useServerFn(upsertWorkflow);
  const del = useServerFn(deleteWorkflow);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const dirty = JSON.stringify(inputs) !== JSON.stringify(initial);
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const errors = validateConsistency(w.attrs, inputs);
  const previewResult = assess(w.attrs, inputs);
  const status = deriveStatus(latest?.results ?? null, latest?.workflow_attributes_version ?? null, w.attributes_version, latest?.scoring_version ?? null);
  const total = 21 + (w.attrs.handles_account_access ? 1 : 0);

  async function onSave() {
    setSaving(true);
    try {
      const r = await save({ data: { workflowId: w.id, baseRevision: latest?.revision ?? 0, inputs, provenance } });
      if (!r.ok) { toast.error(r.message); if (r.kind === "conflict") await qc.invalidateQueries({ queryKey: ["workflow", w.id] }); return; }
      toast.success(`Saved revision ${r.snapshot.revision} · ${MODEL_LABEL[r.snapshot.results.model]}`);
      await Promise.all([qc.invalidateQueries({ queryKey: ["workflow", w.id] }), qc.invalidateQueries({ queryKey: ["workspace"] })]);
    } catch { toast.error("Could not save assessment"); } finally { setSaving(false); }
  }

  return (
    <div className="space-y-3">
      <Link to="/workspace" className="text-xs text-muted-foreground hover:underline">← Workspace</Link>
      <WorkflowDetailView
        meta={w}
        attrs={w.attrs}
        result={previewResult}
        contradictions={errors}
        badges={<StatusBadge status={status} />}
        actions={
          <>
            <CompletenessMeter missing={previewResult.missing.length} total={total} />
            <select aria-label="Input provenance" value={provenance} onChange={(e) => setProvenance(e.target.value as "observed" | "estimate")} className="h-8 rounded border bg-card px-2 text-xs">
              <option value="estimate">Inputs: subjective estimate</option>
              <option value="observed">Inputs: observed data</option>
            </select>
            <button onClick={onSave} disabled={saving || errors.length > 0 || (!dirty && status !== "stale" && !!latest)} className="h-8 rounded bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50">
              {saving ? "Saving…" : status === "stale" && !dirty ? "Re-assess & save" : "Save assessment"}
            </button>
          </>
        }
        banner={
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground" data-testid="save-state">
              {latest ? <span>Saved revision <span className="num">{latest.revision}</span> of {revisionCount} · scored v{latest.scoring_version} · {new Date(latest.created_at).toLocaleString()} · {MODEL_LABEL[latest.results.model]}</span> : <span>Not yet saved.</span>}
              {dirty && <span className="rounded border border-sim/40 bg-sim-soft px-1.5 py-0.5 text-foreground">Unsaved changes — preview only</span>}
              <button onClick={() => setEditingDetails((x) => !x)} className="underline">{editingDetails ? "Close workflow details" : "Edit workflow details"}</button>
              <button onClick={async () => { if (!confirm("Delete this workflow and its full assessment history?")) return; await del({ data: { id: w.id } }); await qc.invalidateQueries({ queryKey: ["workspace"] }); navigate({ to: "/workspace" }); }} className="text-restrict underline">Delete</button>
            </div>
            {status === "stale" && <p role="status" className="rounded border border-sim/40 bg-sim-soft px-3 py-2 text-sm">Workflow attributes or scoring version changed since the last save. The saved result is excluded from totals until you re-assess.</p>}
            {editingDetails && (
              <div className="panel p-4">
                <WorkflowForm
                  initial={w}
                  submitLabel="Save workflow details"
                  note="Changing volume, AHT, action type, account access or sensitive data marks the saved assessment stale."
                  onSubmit={async (v) => {
                    try { await saveWf({ data: { ...v, id: w.id } }); toast.success("Workflow updated"); setEditingDetails(false);
                      await Promise.all([qc.invalidateQueries({ queryKey: ["workflow", w.id] }), qc.invalidateQueries({ queryKey: ["workspace"] })]);
                    } catch { toast.error("Could not update workflow"); }
                  }}
                />
              </div>
            )}
          </div>
        }
        editor={<AssessmentEditor inputs={inputs} onChange={setInputs} errors={errors} attrs={w.attrs} />}
      />
    </div>
  );
}
