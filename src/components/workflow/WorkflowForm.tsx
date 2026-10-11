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
      onSubmit={(e) => {
        e.preventDefault();
        // Emit only form fields: the server schema is strict and rejects extras (e.g. id, attributes_version).
        onSubmit({
          name: v.name, category: v.category, description: v.description, current_process: v.current_process,
          required_systems: systems.split(",").map((s) => s.trim()).filter(Boolean),
          attrs: {
            monthly_volume: v.attrs.monthly_volume, aht_minutes: v.attrs.aht_minutes, action_type: v.attrs.action_type,
            handles_account_access: v.attrs.handles_account_access, accesses_sensitive_data: v.attrs.accesses_sensitive_data,
          },
        });
      }}
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
      {note && <p className="text-[13px] text-muted-foreground">{note}</p>}
      <button disabled={busy} className="h-8 rounded bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-60">{submitLabel}</button>
    </form>
  );
}
