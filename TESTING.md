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

## Phase 2A roadmap (2026-10-11)
- Vitest: 56/56 passed (45 existing + 11 new in `src/domain/roadmap.test.ts`: Now placement, Human-Led exclusion, restrictions/controls visibility, stale exclusion, incomplete no fabricated values, change updates phase, deletion, determinism, total reconciliation 755/616, negative net, phase boundaries).
- Browser (demo): Overview "View roadmap" → /demo/roadmap; Now 4 (408 net h), Next 3 (93), Later 5 (115) = 616; Human-Led 3; keyboard Enter on a Now link → workflow detail; no horizontal overflow at 375px.
- Not executed: authenticated smoke test and private roadmap browser check (no signed-in session minted this pass). Private roadmap reuses `getWorkspace` (owner-scoped RLS), so test 13 relies on prior evidence, not a rerun. Test 12 (demo non-persistence) covered by Phase 1.5 reload check, not rerun.

## Phase 2A final verification gate (2026-10-11)
**Test identities:** two disposable confirmed users created via the service-role admin API (`scripts/security/qa_users.ts create`); signed in through the real /auth password form; deleted afterwards with all data (`cleanup` → 0 remaining). No auth settings, RLS or client code changed.

**Automated:** vitest 56/56 passed.

**Authenticated browser (user A), real session:**
- Created org + workflow, completed assessment, saved → reload shows "Saved revision 1 of 1 · AI Autonomous (bounded)".
- My Roadmap: workflow in Next, priority 63, effort 25, net 44.8 h (gross 48); matches DB snapshot rev 1 (priority 63, ai_autonomous).
- Changed monthly volume 2000→3000: detail shows stale banner; Overview 0/1 assessed, 0 net h; Roadmap 0 candidates, 0 net h, workflow listed under Needs reassessment. All three agree.
- Re-assessed → revision 2 (priority 69, net 67.2 h, still Next); Roadmap updated.
- DB: revisions 1 (attr v1, score 63) and 2 (attr v2, score 69) both present — history intact.

**Isolation (user B), real session:** roadmap before org shows setup prompt (no data); after creating own org/workflow, roadmap shows only B's unassessed workflow, 0 net h, no A data; direct URL to A's workflow id → "Workflow not found", no A fields rendered. Roadmap loads through the same owner-scoped `getWorkspace` path tested here.

**Public demo:** Overview → Roadmap → Now 4/408, Next 3/93, Later 5/115, Human-Led 3; opened workflow from roadmap; changed a factor → "Unsaved simulation" notice; reload restored canonical value; zero non-GET requests.

**Fix:** private Needs-reassessment link said "Re-assess" for never-assessed workflows; now "Open assessment".

**Still not tested:** email-confirmation signup, Google sign-in, hand-crafted live RPC forgery (beyond direct-URL access), screen-reader testing. No production-wide security certification claimed.

## Phase 2B blueprints (2026-10-11)
**Automated:** 69/69 passed (56 existing + 13 in `src/domain/blueprint.test.ts`: per-model blueprints, deterministic has no AI, AI-assisted human authority and refund approval, autonomous limits/escalation, Human-Led no automation, mandatory safeguards + pilot block, provenance, unspecified inputs, deduplication, shared-dependency counts, stale/incomplete, determinism, Northstar baseline 4/6/2/3, 755/616, Now 4 / Next 3 / Later 5 / HL 3 and blueprint phase = roadmap phase).
**Browser (demo):** Overview → Roadmap → Password reset blueprint via keyboard Enter; shows "not an implemented or validated automation", no AI responsibilities, "Not ready to pilot". Refund, product how-to, suspicious activity matrices checked. Shared-dependency link → correct blueprint. 0 non-GET requests. No overflow at 375px.
**Authenticated (disposable users, deleted after):** private blueprint shows saved revision 1, model and Next phase matching the assessment; after a volume change shows "No current blueprint" with no model and a refresh link; user B opening A's blueprint URL → "Workflow not found", no data. First run's private check failed because the script navigated before the save finished; re-run passed.
**Script review:** `scripts/security/qa_users.ts` uses env vars only, random passwords written only to /tmp, outside `src/` (not bundled or routed); cleanup now limited to `qa-2a-*@example.invalid` users.
**Not tested:** email-confirmation signup, Google sign-in, hand-crafted RPC forgery, screen-reader testing.
