// SYNTHETIC demonstration data. Northstar Cloud is fictional. Inputs only; results are computed by the engine.
import type { AssessmentInputs, Category, Ordinal, WorkflowAttributes } from "@/domain/types";
import { SUITABILITY_FACTORS, RISK_FACTORS, EFFORT_FACTORS } from "@/domain/types";

export const FIXTURE_VERSION = "northstar-1";

export const NORTHSTAR_ORG = {
  name: "Northstar Cloud",
  industry: "B2B SaaS",
  support_agent_count: 45,
  monthly_ticket_volume: 18000,
  support_channels: ["Email", "In-app chat", "Web form"],
  segments: ["SMB", "Enterprise"],
};

export interface DemoWorkflow {
  id: string;
  name: string;
  category: Category;
  description: string;
  current_process: string;
  required_systems: string[];
  attrs: WorkflowAttributes;
  inputs: AssessmentInputs;
}

type O = Ordinal;
interface Spec {
  id: string; name: string; category: Category; description: string; current_process: string; systems: string[];
  attrs: WorkflowAttributes;
  S: [O, O, O, O, O, O, O]; R: [O, O, O, O, O, O, O]; E: [O, O, O, O, O];
  lang: O; policy: boolean; recovery?: boolean; compromise?: boolean;
  impact: [number, number, number, number, number] | null; // addressable, coverage, reduction, reviewed, review_min
}

function build(s: Spec): DemoWorkflow {
  const factors: AssessmentInputs["factors"] = {};
  SUITABILITY_FACTORS.forEach((k, i) => (factors[k] = s.S[i]));
  RISK_FACTORS.forEach((k, i) => (factors[k] = s.R[i]));
  EFFORT_FACTORS.forEach((k, i) => (factors[k] = s.E[i]));
  return {
    id: s.id, name: s.name, category: s.category, description: s.description, current_process: s.current_process,
    required_systems: s.systems, attrs: s.attrs,
    inputs: {
      factors,
      attributes: {
        language_reasoning: s.lang,
        authoritative_policy_available: s.policy,
        verified_recovery_control: s.attrs.handles_account_access ? (s.recovery ?? false) : null,
      },
      declared: { suspected_account_compromise: s.compromise ?? false, other_declared_risk: null },
      impact: s.impact
        ? { addressable_fraction: s.impact[0], coverage: s.impact[1], expected_reduction: s.impact[2], reviewed_fraction: s.impact[3], review_minutes: s.impact[4] }
        : { addressable_fraction: null, coverage: null, expected_reduction: null, reviewed_fraction: null, review_minutes: null },
    },
  };
}

const a = (monthly_volume: number, aht_minutes: number, action_type: WorkflowAttributes["action_type"], handles_account_access = false, accesses_sensitive_data = false): WorkflowAttributes =>
  ({ monthly_volume, aht_minutes, action_type, handles_account_access, accesses_sensitive_data });

// S: repetitiveness, standardization, policy_clarity, input_predictability, outcome_verifiability, structured_data, low_exception
// R: consequence, irreversibility, financial, account_security, privacy, judgment, escalation
// E: integration, data_gap, process_gap, policy_gap, fragmentation
const SPECS: Spec[] = [
  { id: "password-reset", name: "Password reset", category: "accounts",
    description: "Customer cannot sign in and requests a password reset.",
    current_process: "Agent verifies email ownership manually, triggers reset from admin console.",
    systems: ["Identity provider", "Helpdesk"], attrs: a(1800, 6, "reversible_write", true, false),
    S: [4, 4, 4, 4, 4, 4, 3], R: [2, 1, 0, 3, 1, 1, 1], E: [1, 0, 1, 0, 1], lang: 0, policy: true, recovery: true,
    impact: [0.85, 0.9, 0.85, 0.02, 3] },
  { id: "failed-login", name: "Failed login", category: "accounts",
    description: "Login errors caused by SSO misconfiguration, lockouts or browser issues.",
    current_process: "Agent reviews auth logs and walks the customer through likely causes.",
    systems: ["Identity provider logs", "Helpdesk", "Knowledge base"], attrs: a(1400, 12, "read_only"),
    S: [3, 2, 3, 2, 2, 3, 2], R: [2, 0, 0, 2, 1, 2, 2], E: [2, 2, 2, 1, 2], lang: 3, policy: true,
    impact: [0.7, 0.8, 0.35, 1, 1.5] },
  { id: "suspicious-activity", name: "Suspicious account activity", category: "security",
    description: "Customer reports unrecognized logins or changes.",
    current_process: "Escalated to the security team, who lock the account and investigate.",
    systems: ["Identity provider", "SIEM", "Helpdesk"], attrs: a(250, 35, "irreversible_write", true, true),
    S: [2, 3, 3, 2, 2, 3, 1], R: [4, 3, 2, 4, 4, 4, 4], E: [3, 2, 2, 2, 3], lang: 3, policy: true, recovery: false, compromise: true,
    impact: [0.5, 0.5, 0.2, 1, 5] },
  { id: "duplicate-charge", name: "Duplicate charge", category: "billing",
    description: "Customer was charged twice for the same invoice.",
    current_process: "Agent checks billing system, confirms duplicate, issues refund of the duplicate.",
    systems: ["Billing platform", "Payment processor", "Helpdesk"], attrs: a(450, 14, "financial_transaction", false, true),
    S: [3, 3, 3, 3, 3, 3, 3], R: [3, 3, 3, 1, 2, 2, 2], E: [2, 1, 1, 1, 2], lang: 2, policy: true,
    impact: [0.9, 0.8, 0.45, 1, 2] },
  { id: "refund-request", name: "Refund request", category: "billing",
    description: "Customer requests a refund for unused service or dissatisfaction.",
    current_process: "Agent checks contract terms and eligibility; team lead approves above threshold.",
    systems: ["Billing platform", "CRM", "Contract repository"], attrs: a(900, 18, "financial_transaction", false, true),
    S: [3, 2, 2, 2, 2, 3, 1], R: [3, 4, 3, 1, 2, 3, 3], E: [3, 2, 2, 2, 2], lang: 3, policy: true,
    impact: [0.8, 0.7, 0.3, 1, 3] },
  { id: "invoice-copy", name: "Invoice copy request", category: "billing",
    description: "Customer requests a copy of a past invoice.",
    current_process: "Agent locates invoice in billing system and emails PDF after confirming the requester.",
    systems: ["Billing platform", "Helpdesk"], attrs: a(1100, 5, "read_only", false, true),
    S: [4, 4, 4, 4, 4, 4, 4], R: [1, 0, 0, 1, 2, 0, 1], E: [1, 0, 0, 0, 1], lang: 0, policy: true,
    impact: [0.95, 0.9, 0.9, 0.01, 2] },
  { id: "subscription-cancellation", name: "Subscription cancellation", category: "billing",
    description: "Customer asks to cancel their subscription.",
    current_process: "Retention specialist discusses options, then processes cancellation.",
    systems: ["Billing platform", "CRM"], attrs: a(600, 20, "irreversible_write"),
    S: [3, 3, 3, 2, 3, 3, 2], R: [3, 3, 2, 0, 1, 4, 3], E: [2, 1, 1, 1, 2], lang: 3, policy: true,
    impact: [0.6, 0.5, 0.25, 1, 4] },
  { id: "plan-downgrade", name: "Plan downgrade", category: "billing",
    description: "Customer moves to a lower plan tier.",
    current_process: "Agent explains feature differences and applies the plan change.",
    systems: ["Billing platform", "Entitlements service"], attrs: a(500, 11, "reversible_write"),
    S: [3, 3, 3, 3, 3, 2, 2], R: [2, 1, 2, 0, 1, 2, 2], E: [2, 1, 1, 1, 1], lang: 2, policy: true,
    impact: [0.85, 0.75, 0.4, 1, 2] },
  { id: "billing-address-update", name: "Billing address update", category: "billing",
    description: "Customer updates billing address or tax details.",
    current_process: "Agent edits the billing profile after confirming the requester is an account admin.",
    systems: ["Billing platform"], attrs: a(400, 6, "reversible_write", false, true),
    S: [4, 4, 4, 4, 4, 4, 3], R: [1, 1, 0, 1, 2, 0, 1], E: [1, 0, 0, 0, 0], lang: 0, policy: true,
    impact: [0.9, 0.9, 0.9, 0.02, 2] },
  { id: "product-how-to", name: "Product how-to question", category: "product",
    description: "Customer asks how to use a feature.",
    current_process: "Agent searches the knowledge base and replies with steps.",
    systems: ["Knowledge base", "Helpdesk"], attrs: a(3200, 9, "read_only"),
    S: [4, 3, 4, 3, 3, 3, 3], R: [1, 0, 0, 0, 0, 1, 1], E: [1, 1, 1, 1, 1], lang: 3, policy: true,
    impact: [0.75, 0.6, 0.7, 0.1, 2] },
  { id: "feature-availability", name: "Feature availability question", category: "product",
    description: "Customer asks whether a feature exists on their plan.",
    current_process: "Agent checks plan matrix and the customer's entitlements.",
    systems: ["Knowledge base", "Entitlements service"], attrs: a(1500, 7, "read_only"),
    S: [4, 4, 4, 3, 4, 3, 3], R: [1, 0, 0, 0, 0, 0, 1], E: [1, 1, 1, 0, 1], lang: 2, policy: true,
    impact: [0.85, 0.7, 0.75, 0.1, 1.5] },
  { id: "api-integration-troubleshooting", name: "API integration troubleshooting", category: "technical",
    description: "Customer's integration fails or behaves unexpectedly.",
    current_process: "Technical support engineer reviews logs, reproduces, and advises.",
    systems: ["API gateway logs", "Observability", "Helpdesk", "Developer docs"], attrs: a(1300, 45, "read_only"),
    S: [3, 2, 2, 2, 2, 2, 1], R: [2, 0, 0, 1, 1, 3, 2], E: [4, 3, 3, 2, 3], lang: 4, policy: true,
    impact: [0.6, 0.6, 0.2, 1, 6] },
  { id: "api-authentication-error", name: "API authentication error", category: "technical",
    description: "401/403 errors when calling the API.",
    current_process: "Agent checks key status and scopes, explains the fix.",
    systems: ["API gateway logs", "Developer docs"], attrs: a(900, 15, "read_only"),
    S: [3, 3, 3, 3, 3, 3, 2], R: [2, 0, 0, 2, 1, 1, 2], E: [2, 1, 1, 1, 1], lang: 2, policy: true,
    impact: [0.8, 0.7, 0.4, 1, 2] },
  { id: "data-export-request", name: "Data export request", category: "accounts",
    description: "Account admin requests an export of workspace data.",
    current_process: "Agent verifies admin role and triggers export job.",
    systems: ["Admin console", "Export service"], attrs: a(300, 10, "read_only", false, true),
    S: [4, 4, 4, 4, 4, 3, 3], R: [2, 0, 0, 2, 3, 1, 1], E: [2, 1, 1, 1, 1], lang: 0, policy: true,
    impact: [0.9, 0.85, 0.8, 0.05, 3] },
  { id: "service-outage-escalation", name: "Service outage escalation", category: "technical",
    description: "Customer reports a suspected outage or severe degradation.",
    current_process: "Incident commander correlates reports; agents send status updates.",
    systems: ["Status page", "Incident tool", "Observability"], attrs: a(1000, 16, "read_only"),
    S: [2, 3, 3, 2, 2, 3, 2], R: [4, 0, 2, 0, 1, 4, 4], E: [3, 2, 2, 1, 3], lang: 3, policy: true,
    impact: null },
];

export function getNorthstarWorkflows(): DemoWorkflow[] {
  return SPECS.map(build);
}

export function getNorthstarWorkflow(id: string): DemoWorkflow | undefined {
  const s = SPECS.find((x) => x.id === id);
  return s ? build(s) : undefined;
}
