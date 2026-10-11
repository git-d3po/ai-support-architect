# AI Support Automation Architect — Implementation Plan (Phase 1 build, full MVP planned)

## Summary
A decision workspace that assesses support workflows on three separate scores (Suitability, Risk, Effort), plus a separate business-impact estimate. A fixed, versioned set of rules turns those inputs into one of four operating models, and safety restrictions always win. Phase 1 delivers one working vertical slice: a read-only public demo for Northstar Cloud with local what-if changes, and private workspaces where signed-in users create, assess, save and reload their own workflows.

## A. Product architecture
- TanStack Start (the existing template) with Lovable Cloud for Postgres, Auth (email/password) and RLS. No other services, no LLM calls.
- Layers. Only the top two layers import React.
```text
src/domain/            pure TS, no React, no DB
  types.ts, schemas.ts (zod), rubrics.ts (factor anchors)
  scoring/engine.ts    weighted scores, versioned (SCORING_VERSION = "1.0.0")
  scoring/decide.ts    completeness -> restrictions -> model precedence
  impact.ts            opportunity estimate
  priority.ts
  architecture.ts      operating model -> future-state diagram steps
  portfolio.ts         aggregates (no double counting)
src/fixtures/northstar.ts   synthetic org + 15 workflows (inputs only, no results)
src/server/*.functions.ts   createServerFn: CRUD + saveAssessment (server recomputes)
src/components/assessment/, workflow/, overview/, ui/
src/routes/                 thin route files
```
- The same `assess(inputs, version)` function runs on the client (for live previews and demo simulations) and on the server (authoritative). The server ignores any scores the client sends.

## B. Data model (Lovable Cloud)
- `organizations`: owner_user_id → auth.users, name, industry, support_agent_count, monthly_ticket_volume, support_channels text[], operational_assumptions jsonb, timestamps.
- `workflows`: organization_id FK (cascade), name, category (enum: billing/accounts/product/technical/security), description, current_process, monthly_volume, average_handle_time_minutes, required_systems text[], action_type (enum: read_only/reversible_write/irreversible_write/financial_transaction), timestamps.
- `assessments`: **append-only versions**. Columns: workflow_id FK, factor_inputs jsonb, decision_attributes jsonb, safety_flags jsonb, impact_assumptions jsonb, input_provenance jsonb (observed/estimate/synthetic for each field), scoring_version, created_at, created_by. Each save inserts a new row.
- `assessment_results`: 1:1 with assessment (PK = assessment_id). Holds the three scores, model (or `insufficient_data`), priority_score, impact jsonb, triggered_restrictions, drivers, limiting_factors, required_controls, next_step, scoring_version, calculated_at. Only the save server function writes it, in the same request, using the shared engine. It is an immutable snapshot, so results can never be stale or contradict their inputs. The "current" result is the latest assessment's result. If the engine version changes, the app shows "Scored with v1.0.0, recalculate available" and does not rewrite old snapshots.
- `workflows.assessment_status` is derived, not stored: not_assessed / incomplete / assessed. Storing it would risk drift.
- RLS: ownership is checked through organization.owner_user_id = auth.uid() on every table. Results can be selected by the owner but not inserted or updated by clients; the server writes them with the user's context through a SECURITY DEFINER-free path, after grants and an insert policy check that ties the row to an owned assessment. No anon policies anywhere. Indexes go on FKs and on (workflow_id, created_at desc).
- The demo uses no database: it is a versioned code fixture, so canonical demo data cannot be written to.

## C. Decision engine (v1.0.0)
- Factors use a 0–4 ordinal scale with anchored descriptions. Score = round(Σ weightᵢ × vᵢ/4 × 100), giving 0–100. Weights follow the spec tables (Suitability 20/20/15/15/15/10/5, Risk 20/15/15/15/10/10/15, Effort 30/20/20/20/10). Each effort factor is phrased as a "gap", so higher always means more effort. Volume is not a suitability factor.
- Decision attributes (not weighted): language_reasoning (0–4), action_type, reversible (bool), executes_financial_transaction, account_security_exposure, outcome_objectively_verifiable, authoritative_policy_available, required_systems/permissions.
- Explicit safety flags (user-set or derived): suspected_account_compromise, identity_or_recovery_action, irreversible_financial_action (derived from action_type), sensitive_data_access, policy_unclear (derived when policy_clarity ≤ 1 or no authoritative policy), outcome_unverifiable.
- Precedence:
  1. **Completeness.** If any factor or decision attribute is missing, the result is `Insufficient Data` with a list of missing fields. Missing values are never treated as 0.
  2. **Restrictions.** Each flag removes eligibility for the Autonomous model. `suspected_account_compromise` forces Human-Led. `identity_or_recovery_action` allows only Deterministic or Human-Led.
  3. **Human-Led** if risk ≥ 70, OR required_human_judgment = 4, OR policy_clarity = 0.
  4. **Deterministic** if suitability ≥ 70, risk < 50, language_reasoning ≤ 1, outcome verifiable, and policy available.
  5. **Autonomous (bounded)** if suitability ≥ 75, risk ≤ 30, policy_clarity ≥ 3, outcome verifiable, action is read_only or reversible_write, data_readiness_gap ≤ 1, and no restriction applies.
  6. **AI-Assisted** if suitability ≥ 40, language_reasoning ≥ 2, and risk < 70.
  7. Otherwise **Human-Led**.
- Thresholds are inclusive exactly as written, and boundary tests cover 29/30/31, 69/70, and so on.
- Explanations are built only from rule hits. Each rule emits coded drivers, limits, restrictions, controls and a next step from a fixed catalog (e.g. "Human approval required before refund execution."). There is no free-form text.

## D. Operational-impact model
- Gross modeled hours/month = volume × AHT × addressable × coverage × AHT_reduction ÷ 60. All percentages are fractions in [0,1], validated.
- Review overhead (fraction of handled items × review minutes) is subtracted separately and labeled as net modeled hours.
- If any input is missing, the app shows "Estimate unavailable". Labels say "Modeled monthly opportunity" and "Not yet validated in production". No currency, headcount, or savings claims.
- Workflows are mutually exclusive primary-intent categories. The portfolio sum is checked against the org volume, and any remainder appears as "Unclassified / other intents".
- Priority (0–100) = 0.40 × impactIndex + 0.30 × suitability + 0.30 × (100 − effort). impactIndex = min(100, gross hours ÷ 150 × 100), using a fixed cap so each workflow's score does not depend on the rest of the portfolio. Priority is kept separate from the model and never changes it.

## E. Seed data — Northstar Cloud (synthetic)
- 45 agents, 18,000 tickets/month, email/chat/web form. 15 workflows total about 15,600, plus about 2,400 shown as other intents.
- Expected distribution, computed by the engine. A test fails if the engine output drifts.
  - Deterministic: Password reset (identity restriction), Invoice copy, Billing address update, Data export request
  - Autonomous (bounded): Product how-to, Feature availability
  - AI-Assisted: Failed login, Refund request (approval control), Duplicate charge, Plan downgrade, API auth error, API integration troubleshooting (high effort)
  - Human-Led: Suspicious account activity (compromise flag), Service outage escalation, Subscription cancellation (retention judgment)
- Every demo screen shows a "Synthetic data" badge, and inputs carry provenance tags.

## F. UX and components
- Visual direction: light neutral canvas with slate/navy text. IBM Plex Sans for UI, IBM Plex Mono for numbers. Muted semantic colors: Deterministic slate-blue, Assisted teal, Autonomous green, Human-Led amber, Restriction red, Insufficient grey. All colors are tokens in styles.css. No gradients, no hero section.
- Phase 1 routes, all functional:
  - `/`: Demo Overview with KPI strip, model distribution, Impact vs Effort scatter (axis formulas shown), top priorities, top restrictions
  - `/demo/workflows` and `/demo/workflows/$workflowId`: inventory table (search and filter) plus a detail and assessment page with editable inputs as **local simulation** (amber "Unsaved simulation — reset" banner)
  - `/auth`: sign in / sign up
  - `/workspace` (authenticated): org setup or overview of the user's own data
  - `/workspace/workflows`, `/workspace/workflows/new`, `/workspace/workflows/$workflowId`: create/edit workflow and save assessment, with saved-state feedback and version history count
- Reusable pieces: ScoreTriplet, ModelBadge, RestrictionList, ExplanationPanel, FactorInput (0–4 segmented control with anchor text), CompletenessMeter, ImpactPanel with assumptions, FutureStateDiagram (step list or flow that varies by model, labeled "Proposed future state"), WorkflowTable, ImpactEffortChart (recharts).

## G. Implementation sequence
- **Phase 1** (this build):
  1. Docs: DECISIONS, SCORING, DATA_MODEL, TESTING
  2. Domain engine and tests
  3. Fixture
  4. Design system and shell
  5. Demo inventory, detail and overview
  6. Enable Cloud, add migration and RLS
  7. Auth and workspace CRUD, with the save server function recomputing results
  8. Browser checks

  Acceptance: the milestone statement in spec §16 holds for both the demo (simulated) and the workspace (persisted).
- **Phase 2:** roadmap page (Now/Next/Later derived from priority, effort and dependencies, kept separate from "do not automate"), dependency view, org-level impact, richer what-if.
- **Phase 3:** executive report, accessibility pass, full verification, demo hardening. Later: PDF export.

## H. Risk review
- Unsafe autonomy: restrictions are checked before thresholds, and tests prove they win at suitability 100.
- Stale results: immutable snapshots computed by the server, with the version shown.
- Demo integrity: data lives in a code fixture, there are no anon policies, and simulations are visibly marked as unsaved.
- Cross-user access: RLS on every table, plus a test using two users.
- Misleading impact: labels, assumptions on screen, no money or headcount figures.
- Incomplete assessments: `Insufficient Data` with no forced model.

## I. Validation
- Vitest covers spec tests 1–12 plus threshold boundaries and the seed-distribution snapshot.
- Playwright:
  - Demo flow: open, inspect, simulate a change, confirm the model changes, reload, confirm the change is gone.
  - Workspace: sign up, create a workflow, assess, save, reload, confirm it persisted and the overview updated.
- Authorization: a second user's query returns no rows and their update fails.
- TESTING.md lists only tests that were actually run, plus known gaps.

## Resolved ambiguities
- Password reset vs. deterministic preference: the identity restriction blocks AI autonomy but still allows a secure deterministic path.
- "Priority" uses a fixed impact cap rather than portfolio-relative scaling, which keeps it reproducible.
- Roadmap phase is deferred to Phase 2, so Phase 1 shows a priority score but no Now/Next/Later labels.
- Assessment history is append-only and the latest version is current. Editing never mutates past results.
