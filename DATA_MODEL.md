# Data model

Migrations: `drizzle/migrations/0000_*.sql`, `0001_revoke_default_grants.sql`, `0002_stale_version_errcode.sql`.

## Tables
- **organizations**: owned by `owner_user_id` (plain uuid = auth user id). Constraints: name length and non-negative counts.
- **workflows**: FK to organization (cascade), `owner_user_id`, authoritative attributes, and `attributes_version`.
  - Trigger `workflows_before_update` makes owner and organization immutable and ignores client-set versions. It increments `attributes_version` when volume, AHT, action_type, handles_account_access or accesses_sensitive_data changes.
- **assessment_snapshots**: immutable, one row per save. Holds validated `inputs`, a copy of `workflow_attributes`, `workflow_attributes_version`, `scoring_version`, `results` and `provenance`.
  - `UNIQUE(workflow_id, revision)`.
  - FK to workflow (cascade).

## Grants and RLS
| Table | anon | authenticated | service_role |
|---|---|---|---|
| organizations | none | CRUD, owner RLS (`owner_user_id = auth.uid()`) | all |
| workflows | none | CRUD, owner RLS; insert/update also require an owned organization | all |
| assessment_snapshots | none | SELECT only, owner RLS | SELECT, INSERT, DELETE |

- Trigger `assessment_snapshots_forbid_update` rejects every UPDATE, for every role.
- Trigger `assessment_snapshots_before_insert` requires all of:
  - the snapshot owner equals the workflow owner;
  - `workflow_attributes_version` equals the current version (otherwise errcode P0409 (not 40001: the Data API auto-retries serialization failures));
  - `revision` equals the current max + 1 (otherwise errcode 23505).
- Default Data API privileges were explicitly revoked in migration 0001. Before that, anon had an unintended INSERT privilege on snapshots; the insert trigger still blocked it.

## Trusted write path (`saveAssessment`, `src/lib/workspace.functions.ts`)
1. `requireSupabaseAuth` validates the JWT and provides `userId`. No identity is taken from input.
2. The strict zod schema rejects unknown fields, including any client-supplied scores or results.
3. The workflow is re-read with the user-scoped client, so RLS applies. Ownership is re-checked against `userId`; failure returns not_found.
4. Consistency validation runs; failure returns `invalid` with field errors.
5. `assess()` recomputes results on the server.
6. One INSERT with the service-role client, which is dynamically imported inside the handler and never reaches the browser. A single statement is atomic: the save either fully persists or nothing does. Error 23505 or P0409 is returned as `conflict`.

## Lifecycle
- The current snapshot is the one with max(revision).
- Status is derived, never stored:
  - not_assessed: no snapshot
  - incomplete: the result is insufficient data
  - stale: the attributes version or scoring version differs from the current one
  - assessed: otherwise
- Stale and incomplete snapshots are excluded from aggregates and rankings.
- Recalculation happens only through an explicit re-save, which creates a new revision. Old rows are never rewritten.
- Deleting a workflow cascades and deletes its entire history.

## Demo
Northstar Cloud is a code fixture (`src/fixtures/northstar.ts`) with no database rows. Its results come from the same `assess()` function. Simulations live in component state only.
