---
phase: 01-foundation
plan: "01"
subsystem: test-infrastructure
tags: [dependencies, vitest, testing, zod]
status: complete
---

# Plan 01-01 Summary: Fix Dependencies & Restructure Test Suite

## What Was Built

Added `zod` (^4.3.6) as a direct dependency and `@vitest/coverage-v8` (^3.2.4) as a dev dependency to fix clean-install failures. Relocated all 5 existing test files from `src/__tests__/` to `src/__tests__/unit/`, updated their import paths from `../` to `../../`, and rewrote `vitest.config.ts` with a `projects` array for separate unit/integration test execution.

## Key Files

### Created
- `src/__tests__/integration/.gitkeep` — placeholder for future integration tests

### Modified
- `package.json` — added zod to dependencies, @vitest/coverage-v8 to devDependencies, added test:unit and test:integration scripts
- `package-lock.json` — updated lockfile
- `vitest.config.ts` — replaced single config with multi-project array (unit + integration), removed `root: "src"`, added `passWithNoTests: true`
- `src/__tests__/unit/api-paths.test.ts` — relocated, imports updated
- `src/__tests__/unit/removed-tools.test.ts` — relocated, imports updated
- `src/__tests__/unit/request-bodies.test.ts` — relocated, imports updated
- `src/__tests__/unit/tool-helpers.test.ts` — relocated, imports updated
- `src/__tests__/unit/tool-registration.test.ts` — relocated, imports updated

## Verification

- `npm ci` succeeds on clean checkout
- `npx vitest run --project unit` — 5 files, 49 tests, all pass
- `npx vitest run --project integration` — exits 0 (no tests, passWithNoTests)
- No test files remain in `src/__tests__/` root

## Deviations

1. `passWithNoTests: true` placed at root `test` level (not per-project) — vitest 3.x ProjectConfig type doesn't expose this property, but it works at the root level and is inherited
2. Used `test` blocks without `extends: true` in project configs — simpler and vitest inherits root settings by default

## Self-Check: PASSED
