---
phase: 8
slug: schema-and-formatter-extension
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-11
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.2.4 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm run test:unit` |
| **Full suite command** | `npm run test:unit` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:unit`
- **After every plan wave:** Run `npm run test:unit`
- **Before `/gsd-verify-work`:** Full suite must be green + `npx tsc --noEmit`
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | FSEL-01 | — | N/A | unit | `npm run test:unit` | ❌ W0 | ⬜ pending |
| 08-01-02 | 01 | 1 | FSEL-02 | — | N/A | unit | `npm run test:unit` | ❌ W0 | ⬜ pending |
| 08-01-03 | 01 | 1 | SC-3 | — | N/A | unit | `npm run test:unit` | ✅ | ⬜ pending |
| 08-01-04 | 01 | 1 | SC-4 | — | N/A | typecheck | `npx tsc --noEmit` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/unit/browse-helpers.test.ts` — add tests for `projectFields` and `resolveFieldPreset`
- [ ] `src/__tests__/unit/tool-helpers.test.ts` — add tests for extended `formatBrowseResult` with `options.fields`

*Existing test files, add new test suites/cases.*

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
