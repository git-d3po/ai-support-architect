# Testing

Only tests that were actually executed are marked as passing. Each section is labeled with its evidence type.

## 1. Source inspection — trust boundaries
| Boundary | Enforced by |
|---|---|
| Anonymous visitors have no access to private data | Migration `0001_revoke_default_grants.sql` (REVOKE ALL FROM anon on all 3 tables); no `TO anon` policies |
| Owner-only organizations | RLS `org_*_own` (`owner_user_id = auth.uid()`) |
| Owner-only workflows; must sit in an organization the user owns | RLS `wf_*_own` (EXISTS owned organization); trigger `workflows_before_update` (owner and organization immutable; `attributes_version` server-controlled) |
| Snapshots are read-only to browsers | Grant: `authenticated` has SELECT only; RLS `snap_select_own` |
| Snapshots are immutable for every role | Trigger `assessment_snapshots_forbid_update`; `service_role` UPDATE revoked |
| Snapshot integrity | Trigger `assessment_snapshots_before_insert`: owner = workflow owner, current attributes version (P0409), revision = max + 1 (23505); `UNIQUE(workflow_id, revision)` |
| Authoritative results | `saveAssessment` in `src/lib/workspace.functions.ts`: JWT identity, strict zod schema, RLS ownership re-check, server-side `assess()`, single service-role INSERT |
| Service-role key never sent to the browser | `client.server` is imported only dynamically inside the `saveAssessment` handler. The client copy of `workspace.functions.ts` served by the dev server contains only RPC stubs: 0 matches for `client.server`, `SERVICE_ROLE` or `supabaseAdmin` |
| UI, demo and server use the same engine | `assess()` from `src/domain/engine.ts` is called by the demo, the workspace preview and `saveAssessment` |

## 2. Database authorization — real JWTs against the live backend (2026-10-11)
Script: `scripts/security/authz_test.ts`. It needs the server-only service-role key, so it is run manually from a trusted environment. The service role is used only to create and delete two pre-confirmed throwaway users and to replay the exact insert that `saveAssessment` performs. All tests ran as ordinary signed-in users through the public API, with RLS enforced. The real sign-up flow and email confirmation were not changed.

**Result: 38 passed, 0 failed** (first run: 37/38; the defect is listed below).
- **Anonymous:** SELECT on all 3 tables, INSERT into snapshots and organizations, UPDATE on workflows, DELETE on organizations → all 42501. The anonymous INSERT grant on snapshots is gone in the live configuration.
- **User B against user A:**
  - SELECT, UPDATE and DELETE on A's organization, workflow and snapshots → 0 rows.
  - Inserting an organization owned by A, or a workflow into A's organization (even with a forged owner) → 42501.
  - Moving B's own workflow into A's organization → rejected by the trigger.
  - Inserting a snapshot on A's workflow → 42501.
- **Result forgery by the owner:** A's direct INSERT, UPDATE or DELETE on snapshots → 42501. A service-role UPDATE → denied.
- **Atomicity:** a failed insert (NOT NULL violation) leaves no row. Revision gaps and owner mismatches are rejected.
- **Concurrency:** two simultaneous saves on the same base revision → exactly one succeeds and the other gets 23505. Revisions stay `[1,2]`.
  - Contract: the first writer wins; the second gets a "conflict, reload" message. Ordering is always deterministic.
- **Staleness:**
  - A client-set `attributes_version` is ignored.
  - A rename keeps the version; a volume change bumps it.
  - A save against the old version → P0409; a re-assessment at the current version succeeds.
- **Cascade:** deleting a workflow removes its history; 0 orphan snapshots remain.
- **Cleanup check:** after the runs, every table holds 0 rows and the test users are deleted.

## 3. Unit tests — Vitest
`bunx vitest run` → **45 passed, 0 failed** (44 domain tests plus 1 routing test). Coverage:
- Spec tests 1–10, plus the requirement that missing values are never treated as zero.
- Threshold boundaries: 69/70, 49/50, 74/75, 29/30/31, 39/40.
- R1–R6 each forced at suitability 100.
- Identity recovery requires the verified control.
- Contradiction rejection; the schema rejects result fields.
- Impact chain, unavailable estimates, negative net, the 150 h cap.
- Seed distribution snapshot; volumes 15,600 + 2,400 = 18,000; aggregate consistency; Human-Led never ranked; stale and scoring-version exclusion; future-state AI and approval steps; the refund boundary fixture.

## 4. Browser — Playwright against the dev server
- **Public demo:** overview → inventory → refund request → escalation set to 4 → AI-Assisted becomes Human-Led, with the simulation banner → reload restores AI-Assisted. No POST/PUT/PATCH/DELETE requests sent.
- **Password reset:** Deterministic → verified recovery "No" → Human-Led, with the "Identity or account access" restriction and its controls listed. Lowering account-security sensitivity to 1 → contradiction alert, recommendation withheld.
- **Signed out:** `/workspace` redirects to `/auth`.
- **Authenticated workspace** (throwaway confirmed user, password sign-in through the real form):
  - Create an organization → add a workflow → "Insufficient Data" until all 21 inputs are filled → preview AI-Assisted → save → "Saved revision 1 of 1" persists after reload.
  - Edit volume from 500 to 900 → Stale banner and badge; the overview excludes it ("0 / 1").
  - "Re-assess & save" → revision 2, stale banner cleared, overview shows "1 / 1".
  - Database inspection: rev 1 (attributes v1, eligible 400) and rev 2 (attributes v2, eligible 720). No contradictory rows.
- **Mobile (390 px):** overview, inventory and detail fit the viewport (scrollWidth 390). Navigation and Sign in are visible. Wide tables scroll inside their own panels.

## Defects found and fixed in this pass
1. **Saving after a workflow change hung.** The trigger raised SQLSTATE 40001, which the database's web API automatically retries, so a stale save hung instead of returning a conflict. Fixed: migration `0002_stale_version_errcode.sql` raises P0409, and `saveAssessment` maps it to `conflict`.
2. **"Save workflow details" always failed.** `WorkflowForm` sent extra fields (`id`, `attributes_version`, …) that the strict server schema rejects. Fixed: `src/components/workflow/WorkflowForm.tsx` sends only form fields.
3. **Mobile header and overview overflowed** (the page was 739 px wide on a 390 px screen). Fixed: `AppHeader.tsx` wraps its navigation; the candidates table in `OverviewView.tsx` scrolls inside its panel.

## Not verified / remaining risks
- Sign-up through the email-confirmation flow and Google sign-in were not exercised end-to-end; confirmed users were created with admin tooling.
- `saveAssessment` was exercised through the browser. Forged-payload rejection at the RPC layer is covered by schema unit tests, not by a raw RPC call.
- Weights and thresholds are uncalibrated design assumptions.
- The demo uses per-assessment provenance (observed/estimate), not per-field.
- No automated accessibility audit has been run.

## Phase 1.5 UX refinement (2026-10-11)
- Vitest: 45/45 passed (scoring regression unchanged). Overview still shows 4/6/2/3 distribution, 755 gross / 616 net h.
- Browser (Playwright, demo): chart point click → /demo/workflows/password-reset; keyboard Enter on chart list link → correct workflow; no horizontal overflow at 1280/820/375; phone score buttons 61×44px, arrow keys move selection, aria-label includes anchor text; demo what-if resets after reload.
- Required-controls column renders engine `restrictions` and `controls` counts only.
- Not rerun: authenticated save/stale flow and two-user security script (no session in this pass). No screen-reader testing; no formal WCAG claim.
