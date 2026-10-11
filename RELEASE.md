# Release candidate checklist (v1, 2026-10-11)

Evidence key: [auto] automated test · [live] live backend request test · [browser] Playwright on running app · [user] user-reported manual test · [unverified]

- [x] Core features: assessment engine, 4 operating models, safety overrides, immutable versioned snapshots, private workspaces, read-only Northstar demo, impact model, roadmap, blueprints, shared dependencies, executive report.
- [x] Regression: 87/87 [auto]; Northstar 15 workflows, 4/6/2/3, 755/139/616 h, Now 4/408 · Next 3/93 · Later 5/115 · Human-Led 3 [auto][browser].
- [x] Authentication: email signup + confirmation, Google sign-in, separate workspaces per identity [user]; password sign-in and expired-session redirect [browser].
- [x] Authorization: 32/32 tampered server-function requests blocked [live]; two-user isolation [browser][live].
- [x] Public-demo integrity: zero writes, unsaved simulation resets [browser].
- [x] Report consistency: sequence guidance matches populated lanes across 7 portfolio states [auto][browser].
- [x] Print completeness: collapsed sections print; app chrome hidden [auto][browser]. No PDF export feature.
- [x] Accessibility: axe 0 violations on 13 pages (Phase 3B) [browser]. Screen reader [unverified]. No WCAG claim.
- [x] Dependency security: 3 advisories fixed via patch overrides; scan clean [auto].
- Limitations: scoring weights/thresholds are uncalibrated heuristics; modeled impact is a scenario estimate; required controls are never verified by the app; not a security certification.
- Manual actions before publishing: review the app, then publish from the editor (not done automatically). Optional: screen-reader pass on report and assessment pages.
