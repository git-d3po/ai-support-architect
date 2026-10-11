import { useState } from "react";
import type { Category, WorkflowAttributes } from "@/domain/types";
import { CATEGORY_LABEL } from "@/domain/types";
import { WorkflowAttributesEditor } from "@/components/assessment/AssessmentEditor";

export interface WorkflowFormValue {
  name: string; category: Category; description: string; current_process: string; required_systems: string[]; attrs: WorkflowAttributes;
}

export function WorkflowForm({ initial, onSubmit, submitLabel, busy, note }: { initial: WorkflowFormValue; onSubmit: (v: WorkflowFormValue) => void; submitLabel: string; busy?: boolean; note?: string }) {
  const [v, setV] = useState(initial);
  const [systems, setSystems] = useState(initial.required_systems.join(", "));
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => { e.preventDefault(); onSubmit({ ...v, required_systems: systems.split(",").map((s) => s.trim()).filter(Boolean) }); }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm"><span className="eyebrow mb-1 block">Name</span><input required maxLength={120} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} className="h-8 w-full rounded border bg-card px-2" /></label>
        <label className="text-sm"><span className="eyebrow mb-1 block">Category</span>
          <select value={v.category} onChange={(e) => setV({ ...v, category: e.target.value as Category })} className="h-8 w-full rounded border bg-card px-2">
            {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
          </select></label>
      </div>
      <label className="block text-sm"><span className="eyebrow mb-1 block">Description</span><textarea maxLength={2000} rows={2} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} className="w-full rounded border bg-card p-2" /></label>
      <label className="block text-sm"><span className="eyebrow mb-1 block">Current process</span><textarea maxLength={4000} rows={2} value={v.current_process} onChange={(e) => setV({ ...v, current_process: e.target.value })} className="w-full rounded border bg-card p-2" /></label>
      <label className="block text-sm"><span className="eyebrow mb-1 block">Required systems (comma-separated)</span><input value={systems} onChange={(e) => setSystems(e.target.value)} className="h-8 w-full rounded border bg-card px-2" /></label>
      <WorkflowAttributesEditor attrs={v.attrs} onChange={(attrs) => setV({ ...v, attrs })} />
      {note && <p className="text-[11px] text-muted-foreground">{note}</p>}
      <button disabled={busy} className="h-8 rounded bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-60">{submitLabel}</button>
    </form>
  );
}
