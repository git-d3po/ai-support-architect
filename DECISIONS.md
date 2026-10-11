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
