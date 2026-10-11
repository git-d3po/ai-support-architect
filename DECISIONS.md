# Decisions

1. **Demo as a code fixture, not database rows.** The public demo needs no anon database policies, so canonical data cannot be modified.
2. **One immutable snapshot table** instead of separate assessment and result tables. Each save is a single atomic insert, and every result is tied to its exact inputs and version.
3. **Service-role insert from an authenticated server function.** Browser roles hold no write grant on snapshots, so results cannot be forged from the client. The service-role key stays server-side.
4. **Optimistic concurrency** uses `UNIQUE(workflow_id, revision)` plus a trigger requiring revision = max + 1.
5. **Staleness via `attributes_version`**, incremented by a trigger. Results are never silently recomputed; the user re-saves explicitly.
6. **Restrictions are derived from authoritative attributes**, and declared risks can only add more. Contradictory inputs are rejected rather than resolved.
7. **Outcome verifiability is a single factor.** R6 is derived from it instead of a duplicate boolean (a refinement of plan rev 2, which listed both).
8. **Suitability is excluded from the priority score** because it already gates the model.
9. **Provenance is recorded per assessment** (observed vs estimate) in Phase 1, not per field. Per-field provenance is deferred.
10. **The workspace inventory lives on `/workspace`** rather than a separate `/workspace/workflows` page, to avoid an extra list route.
11. **Fonts: IBM Plex Sans/Mono**, with muted semantic colors per operating model.
12. **Stale-version conflicts use SQLSTATE P0409, not 40001.** The Data API auto-retries serialization failures (40001), so using it made stale saves hang.
13. **Concurrency contract: first writer wins.** A second save on the same base revision gets a conflict and must reload. Ordering by unique revision is always deterministic.
14. **Security verification uses throwaway pre-confirmed users** created with admin tooling (`scripts/security/authz_test.ts`), so the real sign-up and confirmation flow stays unchanged and no test bypass exists in the app.

## Roadmap is derived, not persisted (Phase 2A)
The roadmap is recomputed from current workflows and latest snapshots on each view; no roadmap table, no migration. It therefore always follows assessment changes, staleness and deletions, and cannot diverge from authoritative results.
Implementation priority ≠ deployment readiness: "Now" means investigate first, not approved. Controls carry no completion state because the app holds no evidence of implementation.
Human-Led workflows sit in a separate section and never enter phase lanes; restricted candidates stay ranked but are labelled "Conditional on required controls" with a restriction-driven next action.

## Implementation Blueprints are derived (Phase 2B)
Blueprints and shared dependencies are recomputed from the authoritative assessment on each view; nothing is persisted, so they cannot drift from saved results and need no migration. Every dependency carries a provenance (mandatory / assessment-derived / planning inference / unspecified) so inferred guidance is never mistaken for evidence. The Blueprint states what to design and evaluate; it is not launch certification, has no readiness score and no completion tracking. Tradeoff: provenance thresholds are rule-based and uncalibrated, documented in IMPLEMENTATION_DESIGN.md. Blueprint routes are `/demo/blueprint/$id` and `/workspace/blueprint/$id` so existing workflow-detail routes stay leaf pages.

## Executive report is derived and templated (Phase 3A)
`src/domain/report.ts` builds the report on demand from one dataset in a single call to summarize(), buildRoadmap(), sharedDependencies() and analyzeDependencies(), so sections cannot disagree and nothing is persisted. Narrative sentences are deterministic templates filled from structured findings — no LLM text in v1, so every claim is traceable and reproducible. Report header shows report-1, scoring, roadmap and blueprint versions; a lineage list shows each workflow's status and saved revision. Review overhead is the sum of engine review_hours over the same population as gross/net.
