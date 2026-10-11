import type { ReactNode } from "react";
import type { PortfolioItem } from "@/domain/portfolio";
import { buildRoadmap, PHASE_RULES, SECTION_LABEL, type Lane, type RoadmapEntry } from "@/domain/roadmap";
import { ModelBadge } from "@/components/assessment/ModelBadge";
import { cn } from "@/lib/utils";
import { sharedDependencies, DEP_CATEGORY_LABEL } from "@/domain/blueprint";
import { ProvenanceBadge } from "@/components/blueprint/BlueprintView";

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });

const LANE_HINT: Record<Lane, string> = {
  now: "Strong near-term opportunities. Not approved for deployment — required controls still apply.",
  next: "Good opportunities that need more preparation or offer less immediate value.",
  later: "Deferred: lower priority, higher effort or unfavorable modeled value. Not a commitment to automate.",
};

function Stat({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return (
    <div className="panel p-4">
      <div className="eyebrow">{label}</div>
      <div className="num mt-1 text-2xl font-semibold">{value}</div>
      {note && <div className="mt-1 text-[13px] text-muted-foreground">{note}</div>}
    </div>
  );
}

function ControlsBlock({ e }: { e: RoadmapEntry }) {
  return (
    <div className="space-y-1 text-[13px]">
      {e.restrictions.length > 0 ? (
        <span className="inline-flex items-center gap-1 rounded border border-restrict/40 bg-restrict-soft px-1.5 py-0.5 text-xs font-medium text-restrict">
          <span aria-hidden>!</span>Conditional on required controls
        </span>
      ) : <span className="text-muted-foreground">No mandatory restrictions</span>}
      {e.restrictions.length > 0 && <div className="text-muted-foreground">Restrictions: {e.restrictions.join(", ")}</div>}
      {e.required_controls.length > 0 && (
        <details>
          <summary className="cursor-pointer text-muted-foreground">{e.required_controls.length} required controls · status unverified</summary>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">{e.required_controls.map((c) => <li key={c.code}>{c.text}</li>)}</ul>
        </details>
      )}
    </div>
  );
}

function EntryCard({ e, link, bpLink }: { e: RoadmapEntry; link: (id: string, c: ReactNode) => ReactNode; bpLink: (id: string, c: ReactNode) => ReactNode }) {
  return (
    <li className="space-y-2 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-sm font-semibold">{link(e.id, e.name)}</h3>
        <ModelBadge model={e.model} />
      </div>
      <dl className="grid grid-cols-3 gap-2 text-[13px]">
        <div><dt className="text-muted-foreground">Priority</dt><dd className="num font-semibold">{e.priority}</dd></div>
        <div><dt className="text-muted-foreground">Effort</dt><dd className="num">{e.effort}</dd></div>
        <div><dt className="text-muted-foreground">Net h/mo</dt><dd className={cn("num", (e.net_hours ?? 0) <= 0 && "text-restrict")}>{e.net_hours ?? "Unavailable"}</dd></div>
      </dl>
      <p className="text-[13px]"><span className="font-medium">Why here: </span>{e.reason}</p>
      {e.dependency && (
        <p className="text-[13px]"><span className="font-medium">Key dependency: </span>{e.dependency.text}{" "}
          <span className="text-muted-foreground">({e.dependency.source === "restriction" ? "from safety restriction" : "inferred, not documented"})</span></p>
      )}
      <ControlsBlock e={e} />
      <p className="rounded bg-surface px-2 py-1.5 text-[13px]"><span className="font-medium">Next action: </span>{e.next_action}</p>
      <p className="text-[13px]">{bpLink(e.id, <span className="font-medium underline">View implementation blueprint</span>)}</p>
    </li>
  );
}

export function RoadmapView({ items, link, bpLink, reassessLabel = "Open assessment" }: { items: PortfolioItem[]; link: (id: string, children: ReactNode) => ReactNode; bpLink: (id: string, children: ReactNode) => ReactNode; reassessLabel?: string }) {
  const rm = buildRoadmap(items);
  const shared = sharedDependencies(items);
  const lanes: Lane[] = ["now", "next", "later"];
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Assessed (current)" value={rm.assessedCount} />
        <Stat label="Automation candidates" value={rm.totals.all.count} note="Now + Next + Later" />
        <Stat label="Human-Led" value={rm.entries.human_led.length} note="Not proposed for automation" />
        <Stat label="Needs reassessment" value={rm.entries.reassess.length} note="Stale, incomplete or unassessed" />
        <Stat label="Modeled net h / mo" value={fmt(rm.totals.all.net)} note={`Gross ${fmt(rm.totals.all.gross)} · scenario estimate, not realized savings`} />
      </div>
      <p className="text-[13px] text-muted-foreground">
        Planning recommendation only. Placement is not deployment approval, a safety certification, or evidence that required controls or integrations exist. Rules {rm.version}: Now = priority ≥ {PHASE_RULES.nowMinPriority} and effort &lt; {PHASE_RULES.nowMaxEffortExclusive}; Next = priority ≥ {PHASE_RULES.nextMinPriority} and effort &lt; {PHASE_RULES.nextMaxEffortExclusive}; otherwise Later. Non-positive net value always goes to Later.
      </p>

      <div className="grid gap-4 lg:grid-cols-3">
        {lanes.map((l) => (
          <section key={l} aria-labelledby={`lane-${l}`} className="panel flex flex-col">
            <div className="border-b px-4 py-3">
              <div className="flex items-baseline justify-between gap-2">
                <h2 id={`lane-${l}`} className="text-base font-semibold">{SECTION_LABEL[l]} <span className="num text-sm font-normal text-muted-foreground">({rm.totals[l].count})</span></h2>
                <span className="num text-[13px] text-muted-foreground">{fmt(rm.totals[l].net)} net h/mo</span>
              </div>
              <p className="mt-1 text-[13px] text-muted-foreground">{LANE_HINT[l]}</p>
            </div>
            {rm.entries[l].length === 0 ? <p className="p-4 text-sm text-muted-foreground">No workflows in this phase.</p> : (
              <ul className="divide-y">{rm.entries[l].map((e) => <EntryCard key={e.id} e={e} link={link} bpLink={bpLink} />)}</ul>
            )}
          </section>
        ))}
      </div>

      <section aria-labelledby="sec-shared" className="panel">
        <div className="border-b px-4 py-3">
          <h2 id="sec-shared" className="text-base font-semibold">Shared dependencies</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">Required or identified across current assessments. Each workflow counted once per category. No completion status is tracked.</p>
        </div>
        {shared.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No current assessments.</p> : (
          <ul className="divide-y">{shared.map((d) => {
            const auto = d.workflows.filter((w) => !w.humanLed), hl = d.workflows.filter((w) => w.humanLed);
            return (
              <li key={d.category} className="grid gap-2 p-4 text-[13px] md:grid-cols-[14rem_1fr]">
                <div>
                  <h3 className="text-sm font-semibold">{DEP_CATEGORY_LABEL[d.category]}</h3>
                  <p className="num text-muted-foreground">{d.workflows.length} workflow{d.workflows.length === 1 ? "" : "s"}</p>
                  <div className="mt-1 flex flex-wrap gap-1">{d.provenance.map((p) => <ProvenanceBadge key={p} p={p} />)}</div>
                </div>
                <div className="space-y-1">
                  <p><span className="font-medium">Automation candidates: </span>{auto.length ? auto.map((w, i) => <span key={w.id}>{i > 0 && ", "}{bpLink(w.id, w.name)}</span>) : "—"}</p>
                  {hl.length > 0 && <p className="text-muted-foreground"><span className="font-medium">Human-Led (not automation): </span>{hl.map((w, i) => <span key={w.id}>{i > 0 && ", "}{bpLink(w.id, w.name)}</span>)}</p>}
                  <p><span className="font-medium">Suggested action: </span>{d.action}</p>
                </div>
              </li>
            );
          })}</ul>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-labelledby="sec-human" className="panel">
          <div className="border-b px-4 py-3">
            <h2 id="sec-human" className="text-base font-semibold">{SECTION_LABEL.human_led} <span className="num text-sm font-normal text-muted-foreground">({rm.entries.human_led.length})</span></h2>
            <p className="mt-1 text-[13px] text-muted-foreground">Excluded from automation ranking. May warrant manual-process improvement or agent tooling; the recommended model is unchanged.</p>
          </div>
          {rm.entries.human_led.length === 0 ? <p className="p-4 text-sm text-muted-foreground">None.</p> : (
            <ul className="divide-y">{rm.entries.human_led.map((e) => (
              <li key={e.id} className="space-y-1 p-4 text-[13px]">
                <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-semibold">{link(e.id, e.name)}</span><ModelBadge model={e.model} /></div>
                <p><span className="font-medium">Why excluded: </span>{e.reason}</p>
                {e.restrictions.length > 0 && <p className="text-muted-foreground">Restrictions: {e.restrictions.join(", ")}</p>}
                <p className="text-muted-foreground">Next: {e.next_action}</p>
                <p>{bpLink(e.id, <span className="font-medium underline">View blueprint</span>)}</p>
              </li>
            ))}</ul>
          )}
        </section>
        <section aria-labelledby="sec-reassess" className="panel">
          <div className="border-b px-4 py-3">
            <h2 id="sec-reassess" className="text-base font-semibold">{SECTION_LABEL.reassess} <span className="num text-sm font-normal text-muted-foreground">({rm.entries.reassess.length})</span></h2>
            <p className="mt-1 text-[13px] text-muted-foreground">Not ranked and not counted in totals. Old scores are not used.</p>
          </div>
          {rm.entries.reassess.length === 0 ? <p className="p-4 text-sm text-muted-foreground">All workflows have current assessments.</p> : (
            <ul className="divide-y">{rm.entries.reassess.map((e) => (
              <li key={e.id} className="space-y-1 p-4 text-[13px]">
                <div className="text-sm font-semibold">{e.name}</div>
                <p>{e.reason}</p>
                <p>{link(e.id, <span className="font-medium underline">{reassessLabel}</span>)}</p>
              </li>
            ))}</ul>
          )}
        </section>
      </div>
    </div>
  );
}
