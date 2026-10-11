# AI Support Automation Architect — Revised Phase 1 Plan (rev 2)

Architecture, scope, the Northstar fixture, visual direction and the three phases are unchanged from rev 1. This revision corrects how results are written, how saves persist, prioritization, impact math, and how attributes stay consistent.

## 1. Change log vs rev 1
- **Storage.** The `assessments` + `assessment_results` tables are replaced by one immutable `assessment_snapshots` row per save. That row holds the validated inputs, a copy of the workflow attributes at save time, and the derived results. Saving is a single insert, so it is atomic.
- **Write path.** Results are now written only by an authenticated server function using the service-role key, which stays on the server. Browser roles get no INSERT/UPDATE/DELETE grant on snapshots. A trigger also forbids UPDATE for every role.
- **Concurrency.** Each save carries an explicit `revision` with `UNIQUE(workflow_id, revision)`. Saves use optimistic concurrency based on the base revision the client last saw.
- **Staleness.** Workflows carry an `attributes_version` that a trigger increments. A snapshot built from an older version is shown as **Stale**. It is excluded from aggregates and rankings until the user re-assesses.
- **Prioritization.** Eligibility gates are checked before any score. Operational risk and control readiness are now part of the score. Human-Led and incomplete workflows are never ranked as automation candidates.
- **Impact math.** The eligible → affected → gross → review → net chain is defined exactly. Negative net results stay visible. Priority uses net hours.
- **Attributes.** Overlapping fields are removed. Each field has one authoritative source, other values are derived, and contradictory input is rejected. Restrictions can only be added, never removed.
- **Identity recovery.** Deterministic automation is allowed only when a verified recovery control is declared. Otherwise the workflow is Human-Led.
- **Tests.** The test list is extended per the review. Seed outcomes are regression expectations; the rules are never tuned to match them.

## 2. Authoritative write architecture
Confirmed platform capabilities (Lovable Cloud on TanStack Start):
- `requireSupabaseAuth` middleware validates the bearer JWT server-side and exposes `userId` and a user-scoped client (RLS applies).
- A service-role client (`client.server`, `SUPABASE_SERVICE_ROLE_KEY`) is available only inside server handlers. It is loaded with a dynamic import inside the handler and never reaches the browser.
- supabase-js runs single statements. Multi-statement transactions need a Postgres function. This design needs only one insert per save, so no such function is required.

Trusted save path, `saveAssessment` (POST):
```text
browser --bearer JWT--> saveAssessment (createServerFn)
  1. requireSupabaseAuth -> userId (never taken from input)
  2. zod-validate input: workflowId, baseRevision, factorInputs, declaredFlags,
     impactAssumptions, provenance   (any score/result fields -> rejected)
  3. user-scoped client: SELECT workflow JOIN organization
     WHERE id = workflowId   -> RLS returns row only if owner = auth.uid()
     none -> 404 (no distinction between missing and foreign)
  4. consistency validation (section 4) -> 422 with field errors
  5. assess(inputs, workflowAttrs, SCORING_VERSION) -> results (pure TS)
  6. service-role client: single INSERT assessment_snapshots
     (revision = baseRevision + 1, owner_user_id = userId,
      workflow_attributes_version = workflow.attributes_version, results)
     unique violation -> 409 "Assessment changed elsewhere, reload"
  7. return snapshot DTO
```
- Database identity and grants. Only `service_role` gets INSERT on `assessment_snapshots`. `authenticated` gets SELECT only, under RLS. `anon` gets nothing.
- The trigger `forbid_snapshot_update` raises on any UPDATE. DELETE happens only through the cascade when the owner deletes the workflow. That is documented as deleting the whole history, not editing it.
- Organizations and workflows: `authenticated` may SELECT/INSERT/UPDATE/DELETE under owner RLS. A forged `owner_user_id` is rejected by the `WITH CHECK owner_user_id = auth.uid()` policy. The workflow's organization must be owned by the caller, checked through an EXISTS clause.
- Defense in depth: the service-role insert repeats the ownership check in its WHERE logic. The handler re-reads the workflow and organization with the user client immediately before inserting, and the insert sets `owner_user_id` from `userId`. An RLS SELECT policy on snapshots ensures owner-only reads even if the UI is bypassed.

## 3. Data model and result lifecycle
- `organizations(id, owner_user_id NOT NULL, name, industry, support_agent_count ≥ 0, monthly_ticket_volume ≥ 0, support_channels text[], created_at, updated_at)`
- `workflows(id, organization_id FK cascade, owner_user_id NOT NULL, name, category enum, description, current_process, monthly_volume ≥ 0, aht_minutes > 0, required_systems text[], action_type enum, handles_account_access bool, accesses_sensitive_data bool, attributes_version int default 1, timestamps)`
  - Trigger: `attributes_version += 1` when volume, AHT, action_type, handles_account_access or accesses_sensitive_data changes.
- `assessment_snapshots(id, workflow_id FK cascade, owner_user_id, revision int, UNIQUE(workflow_id, revision), workflow_attributes_version int, workflow_attributes jsonb (copy), inputs jsonb, provenance jsonb, scoring_version text, results jsonb, created_at)`
  - Index on (workflow_id, revision desc).
- **Current snapshot** = the row with the maximum revision. The ordering is deterministic because revision is unique.
- Status, derived only:
  - `not_assessed`: no snapshot
  - `incomplete`: the result is Insufficient Data
  - `stale`: the snapshot's attributes version differs from the workflow's, or its scoring version differs from the current engine
  - `assessed`: none of the above
- Recalculation happens only when the user explicitly re-saves. That creates a new revision under the current engine version. Old rows are never rewritten.
- Demo: a static code fixture with no database rows. It goes through the same `assess()` function, and simulations are kept in component state.

## 4. Decision attributes, restrictions, scoring
Each value has one source:
- **Authoritative workflow attributes:** action_type ∈ {read_only, reversible_write, irreversible_write, financial_transaction}, handles_account_access, accesses_sensitive_data.
- **Derived from those** (never entered):
  - reversible = action_type ∈ {read_only, reversible_write}
  - executes_financial = action_type = financial_transaction
- **Assessment attributes:** language_reasoning 0–4, outcome_verifiable bool, authoritative_policy_available bool, verified_recovery_control bool (meaningful only when handles_account_access).
- **Declared risks** (the user can only add these): suspected_account_compromise, other_declared_risk plus a note.

Consistency rules (contradictory input → 422):
- irreversibility factor ≥ 3 when action is irreversible or financial; ≤ 1 when read_only.
- financial_consequence ≥ 2 when financial_transaction.
- account_security_sensitivity ≥ 3 when handles_account_access.
- privacy_sensitivity ≥ 2 when accesses_sensitive_data.
- If authoritative_policy_available is false, policy_clarity ≤ 2.

Effective restrictions are the union of mandatory (derived) restrictions and declared restrictions. Nothing a user enters can remove a mandatory one.

| Restriction | Source | Effect |
|---|---|---|
| R1 account_compromise | declared | Human-Led (security-led) |
| R2 identity_access | handles_account_access | No Autonomous. Deterministic only if verified_recovery_control; else Human-Led. Controls: verified recovery factor, audit log, no agent/AI-granted access |
| R3 irreversible_financial | action_type = financial_transaction or irreversible_write | No Autonomous. Control: human approval before execution |
| R4 sensitive_data | accesses_sensitive_data | No Autonomous. Control: permission-scoped access check |
| R5 policy_unclear | policy_clarity ≤ 1 or no authoritative policy | No Autonomous, no Deterministic |
| R6 outcome_unverifiable | outcome_verifiable false | No Autonomous, no Deterministic |

Scores are unchanged from rev 1: three 0–4 rubrics, round(Σ wᵢ·vᵢ/4·100). Rule order:
1. **Completeness.** Missing required input → Insufficient Data.
2. **R1** → Human-Led.
3. **Human-Led** if risk ≥ 70, OR human_judgment = 4, OR policy_clarity = 0.
4. **Deterministic** if suitability ≥ 70, risk < 50, language_reasoning ≤ 1, R5 and R6 absent, and (R2 absent or verified_recovery_control).
5. **R2** without verified control → Human-Led.
6. **Autonomous** if suitability ≥ 75, risk ≤ 30, policy_clarity ≥ 3, data_readiness_gap ≤ 1, action reversible, and none of R2–R6 apply.
7. **AI-Assisted** if suitability ≥ 40, language_reasoning ≥ 2, and risk < 70.
8. Otherwise Human-Led.

All thresholds are versioned design assumptions (v1.0.0) that need calibration, not industry standards.

## 5. Operational-impact math
All fractions must be in [0, 1].
- V = monthly volume of this primary intent. Intents are mutually exclusive.
- eligible = V × addressable_fraction: the share in scope for this model at all.
- affected = eligible × coverage: the share of eligible tickets the solution actually handles. Coverage is defined relative to eligible tickets, so addressability is not counted twice.
- gross_hours = affected × AHT × expected_reduction ÷ 60
- review_hours = affected × reviewed_fraction × review_minutes ÷ 60
- net_hours = gross − review. A negative value is shown as-is with an "Unfavorable scenario" label.
- Other overhead (maintenance, QA programs, tooling) is out of scope and listed as an assumption. No currency or headcount figures appear.
- Any missing input → "Estimate unavailable" for that metric and any metric that depends on it.
- Portfolio check: Σ V ≤ org volume, and the remainder is shown as other intents. Aggregates exclude stale and incomplete workflows and say so.

## 6. Prioritization
Gate 1. A workflow is an **automation candidate** only if:
- its status is assessed (not stale or incomplete),
- its model is Deterministic, AI-Assisted or Autonomous, and
- net_hours is available.

Gate 2. Workflows that fail Gate 1 get a category instead of a rank:
- Human-Led or R1: "Not an automation candidate". If restrictions apply, also tagged "Control/process improvement".
- Incomplete: "Needs assessment".
- Stale: "Needs re-assessment".

Score for candidates (0–100):
```text
priority = 0.40·ImpactIdx + 0.25·(100 − effort) + 0.20·(100 − risk) + 0.15·ControlReadiness
ImpactIdx        = clamp(net_hours / 150 × 100, 0, 100)   (index only; net shown raw)
ControlReadiness = 100 × (policy_clarity + (4 − data_readiness_gap) + (4 − process_maturity_gap)) / 12
```
- Suitability is deliberately left out of the score. It already gated the operating model, and counting it again would weight it twice.
- Weights: impact matters most, with effort, risk and readiness as brakes on it.

Boundary examples:
- net = −5 h → ImpactIdx 0. It is still a candidate but labeled "Unfavorable scenario".
- net = 150 h and 300 h → both give ImpactIdx 100, and the cap is documented.
- A Human-Led workflow at 900 h is not ranked.

The model never depends on priority.

## 7. Validation invariants and tests
Vitest, domain tests:
- Spec tests 1–12.
- Thresholds at the exact boundaries: 69/70, 74/75, 29/30/31, 49/50.
- R1–R6 each forced at suitability 100.
- Contradictory attributes return 422-equivalent errors.
- Identity workflow is Human-Led without the recovery control and Deterministic with it.
- Missing impact inputs → unavailable.
- Negative net modeled hours.
- Human-Led never appears in the candidate ranking.
- Identical inputs → deep-equal output.
- Seed totals equal the portfolio aggregates.
- Seed model distribution kept as a regression snapshot. If it conflicts with the rules, the fixture is revised and the change reported.

Server and authorization, run against Cloud with two test users:
- Direct REST insert or update of snapshots with the user JWT → denied.
- Results fields in the save payload → rejected.
- User B reads or writes A's org, workflow or snapshot → empty / denied.
- Two saves on the same baseRevision → one succeeds, one gets 409.
- A validation failure leaves no row behind.
- Editing a workflow's volume marks the assessment stale and removes it from aggregates.

Playwright:
- Demo: edit the refund request's financial attributes, or raise password reset's risk inputs across a boundary that is known to change the model. Reload, confirm the original values, and confirm no network writes happened.
- Workspace: sign up, create an org and a workflow, save, reload, confirm it persisted, edit the volume, confirm Stale.

## 8. Remaining uncertainties
- **Assumption:** the service-role key is present once Cloud is enabled. This is confirmed in step 5. If it is unavailable, the fallback is a SECURITY DEFINER SQL function `insert_snapshot` with EXECUTE granted only to service_role; that path still needs a trusted server caller. Status would then be BLOCKED pending confirmation.
- Unique-revision concurrency relies on Postgres constraints. This is a confirmed capability.
- Weights, thresholds and the 150 h cap are uncalibrated design assumptions, and the docs say so.

## 9. Phase 1 sequence and acceptance
1. Docs skeleton: DECISIONS, SCORING, DATA_MODEL (lifecycle and grants), TESTING
2. Domain engine, validation and tests
3. Fixture and its regression tests
4. Design system, shell, demo overview, inventory, detail and simulation
5. Enable Cloud, write the migration (tables, grants, RLS, triggers), confirm the service role
6. Auth, workspace CRUD, `saveAssessment`
7. Authorization and concurrency tests, Playwright, TESTING.md with real results only

Acceptance:
- Spec §16 milestone met.
- All tests above actually executed and recorded.
- No placeholder navigation.
- Roadmap and Report remain Phase 2/3.

Documentation updates: SCORING.md (rules, restrictions, priority, impact formulas, assumption status); DATA_MODEL.md (tables, grants, RLS, triggers, lifecycle, staleness); DECISIONS.md (single-snapshot design, service-role write path, suitability left out of priority, demo as fixture); TESTING.md.

## 10. Readiness
**READY TO BUILD.** The write path uses only confirmed primitives: JWT validation, a server-only service role, an atomic single insert, unique constraints, RLS and triggers. The one unverified item, whether the service-role key is present, is checked in step 5 and has a documented fallback. All review concerns now have specified rules and tests.
