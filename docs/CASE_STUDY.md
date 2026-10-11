# Case study — AI Support Automation Architect

**Product:** [AI Support Automation Architect](https://ai-support-architect.lovable.app/)  
**Release:** v1.0.0 (11 October 2026) · **Frozen software:** [commit 3198568](https://github.com/git-d3po/ai-support-architect/commit/31985682460e5a136a262087dbf340d4e2ab3cf7)

## The problem

“Automate support with AI” is not a sufficient implementation plan. Different support workflows carry different levels of judgment, financial exposure, privacy requirements, account-access risk, technical integration effort and available verification. A high-volume workflow may be easy to automate, while an attractive suitability score may still conflict with a mandatory safety restriction.

I scoped this portfolio product to an operational decision: **which workflows should use traditional deterministic automation, AI assistance, bounded AI autonomy, or remain human-led—and which prerequisites must exist before implementation?**

The output is an assessment, prioritized implementation Roadmap, proposed implementation Blueprint, and executive-facing report. The app does **not** execute support actions.

## From assessment to decision

1. **Capture inputs.** Workflow attributes and structured 0–4 factor ratings describe the support process, its handling-time assumptions, available policy and operating environment.
2. **Validate and constrain.** The pure TypeScript engine checks completeness and consistency, derives safety restrictions from authoritative attributes and permits declared risks to add restrictions, never remove them.
3. **Calculate explainable evidence.** Suitability, risk and effort are separate dimensions. A deterministic model selection follows hard restrictions; a separate impact formula estimates gross, review and net hours.
4. **Prioritize safely.** The Now / Next / Later planner uses priority, effort and positive modeled net value, with Human-Led workflows outside automation lanes.
5. **Specify future work.** Proposed Blueprints divide deterministic systems, AI systems and humans, identify mandatory versus inferred controls, and require external implementation verification.
6. **Reconcile executive reporting.** The templated report uses the same roadmap entries and source-of-truth calculations. It never asks an LLM to invent recommendations or evidence.

The principal architecture boundary is deliberate: **one authoritative assessment engine, derived planning layers, and no independent rule reimplementation inside a React component or report generator.**

## The decisions behind the design

### Why a deterministic engine, not LLM-generated recommendations?

A model can draft text, but financial and identity-access restrictions should not depend on linguistic improvisation. Deterministic rules, explanation codes and explicit versions allow repeated inputs to produce the same result and enable scenario-based regression tests. The tradeoff is that thresholds remain expert-designed heuristics: transparency is not statistical calibration.

### Why safety precedence overrides scores

Consider Northstar's synthetic **Password reset** workflow: 1,800 cases/month at six-minute AHT, with suitability **99**, risk **34**, effort **15** and priority **79**. Its recommended operating model is **Deterministic Automation**, not autonomous generative AI. Account access requires verified recovery factors, audit logging, access boundaries and fallback to humans. A submitted statement that a recovery safeguard is present is **not independent proof** it exists or works.

This workflow is in the **Now** lane to prioritize *preparation*, not because the app has authorized deployment. Its estimated **115.7 net hours/month** is a fictional scenario calculation, not realized savings.

By contrast, a refund request can be **AI-Assisted** for drafting or policy lookup while required financial approval remains human-controlled. Safety-restricted actions are never replaced by generic pilot text.

### Why Roadmap actions are phase-aware

An operating-model suggestion and an immediate implementation action serve different questions. Early iterations reused generic “pilot agent-assist” text in Next/Later entries, creating an internal contradiction. The planner now gives precedence to restriction-specific instructions, followed by phase guidance: **Now** keeps control-gated preparation/pilot advice; **Next** completes prerequisites and revisits feasibility; **Later** reassesses the business case; **non-positive net benefit** explicitly advises against a pilot on the present assumptions. The executive report consumes the same actions, preventing cross-page drift.

### Why immutable revisions and server recalculation

Private users assess workflows in their own workspace. A trusted server function validates the input schema, checks ownership, recomputes `assess()`, and writes a new **immutable** snapshot with a revision and rule version. Browser-supplied recommendations cannot become authoritative by assertion. Row-level security and server checks keep organizations, workflows and snapshots owner-scoped; conflicting saves fail rather than overwrite past decisions. Changes to material workflow attributes make the saved assessment stale until reassessed.

### Why demo fixtures live outside the database

The public Northstar Cloud showcase is seeded from deterministic code fixtures. Visitors can explore unsaved what-if variations without writing canonical records or viewing a private workspace. This makes the demo inspectable, repeatable and low-risk without presenting invented customer data as evidence.

## Reference portfolio and impact

Northstar Cloud is a fictional 45-agent B2B SaaS organization with 18,000 monthly tickets, including 15,600 classified in 15 assessed workflows:

| Recommended model | Count | Operational boundary |
| --- | ---: | --- |
| Deterministic Automation | 4 | Predictable rules and authorized integrations, no generative AI required |
| AI-Assisted | 6 | AI drafts or suggests; a human approves decisions and actions |
| AI Autonomous (bounded) | 2 | Only tightly scoped informational resolution, with handoff and QA |
| Human-Led | 3 | Required human judgment and/or non-negotiable safety constraints |

The modeled opportunity is **755 gross − 139 review = 616 net handling-time hours/month**. The roadmap has **Now 4/408, Next 3/93, Later 5/115** (rounded). All quantities are synthetic assumptions; maintenance, tooling, integration cost and ongoing QA program overhead are not included. No ROI or headcount reductions are claimed.

## Validation and limits

- **[Verified CI]** 106/106 automated TypeScript tests across 10 files passed on frozen commit [3198568](https://github.com/git-d3po/ai-support-architect/actions/runs/38168651593).
- **[Lovable verification report]** Production build and TypeScript checking passed. Full lint still fails with **1,570 pre-existing errors and 9 warnings**; the final change introduced zero net new lint findings.
- **[Historical controlled tests]** 38/38 backend authorization scenarios and 32/32 forged-request scenarios passed with disposable identities; tested staleness, concurrency, demo read-only behavior, and user isolation.
- **[Owner-supplied published screenshots]** Visible updated Roadmap, Blueprint and Executive Report agree on model distribution, hours, safeguard qualifiers and phase-specific instructions.
- **[Not established]** Formal penetration test, real-customer outcome calibration, full screen-reader audit, deployment bundle attestation, or continuously enforced lint/build CI.

The evidence supports a **portfolio-quality operational planning product**, not an independently certified production platform. The most important boundary remains that *recommendation and modeled benefit do not establish implementation readiness*.

## What I would explain in an engineering interview

The interesting design choice wasn't adding AI to every workflow. It was creating a reproducible method for deciding **when not to automate**, with account-security and financial approval rules taking precedence over potentially attractive estimates.

The project combines support-operations modeling, TypeScript domain design, a server-authoritative persistence boundary, owner-scoped Postgres authorization, explainable safety restrictions, deterministic impact assumptions, incremental regression tests, and derived executive reporting. It also surfaces a release-engineering tradeoff clearly: passing scenario tests and a production build is valuable evidence, but outstanding lint, accessibility and calibration gaps must remain visible.

## Technical references

[README](../README.md) · [SCORING.md](../SCORING.md) · [DATA_MODEL.md](../DATA_MODEL.md) · [IMPLEMENTATION_DESIGN.md](../IMPLEMENTATION_DESIGN.md) · [DECISIONS.md](../DECISIONS.md) · [Release evidence](RELEASE_EVIDENCE.md) · [Known limitations](KNOWN_LIMITATIONS.md) · [Screenshot capture manifest](screenshots/README.md)

**Implementation environment:** Lovable with React, TypeScript, TanStack Start, PostgreSQL, RLS and a Supabase-compatible SDK. The case study describes the product and engineering decisions; it does not claim individual authorship of every generated code line.
