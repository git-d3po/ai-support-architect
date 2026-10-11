# Testing

Only tests that were actually executed are listed as passing.

## Executed — passing (2026-10-11)
**Vitest** `bunx vitest run`: 45 tests passed (44 domain tests plus 1 routing test). Coverage:
- Spec tests 1–10, plus the requirement that missing values are never treated as zero.
- Threshold boundaries: 69/70 (Human-Led risk, deterministic suitability), 49/50 (deterministic risk), 74/75 (autonomy suitability), 29/30/31 (autonomy risk), 39/40 (assisted suitability).
- R1–R6 each forced at suitability 100. R5/R6 also block deterministic. Mandatory restrictions cannot be removed.
- Identity recovery: Human-Led without the verified control, Deterministic with it, and the control is a required input.
- Contradictory attributes are rejected. The seed fixture is consistent. The schema rejects client-supplied result fields.
- Impact: the full chain; missing assumptions → unavailable; negative net shown, not clamped; impact cap at 150 h.
- Portfolio: seed distribution snapshot; volumes 15,600 + 2,400 other = 18,000; aggregate net equals the item sum; Human-Led never ranked; stale and scoring-version changes excluded.
- Future state: no AI step for deterministic or human-led workflows; refund flow includes an approval gate.
- Boundary fixture: refund request moves from AI-Assisted to Human-Led when escalation sensitivity is set to 4 (risk 69 → 73).

**Playwright** (signed out):
- Demo flow: open overview → inventory → refund request → set escalation to 4 → model changes from AI-Assisted to Human-Led, and the "Unsaved simulation" banner appears → reload restores AI-Assisted. No POST/PUT/PATCH/DELETE requests were sent.
- Password reset: Deterministic; with verified recovery set to "No" → Human-Led; setting account-security sensitivity to 1 shows the contradiction alert and withholds the recommendation.
- Visiting `/workspace` while signed out redirects to `/auth`.

**Data API probes as an anonymous visitor** (publishable key):
- Reading workflows or snapshots → permission denied.
- Inserting an organization → RLS violation.
- Inserting a snapshot → permission denied (after migration 0001).

## Not yet verified
- Authenticated flows with two real users: sign-up, create, save, reload, cross-user read/write isolation, and the concurrent-save 409. No test accounts exist yet (sign-up requires email confirmation). The sandbox database role cannot switch to the `authenticated` or `service_role` roles, so these RLS and trigger paths have **not** been tested with signed-in users.
- Partial-save failure: atomicity rests on the single-statement insert by design, but it has not been tested by fault injection.
- Accessibility audit (Phase 3).
