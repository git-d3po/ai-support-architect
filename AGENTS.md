<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Domain logic lives in `src/domain/` (pure TS, no React/DB); UI and server both call `assess()` so demo, preview and saved results never diverge.
- Assessment snapshots are written only by `saveAssessment` via the server-side service-role client; browser roles have SELECT-only on that table, so results can't be forged.
- Snapshots are immutable and versioned by `(workflow_id, revision)`; recalculation means a new revision, never an UPDATE.
- The public demo is a code fixture (`src/fixtures/northstar.ts`), not database rows, so anon needs no database access.
- Workflow-level attributes are authoritative for safety restrictions; assessment inputs may only add restrictions.
- Scoring rules, data model, decisions and test status are documented in SCORING.md, DATA_MODEL.md, DECISIONS.md, TESTING.md — update them with any rule change.
- Roadmap planning lives in src/domain/roadmap.ts and only consumes assess() output; it must never recompute scores, models, restrictions or impact.
- Implementation blueprints and dependency analysis live in src/domain/blueprint.ts; one analyzeDependencies() feeds both workflow blueprints and portfolio shared dependencies.
- The executive report lives in src/domain/report.ts and is assembled from existing portfolio, roadmap and blueprint functions in one pass; it never adds its own calculations.
