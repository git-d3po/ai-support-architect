# Scoring — engine v1.0.0

Source of truth: `src/domain/engine.ts`, `src/domain/rubrics.ts`, `src/domain/validation.ts`.
**All weights, thresholds and the impact cap are uncalibrated v1 design assumptions, not industry standards.**

## Dimensions (0–100, integers)
score = round(Σ weightᵢ × vᵢ / 4 × 100), with vᵢ ∈ {0..4}. If any factor in a dimension is missing, that score is `null`. Missing values are never treated as 0.

| Suitability (higher = more suitable) | w | Risk (higher = more risk) | w | Effort (higher = more effort) | w |
|---|---:|---|---:|---|---:|
| Repetitiveness | 20 | Consequence of error | 20 | Integration complexity | 30 |
| Process standardization | 20 | Irreversibility | 15 | Data readiness gap | 20 |
| Policy clarity | 15 | Financial consequences | 15 | Process maturity gap | 20 |
| Input predictability | 15 | Account-security sensitivity | 15 | Policy maturity gap | 20 |
| Outcome verifiability | 15 | Privacy/data sensitivity | 10 | Tool fragmentation | 10 |
| Structured-data availability | 10 | Required human judgment | 10 | | |
| Low exception frequency | 5 | Escalation sensitivity | 15 | | |

Ticket volume is not a suitability factor. Anchors for every level are listed in `rubrics.ts` and shown in the UI.

## Attribute authority
- **Authoritative workflow attributes:** action_type, handles_account_access, accesses_sensitive_data.
- **Derived from them:** reversible, executes_financial.
- **Assessment attributes:** language_reasoning (0–4), authoritative_policy_available, verified_recovery_control (required only when the workflow handles account access).
- **Declared risks:** suspected_account_compromise. Declared risks can only add restrictions.
- Outcome verifiability is a single factor. R6 is derived from it (≤1), so there is no second "verifiable" flag that could contradict it.

## Consistency rules (rejected; no recommendation is produced)
- irreversibility ≥ 3 for irreversible or financial actions; ≤ 1 for read-only.
- financial_consequence ≥ 2 for financial transactions.
- account_security_sensitivity ≥ 3 when the workflow handles account access.
- privacy_sensitivity ≥ 2 when it accesses sensitive data.
- policy_clarity ≤ 2 when no authoritative policy is available.
- verified_recovery_control applies only to account-access workflows.

## Restrictions (effective = derived ∪ declared)
| Code | Source | Effect |
|---|---|---|
| R1 account compromise | declared | Human-Led |
| R2 identity access | handles_account_access | No autonomy. Deterministic only with a verified recovery control, else Human-Led |
| R3 irreversible/financial | action_type | No autonomy. Human approval control |
| R4 sensitive data | accesses_sensitive_data | No autonomy. Permission-scope control |
| R5 policy unclear | policy_clarity ≤ 1 or no policy | No deterministic, no autonomy |
| R6 outcome unverifiable | outcome_verifiability ≤ 1 | No deterministic, no autonomy |

## Precedence
1. Completeness: any missing input → `insufficient_data`.
2. R1 → Human-Led.
3. Human-Led if risk ≥ 70, OR human_judgment = 4, OR policy_clarity = 0.
4. Deterministic if suitability ≥ 70, risk < 50, language ≤ 1, no R5/R6, and (no R2 or verified recovery).
5. R2 without verified recovery → Human-Led.
6. Autonomous if suitability ≥ 75, risk ≤ 30, policy_clarity ≥ 3, data_readiness_gap ≤ 1, reversible action, and no R2–R6.
7. AI-Assisted if suitability ≥ 40, language ≥ 2, and risk < 70.
8. Otherwise Human-Led.

Explanations (drivers, limits, controls, next step) are coded catalog items emitted by the rules. There is no free-form text.

## Impact (fractions in [0,1])
- eligible = volume × addressable
- affected = eligible × coverage
- gross h = affected × AHT × reduction ÷ 60
- review h = affected × reviewed_fraction × review_min ÷ 60
- net = gross − review. A negative net is shown and labeled "Unfavorable scenario".

Missing inputs → "Estimate unavailable". Maintenance, QA programs and tooling overhead are out of scope. No currency or headcount figures are produced.

## Prioritization
Only an automation candidate gets a score. That requires: status assessed (not stale or incomplete), a model other than Human-Led or Insufficient, and an available net estimate. Otherwise the workflow is categorized as: Not an automation candidate (optionally tagged "control/process improvement"), Needs assessment, Needs re-assessment, or Impact unavailable.

```
priority = 0.40·ImpactIdx + 0.25·(100−effort) + 0.20·(100−risk) + 0.15·ControlReadiness
ImpactIdx = clamp(net / 150 × 100, 0, 100)
ControlReadiness = 100 × (policy_clarity + (4 − data_gap) + (4 − process_gap)) / 12
```
Suitability is excluded from the score because it already gates the model. The priority never changes the model.

## Roadmap phase assignment (roadmap-1, separate from scoring v1)
Implemented in `src/domain/roadmap.ts`. Consumes engine output only; scoring version unchanged.
Precedence: (1) not current (stale / incomplete / not assessed) → Needs reassessment, no priority or impact shown; (2) model Human-Led → Human-Led section; (3) not an automation candidate (insufficient data / impact unavailable) → Needs reassessment; (4) net ≤ 0 → Later; (5) priority ≥ 70 and effort < 40 → Now; (6) priority ≥ 50 and effort < 60 → Next; (7) otherwise Later.
Key dependency: from the highest-precedence triggered restriction (documented); otherwise inferred from effort ≥ 60 or the operating model, and labelled "inferred, not documented". Required controls are the engine's `controls`, always shown as status unverified. Next action: restriction-specific action if restricted, else the model's next step.
