import { assess } from "@/domain/engine";
import { deriveStatus } from "@/domain/portfolio";
import type { TableRow } from "@/components/workflow/WorkflowTable";
import type { SnapshotDTO, WorkflowDTO } from "./workspace.functions";

export function toRows(workflows: WorkflowDTO[], latest: Record<string, SnapshotDTO>): TableRow[] {
  return workflows.map((w) => {
    const s = latest[w.id];
    const result = s?.results ?? null;
    return {
      id: w.id, name: w.name, category: w.category, attrs: w.attrs, result,
      inputs: s?.inputs ?? null, required_systems: w.required_systems, revision: s?.revision ?? null,
      status: deriveStatus(result, s?.workflow_attributes_version ?? null, w.attributes_version, s?.scoring_version ?? null),
    };
  });
}

/** Client preview uses the same engine; the server recomputes on save. */
export const preview = assess;
