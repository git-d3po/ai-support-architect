import { Inbox, GitBranch, Search, Sparkles, UserCheck, User, CheckCircle2, Siren } from "lucide-react";
import type { AssessmentResult } from "@/domain/types";
import { futureState, type StepKind } from "@/domain/architecture";
import { cn } from "@/lib/utils";

const ICON: Record<StepKind, typeof Inbox> = {
  intake: Inbox, rules: GitBranch, check: Search, ai: Sparkles, gate: UserCheck, human: User, resolve: CheckCircle2, escalate: Siren,
};
const TONE: Record<StepKind, string> = {
  intake: "border-border", rules: "border-model-det/40 bg-model-det-soft", check: "border-border bg-surface",
  ai: "border-model-assist/40 bg-model-assist-soft", gate: "border-model-human/40 bg-model-human-soft",
  human: "border-model-human/40 bg-model-human-soft", resolve: "border-border", escalate: "border-restrict/40 bg-restrict-soft",
};

export function FutureStateDiagram({ result }: { result: AssessmentResult }) {
  const steps = futureState(result);
  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="text-sm font-semibold">Proposed future-state architecture</h2>
        <span className="text-[11px] text-muted-foreground">Proposal only · not a deployed integration</span>
      </div>
      <div className="p-4">
        {!steps ? (
          <p className="text-sm text-muted-foreground">Available once the assessment is complete.</p>
        ) : (
          <ol className="flex flex-wrap items-stretch gap-2">
            {steps.map((s, idx) => {
              const Icon = ICON[s.kind];
              return (
                <li key={idx} className="flex items-stretch gap-2">
                  <div className={cn("w-40 rounded border p-2.5", TONE[s.kind])}>
                    <div className="flex items-center gap-1.5 text-xs font-semibold"><Icon className="size-3.5" />{s.title}</div>
                    <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{s.detail}</p>
                  </div>
                  {idx < steps.length - 1 && <span className="self-center text-muted-foreground" aria-hidden>→</span>}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
