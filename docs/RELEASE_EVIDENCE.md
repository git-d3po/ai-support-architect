# V1 release evidence — provenance-first record

**Release date:** 2026-10-11  
**Live demo:** https://ai-support-architect.lovable.app/  
**Frozen application commit:** [31985682460e5a136a262087dbf340d4e2ab3cf7](https://github.com/git-d3po/ai-support-architect/commit/31985682460e5a136a262087dbf340d4e2ab3cf7)

This record distinguishes what was independently recorded by GitHub, reported by the Lovable development environment, supplied by the user, or completed during earlier test phases.

| Gate | Evidence | Result |
| --- | --- | --- |
| Automated regression | [GitHub Actions run 38168651593](https://github.com/git-d3po/ai-support-architect/actions/runs/38168651593), at frozen commit | **PASS: 106/106 tests across ten files** |
| Production build | Lovable final verification: `bun run build` executed in an isolated copy; exit 0, client/server/deploy artifacts produced | **PASS, reported**; nonfatal `inlineDynamicImports` warning |
| Typecheck | Lovable final verification | **PASS, reported** |
| Full lint | Lovable baseline comparison, same lint environment | **FAIL, known debt**: 1,570 errors and 9 warnings; zero net new regressions vs 1,571/9 baseline |
| Final published visuals | User-supplied desktop screenshots of public synthetic demo | **Visually reviewed**: Overview, inventory, assessment, Blueprint, Roadmap, Report Sections A–I |
| Backend authorization | Earlier live backend testing using disposable test users, documented in `TESTING.md` | **Historical PASS: 38/38** |
| Server-function request tampering | Earlier live backend forged/cross-user request tests, documented in `TESTING.md` | **Historical PASS: 32/32** |
| Accessibility | Earlier axe automated audit on tested routes | **Partial**; real screen-reader testing unverified |
| Report print | Prior Chromium print/PDF tests and automated disclosure-state test | **Historical PASS**; not exhaustively repeated on last release |
| Post-release private/phone validation | Earlier historical checks and source reuse; no comprehensive final pass demonstrated | **Not fully reverified** |
| Deployed artifact identity | Screenshots display latest phase-aware text, without a signed deployment build SHA | **No cryptographic attestation** |

## Canonical synthetic baseline

- Northstar Cloud: fictional B2B SaaS team, 45 agents, 18,000 tickets/month, 15,600 classified.
- 15/15 assessed; **4 Deterministic Automation, 6 AI-Assisted, 2 bounded AI Autonomous, 3 Human-Led**.
- **755 gross − 139 modeled review = 616 net hours/month** (rounded; invented simulation).
- Roadmap: **Now 4 / 408 net hours; Next 3 / 93; Later 5 / 115; Human-Led 3**.
- Password reset: suitability 99, risk 34, effort 15, priority 79, policy/data/process index 92; Deterministic and restricted by verified-recovery safeguards.
- Safety restrictions retain precedence, while phase-aware actions distinguish Now preparation/pilots from Next preparation and Later reassessment.

## Release discipline

The software baseline is the precise frozen commit above. Later README, case-study and screenshot documentation changes belong to `main` but do not become new v1 application code. A future functional modification requires a deliberate new change and verification; do not rewrite Git history or move release references to accommodate it.

Read [Known limitations](KNOWN_LIMITATIONS.md), [Test history](../TESTING.md) and [Decision history](../DECISIONS.md).