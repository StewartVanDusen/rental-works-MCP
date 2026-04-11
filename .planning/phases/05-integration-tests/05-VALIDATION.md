---
phase: 5
slug: integration-tests
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-09
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.1.0 |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --project integration` |
| **Full suite command** | `npx vitest run --project integration` |
| **Estimated runtime** | ~30 seconds (network-dependent) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --project integration`
- **After every plan wave:** Run `npx vitest run --project integration`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 5-01-01 | 01 | 1 | INTG-01 | — | N/A | integration | `npx vitest run --project integration` | ❌ W0 | ⬜ pending |
| 5-01-02 | 01 | 1 | INTG-02 | — | N/A | integration | `npx vitest run --project integration` | ❌ W0 | ⬜ pending |
| 5-01-03 | 01 | 1 | INTG-03 | — | N/A | integration | `npx vitest run --project integration` | ❌ W0 | ⬜ pending |
| 5-01-04 | 01 | 1 | INTG-04 | — | N/A | integration | `npx vitest run --project integration` | ❌ W0 | ⬜ pending |
| 5-01-05 | 01 | 1 | INTG-05 | — | N/A | integration | `npx vitest run --project integration` | ❌ W0 | ⬜ pending |
| 5-01-06 | 01 | 1 | INTG-06 | — | N/A | integration | `npx vitest run --project integration` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/integration/smoke.test.ts` — integration test file with all INTG requirements
- [ ] vitest.config.ts timeout update — 15s for integration project

*Existing infrastructure covers test runner and project config.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Tests skip when no env vars | INTG-01 | Requires running without env vars set | Run `npx vitest run --project integration` without RENTALWORKS_BASE_URL |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
