import { useMemo, useState, type ReactNode } from "react";
import type { PortfolioItem } from "@/domain/portfolio";
import { CATEGORY_LABEL, MODEL_LABEL, type Category, type ModelOutcome } from "@/domain/types";
import { ModelBadge, StatusBadge } from "@/components/assessment/ModelBadge";

export interface TableRow extends PortfolioItem { category: Category }

export function WorkflowTable({ rows, renderName }: { rows: TableRow[]; renderName: (r: TableRow) => ReactNode }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<Category | "all">("all");
  const [model, setModel] = useState<ModelOutcome | "all">("all");
  const filtered = useMemo(
    () =>
      rows.filter((r) =>
        (q === "" || r.name.toLowerCase().includes(q.toLowerCase())) &&
        (cat === "all" || r.category === cat) &&
        (model === "all" || (r.status === "assessed" && r.result?.model === model)),
      ),
    [rows, q, cat, model],
  );
  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b p-3">
        <input aria-label="Search workflows" placeholder="Search workflows" value={q} onChange={(e) => setQ(e.target.value)} className="h-8 w-56 rounded border bg-card px-2 text-sm" />
        <select aria-label="Filter by category" value={cat} onChange={(e) => setCat(e.target.value as Category | "all")} className="h-8 rounded border bg-card px-2 text-sm">
          <option value="all">All categories</option>
          {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
        </select>
        <select aria-label="Filter by model" value={model} onChange={(e) => setModel(e.target.value as ModelOutcome | "all")} className="h-8 rounded border bg-card px-2 text-sm">
          <option value="all">All models</option>
          {(Object.keys(MODEL_LABEL) as ModelOutcome[]).map((m) => <option key={m} value={m}>{MODEL_LABEL[m]}</option>)}
        </select>
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} of {rows.length}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              {["Workflow", "Category", "Volume / mo", "AHT", "Suitability", "Risk", "Effort", "Recommended model", "Priority", "Status"].map((h) => (
                <th key={h} className="whitespace-nowrap px-3 py-2 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((r) => {
              const ok = r.status === "assessed" || r.status === "incomplete";
              const res = ok ? r.result : null;
              return (
                <tr key={r.id} className="hover:bg-surface/60">
                  <td className="px-3 py-2 font-medium">{renderName(r)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{CATEGORY_LABEL[r.category]}</td>
                  <td className="num px-3 py-2 text-right">{r.attrs.monthly_volume.toLocaleString()}</td>
                  <td className="num px-3 py-2 text-right">{r.attrs.aht_minutes}m</td>
                  <td className="num px-3 py-2 text-right">{res?.scores.suitability ?? "—"}</td>
                  <td className="num px-3 py-2 text-right">{res?.scores.risk ?? "—"}</td>
                  <td className="num px-3 py-2 text-right">{res?.scores.effort ?? "—"}</td>
                  <td className="px-3 py-2">{r.status === "stale" ? <span className="text-xs text-muted-foreground">Re-assess required</span> : <ModelBadge model={r.result ? r.result.model : null} />}</td>
                  <td className="num px-3 py-2 text-right">{r.status === "assessed" ? (r.result?.priority.score ?? <span className="text-xs text-muted-foreground">n/a</span>) : "—"}</td>
                  <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                </tr>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">No workflows match.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
