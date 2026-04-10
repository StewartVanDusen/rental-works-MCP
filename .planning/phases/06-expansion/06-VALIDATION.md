---
phase: 6
slug: expansion
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-09
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 6-01-01 | 01 | 1 | EXPN-01 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 6-01-02 | 01 | 1 | EXPN-02 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 6-02-01 | 02 | 2 | EXPN-03 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 6-02-02 | 02 | 2 | EXPN-04 | — | N/A | integration | `npx vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `__tests__/address-tools.test.ts` — unit tests for address CRUD tools
- [ ] `__tests__/change-order-status.test.ts` — unit test for change order status tool
- [ ] `__tests__/integration/address-smoke.test.ts` — integration smoke tests for address browse

*Existing test infrastructure (vitest, test helpers, mock patterns) covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Change order status mutates data | EXPN-02 | Read-only constraint prevents live testing | Verify tool definition matches Swagger path; unit test validates request shape |

*All other phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
