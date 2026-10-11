import { createFileRoute, Link } from "@tanstack/react-router";
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
        <p className="max-w-md text-xs text-muted-foreground">
          Suitability, risk, effort and modeled impact are scored separately. Safety restrictions override scores. All figures are scenario estimates on synthetic data.
        </p>
      </header>
      <OverviewView
        items={rows}
        orgVolume={NORTHSTAR_ORG.monthly_ticket_volume}
        renderLink={(it, children) => <Link to="/demo/workflows/$workflowId" params={{ workflowId: it.id }} className="hover:underline">{children}</Link>}
      />
    </div>
  );
}
