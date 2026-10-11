import { FACTORS, LANGUAGE_REASONING_ANCHORS } from "@/domain/rubrics";
import type { AssessmentInputs, FactorKey, ImpactAssumptions, Ordinal, ValidationError, WorkflowAttributes, ActionType } from "@/domain/types";
import { ACTION_LABEL } from "@/domain/types";
import { cn } from "@/lib/utils";

const ORD: Ordinal[] = [0, 1, 2, 3, 4];

function Segmented({ value, onChange, label, disabled, anchors }: { value: Ordinal | null | undefined; onChange: (v: Ordinal | null) => void; label: string; disabled?: boolean | undefined; anchors?: Record<number, string> | readonly string[] }) {
  const focusIdx = value ?? 0;
  const onKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const d = e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : 0;
    if (!d || disabled) return;
    e.preventDefault();
    const next = Math.min(4, Math.max(0, (value ?? (d > 0 ? -1 : 5)) + d)) as Ordinal;
    onChange(next);
    (e.currentTarget.querySelectorAll("button")[next] as HTMLButtonElement | undefined)?.focus();
  };
  return (
    <div role="radiogroup" aria-label={`${label}, 0 to 4`} onKeyDown={onKey} className="grid w-full grid-cols-5 overflow-hidden rounded border bg-card sm:inline-grid sm:w-auto">
      {ORD.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={value === o}
          aria-label={anchors?.[o] ? `${o}: ${anchors[o]}` : String(o)}
          tabIndex={o === focusIdx ? 0 : -1}
          disabled={disabled}
          onClick={() => onChange(value === o ? null : o)}
          className={cn(
            "num h-11 border-r text-sm last:border-r-0 sm:h-8 sm:w-9 focus-visible:outline-2 focus-visible:outline-ring focus-visible:-outline-offset-2",
            value === o ? "bg-primary font-semibold text-primary-foreground" : "hover:bg-accent",
          )}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function errFor(errors: ValidationError[], field: string) {
  return errors.filter((e) => e.field === field);
}

function FieldErrors({ errors }: { errors: ValidationError[] }) {
  if (!errors.length) return null;
  return <>{errors.map((e, i) => <p key={i} role="alert" aria-live="polite" className="mt-1 text-[13px] text-restrict">{e.message}</p>)}</>;
}

function Group({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <fieldset className="panel">
      <legend className="sr-only">{title}</legend>
      <div className="panel-head"><h3 className="text-sm font-semibold">{title}</h3>{subtitle && <span className="text-[13px] text-muted-foreground">{subtitle}</span>}</div>
      <div className="divide-y">{children}</div>
    </fieldset>
  );
}

export function AssessmentEditor({
  inputs, onChange, errors, attrs, disabled,
}: {
  inputs: AssessmentInputs;
  onChange: (next: AssessmentInputs) => void;
  errors: ValidationError[];
  attrs: WorkflowAttributes;
  disabled?: boolean;
}) {
  const setFactor = (k: FactorKey, v: Ordinal | null) => onChange({ ...inputs, factors: { ...inputs.factors, [k]: v } });
  const setAttr = <K extends keyof AssessmentInputs["attributes"]>(k: K, v: AssessmentInputs["attributes"][K]) =>
    onChange({ ...inputs, attributes: { ...inputs.attributes, [k]: v } });
  const setImpact = (k: keyof ImpactAssumptions, raw: string) => {
    const v = raw.trim() === "" ? null : Number(raw);
    onChange({ ...inputs, impact: { ...inputs.impact, [k]: v != null && Number.isFinite(v) ? v : null } });
  };

  const dims = [
    { key: "suitability", title: "Automation suitability", subtitle: "0 = least suitable · 4 = most suitable" },
    { key: "risk", title: "Operational risk", subtitle: "0 = lowest risk · 4 = highest risk" },
    { key: "effort", title: "Implementation effort", subtitle: "0 = no gap · 4 = largest gap" },
  ] as const;

  return (
    <div className="space-y-4">
      {dims.map((d) => (
        <Group key={d.key} title={d.title} subtitle={d.subtitle}>
          {FACTORS.filter((f) => f.dimension === d.key).map((f) => {
            const v = inputs.factors[f.key];
            const fe = errFor(errors, `factors.${f.key}`);
            return (
              <div key={f.key} className={cn("grid gap-2 px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-start sm:gap-4 sm:py-2.5", fe.length && "bg-restrict-soft")}>
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2 text-sm font-medium">
                    {f.label}<span className="num text-[13px] font-normal text-muted-foreground">{Math.round(f.weight * 100)}%</span>
                  </div>
                  <p className="text-[13px] text-muted-foreground">{v != null ? <><span className="font-medium text-foreground">{v}:</span> {f.anchors[v]}</> : <span className="text-model-none">Not provided — {f.description}</span>}</p>
                  <FieldErrors errors={fe} />
                </div>
                <Segmented label={f.label} value={v} onChange={(x) => setFactor(f.key, x)} disabled={disabled} anchors={f.anchors} />
              </div>
            );
          })}
        </Group>
      ))}

      <Group title="Decision attributes" subtitle="Not weighted; used by the rules">
        <div className="grid gap-2 px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-start sm:gap-4 sm:py-2.5">
          <div>
            <div className="text-sm font-medium">Language reasoning required</div>
            <p className="text-[13px] text-muted-foreground">{inputs.attributes.language_reasoning != null ? LANGUAGE_REASONING_ANCHORS[inputs.attributes.language_reasoning] : <span className="text-model-none">Not provided</span>}</p>
          </div>
          <Segmented label="Language reasoning" value={inputs.attributes.language_reasoning} onChange={(x) => setAttr("language_reasoning", x)} disabled={disabled} anchors={LANGUAGE_REASONING_ANCHORS} />
        </div>
        <TriState label="Authoritative policy available" value={inputs.attributes.authoritative_policy_available} onChange={(x) => setAttr("authoritative_policy_available", x)} disabled={disabled} />
        {attrs.handles_account_access && (
          <TriState
            label="Verified recovery control in place"
            help="E.g. email/MFA token verification. Required for any automation of account access."
            value={inputs.attributes.verified_recovery_control}
            onChange={(x) => setAttr("verified_recovery_control", x)}
            disabled={disabled}
            errors={errFor(errors, "attributes.verified_recovery_control")}
          />
        )}
      </Group>

      <Group title="Declared risks" subtitle="Can only add restrictions">
        <label className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
          <span><span className="font-medium">Suspected account compromise</span><span className="block text-[13px] text-muted-foreground">Forces security-led, Human-Led handling.</span></span>
          <input type="checkbox" className="size-4 accent-[var(--restrict)]" checked={inputs.declared.suspected_account_compromise} disabled={disabled}
            onChange={(e) => onChange({ ...inputs, declared: { ...inputs.declared, suspected_account_compromise: e.target.checked } })} />
        </label>
      </Group>

      <Group title="Impact assumptions" subtitle="Fractions between 0 and 1 · scenario estimates">
        {([
          ["addressable_fraction", "Addressable fraction", "Share of this intent's volume in scope for the model."],
          ["coverage", "Coverage", "Share of eligible tickets actually handled by the solution."],
          ["expected_reduction", "Expected handling-time reduction", "Fraction of AHT removed for affected tickets."],
          ["reviewed_fraction", "Reviewed-case fraction", "Share of affected tickets that a human reviews."],
          ["review_minutes", "Review minutes per case", "Average minutes spent reviewing one case."],
        ] as const).map(([k, label, help]) => (
          <label key={k} className="grid grid-cols-[1fr_7rem] items-center gap-4 px-4 py-2 text-sm">
            <span><span className="font-medium">{label}</span><span className="block text-[13px] text-muted-foreground">{help}</span><FieldErrors errors={errFor(errors, `impact.${k}`)} /></span>
            <input
              type="number" inputMode="decimal" step={k === "review_minutes" ? 0.5 : 0.05} min={0} max={k === "review_minutes" ? 240 : 1}
              disabled={disabled}
              aria-label={label}
              value={inputs.impact[k] ?? ""}
              onChange={(e) => setImpact(k, e.target.value)}
              className="num h-11 rounded border bg-card px-2 text-right text-sm sm:h-8"
              placeholder="—"
            />
          </label>
        ))}
      </Group>
    </div>
  );
}

function TriState({ label, help, value, onChange, disabled, errors = [] }: { label: string; help?: string; value: boolean | null; onChange: (v: boolean | null) => void; disabled?: boolean | undefined; errors?: ValidationError[] }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-4 px-4 py-2.5">
      <div><div className="text-sm font-medium">{label}</div>{help && <p className="text-[13px] text-muted-foreground">{help}</p>}{value == null && <p className="text-[13px] text-model-none">Not provided</p>}<FieldErrors errors={errors} /></div>
      <div role="radiogroup" aria-label={label} className="inline-flex overflow-hidden rounded border bg-card">
        {([[true, "Yes"], [false, "No"]] as const).map(([v, l]) => (
          <button key={l} type="button" role="radio" aria-checked={value === v} disabled={disabled}
            onClick={() => onChange(value === v ? null : v)}
            className={cn("h-11 min-w-14 px-3 text-sm border-r last:border-r-0 sm:h-8", value === v ? "bg-primary text-primary-foreground" : "hover:bg-accent")}>{l}</button>
        ))}
      </div>
    </div>
  );
}

export function WorkflowAttributesEditor({ attrs, onChange, disabled }: { attrs: WorkflowAttributes; onChange: (a: WorkflowAttributes) => void; disabled?: boolean }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm"><span className="eyebrow mb-1 block">Monthly volume</span>
        <input type="number" min={0} className="num h-8 w-full rounded border bg-card px-2" value={attrs.monthly_volume} disabled={disabled}
          onChange={(e) => onChange({ ...attrs, monthly_volume: Math.max(0, Math.round(Number(e.target.value) || 0)) })} /></label>
      <label className="text-sm"><span className="eyebrow mb-1 block">Average handle time (min)</span>
        <input type="number" min={0.5} step={0.5} className="num h-8 w-full rounded border bg-card px-2" value={attrs.aht_minutes} disabled={disabled}
          onChange={(e) => onChange({ ...attrs, aht_minutes: Math.max(0.5, Number(e.target.value) || 0.5) })} /></label>
      <label className="text-sm"><span className="eyebrow mb-1 block">Action type</span>
        <select className="h-8 w-full rounded border bg-card px-2" value={attrs.action_type} disabled={disabled}
          onChange={(e) => onChange({ ...attrs, action_type: e.target.value as ActionType })}>
          {(Object.keys(ACTION_LABEL) as ActionType[]).map((k) => <option key={k} value={k}>{ACTION_LABEL[k]}</option>)}
        </select></label>
      <div className="flex flex-col justify-end gap-1.5 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={attrs.handles_account_access} disabled={disabled} onChange={(e) => onChange({ ...attrs, handles_account_access: e.target.checked })} />Handles account access</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={attrs.accesses_sensitive_data} disabled={disabled} onChange={(e) => onChange({ ...attrs, accesses_sensitive_data: e.target.checked })} />Accesses sensitive data</label>
      </div>
    </div>
  );
}

export function CompletenessMeter({ missing, total }: { missing: number; total: number }) {
  const pct = Math.round(((total - missing) / total) * 100);
  return (
    <div className="flex items-center gap-2 text-xs" aria-label={`Assessment ${pct}% complete`}>
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${pct}%` }} /></div>
      <span className="num text-muted-foreground">{total - missing}/{total} inputs</span>
    </div>
  );
}
