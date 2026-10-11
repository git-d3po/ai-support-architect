import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getWorkspace } from "@/lib/workspace.functions";
import { toRows } from "@/lib/workspace-queries";
import { buildReport } from "@/domain/report";
import { ReportView } from "@/components/report/ReportView";

export const Route = createFileRoute("/_authenticated/workspace/report")({
  head: () => ({
    meta: [
      { title: "My assessment report — Support Automation Architect" },
      { name: "description", content: "Executive assessment report derived from your current saved workflow assessments." },
      { property: "og:title", content: "My assessment report — Support Automation Architect" },
      { property: "og:description", content: "Executive assessment report derived from your current saved workflow assessments." },
    ],
  }),
  component: WorkspaceReport,
});

function WorkspaceReport() {
  const fetchWs = useServerFn(getWorkspace);
  const q = useQuery({ queryKey: ["workspace"], queryFn: () => fetchWs() });
  if (q.isPending) return <p role="status" className="text-sm text-muted-foreground">Loading report…</p>;
  if (q.isError) return <p role="alert" className="text-sm text-restrict">Could not load your workspace. Try refreshing.</p>;
  const { org, workflows, latest } = q.data;
  if (!org) return <p className="text-sm">Set up your organization in <Link to="/workspace" className="underline">My workspace</Link> first.</p>;
  const rows = toRows(workflows, latest);
  const prov: Record<string, string> = {};
  for (const [id, s] of Object.entries(latest)) prov[id] = String((s.provenance as Record<string, unknown> | null)?.["all"] ?? "estimate");
  const report = buildReport({ name: org.name, industry: org.industry, support_agent_count: org.support_agent_count, monthly_ticket_volume: org.monthly_ticket_volume, support_channels: org.support_channels, synthetic: false }, rows, prov);
  return (
    <ReportView r={report} sourceNote={`generated ${new Date().toLocaleString()} from latest saved revisions`} links={{
      workflow: (id, c) => <Link to="/workspace/workflows/$workflowId" params={{ workflowId: id }} className="underline-offset-2 hover:underline">{c}</Link>,
      blueprint: (id, c) => <Link to="/workspace/blueprint/$workflowId" params={{ workflowId: id }} className="underline-offset-2 hover:underline">{c}</Link>,
      roadmap: (c) => <Link to="/workspace/roadmap">{c}</Link>,
    }} />
  );
}
