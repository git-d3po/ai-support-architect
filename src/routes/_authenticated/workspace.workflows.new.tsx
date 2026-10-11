import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { upsertWorkflow } from "@/lib/workspace.functions";
import { WorkflowForm } from "@/components/workflow/WorkflowForm";

export const Route = createFileRoute("/_authenticated/workspace/workflows/new")({
  head: () => ({
    meta: [
      { title: "New workflow — Support Automation Architect" },
      { name: "description", content: "Add a support workflow to your private workspace." },
      { property: "og:title", content: "New workflow — Support Automation Architect" },
      { property: "og:description", content: "Add a support workflow to your private workspace." },
    ],
  }),
  component: NewWorkflow,
});

function NewWorkflow() {
  const save = useServerFn(upsertWorkflow);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link to="/workspace" className="text-xs text-muted-foreground hover:underline">← Workspace</Link>
      <h1 className="text-2xl font-semibold">New workflow</h1>
      <div className="panel p-5">
        <WorkflowForm
          busy={busy}
          submitLabel="Create workflow"
          initial={{ name: "", category: "product", description: "", current_process: "", required_systems: [],
            attrs: { monthly_volume: 0, aht_minutes: 10, action_type: "read_only", handles_account_access: false, accesses_sensitive_data: false } }}
          onSubmit={async (v) => {
            setBusy(true);
            try {
              const { id } = await save({ data: v });
              await qc.invalidateQueries({ queryKey: ["workspace"] });
              navigate({ to: "/workspace/workflows/$workflowId", params: { workflowId: id } });
            } catch (e) { toast.error(e instanceof Error ? e.message : "Could not create workflow"); } finally { setBusy(false); }
          }}
        />
      </div>
    </div>
  );
}
