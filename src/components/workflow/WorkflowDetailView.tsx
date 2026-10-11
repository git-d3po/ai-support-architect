import type { ReactNode } from "react";
import type { AssessmentResult, Category, WorkflowAttributes } from "@/domain/types";
import { ACTION_LABEL, CATEGORY_LABEL } from "@/domain/types";
import { RecommendationPanel, RestrictionsPanel, ImpactPanel } from "@/components/assessment/ResultPanels";
import { FutureStateDiagram } from "@/components/assessment/FutureStateDiagram";

export interface WorkflowMeta {
  name: string;
  category: Category;
  description: string;
  current_process: string;
  required_systems: string[];
}

export function WorkflowDetailView({
  meta, attrs, result, banner, actions, editor, badges,
}: {
  meta: WorkflowMeta;
  attrs: WorkflowAttributes;
  result: AssessmentResult;
  banner?: ReactNode;
  actions?: ReactNode;
  editor: ReactNode;
  badges?: ReactNode;
}) {
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2"><span className="eyebrow">{CATEGORY_LABEL[meta.category]}</span>{badges}</div>
          <h1 className="text-2xl font-semibold">{meta.name}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{meta.description}</p>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </header>
      {banner}
      <section className="panel grid gap-4 p-4 text-sm md:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
        <div><span className="eyebrow block">Current process</span>{meta.current_process || "—"}</div>
        <div><span className="eyebrow block">Monthly volume</span><span className="num">{attrs.monthly_volume.toLocaleString()}</span></div>
        <div><span className="eyebrow block">AHT</span><span className="num">{attrs.aht_minutes} min</span></div>
        <div><span className="eyebrow block">Action type</span>{ACTION_LABEL[attrs.action_type]}{attrs.handles_account_access && <div className="text-xs text-muted-foreground">Account access</div>}{attrs.accesses_sensitive_data && <div className="text-xs text-muted-foreground">Sensitive data</div>}</div>
        <div><span className="eyebrow block">Required systems</span>{meta.required_systems.length ? meta.required_systems.join(", ") : "—"}</div>
      </section>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,460px)]">
        <div className="space-y-5">
          <RecommendationPanel result={result} />
          <RestrictionsPanel result={result} />
          <ImpactPanel result={result} attrs={attrs} />
          <FutureStateDiagram result={result} />
        </div>
        <div>
          <h2 className="eyebrow mb-2">Assessment inputs</h2>
          {editor}
        </div>
      </div>
    </div>
  );
}
