import type { ReactNode } from "react";
import { DEP_CATEGORY_LABEL, PROVENANCE_LABEL, type Blueprint, type Dependency, type Provenance } from "@/domain/blueprint";
import { SECTION_LABEL } from "@/domain/roadmap";
import { ModelBadge } from "@/components/assessment/ModelBadge";
import { FutureStateDiagram } from "@/components/assessment/FutureStateDiagram";
import type { AssessmentResult } from "@/domain/types";
import { cn } from "@/lib/utils";

const PROV_STYLE: Record<Provenance, string> = {
  mandatory: "border-restrict/40 bg-restrict-soft text-restrict",
  assessment: "border-model-det/30 bg-model-det-soft text-model-det",
  inference: "border-dashed border-border text-muted-foreground",
  unspecified: "border-sim/50 bg-sim-soft text-foreground",
};

export function ProvenanceBadge({ p }: { p: Provenance }) {
  return <span className={cn("inline-flex whitespace-nowrap rounded border px-1.5 py-0.5 text-xs font-medium", PROV_STYLE[p])}>{PROVENANCE_LABEL[p]}</span>;
}

function Section({ title, children, id }: { title: string; children: ReactNode; id: string }) {
  return (
    <section aria-labelledby={id} className="panel">
      <div className="panel-head"><h2 id={id} className="text-base font-semibold">{title}</h2></div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function List({ items, empty = "None." }: { items: string[]; empty?: string }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return <ul className="list-disc space-y-1 pl-5 text-sm">{items.map((x) => <li key={x}>{x}</li>)}</ul>;
}

export function BlueprintView({ bp, result, name, description, links }: { bp: Blueprint; result: AssessmentResult | null; name: string; description: string; links: ReactNode }) {
  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <span className="eyebrow">Implementation blueprint</span>
        <h1 className="text-2xl font-semibold">{name}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">{description}</p>
        <div className="flex flex-wrap gap-3 text-sm">{links}</div>
      </header>

      {!bp.current ? (
        <div role="status" className="rounded border border-sim/50 bg-sim-soft p-4 text-sm">
          <p className="font-semibold">No current blueprint.</p>
          <p className="mt-1">{bp.reason} No operating model, priority or impact is shown until the assessment is current.</p>
        </div>
      ) : (
        <>
          <p role="note" className="rounded border border-dashed px-4 py-2.5 text-sm">
            <span className="font-semibold">Proposed future-state design — not an implemented or validated automation.</span>{" "}
            Listed controls and dependencies carry no completion status; none are known to exist.
          </p>

          <Section id="bp-model" title="A. Proposed operating model">
            <div className="flex flex-wrap items-center gap-3">
              <ModelBadge model={bp.model} size="lg" />
              <span className="rounded border px-2 py-1 text-sm">Roadmap: <span className="font-medium">{SECTION_LABEL[bp.phase]}</span></span>
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-3 text-sm sm:max-w-md">
              <div><dt className="text-muted-foreground">Suitability</dt><dd className="num font-semibold">{bp.scores.suitability}</dd></div>
              <div><dt className="text-muted-foreground">Risk</dt><dd className="num font-semibold">{bp.scores.risk}</dd></div>
              <div><dt className="text-muted-foreground">Effort</dt><dd className="num font-semibold">{bp.scores.effort}</dd></div>
            </dl>
            <p className="mt-3 text-sm"><span className="font-medium">Phase reason: </span>{bp.phaseReason}</p>
            <p className="mt-2 text-sm"><span className="font-medium">Automation boundary: </span>{bp.boundary}</p>
            {bp.restrictions.length > 0 && (
              <div className="mt-3">
                <h3 className="text-sm font-medium">Safety restrictions</h3>
                <ul className="mt-1 space-y-1 text-sm">{bp.restrictions.map((r) => <li key={r.code}><span className="font-medium">{r.label}</span> — <span className="text-muted-foreground">{r.effect}</span></li>)}</ul>
              </div>
            )}
            <div className="mt-3"><h3 className="text-sm font-medium">Assumptions</h3><List items={bp.assumptions} /></div>
            <p className="num mt-3 text-[13px] text-muted-foreground">Derived from {bp.revision != null ? `saved revision ${bp.revision}` : "canonical demo inputs"} · scoring v{bp.scoring_version} · {bp.version}</p>
          </Section>

          <Section id="bp-resp" title="B. Responsibility boundaries">
            <div className="grid gap-4 md:grid-cols-3">
              <div><h3 className="mb-1 flex items-center gap-2 text-sm font-semibold"><span className="size-2.5 rounded-full bg-model-det" aria-hidden />Deterministic systems</h3><List items={bp.responsibilities.deterministic} /></div>
              <div><h3 className="mb-1 flex items-center gap-2 text-sm font-semibold"><span className="size-2.5 rounded-full bg-model-assist" aria-hidden />AI systems</h3><List items={bp.responsibilities.ai} empty={bp.responsibilities.aiNote ?? "None."} /></div>
              <div><h3 className="mb-1 flex items-center gap-2 text-sm font-semibold"><span className="size-2.5 rounded-full bg-model-human" aria-hidden />Human operators</h3><List items={bp.responsibilities.human} /></div>
            </div>
          </Section>

          {result && <FutureStateDiagram result={result} />}

          <Section id="bp-matrix" title="D. Control and action boundaries">
            <div className="grid gap-4 md:grid-cols-2">
              <div><h3 className="mb-1 text-sm font-semibold">Proposed automated activities</h3><List items={bp.matrix.automated} empty="None — not proposed for automation." /></div>
              <div><h3 className="mb-1 text-sm font-semibold">Requires human approval</h3><List items={bp.matrix.approval} /></div>
              <div><h3 className="mb-1 text-sm font-semibold">Restricted or prohibited for automation</h3><List items={bp.matrix.prohibited} /></div>
              <div><h3 className="mb-1 text-sm font-semibold">Escalation conditions</h3><List items={bp.matrix.escalation} /></div>
            </div>
            <h3 className="mb-1 mt-4 text-sm font-semibold">Required safeguards <span className="font-normal text-muted-foreground">· status: required, unverified</span></h3>
            <ul className="divide-y rounded border">{bp.matrix.safeguards.map((c) => <li key={c.code} className="flex flex-wrap items-start justify-between gap-2 px-3 py-2 text-sm"><span>{c.text}</span><ProvenanceBadge p={c.provenance} /></li>)}</ul>
          </Section>

          <Section id="bp-deps" title="Implementation dependencies">
            <DependencyList deps={bp.dependencies} />
          </Section>

          <Section id="bp-approach" title="Proposed implementation approach">
            {bp.approach.pilotBlockedBy.length > 0 && (
              <p className="mb-3 rounded border border-restrict/40 bg-restrict-soft px-3 py-2 text-sm"><span className="font-semibold">Not ready to pilot</span> until these mandatory prerequisites are established: {bp.approach.pilotBlockedBy.join("; ")}.</p>
            )}
            <ol className="grid gap-3 md:grid-cols-4">
              {([["Define", bp.approach.define], ["Prepare", bp.approach.prepare], ["Pilot", bp.approach.pilot], ["Expand", bp.approach.expand]] as const).map(([t, xs], i) => (
                <li key={t} className="rounded border p-3"><h3 className="mb-1 text-sm font-semibold"><span className="num text-muted-foreground">{i + 1}.</span> {t}</h3><List items={[...xs]} /></li>
              ))}
            </ol>
            <h3 className="mb-1 mt-4 text-sm font-semibold">Suggested validation criteria</h3>
            <List items={bp.validation} />
            <p className="mt-2 text-[13px] text-muted-foreground">Planning steps only — not recorded milestones, and not a launch-readiness assessment.</p>
          </Section>
        </>
      )}
    </div>
  );
}

export function DependencyList({ deps }: { deps: Dependency[] }) {
  if (!deps.length) return <p className="text-sm text-muted-foreground">No dependencies identified.</p>;
  const cats = [...new Set(deps.map((d) => d.category))];
  return (
    <div className="space-y-3">
      <p className="text-[13px] text-muted-foreground">Origins: Mandatory control = required by a safety rule · Assessment-derived = from entered inputs · Planning inference = suggested by the operating model, not a confirmed blocker · Unspecified = information needed.</p>
      {cats.map((c) => (
        <div key={c}>
          <h3 className="mb-1 text-sm font-semibold">{DEP_CATEGORY_LABEL[c]}</h3>
          <ul className="divide-y rounded border">{deps.filter((d) => d.category === c).map((d) => <li key={d.key} className="flex flex-wrap items-start justify-between gap-2 px-3 py-2 text-sm"><span>{d.text}</span><ProvenanceBadge p={d.provenance} /></li>)}</ul>
        </div>
      ))}
    </div>
  );
}
