import { useEffect, useRef, type ReactNode } from "react";
import type { Report } from "@/domain/report";
import type { RoadmapEntry } from "@/domain/roadmap";
import { DEP_CATEGORY_LABEL } from "@/domain/blueprint";
import { MODEL_LABEL } from "@/domain/types";
import { ModelBadge, SyntheticBadge, MODEL_DOT } from "@/components/assessment/ModelBadge";
import { ProvenanceBadge } from "@/components/blueprint/BlueprintView";
import { cn } from "@/lib/utils";

export interface ReportLinks {
  workflow: (id: string, c: ReactNode) => ReactNode;
  blueprint: (id: string, c: ReactNode) => ReactNode;
  roadmap: (c: ReactNode) => ReactNode;
}

const h = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });
const pct = (n: number | null) => (n == null ? "—" : `${Math.round(n * 100)}%`);

const SECTIONS = [
  ["summary", "Executive summary"], ["scope", "Assessment scope and coverage"], ["opportunity", "Automation opportunity"],
  ["impact", "Modeled operational impact"], ["priorities", "Priority implementation opportunities"], ["risks", "Major risks and required controls"],
  ["dependencies", "Shared implementation dependencies"], ["sequence", "Recommended implementation sequence"], ["method", "Limitations and methodology"],
] as const;

function Sec({ n, id, title, children }: { n: number; id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-20 border-t pt-6">
      <h2 id={`${id}-h`} className="mb-3 text-lg font-semibold"><span className="num mr-2 text-muted-foreground">{String.fromCharCode(64 + n)}.</span>{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

function Fact({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return <div className="rounded border p-3"><div className="eyebrow">{label}</div><div className="num mt-1 text-xl font-semibold">{value}</div>{note && <div className="mt-0.5 text-[13px] text-muted-foreground">{note}</div>}</div>;
}

function PhaseTable({ rows, links }: { rows: RoadmapEntry[]; links: ReportLinks }) {
  if (!rows.length) return <p className="text-muted-foreground">No workflows in this phase.</p>;
  return (
    <div className="overflow-x-auto rounded border"><table className="w-full text-sm">
      <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted-foreground"><tr>{["Workflow", "Model", "Priority", "Net h/mo", "Key dependency", "Controls & safety restrictions", "Next action"].map((x) => <th key={x} scope="col" className="px-3 py-2 font-medium">{x}</th>)}</tr></thead>
      <tbody className="divide-y">{rows.map((e) => (
        <tr key={e.id} className="align-top">
          <td className="px-3 py-2 font-medium">{links.workflow(e.id, e.name)}<div className="text-[13px] font-normal">{links.blueprint(e.id, "Blueprint")}</div></td>
          <td className="px-3 py-2"><ModelBadge model={e.model} /></td>
          <td className="num px-3 py-2">{e.priority}</td>
          <td className={cn("num px-3 py-2", (e.net_hours ?? 0) < 0 && "text-restrict")}>{e.net_hours ?? "Unavailable"}</td>
          <td className="min-w-44 px-3 py-2 text-[13px]">{e.dependency ? <>{e.dependency.text} <span className="text-muted-foreground">({e.dependency.source === "restriction" ? "mandatory" : "inferred"})</span></> : "—"}</td>
          <td className="min-w-44 px-3 py-2 text-[13px]">
            <div>{e.required_controls.length > 0 ? `${e.required_controls.length} required control${e.required_controls.length === 1 ? "" : "s"} · status unverified` : "No required controls identified"}</div>
            {e.restrictions.length > 0 ? (
              <div className="mt-1 text-restrict">Triggered safety restrictions: {e.restrictions.join(", ")}</div>
            ) : <div className="mt-1 text-muted-foreground">No triggered safety restrictions</div>}
          </td>
          <td className="min-w-52 px-3 py-2 text-[13px]">{e.next_action}</td>
        </tr>
      ))}</tbody>
    </table></div>
  );
}

export function ReportView({ r, links, sourceNote }: { r: Report; links: ReportLinks; sourceNote: string }) {
  const c = r.coverage;
  const ref = useRef<HTMLElement>(null);
  // Print the full report: open every disclosure before printing, restore the on-screen state afterwards.
  useEffect(() => {
    let opened: HTMLDetailsElement[] = [];
    const before = () => { opened = [...(ref.current?.querySelectorAll("details:not([open])") ?? [])] as HTMLDetailsElement[]; opened.forEach((d) => { d.open = true; }); };
    const after = () => { opened.forEach((d) => { d.open = false; }); opened = []; };
    window.addEventListener("beforeprint", before); window.addEventListener("afterprint", after);
    return () => { window.removeEventListener("beforeprint", before); window.removeEventListener("afterprint", after); };
  }, []);
  return (
    <article ref={ref} className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-2 border-b pb-5">
        <div className="flex flex-wrap items-center gap-2"><span className="eyebrow">Executive assessment report</span>{r.org.synthetic && <SyntheticBadge />}</div>
        <h1 className="text-3xl font-semibold">{r.org.name}</h1>
        <p className="text-sm text-muted-foreground">{[r.org.industry, `${r.org.support_agent_count} agents`, `${r.org.monthly_ticket_volume.toLocaleString("en-US")} tickets / month`, r.org.support_channels.join(", ")].filter(Boolean).join(" · ")}</p>
        <p className="num text-[13px] text-muted-foreground">{r.version} · scoring v{r.scoring_version} · {r.roadmap_version} · {r.blueprint_version} · {sourceNote}</p>
        <p className="rounded border border-dashed px-3 py-2 text-sm">Decision-support assessment. Not a production-readiness certificate. All figures derive from current assessments and documented deterministic rules.</p>
        <nav aria-label="Report sections" className="pt-1">
          <ol className="flex flex-wrap gap-x-4 gap-y-1 text-sm">{SECTIONS.map(([id, t], i) => <li key={id}><a href={`#${id}`} className="underline-offset-2 hover:underline">{String.fromCharCode(65 + i)}. {t}</a></li>)}</ol>
        </nav>
      </header>

      <Sec n={1} id="summary" title="Executive summary">
        {r.summary.map((p, i) => <p key={i}>{p}</p>)}
        {r.hasFindings && <p>{links.roadmap(<span className="font-medium underline">Open the implementation roadmap</span>)}</p>}
      </Sec>

      <Sec n={2} id="scope" title="Assessment scope and coverage">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Fact label="Workflows represented" value={c.workflows} />
          <Fact label="Current & complete" value={c.current} note="Included in findings" />
          <Fact label="Stale / incomplete" value={`${c.stale} / ${c.incomplete}`} note={`${c.notAssessed} not assessed · excluded`} />
          <Fact label="Ticket volume represented" value={c.classifiedVolume.toLocaleString("en-US")} note={c.overCommitted ? "Exceeds organization volume — check overlaps" : `of ${c.orgVolume.toLocaleString("en-US")} · ${c.otherIntentsVolume.toLocaleString("en-US")} other intents not assessed`} />
        </div>
        <p className="text-muted-foreground">Workflow coverage (count of workflows) and ticket-volume coverage (monthly tickets in represented workflows) are different denominators. Findings are not extrapolated to the {c.otherIntentsVolume.toLocaleString("en-US")} tickets in other intents.</p>
        <p className="text-muted-foreground">Input provenance: {r.org.synthetic ? "synthetic demonstration inputs, not customer data." : c.observedInputs == null ? "not recorded." : `${c.observedInputs} of ${c.current + c.stale + c.incomplete} saved assessments marked as observed data; the rest are subjective estimates.`}</p>
        {(c.stale > 0 || c.incomplete > 0 || c.notAssessed > 0) && (
          <div role="status" className="rounded border border-sim/50 bg-sim-soft p-3">
            <p className="font-semibold">Excluded from findings — reassessment required</p>
            <ul className="mt-1 list-disc pl-5">{r.roadmap.reassess.map((e) => <li key={e.id}>{links.workflow(e.id, e.name)} — {e.reason}</li>)}</ul>
          </div>
        )}
      </Sec>

      {!r.hasFindings ? (
        <p role="status" className="rounded border p-4 text-sm">No current, complete assessments yet. Opportunity, impact, roadmap and risk findings cannot be established. Complete at least one assessment to generate them.</p>
      ) : (<>
        <Sec n={3} id="opportunity" title="Automation opportunity">
          <div className="flex h-3 overflow-hidden rounded-full bg-muted" aria-hidden>{r.distribution.map((d) => d.count > 0 && <div key={d.model} className={MODEL_DOT[d.model]} style={{ width: `${(d.share ?? 0) * 100}%` }} />)}</div>
          <div className="overflow-x-auto rounded border"><table className="w-full text-sm">
            <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted-foreground"><tr>{["Proposed model", "Workflows", "Share", "What it means"].map((x) => <th key={x} scope="col" className="px-3 py-2 font-medium">{x}</th>)}</tr></thead>
            <tbody className="divide-y">{r.distribution.map((d) => (
              <tr key={d.model} className="align-top"><td className="px-3 py-2"><ModelBadge model={d.model} /></td><td className="num px-3 py-2">{d.count}</td><td className="num px-3 py-2">{pct(d.share)}</td>
                <td className="px-3 py-2">{d.implication}{d.workflows.length > 0 && <div className="mt-1 text-[13px] text-muted-foreground">{d.workflows.join(", ")}</div>}</td></tr>
            ))}</tbody>
          </table></div>
          <p className="text-muted-foreground">Share = workflows with current assessments ({c.current}). Proposed models describe possible future operation, not deployed capability.</p>
        </Sec>

        <Sec n={4} id="impact" title="Modeled operational impact">
          <div className="grid gap-3 sm:grid-cols-3">
            <Fact label="Gross modeled h / mo" value={h(r.impact.gross)} />
            <Fact label="Review overhead h / mo" value={h(r.impact.review)} />
            <Fact label="Net modeled h / mo" value={h(r.impact.net)} note="Gross − review" />
          </div>
          <p><span className="font-medium">{h(r.impact.net)} modeled net handling-time hours per month under the stated assumptions.</span> This is not observed production performance and is not converted to cost, staffing or revenue.</p>
          <p className="text-muted-foreground">Population: {r.impact.contributors.length} current, non-Human-Led workflows with complete impact assumptions. Each estimate = volume × addressable × coverage × handling-time reduction, minus reviewed cases × review minutes.</p>
          {r.impact.negative.length > 0 && <p role="note" className="text-restrict">Negative net estimates: {r.impact.negative.map((x) => `${x.name} (${x.net} h)`).join(", ")} — review effort exceeds modeled savings.</p>}
          {r.impact.unavailable.length > 0 && <p className="text-muted-foreground">Estimate unavailable (not counted as zero): {r.impact.unavailable.map((x) => x.name).join(", ")}.</p>}
          <details className="rounded border"><summary className="cursor-pointer px-3 py-2 font-medium">Contributing workflows ({r.impact.contributors.length})</summary>
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-surface text-left text-xs uppercase text-muted-foreground"><tr>{["Workflow", "Gross", "Review", "Net"].map((x) => <th key={x} scope="col" className="px-3 py-1.5 font-medium">{x}</th>)}</tr></thead>
              <tbody className="divide-y">{r.impact.contributors.map((x) => <tr key={x.id}><td className="px-3 py-1.5">{links.workflow(x.id, x.name)}</td><td className="num px-3 py-1.5">{x.gross}</td><td className="num px-3 py-1.5">{x.review}</td><td className={cn("num px-3 py-1.5", x.net < 0 && "text-restrict")}>{x.net}</td></tr>)}</tbody></table></div>
          </details>
        </Sec>

        <Sec n={5} id="priorities" title="Priority implementation opportunities">
          <p className="text-muted-foreground">Phases come from the roadmap ({r.roadmap_version}). Now means prioritize for preparation — not ready to deploy.</p>
          {(["now", "next", "later"] as const).map((l) => (
            <div key={l} className="space-y-2">
              <h3 className="text-base font-semibold">{l === "now" ? "Now" : l === "next" ? "Next" : "Later"} <span className="num text-sm font-normal text-muted-foreground">· {r.roadmap.totals[l].count} workflows · {h(r.roadmap.totals[l].net)} net h/mo</span></h3>
              <PhaseTable rows={r.roadmap[l]} links={links} />
            </div>
          ))}
          <div><h3 className="text-base font-semibold">Human-Led — outside automation phases <span className="num text-sm font-normal text-muted-foreground">· {r.roadmap.humanLed.length}</span></h3>
            <ul className="mt-1 list-disc pl-5">{r.roadmap.humanLed.map((e) => <li key={e.id}>{links.workflow(e.id, e.name)} — {e.reason}</li>)}</ul></div>
        </Sec>

        <Sec n={6} id="risks" title="Major risks and required controls">
          <p className="text-muted-foreground">Grouped by mandatory safety restriction. A workflow can appear in more than one group; group sizes are not additive.</p>
          {r.risks.length === 0 ? <p>No mandatory restrictions triggered.</p> : (
            <ul className="divide-y rounded border">{r.risks.map((g) => (
              <li key={g.code} className="space-y-1 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{g.label} <span className="num font-normal text-muted-foreground">· {g.workflows.length} workflows</span></h3><ProvenanceBadge p="mandatory" /></div>
                <p className="text-muted-foreground">{g.effect}</p>
                <p><span className="font-medium">Required — implementation unverified: </span>{g.controls.join(" ")}</p>
                <p className="text-[13px]">{g.workflows.map((w, i) => <span key={w.id}>{i > 0 && ", "}{links.blueprint(w.id, w.name)}{w.humanLed && " (Human-Led)"}</span>)}</p>
              </li>
            ))}</ul>
          )}
          {r.unspecified.length > 0 && <div><h3 className="flex items-center gap-2 font-semibold">Information still required <ProvenanceBadge p="unspecified" /></h3><ul className="mt-1 list-disc pl-5">{r.unspecified.map((u, i) => <li key={i}>{u.name}: {u.text}</li>)}</ul></div>}
        </Sec>

        <Sec n={7} id="dependencies" title="Shared implementation dependencies">
          <p className="text-muted-foreground">Dependencies recurring across workflows can be prepared once and reused, which shapes sequencing. Counts are per category; a workflow appears once per category. No completion status is tracked.</p>
          <div className="overflow-x-auto rounded border"><table className="w-full text-sm">
            <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted-foreground"><tr>{["Category", "Workflows", "Origins", "Associated workflows", "Preparation action"].map((x) => <th key={x} scope="col" className="px-3 py-2 font-medium">{x}</th>)}</tr></thead>
            <tbody className="divide-y">{r.shared.map((d) => (
              <tr key={d.category} className="align-top"><td className="px-3 py-2 font-medium">{DEP_CATEGORY_LABEL[d.category]}</td><td className="num px-3 py-2">{d.workflows.length}</td>
                <td className="px-3 py-2"><div className="flex flex-wrap gap-1">{d.provenance.map((p) => <ProvenanceBadge key={p} p={p} />)}</div></td>
                <td className="min-w-52 px-3 py-2 text-[13px]">{d.workflows.map((w, i) => <span key={w.id}>{i > 0 && ", "}{links.blueprint(w.id, w.name)}{w.humanLed && " (HL)"}</span>)}</td>
                <td className="min-w-52 px-3 py-2 text-[13px]">{d.action}</td></tr>
            ))}</tbody>
          </table></div>
        </Sec>

        <Sec n={8} id="sequence" title="Recommended implementation sequence">
          <p className="text-muted-foreground">Proposed work, not a confirmed delivery plan.</p>
          <ol className="grid gap-3 md:grid-cols-2">{([["Define", r.sequence.define], ["Prepare", r.sequence.prepare], ["Pilot", r.sequence.pilot], ["Expand", r.sequence.expand]] as const).map(([t, xs], i) => (
            <li key={t} className="rounded border p-3"><h3 className="mb-1 font-semibold"><span className="num text-muted-foreground">{i + 1}.</span> {t}</h3><ul className="list-disc space-y-1 pl-5">{xs.map((x) => <li key={x}>{x}</li>)}</ul></li>
          ))}</ol>
        </Sec>
      </>)}

      <Sec n={9} id="method" title="Limitations and methodology">
        <ul className="list-disc space-y-1 pl-5">
          <li>Recommendations come from a deterministic rules engine (scoring v{r.scoring_version}); the same inputs always give the same result. No AI writes this report.</li>
          <li>Suitability, operational risk, implementation effort, modeled impact and roadmap priority are separate measures. Safety restrictions override scores.</li>
          <li>Scoring weights and thresholds are documented design heuristics and have not been calibrated against real operational outcomes.</li>
          {r.org.synthetic && <li>Northstar Cloud is a synthetic demonstration and does not represent any real customer.</li>}
          <li>Modeled impact is based on entered assumptions, not realized savings.</li>
          <li>Required controls are not assumed to be implemented. A proposed blueprint is not a deployed system.</li>
          <li>Launch authorization requires separate validation and governance outside this application.</li>
          <li>Stale, incomplete and unassessed workflows are excluded from every finding above.</li>
        </ul>
        <details className="rounded border"><summary className="cursor-pointer px-3 py-2 font-medium">Source assessment lineage ({r.lineage.length})</summary>
          <ul className="divide-y text-[13px]">{r.lineage.map((x) => <li key={x.id} className="flex justify-between gap-2 px-3 py-1.5">{links.workflow(x.id, x.name)}<span className="num text-muted-foreground">{x.status}{x.revision != null ? ` · rev ${x.revision}` : ""}</span></li>)}</ul>
        </details>
        <p className="text-[13px] text-muted-foreground">Recommended models: {Object.values(MODEL_LABEL).slice(0, 4).join(", ")}.</p>
      </Sec>
    </article>
  );
}
