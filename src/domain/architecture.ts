import type { AssessmentResult } from "./types";

export type StepKind = "intake" | "rules" | "check" | "ai" | "gate" | "human" | "resolve" | "escalate";
export interface ArchStep { kind: StepKind; title: string; detail: string }

/** Proposed future-state flow, derived only from the operating model and restrictions. */
export function futureState(result: AssessmentResult): ArchStep[] | null {
  const has = (c: string) => result.restrictions.some((r) => r.code === c);
  const checks: ArchStep[] = [];
  if (has("R2_identity_access")) checks.push({ kind: "check", title: "Verified identity factor", detail: "Recovery token / MFA verified before any account change." });
  if (has("R4_sensitive_data")) checks.push({ kind: "check", title: "Authorization check", detail: "Requester permitted to access the requested data." });
  checks.push({ kind: "check", title: "Policy & data lookup", detail: "Authoritative policy and system-of-record data retrieved." });

  switch (result.model) {
    case "deterministic":
      return [
        { kind: "intake", title: "Structured intake", detail: "Form or intent-routed request with required fields." },
        { kind: "rules", title: "Rule evaluation", detail: "Versioned rules decide eligibility. No generative AI." },
        ...checks,
        ...(has("R3_irreversible_financial") ? [{ kind: "gate" as const, title: "Human approval", detail: "Agent approves before financial or irreversible execution." }] : []),
        { kind: "resolve", title: "System-executed resolution", detail: "API action with audit log; failures fall back to an agent." },
      ];
    case "ai_assisted":
      return [
        { kind: "intake", title: "Request intake", detail: "Ticket from email, chat or web form." },
        { kind: "ai", title: "AI classification & summary", detail: "Intent, context summary, relevant policy retrieved." },
        ...checks,
        { kind: "ai", title: "AI draft / recommendation", detail: "Suggested resolution or troubleshooting steps." },
        { kind: "gate", title: "Agent review & approval", detail: "Agent validates and decides. AI does not execute actions." },
        { kind: "resolve", title: "Agent-executed resolution", detail: "Agent sends response or performs action." },
      ];
    case "ai_autonomous":
      return [
        { kind: "intake", title: "Request intake", detail: "Chat or in-app question." },
        { kind: "ai", title: "AI intent classification", detail: "Out-of-scope intents hand off immediately." },
        ...checks,
        { kind: "ai", title: "Grounded AI response", detail: "Answer limited to approved content; read-only or reversible actions." },
        { kind: "gate", title: "Confidence & scope gate", detail: "Low confidence or customer request → agent handoff." },
        { kind: "resolve", title: "Bounded autonomous resolution", detail: "Sampled QA review of resolutions." },
      ];
    case "human_led":
      return [
        { kind: "intake", title: "Request intake", detail: "Routed to a specialist queue." },
        ...(has("R1_account_compromise") ? [{ kind: "escalate" as const, title: "Security escalation", detail: "Security team owns disposition; account protected." }] : []),
        { kind: "human", title: "Specialist handling", detail: "Human judgment drives the outcome. Optional deterministic lookups only." },
        { kind: "resolve", title: "Human resolution or escalation", detail: "Documented decision and follow-up." },
      ];
    default:
      return null;
  }
}
