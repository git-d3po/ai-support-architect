import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { getWorkspace, createOrganization } from "@/lib/workspace.functions";
import { toRows } from "@/lib/workspace-queries";
import { OverviewView } from "@/components/overview/OverviewView";
import { WorkflowTable } from "@/components/workflow/WorkflowTable";

export const Route = createFileRoute("/_authenticated/workspace/")({
  head: () => ({
    meta: [
      { title: "My workspace — Support Automation Architect" },
      { name: "description", content: "Your private support workflow assessments." },
      { property: "og:title", content: "My workspace — Support Automation Architect" },
      { property: "og:description", content: "Your private support workflow assessments." },
    ],
  }),
  component: Workspace,
});

function Workspace() {
  const fetchWs = useServerFn(getWorkspace);
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ["workspace"], queryFn: () => fetchWs() });
  if (q.isPending) return <p className="text-sm text-muted-foreground">Loading workspace…</p>;
  if (q.isError) return <p className="text-sm text-restrict">Could not load your workspace. Try refreshing.</p>;
  const { org, workflows, latest } = q.data;
  if (!org) return <OrgSetup />;
  const rows = toRows(workflows, latest);
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow">Private workspace</span>
          <h1 className="text-2xl font-semibold">{org.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{org.industry || "—"} · {org.support_agent_count} agents · {org.monthly_ticket_volume.toLocaleString()} tickets / month</p>
        </div>
        <div className="flex gap-2"><Link to="/workspace/report" className="rounded border px-3 py-1.5 text-sm font-medium hover:bg-accent">Report</Link><Link to="/workspace/roadmap" className="rounded border px-3 py-1.5 text-sm font-medium hover:bg-accent">Roadmap</Link><Link to="/workspace/workflows/new" className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">New workflow</Link></div>
      </header>
      {rows.length === 0 ? (
        <div className="panel p-8 text-center text-sm text-muted-foreground">No workflows yet. Add your first workflow to assess it.</div>
      ) : (
        <>
          <OverviewView items={rows} orgVolume={org.monthly_ticket_volume} onSelectWorkflow={(id) => navigate({ to: "/workspace/workflows/$workflowId", params: { workflowId: id } })}
        renderLink={(it, c) => <Link to="/workspace/workflows/$workflowId" params={{ workflowId: it.id }} className="hover:underline">{c}</Link>} />
          <h2 className="text-sm font-semibold">Workflow inventory</h2>
          <WorkflowTable rows={rows} renderName={(r) => <Link to="/workspace/workflows/$workflowId" params={{ workflowId: r.id }} className="hover:underline">{r.name}</Link>} />
        </>
      )}
    </div>
  );
}

function OrgSetup() {
  const create = useServerFn(createOrganization);
  const qc = useQueryClient();
  const [f, setF] = useState({ name: "", industry: "", agents: "", volume: "", channels: "Email, Chat" });
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      await create({ data: {
        name: f.name, industry: f.industry,
        support_agent_count: Math.max(0, Math.round(Number(f.agents) || 0)),
        monthly_ticket_volume: Math.max(0, Math.round(Number(f.volume) || 0)),
        support_channels: f.channels.split(",").map((s) => s.trim()).filter(Boolean),
      } });
      await qc.invalidateQueries({ queryKey: ["workspace"] });
      toast.success("Organization created");
    } catch { toast.error("Could not create organization"); } finally { setBusy(false); }
  }
  const field = (k: keyof typeof f, label: string, type = "text") => (
    <label className="block text-sm"><span className="eyebrow mb-1 block">{label}</span>
      <input required={k === "name"} type={type} min={0} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} className="h-9 w-full rounded border bg-card px-2" /></label>
  );
  return (
    <form onSubmit={submit} className="panel mx-auto mt-6 max-w-lg space-y-3 p-6">
      <h1 className="text-lg font-semibold">Set up your organization</h1>
      <p className="text-xs text-muted-foreground">Used for portfolio totals. Workflow volumes should be mutually exclusive primary intents within this monthly volume.</p>
      {field("name", "Organization name")}
      {field("industry", "Industry")}
      <div className="grid grid-cols-2 gap-3">{field("agents", "Support agents", "number")}{field("volume", "Monthly tickets", "number")}</div>
      {field("channels", "Channels (comma-separated)")}
      <button disabled={busy} className="h-9 rounded bg-primary px-4 text-sm font-medium text-primary-foreground">Create organization</button>
    </form>
  );
}
