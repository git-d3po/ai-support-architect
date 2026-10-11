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

## Phase 3A executive report (2026-10-11)
**Automated:** 77/77 passed (69 existing + 8 in `src/domain/report.test.ts`: Northstar values, count/impact reconciliation incl. gross − review = net, Human-Led exclusion, mandatory controls + provenance + no completion fields, stale/incomplete exclusion, empty org, unavailable and negative estimates, determinism + org scoping).
**Browser (demo):** Overview → Assessment report; summary states 15/15, 15,600 of 18,000, 4/6/2/3, 755 gross / 616 net; facts 755 / 139 review / 616. Keyboard Enter on section link jumps to #risks. Report → workflow, → blueprint, → roadmap all correct. 0 non-GET requests. No overflow at 375px.
**Authenticated (disposable users, deleted):** new org → "No current, complete assessments yet"; after save → 45 net h shown; after volume change → workflow listed under "Excluded from findings", no findings; user B sees only own setup prompt, no A data (report has no id parameter; data comes from owner-scoped getWorkspace).
**Not tested:** email-confirmation signup, Google sign-in, hand-crafted RPC forgery, screen-reader testing, print/PDF (not implemented).

## Phase 3B — Release gate (2026-10-11)

Evidence types are kept separate: **[auto]** vitest, **[live-backend]** real HTTP requests to the running app/database, **[browser]** Playwright against the running app, **[unverified]** not executed.

**Baseline [auto]:** 77/77 tests pass, unchanged. Northstar 15 workflows, 4/6/2/3, 755/139/616 h, roadmap Now 4 (408) / Next 3 (93) / Later 5 (115) / Human-Led 3 [browser]. No scoring, roadmap, blueprint or report logic changed.

**Forged-request test [live-backend], 32/32 pass.** Scripts: `scripts/security/forge_capture.py` (records real server-function calls from a normal signed-in session) and `forge_rpc_test.py` (replays them tampered). Two disposable `qa-2a-*@example.invalid` users, deleted afterwards (0 remaining).
- Anonymous calls to all six workspace server functions → Unauthorized; garbage and signature-tampered JWTs rejected.
- User B with A's workflow ID: detail → null, save → `not_found`, update/delete → "Workflow not found"; A's row unchanged in the database.
- Forged `model`, `results`, `inputs.priority`, `owner_user_id` (save and createOrganization) → rejected by strict schemas; no rows written.
- Out-of-range factor and malformed IDs rejected; contradictory input (read-only + irreversibility 4) → `invalid`, no row.
- Stale `baseRevision` and replay of an already-used revision → `conflict`; legitimate save writes exactly one new revision with server-computed results.
- Owner direct REST UPDATE/DELETE/INSERT on snapshots → 403; B's direct REST read of A's snapshots → 0 rows.
- Cross-site request (foreign Origin) → 403 from CSRF middleware.
- Note: server-function errors return HTTP 200 with a serialized error payload; the test asserts on the payload and on database state, not status codes.

**Secrets/config review:** service-role key only read in `client.server.ts`, loaded inside the `saveAssessment` handler; not present in the client version of `workspace.functions.ts`. `.env` holds only publishable values. `scripts/security/*` read keys from env only, write random passwords to /tmp only, and cleanup is restricted to `qa-2a-*@example.invalid` / `sec-test-*@example.invalid`. Backend security scan: no findings. Dependency scan: 3 high advisories in build-time transitive packages (source-map-js via the Tailwind Vite plugin; js-yaml via TanStack Start) — not used at request time; no upgrade performed, revisit when upstream releases fixes.

**Authentication:**
- Email/password sign-in through the /auth form with pre-confirmed disposable users [browser]. Sign-out → sign-in again was not re-run in this phase [unverified this phase].
- Expired/invalid stored session → redirected to /auth, no private data shown [browser].
- **Email signup with confirmation [unverified — BLOCKED]:** no test inbox available; requires the user to sign up with a real address and click the link. Email verification left enabled.
- **Google [unverified — BLOCKED]:** the button starts the managed Google sign-in flow (redirect to the OAuth initiate endpoint observed); consent requires an interactive Google account.

**Accessibility [browser, axe-core 4.10 WCAG 2 A/AA + best practice]:** all public pages, /auth and all five private pages now report 0 violations. Fixed: "Insufficient data" badge contrast (darker neutral token); scatter chart now hidden from assistive tech with a text alternative pointing to the existing keyboard list; roadmap workflow headings h4→h3 (heading order); loading/error messages on private pages now `role=status` / `role=alert`. **Screen reader [unverified]:** no assistive technology available.

**Reliability [browser]:** slow backend (4 s) shows "Loading…" then content; unreachable backend shows "Could not load your workspace. Try refreshing." after retries (~7 s); empty org, stale and not-assessed states shown in earlier runs and rerun below.

**Print [browser, Chromium print emulation + PDF]:** report prints without app header or section nav, with org identity, synthetic badge, disclaimers, methodology and readable tables; rows/headings avoid page splits. Collapsed "Contributing workflows" disclosures print collapsed. No PDF export feature exists.

**Final regression [browser]:** demo journey (overview → workflow simulation → roadmap → blueprint → report): unsaved banner shown, reset on reload, zero non-GET requests. Private journey with fresh disposable users: create org → workflow → assess → save → reload (rev 1) → roadmap → stale after edit (excluded from totals) → reassess (rev 2, rev 1 kept) → second user isolated, direct URL → "Workflow not found".

**Release requirements before publishing:** confirm email signup end-to-end; decide whether Google sign-in stays (test it or remove the button); keep email verification on. Scoring weights/thresholds remain uncalibrated heuristics. Not a security certification.

## Phase 3C — Release-candidate qualification (2026-10-11)

**Automated [auto]: 87/87 pass** (77 prior + 9 `src/domain/report-sequence.test.ts` + 1 `src/test/report-print.test.tsx`). New cases: Now / Next-only / Later-only (Northstar's real refund-request engine output as a Meridian-style single-workflow org) / Human-Led-only / empty org / stale-and-incomplete-only / non-positive net / unspecified dependencies never presented as Prepare facts / determinism / print opens all disclosures and restores the on-screen state. Northstar reference test unchanged and passing.

**Browser [browser]:** demo report sequence names the 4 Now candidates; zero non-GET requests on the demo. Chromium print-to-PDF of the demo report contains the contributing-workflows table and the 15-row assessment lineage while both are collapsed on screen; on-screen state unchanged after print. Private report with a disposable user whose only workflow lands in Next: Define states "There are no Now candidates…", no Now pilot text; roadmap and blueprint reconcile. Disposable users removed (0 remaining). The user's own Meridian SaaS organization was not read or modified.

**Dependency advisories [auto: dependency scan]:** see DECISIONS.md. After two patch-level overrides the scan reports 0 known vulnerabilities in production dependencies. 87/87 tests pass and the app builds and serves after the change.

**Authentication — user-reported manual evidence (not executed by this run):** email signup with a real address, confirmation email received and link followed, workspace access, Meridian SaaS org and refund assessment saved, roadmap and report viewed. Google sign-in completed and returned to an authenticated session; the Google identity got its own empty organization and could not see the email account's Meridian data. Both sign-in methods remain enabled; no auth settings changed.

**Accessibility:** touched components (report sequence, disclosures, print) keep native `<details>/<summary>` (keyboard-operable) and the existing heading structure (h2 sections, h3 stages). No real screen reader was available — screen-reader verification remains **unverified**. No WCAG conformance claim.

**Script hygiene:** no secrets, tokens or passwords in `scripts/`; scripts are not imported by `src/` and are not routes. Fixed: `authz_test.ts` pre-run cleanup previously matched `sec-test-*` without a domain check and deleted any organization named "probe"; it now requires `sec-test-*@example.invalid` and never deletes by organization name.

## Final UX quality pass (2026-10-11)

Audit [browser] at 1440 / 768 / 390 px on overview, inventory, workflow detail, roadmap, blueprint, report, auth. Five refinements:
1. **P0 — phone sideways scroll on Workflow inventory** (page was 627 px wide at 390 px). Cause: screen-reader-only "Recommended model:" labels in model badges were positioned relative to the page, escaping the table's scroll area. Fix: model badge is now `relative`. All 7 checked pages = viewport width at 390 and 768 px.
2. **P1 — workflow names didn't look clickable** (bold text, underline only on hover) in inventory, overview candidates/chart list and roadmap cards. Added a quiet always-on underline (`.link-subtle`), stronger on hover, 150 ms colour transition, disabled under reduced motion.
3. **P1 — score trio cramped on phones** (labels wrapped, "58" touched the edge). Suitability / risk / effort now stack below 640 px.
4. **P1 — disabled save button gave no reason.** When nothing has changed since the saved revision it now reads "Saved · no changes". No persistence logic changed.
Deferred: per-metric tooltips (existing inline rule/formula text already explains priority and net hours); empty roadmap lanes already say "No workflows in this phase".
Regression: 87/87 [auto]; Northstar demo roadmap Now 4/408, Next 3/93, Later 5/115, Human-Led 3, simulation unsaved and reset, zero writes [browser]; axe WCAG A/AA 0 violations on 4 pages at 390 px; keyboard focus on workflow links shows outline and underline. Screen reader still unverified. Private-page visual check of the save label not re-run in the browser (logic-only change).

## Accepted v1.0.0 portfolio checkpoint (2026-10-11)

- **Software snapshot:** `31985682460e5a136a262087dbf340d4e2ab3cf7`.
- **[verified GitHub CI]** [106/106 tests passed across ten files](https://github.com/git-d3po/ai-support-architect/actions/runs/38168651593), on this exact commit.
- **[Lovable verification report]** `bun run build` exit code 0 and typecheck passes. The GitHub workflow checks tests, not production build or lint.
- **[Lovable baseline comparison]** Full ESLint remains non-green: 1,570 errors and 9 warnings, compared with a 1,571-error/9-warning baseline before the final phase-aware correction. All 14 newly introduced Prettier-style violations were corrected, plus one pre-existing formatting violation.
- **[user-supplied published screenshots]** Current Overview, Workflow inventory, Assessment, Blueprint, Roadmap, and Executive Report (Sections A–I) show the updated phase-aware actions, preservation of restriction precedence, and canonical Northstar figures.
- **[historical tests]** Backend authorization 38/38, forged request tests 32/32, prior axe checks, and historical browser/printing runs are described earlier; they were not all repeated at the final code checkpoint.
- **[not independently established]** Every final browser link, full latest mobile and authenticated behavior, real screen-reader operation, externally calibrated impact, formal audit, or signed live build source hash.

See [Release evidence](docs/RELEASE_EVIDENCE.md) and [Known limitations](docs/KNOWN_LIMITATIONS.md).
