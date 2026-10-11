# AI Support Automation Architect

**Explainable automation planning for Support Operations.**

AI Support Automation Architect is a B2B decision-support application for support leaders and implementation consultants. It helps teams decide **which support workflows to automate, which operating model fits, what controls are mandatory, and where to start**—without treating automation potential as permission to deploy AI.

The product is built with Lovable and uses a deterministic, versioned TypeScript decision engine. The public **Northstar Cloud** environment contains entirely synthetic data; signed-in users can assess and save workflows in separate private workspaces.

**Project status:** v1 release candidate (October 2026). A public application URL can be added after publication.

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

At the October 2026 v1 release-candidate checkpoint, the project documented:

- **87/87 automated regression tests** passing.
- **32/32 live request-tampering checks** rejected unauthorized or manipulated requests.
- Authenticated cross-user isolation, immutable snapshots, concurrency and stale-result behavior checked in earlier browser/backend runs.
- Public-demo changes verified as unsaved; private assessment-to-roadmap-to-report flows exercised.
- Email confirmation and Google sign-in manually verified by the project owner.

These are **historical, reported verification results**, not continuously running certifications. The latest executed results and limitations are recorded in `TESTING.md` and `RELEASE.md`. Scoring weights and thresholds are explicitly **uncalibrated heuristics**; a comprehensive real screen-reader interaction test has not been completed.

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

**Built with Lovable**, with deliberate product requirements, deterministic architecture, evaluation scenarios and documented review/iteration. No open-source reuse license has been granted at this stage.
