import { cn } from "@/lib/utils";
import { MODEL_LABEL, type ModelOutcome } from "@/domain/types";
import type { AssessmentStatus } from "@/domain/portfolio";
import { STATUS_LABEL } from "@/domain/portfolio";

const MODEL_STYLE: Record<ModelOutcome, string> = {
  deterministic: "bg-model-det-soft text-model-det border-model-det/30",
  ai_assisted: "bg-model-assist-soft text-model-assist border-model-assist/30",
  ai_autonomous: "bg-model-auto-soft text-model-auto border-model-auto/30",
  human_led: "bg-model-human-soft text-model-human border-model-human/30",
  insufficient_data: "bg-model-none-soft text-model-none border-model-none/30",
};

export const MODEL_DOT: Record<ModelOutcome, string> = {
  deterministic: "bg-model-det",
  ai_assisted: "bg-model-assist",
  ai_autonomous: "bg-model-auto",
  human_led: "bg-model-human",
  insufficient_data: "bg-model-none",
};

export function ModelBadge({ model, size = "sm" }: { model: ModelOutcome | null; size?: "sm" | "lg" }) {
  const m = model ?? "insufficient_data";
  const label = model ? MODEL_LABEL[m] : "Not Assessed";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded border font-medium",
        size === "lg" ? "px-2.5 py-1 text-sm" : "px-1.5 py-0.5 text-xs",
        MODEL_STYLE[m],
      )}
    >
      <span className={cn("size-1.5 rounded-full", MODEL_DOT[m])} aria-hidden />
      {label}
    </span>
  );
}

const STATUS_STYLE: Record<AssessmentStatus, string> = {
  not_assessed: "text-muted-foreground border-border",
  incomplete: "text-model-none border-model-none/40",
  stale: "text-sim border-sim/50 bg-sim-soft",
  assessed: "text-foreground border-border",
};

export function StatusBadge({ status }: { status: AssessmentStatus }) {
  return (
    <span className={cn("inline-flex rounded border px-1.5 py-0.5 text-xs", STATUS_STYLE[status])}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function SyntheticBadge() {
  return (
    <span className="inline-flex items-center rounded border border-dashed border-muted-foreground/50 px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
      Synthetic data
    </span>
  );
}
