import { ShieldAlert, CheckCircle2, AlertTriangle, ArrowRight, Wrench } from "lucide-react";
import type { AssessmentResult, WorkflowAttributes } from "@/domain/types";
import { THRESHOLDS } from "@/domain/engine";
import { ModelBadge } from "./ModelBadge";
import { cn } from "@/lib/utils";

function ScoreBar({ label, value, hint, invert }: { label: string; value: number | null; hint: string; invert?: boolean }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="num text-xl font-semibold">{value ?? "—"}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        {value != null && (
          <div className={cn("h-full rounded-full", invert ? "bg-model-human" : "bg-primary")} style={{ width: `${value}%` }} />
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}

export function ScoreTriplet({ result }: { result: AssessmentResult }) {
  return (
    <div className="grid grid-cols-3 gap-5">
      <ScoreBar label="Automation suitability" value={result.scores.suitability} hint="Higher = more suitable" />
      <ScoreBar label="Operational risk" value={result.scores.risk} hint="Higher = more risk" invert />
      <ScoreBar label="Implementation effort" value={result.scores.effort} hint="Higher = more effort" invert />
    </div>
  );
}

export function RecommendationPanel({ result }: { result: AssessmentResult }) {
  return (
    <section className="panel" aria-labelledby="rec-h">
      <div className="panel-head">
        <h2 id="rec-h" className="text-sm font-semibold">Recommendation</h2>
        <span className="num text-[11px] text-muted-foreground">rule {result.rule} · v{result.scoring_version}</span>
      </div>
      <div className="space-y-5 p-4">
        <div className="flex flex-wrap items-center gap-3" data-testid="recommended-model">
          <ModelBadge model={result.model} size="lg" />
          {result.model === "insufficient_data" && (
            <span className="text-sm text-muted-foreground">Recommendation withheld until required inputs are complete.</span>
          )}
        </div>
        <ScoreTriplet result={result} />
        {result.missing.length > 0 && (
          <div className="rounded border border-model-none/30 bg-model-none-soft p-3 text-xs">
            <p className="mb-1 font-medium">Missing evidence ({result.missing.length})</p>
            <p className="text-muted-foreground">{result.missing.map((m) => (m.split(".")[1] ?? m).replaceAll("_", " ")).join(", ")}</p>
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          <ExplainList title="Primary drivers" icon={<CheckCircle2 className="size-3.5 text-model-auto" />} items={result.drivers} empty="No positive drivers." />
          <ExplainList title="Limiting factors" icon={<AlertTriangle className="size-3.5 text-model-human" />} items={result.limits} empty="None." />
        </div>
        <div className="flex items-start gap-2 rounded bg-surface p-3 text-sm">
          <ArrowRight className="mt-0.5 size-4 shrink-0 text-primary" />
          <div><span className="eyebrow block">Recommended next step</span>{result.next_step.text}</div>
        </div>
      </div>
    </section>
  );
}

function ExplainList({ title, icon, items, empty }: { title: string; icon: React.ReactNode; items: { code: string; text: string }[]; empty: string }) {
  return (
    <div>
      <h3 className="eyebrow mb-2">{title}</h3>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((d) => (
            <li key={d.code} className="flex gap-2 text-sm">{icon && <span className="mt-0.5">{icon}</span>}<span>{d.text}</span></li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function RestrictionsPanel({ result }: { result: AssessmentResult }) {
  return (
    <section className="panel">
      <div className="panel-head"><h2 className="text-sm font-semibold">Safety restrictions & required controls</h2></div>
      <div className="space-y-4 p-4">
        {result.restrictions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No safety restrictions triggered.</p>
        ) : (
          <ul className="space-y-2">
            {result.restrictions.map((r) => (
              <li key={r.code} className="flex gap-2.5 rounded border border-restrict/25 bg-restrict-soft p-2.5 text-sm">
                <ShieldAlert className="mt-0.5 size-4 shrink-0 text-restrict" />
                <div>
                  <div className="font-medium">{r.label} <span className="num ml-1 text-[11px] font-normal text-muted-foreground">{r.code.split("_")[0]} · {r.source}</span></div>
                  <div className="text-muted-foreground">{r.effect}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
        {result.controls.length > 0 && (
          <div>
            <h3 className="eyebrow mb-2">Required operational controls</h3>
            <ul className="space-y-1.5">
              {result.controls.map((c) => (
                <li key={c.code} className="flex gap-2 text-sm"><Wrench className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />{c.text}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

const fmt = (n: number | null, d = 1) => (n == null ? "—" : n.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: 0 }));

export function ImpactPanel({ result, attrs }: { result: AssessmentResult; attrs: WorkflowAttributes }) {
  const im = result.impact;
  const p = result.priority;
  const catLabel: Record<typeof p.category, string> = {
    automation_candidate: "Automation candidate",
    not_automation_candidate: "Not an automation candidate",
    needs_assessment: "Needs assessment",
    needs_reassessment: "Needs re-assessment",
    impact_unavailable: "Priority unavailable (impact estimate missing)",
  };
  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="text-sm font-semibold">Modeled monthly opportunity</h2>
        <span className="text-[11px] text-muted-foreground">Scenario estimate · not yet validated in production</span>
      </div>
      <div className="space-y-4 p-4">
        {!im.available && im.gross_hours == null ? (
          <p className="text-sm"><span className="font-medium">Estimate unavailable.</span> <span className="text-muted-foreground">Missing: {im.missing.map((m) => (m.split(".")[1] ?? m).replaceAll("_", " ")).join(", ")}</span></p>
        ) : (
          <dl className="grid grid-cols-5 gap-3 text-sm">
            {[
              ["Eligible tickets", fmt(im.eligible, 0)],
              ["Affected tickets", fmt(im.affected, 0)],
              ["Gross hours", fmt(im.gross_hours)],
              ["Review hours", fmt(im.review_hours)],
              ["Net modeled hours", fmt(im.net_hours)],
            ].map(([k, v]) => (
              <div key={k}><dt className="text-[11px] text-muted-foreground">{k}</dt><dd className={cn("num text-base font-semibold", k?.startsWith("Net") && im.unfavorable && "text-restrict")}>{v}</dd></div>
            ))}
          </dl>
        )}
        {im.unfavorable && <p className="rounded border border-restrict/25 bg-restrict-soft p-2 text-xs">Unfavorable scenario: review effort exceeds modeled handling-time reduction.</p>}
        <p className="num text-[11px] leading-relaxed text-muted-foreground">
          eligible = {attrs.monthly_volume.toLocaleString()} vol × addressable · affected = eligible × coverage · gross = affected × {attrs.aht_minutes} min AHT × reduction ÷ 60 · review = affected × reviewed × review min ÷ 60 · net = gross − review. Excludes maintenance and tooling overhead.
        </p>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t pt-3 text-sm">
          <div><span className="eyebrow block">Prioritization</span>{catLabel[p.category]}{p.control_process_improvement && p.category === "not_automation_candidate" ? " · control/process improvement" : ""}</div>
          <div><span className="eyebrow block">Priority</span><span className="num font-semibold">{p.score ?? "—"}</span></div>
          <div><span className="eyebrow block">Impact index</span><span className="num">{p.impact_index ?? "—"}</span></div>
          <div><span className="eyebrow block">Control readiness</span><span className="num">{p.control_readiness ?? "—"}</span></div>
        </div>
        <p className="text-[11px] text-muted-foreground">Priority = 0.40·impact index + 0.25·(100−effort) + 0.20·(100−risk) + 0.15·control readiness. Impact index caps at {THRESHOLDS.impactCapHours} net h. Weights are uncalibrated v1 design assumptions.</p>
      </div>
    </section>
  );
}
