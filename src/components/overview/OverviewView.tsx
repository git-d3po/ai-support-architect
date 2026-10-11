import type { ReactNode } from "react";
import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis, Cell, ReferenceLine } from "recharts";
import { summarize, type PortfolioItem } from "@/domain/portfolio";
import { MODEL_LABEL, type ModelOutcome } from "@/domain/types";
import { ModelBadge, ModelLegend, MODEL_DOT } from "@/components/assessment/ModelBadge";
import { cn } from "@/lib/utils";

const MODEL_FILL: Record<ModelOutcome, string> = {
  deterministic: "var(--model-det)", ai_assisted: "var(--model-assist)", ai_autonomous: "var(--model-auto)",
  human_led: "var(--model-human)", insufficient_data: "var(--model-none)",
};

function Kpi({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return (
    <div className="panel p-4">
      <div className="eyebrow">{label}</div>
      <div className="num mt-1 text-2xl font-semibold">{value}</div>
      {note && <div className="mt-1 text-[13px] text-muted-foreground">{note}</div>}
    </div>
  );
}

export function OverviewView({ items, orgVolume, renderLink, onSelectWorkflow }: { items: PortfolioItem[]; orgVolume: number; renderLink: (it: PortfolioItem, children: ReactNode) => ReactNode; onSelectWorkflow: (id: string) => void }) {
  const s = summarize(items, orgVolume);
  const models: ModelOutcome[] = ["deterministic", "ai_assisted", "ai_autonomous", "human_led", "insufficient_data"];
  const chartData = items
    .filter((x) => x.status === "assessed" && x.result && x.result.model !== "human_led" && x.result.impact.available)
    .map((x) => ({ id: x.id, item: x, name: x.name, effort: x.result!.scores.effort!, net: x.result!.impact.net_hours!, model: x.result!.model }));
  const restrictions = Object.entries(s.restrictionCounts).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Workflows assessed" value={`${s.assessedCount} / ${s.workflowCount}`} note={s.excludedCount ? `${s.excludedCount} excluded (stale, incomplete or not assessed)` : "All workflows included"} />
        <Kpi label="Classified monthly volume" value={s.classifiedVolume.toLocaleString()} note={s.overCommitted ? "Exceeds organization volume — check overlaps" : `of ${orgVolume.toLocaleString()} · ${s.otherIntentsVolume.toLocaleString()} other intents`} />
        <Kpi label="Modeled gross hours / mo" value={s.grossHours.toLocaleString("en-US", { maximumFractionDigits: 0 })} note={`${s.impactAvailableCount} automation-model workflows with estimates`} />
        <Kpi label="Modeled net hours / mo" value={s.netHours.toLocaleString("en-US", { maximumFractionDigits: 0 })} note="After review effort · scenario estimate, not observed savings" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
        <section className="panel">
          <div className="panel-head"><h2 className="text-sm font-semibold">Operating model distribution</h2><span className="text-[13px] text-muted-foreground">Assessed workflows only</span></div>
          <div className="space-y-3 p-4">
            <div className="flex h-3 overflow-hidden rounded-full bg-muted">
              {models.map((m) => s.distribution[m] > 0 && <div key={m} className={MODEL_DOT[m]} style={{ width: `${(s.distribution[m] / Math.max(1, s.assessedCount)) * 100}%` }} />)}
            </div>
            <ul className="space-y-1.5 text-sm">
              {models.map((m) => (
                <li key={m} className="flex items-center justify-between"><ModelBadge model={m} /><span className="num">{s.distribution[m]}</span></li>
              ))}
            </ul>
          </div>
          <div className="border-t p-4">
            <h3 className="eyebrow mb-2">Most frequent safety restrictions</h3>
            {restrictions.length === 0 ? <p className="text-sm text-muted-foreground">None.</p> : (
              <ul className="space-y-1 text-sm">{restrictions.map(([k, v]) => <li key={k} className="flex justify-between"><span>{k}</span><span className="num text-muted-foreground">{v}</span></li>)}</ul>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head"><h2 className="text-sm font-semibold">Impact vs implementation effort</h2><span className="text-[13px] text-muted-foreground">Human-Led excluded</span></div>
          <div className="h-72 p-2">
            {chartData.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No assessed automation-model workflows with impact estimates yet.</p> : (
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 20, bottom: 24, left: 8 }}>
                  <CartesianGrid stroke="var(--border)" />
                  <XAxis type="number" dataKey="effort" domain={[0, 100]} name="Effort" tick={{ fontSize: 11 }} label={{ value: "Implementation effort (0–100)", position: "insideBottom", offset: -12, fontSize: 11 }} />
                  <YAxis type="number" dataKey="net" name="Net hours" tick={{ fontSize: 11 }} label={{ value: "Net modeled h/mo", angle: -90, position: "insideLeft", fontSize: 11 }} />
                  <ZAxis range={[70, 70]} />
                  <ReferenceLine x={50} stroke="var(--muted-foreground)" strokeDasharray="3 3" />
                  <Tooltip cursor={false} content={({ payload }) => {
                    const p = payload?.[0]?.payload as (typeof chartData)[number] | undefined;
                    return p ? <div className="panel px-2 py-1.5 text-xs"><div className="font-medium">{p.name}</div><div className="text-muted-foreground">Click to open</div><div>{MODEL_LABEL[p.model]}</div><div className="num">effort {p.effort} · {p.net} net h</div></div> : null;
                  }} />
                  <Scatter data={chartData} cursor="pointer" onClick={(d: { payload?: { id?: string } }) => { if (d?.payload?.id) onSelectWorkflow(d.payload.id); }}>{chartData.map((d) => <Cell key={d.name} fill={MODEL_FILL[d.model]} />)}</Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            )}
          </div>
          <p className="border-t px-4 py-2 text-[13px] text-muted-foreground">X = effort score (weighted gaps). Y = net modeled hours = gross − review. Upper-left = higher modeled value for less effort. Color = recommended model.</p>
          <div className="border-t px-4 py-3"><ModelLegend /><p className="mt-2 text-[13px] text-muted-foreground">Recommendations describe possible future operating models, not deployed automations.</p></div>
          <details className="border-t px-4 py-2 text-sm">
            <summary className="cursor-pointer py-1 font-medium">Workflows shown in this chart ({chartData.length})</summary>
            <ul className="mt-1 divide-y">{[...chartData].sort((a, b) => b.net - a.net).map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">{renderLink(d.item, d.name)}<span className="flex items-center gap-2"><ModelBadge model={d.model} /><span className="num text-[13px] text-muted-foreground">effort {d.effort} · {d.net} net h</span></span></li>
            ))}</ul>
          </details>
        </section>
      </div>

      <section className="panel">
        <div className="panel-head"><h2 className="text-sm font-semibold">Top automation candidates</h2><span className="text-[13px] text-muted-foreground">Ranked by priority · gated by model and completeness</span></div>
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead className="bg-surface text-left text-[13px] uppercase tracking-wide text-muted-foreground"><tr>{["#", "Workflow", "Model", "Net h/mo", "Risk", "Effort", "Priority", "Restrictions & required controls"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
          <tbody className="divide-y">
            {s.candidates.slice(0, 6).map((c, i) => (
              <tr key={c.id}>
                <td className="num px-3 py-2 text-muted-foreground">{i + 1}</td>
                <td className="px-3 py-2 font-medium">{renderLink(c, c.name)}</td>
                <td className="px-3 py-2"><ModelBadge model={c.result!.model} /></td>
                <td className={cn("num px-3 py-2", c.result!.impact.unfavorable && "text-restrict")}>{c.result!.impact.net_hours}</td>
                <td className="num px-3 py-2">{c.result!.scores.risk}</td>
                <td className="num px-3 py-2">{c.result!.scores.effort}</td>
                <td className="num px-3 py-2 font-semibold">{c.result!.priority.score}</td>
                <td className="min-w-56 px-3 py-2 text-[13px]">{c.result!.restrictions.length === 0 ? <span className="text-muted-foreground">No mandatory restrictions</span> : (
                  <div>
                    <span className="inline-flex items-center gap-1 rounded border border-restrict/40 bg-restrict-soft px-1.5 py-0.5 text-xs font-medium text-restrict"><span aria-hidden>!</span>Conditional on required controls</span>
                    <ul className="mt-1 text-muted-foreground">{c.result!.restrictions.map((r) => <li key={r.code}>{r.label}</li>)}</ul>
                    {c.result!.controls.length > 0 && <div className="text-muted-foreground">{c.result!.controls.length} required control{c.result!.controls.length > 1 ? "s" : ""} — {renderLink(c, "view")}</div>}
                  </div>
                )}</td>
              </tr>
            ))}
            {s.candidates.length === 0 && <tr><td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">No ranked candidates yet.</td></tr>}
          </tbody>
        </table></div>
      </section>
    </div>
  );
}
