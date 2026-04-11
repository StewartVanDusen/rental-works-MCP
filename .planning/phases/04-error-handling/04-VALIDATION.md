---
phase: 4
slug: error-handling
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-09
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.1.x |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run src/__tests__/unit/error-handling.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/__tests__/unit/error-handling.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | TEST-06 | — | 4xx returns user-readable error | unit | `npx vitest run src/__tests__/unit/error-handling.test.ts` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | TEST-07 | — | 401 triggers re-auth path | unit | `npx vitest run src/__tests__/unit/error-handling.test.ts` | ❌ W0 | ⬜ pending |
| 04-01-03 | 01 | 1 | TEST-08 | — | HTML/empty body handled gracefully | unit | `npx vitest run src/__tests__/unit/error-handling.test.ts` | ❌ W0 | ⬜ pending |
| 04-01-04 | 01 | 1 | TEST-09 | — | withErrorHandling detects known issues | unit | `npx vitest run src/__tests__/unit/error-handling.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/unit/error-handling.test.ts` — stubs for TEST-06, TEST-07, TEST-08, TEST-09

*Existing test infrastructure (vitest, test helpers) covers framework needs.*

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
