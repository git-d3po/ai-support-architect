import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { OverviewView } from "@/components/overview/OverviewView";
import { SyntheticBadge } from "@/components/assessment/ModelBadge";
import { NORTHSTAR_ORG } from "@/fixtures/northstar";
import { getDemoRows } from "@/lib/demo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Northstar Cloud demo — Support Automation Architect" },
      { name: "description", content: "Explainable, safety-gated automation recommendations for 15 synthetic B2B SaaS support workflows." },
      { property: "og:title", content: "Northstar Cloud demo — Support Automation Architect" },
      { property: "og:description", content: "See which support workflows suit deterministic automation, AI assistance, bounded autonomy or human-led handling." },
    ],
  }),
  component: DemoOverview,
});

function DemoOverview() {
  const rows = useMemo(() => getDemoRows(), []);
  const navigate = useNavigate();
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2"><span className="eyebrow">Demo organization</span><SyntheticBadge /></div>
          <h1 className="text-2xl font-semibold">{NORTHSTAR_ORG.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {NORTHSTAR_ORG.industry} · {NORTHSTAR_ORG.support_agent_count} agents · {NORTHSTAR_ORG.monthly_ticket_volume.toLocaleString()} tickets / month · {NORTHSTAR_ORG.support_channels.join(", ")}
          </p>
        </div>
        <div className="max-w-md space-y-2">
          <p className="text-sm text-muted-foreground">
            A fictional B2B SaaS support team. Each workflow is scored separately for suitability, risk, effort and modeled impact; safety restrictions override scores. Figures are scenario estimates on synthetic data.
          </p>
          <ol className="list-inside list-decimal text-[13px] text-muted-foreground"><li>Pick a workflow from the inventory or chart.</li><li>Review its recommendation and restrictions.</li><li>Change the assessment inputs to see the result update (not saved).</li></ol>
          <Link to="/demo/workflows" className="inline-flex min-h-10 items-center rounded bg-primary px-3 text-sm font-medium text-primary-foreground">Explore workflows</Link>
          <Link to="/demo/roadmap" className="ml-2 inline-flex min-h-10 items-center rounded border px-3 text-sm font-medium hover:bg-accent">View roadmap</Link>
          <Link to="/demo/report" className="ml-2 inline-flex min-h-10 items-center rounded border px-3 text-sm font-medium hover:bg-accent">Assessment report</Link>
        </div>
      </header>
      <OverviewView
        items={rows}
        orgVolume={NORTHSTAR_ORG.monthly_ticket_volume}
        onSelectWorkflow={(id) => navigate({ to: "/demo/workflows/$workflowId", params: { workflowId: id } })}
        renderLink={(it, children) => <Link to="/demo/workflows/$workflowId" params={{ workflowId: it.id }} className="hover:underline">{children}</Link>}
      />
    </div>
  );
}
