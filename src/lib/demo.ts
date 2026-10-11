import { assess } from "@/domain/engine";
import { deriveStatus } from "@/domain/portfolio";
import { getNorthstarWorkflows } from "@/fixtures/northstar";
import type { TableRow } from "@/components/workflow/WorkflowTable";

/** Canonical demo portfolio: synthetic fixture inputs, scored by the same engine as user workflows. */
export function getDemoRows(): TableRow[] {
  return getNorthstarWorkflows().map((w) => {
    const result = assess(w.attrs, w.inputs);
    return { id: w.id, name: w.name, category: w.category, attrs: w.attrs, result, status: deriveStatus(result, null, null), inputs: w.inputs, required_systems: w.required_systems, revision: null };
  });
}
