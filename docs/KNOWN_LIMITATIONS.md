# Known limitations — AI Support Automation Architect v1.0.0

**Release scope:** A public, synthetic, deterministic decision-support demonstration. The frozen code is [commit 3198568](https://github.com/git-d3po/ai-support-architect/commit/31985682460e5a136a262087dbf340d4e2ab3cf7). The repository remains private.

| Area | Verified boundary / open limitation |
| --- | --- |
| **Scoring calibration** | Weights and thresholds are explainable v1 heuristics, not trained or calibrated against real customer outcomes. A high score is not deployment permission. |
| **Synthetic metrics** | Northstar's 18,000 tickets, 15 workflows and 616 modeled net hours/month are fictional scenario inputs. These are **not observed savings, revenue, ROI or headcount reductions**. |
| **Impact accounting** | Modeled review effort is deducted; maintenance, integration, ongoing quality assurance and tooling costs are outside the estimate. |
| **Required controls** | The app lists safeguards and accepts some user declarations, but cannot verify that safeguards are implemented, effective, complete or independently approved. |
| **Product boundary** | The app proposes operating models, priorities, blueprints and reports; it does not execute support requests, certify production readiness or track go-live approval. |
| **Authorization assurance** | Controlled earlier live-backend checks covered RLS, two-account isolation, immutable snapshots and forged request rejection. This does not constitute independent penetration testing or security certification. |
| **Accessibility** | Earlier automated axe checks reported zero violations on checked routes; thorough real screen-reader interaction remains **unverified**. No formal WCAG conformance claim. |
| **Post-release browsing** | Owner-supplied desktop screenshots confirm phase-aware language and the report; they do not independently establish every link, mobile viewport, authenticated session or printed report after the final correction. |
| **GitHub lint** | Full `eslint .` **fails** with **1,570 errors and 9 warnings** at freeze. 1,567 errors are formatting-style and three are previously present script/generated-file rules. The final change introduced **zero net lint regressions** versus the earlier 1,571/9 baseline. Do not claim a green lint gate. |
| **CI** | GitHub Actions runs the regression tests, not build, typecheck or lint. The successful production build and typecheck were reported by Lovable's separate verification run. |
| **Source/deployment match** | Live desktop screenshots show guidance consistent with source; the app does not expose a signed deployed source commit, so source-to-deployment cryptographic equivalence has not been established. |
| **Source sharing** | The GitHub repo is private with no open-source license. Public demo access does not grant permission to copy, modify or redistribute the source. |

## Deferred work

Real-world calibration, a manual screen-reader review, end-to-end operational pilot measurement, and repository-wide lint remediation are **separate future work**, not completed v1 features. Keep this list accurate without hiding existing findings or mixing broad changes into release-quality corrections.

See [release evidence](RELEASE_EVIDENCE.md), [test history](../TESTING.md) and [decisions](../DECISIONS.md).
