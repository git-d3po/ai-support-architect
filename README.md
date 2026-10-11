# AI Support Automation Architect

**Explainable automation planning for Support Operations.**

AI Support Automation Architect is a B2B decision-support application for support leaders and implementation consultants. It helps teams decide **which support workflows to automate, which operating model fits, what controls are mandatory, and where to start**—without treating automation potential as permission to deploy AI.

The product is built with Lovable and uses a deterministic, versioned TypeScript decision engine. The public **Northstar Cloud** environment contains entirely synthetic data; signed-in users can assess and save workflows in separate private workspaces.

**Status:** Published v1.0.0 portfolio release (11 October 2026). **[Try the live synthetic demo](https://ai-support-architect.lovable.app/)**.

**Frozen application code:** [commit `3198568`](https://github.com/git-d3po/ai-support-architect/commit/31985682460e5a136a262087dbf340d4e2ab3cf7). Later documentation commits do not change the accepted software snapshot. The GitHub repository remains **private**; the public demo does not expose authenticated workspace data or grant access to the source.

## Product tour and engineering evidence

[Live Overview](https://ai-support-architect.lovable.app/) · [Workflow inventory](https://ai-support-architect.lovable.app/demo/workflows) · [Roadmap](https://ai-support-architect.lovable.app/demo/roadmap) · [Executive Report](https://ai-support-architect.lovable.app/demo/report)

A good walkthrough starts with the synthetic portfolio, opens **Password reset** to understand the deterministic-versus-AI boundary for account access, examines its proposed Blueprint, then compares **Now / Next / Later** actions and the report's Sections E–I.

**Engineering documentation:** [Architecture and case study](docs/CASE_STUDY.md) · [Release evidence](docs/RELEASE_EVIDENCE.md) · [Known limitations](docs/KNOWN_LIMITATIONS.md) · [Release notes](docs/releases/v1.0.0.md).

## Product workflow

1. **Assess:** Evaluate a support workflow's suitability, operational risk, implementation effort and modeled handling-time opportunity.
2. **Recommend:** Choose among Deterministic Automation, AI-Assisted, bounded AI Autonomous, or Human-Led. Mandatory safety rules override weighted scores.
3. **Prioritize:** Organize eligible opportunities into Now, Next and Later; keep Human-Led and stale/incomplete assessments separate.
4. **Design:** Produce proposed implementation blueprints with responsibility boundaries, required controls, dependencies and evaluation considerations.
5. **Report:** Generate an executive assessment report from the same authoritative assessment and planning data, with methodology and evidence limitations.

A refund workflow, for example, may benefit from AI-assisted policy review and drafting while **human approval remains mandatory** for financial execution. High automation suitability does not automatically mean high implementation priority.

## Architecture

| Layer | Implementation |
| --- | --- |
| Application | React, TypeScript and TanStack Start |
| UI | Existing accessible components, responsive assessment controls and Recharts |
| Domain engine | Pure TypeScript: `src/domain/` |
| Authentication and persistence | Lovable Cloud / Supabase-compatible authentication and PostgreSQL |
| Authorization | Owner-scoped row-level security plus server-side ownership checks |
| Trusted assessment save | Server function recalculates results and writes an immutable snapshot |
| Public demo | Versioned synthetic code fixtures in `src/fixtures/` |
| Testing | Vitest; documented browser and live authorization/security checks |

The domain modules separate scoring, validation, impact, roadmap planning, blueprint derivation and executive reporting. The demo, local preview and trusted save path use the same assessment engine rather than maintaining independent business rules.

### Data integrity and security decisions

- **Server-authoritative results:** submitted inputs are validated; client-supplied scores or recommendations cannot become saved authoritative results.
- **Immutable revisions:** assessment inputs, results and rule version are captured in a single saved snapshot. Optimistic concurrency prevents ambiguous competing revisions.
- **Stale-result handling:** changes to material workflow attributes invalidate the current result for portfolio calculations until reassessment.
- **Separation of public/private data:** the public demo cannot write canonical records; private records are owner-restricted.
- **Safety precedence:** controls for sensitive data, identity, security and financial actions constrain automation recommendations even when a workflow scores highly.

See `SCORING.md`, `DATA_MODEL.md`, `DECISIONS.md` and `IMPLEMENTATION_DESIGN.md` for the actual rules and design tradeoffs. **The application proposes operating models; it does not execute support actions or certify launch readiness.**

## Synthetic demonstration

Northstar Cloud represents a fictional 45-agent B2B SaaS support team with 18,000 monthly tickets and 15 assessed workflows. Its reference assessment distribution is four deterministic, six AI-assisted, two bounded-autonomous and three human-led workflows.

Its estimated handling-time opportunity is **755 gross hours minus 139 review hours = 616 net modeled hours per month**, under declared synthetic assumptions. These figures are not observed savings, financial ROI or headcount reductions.

## Validation evidence

At the October 2026 v1 freeze checkpoint, the evidence is:

- **106/106 regression tests passed across ten files**, verified by [GitHub Actions on the frozen commit](https://github.com/git-d3po/ai-support-architect/actions/runs/38168651593).
- **Production build and TypeScript check passed** in Lovable's reported final verification. GitHub CI runs tests only; it does not certify the build or lint.
- **Full lint still fails**: 1,570 pre-existing errors and nine warnings, predominantly formatting violations. The final phase-aware correction introduced zero new lint debt relative to the preceding 1,571-error baseline.
- **Historical** controlled validation included 38/38 backend authorization and 32/32 forged-request scenarios using disposable identities, as recorded in `TESTING.md`.
- User-supplied screenshots of the published demo display the accepted phase-aware Roadmap, warnings and executive reporting; final interactive print, phone and signed-in workflows were not comprehensively repeated.

These are evidence of a **portfolio-quality decision-support demonstration**, not a security certification, independently validated operational benefit, or full accessibility audit. Scoring weights remain uncalibrated, and real screen-reader interaction remains unverified. See [Release evidence](docs/RELEASE_EVIDENCE.md) and [Known limitations](docs/KNOWN_LIMITATIONS.md).

## Run and test locally

The repository uses Bun (`bun.lock`) and the Lovable-managed application stack.

```sh
bun install --frozen-lockfile
bun run test
bun run dev
```

For checks available in the project:

```sh
bun run lint
bun run build
```

Configure local environment variables using `.env.example` as a reference. The existing tracked `.env` contains **publishable** project configuration used by the Lovable environment; it is not a place for secrets. Put local overrides and privileged values in ignored local files or a secure server-side environment. Never expose `SUPABASE_SERVICE_ROLE_KEY` through a `VITE_` variable or client bundle.

The **public synthetic demo** is the easiest way to inspect the application. Real private-workspace operations require a correctly configured compatible backend and server-side credentials; copying example values alone will not enable them.

The lightweight GitHub Actions workflow runs the unit/regression suite without privileged backend secrets. Live security tests are deliberately excluded from untrusted pull-request CI.

## Repository and project conventions

- `src/domain/` — authoritative scoring, planning, blueprints and report-generation rules.
- `src/components/` and `src/routes/` — presentation and TanStack Start routes.
- `src/lib/workspace.functions.ts` — trusted workspace functions.
- `drizzle/migrations/` — database constraints, triggers and grants.
- `scripts/security/` — controlled tests using disposable identities; **do not run against real user data**.
- `AGENTS.md` — Lovable/GitHub synchronization and repository guidelines.

Changes pushed to the connected `main` branch synchronize with Lovable. Preserve published Git history; do not force-push, rewrite or squash existing pushed commits.

**Built using Lovable**, with documented product requirements, deterministic domain architecture, safety restrictions, evaluation scenarios and implementation reviews. The repository remains private, and no open-source reuse license has been granted.
