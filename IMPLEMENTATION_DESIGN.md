# Implementation Blueprint rules (blueprint-1)

Module: `src/domain/blueprint.ts` (pure, deterministic). Inputs: workflow attributes, required systems, assessment inputs, `assess()` result, assessment status, revision. It never recomputes scores, model, restrictions, impact or roadmap phase (phase comes from `planEntry`).

## Currency
Blueprint is produced only when status = assessed and model ≠ Insufficient Data. Stale / incomplete / unassessed → "No current blueprint" with a link to complete or refresh; no model, priority or impact shown. Output records scoring version, saved revision and `blueprint-1`.

## Provenance
- Mandatory control — required by a triggered safety restriction (R1–R6) or a restriction-mapped engine control (C_SECURITY_QUEUE, C_VERIFIED_RECOVERY, C_AUDIT_LOG, C_NO_AI_ACCESS, C_HUMAN_APPROVAL, C_PERMISSION_SCOPE, C_POLICY_AUTHORING, C_OUTCOME_CHECK).
- Assessment-derived — from entered inputs: listed required systems, factor ratings at thresholds below, sensitive-data attribute, model-level engine controls.
- Planning inference — suggested by the operating model (agent review, handoff, fallback, pilot evaluation). Not a confirmed blocker.
- Unspecified — no systems listed, policy availability or verified-recovery control not stated. Shown as "to be confirmed during implementation discovery".

## Dependency mapping (canonical `analyzeDependencies`, also used by Shared Dependencies)
Systems: each listed system (name preserved, deduped case-insensitively); integration_complexity ≥ 3; tool_fragmentation ≥ 3; none listed → unspecified.
Data: R4 → permission-scoped access (mandatory); data_readiness_gap ≥ 2; structured_data ≤ 1.
Policy: R5 → codified policy (mandatory); policy availability null → unspecified; policy_maturity_gap ≥ 2; process_maturity_gap ≥ 2.
Security: R1 security escalation; R2 verified recovery (mandatory) + stated-absent (assessment) or unknown (unspecified); sensitive data without R4 → privacy handling.
Approval/escalation: R3 human financial approval, thresholds "Requires definition" (mandatory); model inference (agent review / handoff / fallback); escalation_sensitivity ≥ 3.
Outcome: R6 outcome check (mandatory); pilot evaluation criteria for automation models (inference).
Shared Dependencies: per category, each current workflow counted once; Human-Led listed separately; stale/incomplete excluded.

## Responsibilities, controls and approach
Deterministic: no AI responsibilities. AI-Assisted: AI drafts/classifies, humans approve and act. Bounded autonomous: AI answers within approved content; irreversible/financial/account actions prohibited; low confidence → handoff. Human-Led: no automated execution; no AI for account-security cases.
Approach stages Define / Prepare / Pilot / Expand are planning steps. Any mandatory dependency → "Not ready to pilot until…". Validation criteria are suggestions; no readiness score is computed.
