---
phase: "02"
plan: "02"
subsystem: tests
tags: [swagger, validation, testing, path-validation]
dependency_graph:
  requires: [02-01]
  provides: [src/__tests__/unit/swagger-spec.test.ts]
  affects: [03-bug-fixes]
tech_stack:
  added: []
  patterns: [vitest, MCP InMemoryTransport, fetch stubbing, OpenAPI path regex matching]
key_files:
  created:
    - src/__tests__/unit/swagger-spec.test.ts
  modified:
    - src/tools/utilities.ts
decisions:
  - "sync_to_quickbooks bug fixed: URL used /entity/id/synctoqbo but spec shows /entity/synctoqbo — entityId now sent in request body"
  - "Test covers 115 cases (114 tool tests + 1 meta coverage test) confirming all tools match spec"
  - "Generic passthrough tools (raw_api_*) validated with known spec-conformant paths"
metrics:
  duration: "~15 minutes"
  completed: "2026-04-10"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 2
---

# Phase 02 Plan 02: Swagger Spec Validation Test Suite Summary

## One-Liner

Vitest test suite validating all 114 MCP tool API paths against the cached Swagger spec using OpenAPI placeholder regex matching, with one genuine path bug found and fixed.

## What Was Built

`src/__tests__/unit/swagger-spec.test.ts` — 115-test validation suite that:
1. Loads `scripts/swagger-cache.json` at test startup (5,801 spec paths)
2. Stubs `fetch` to capture URL + HTTP method for each tool call
3. Normalizes captured paths: strips query strings, matches `{id}` placeholders via regex
4. Asserts every captured path+method exists in the Swagger spec
5. Organized into 11 domain `describe` blocks matching the tool file structure
6. Includes a meta-test confirming exactly 114 tools are registered

## Test Coverage

| Domain | Tools Tested | Result |
|--------|-------------|--------|
| inventory | 13 | all pass |
| orders | 15 | all pass |
| contracts | 14 | all pass |
| customers | 13 | all pass |
| billing | 13 | all pass |
| vendors | 9 | all pass |
| settings | 14 | all pass |
| reports | 6 | all pass |
| admin | 5 | all pass |
| storefront | 3 | all pass |
| utilities | 9 | all pass |
| **TOTAL** | **114** | **all pass** |

## Full Suite Results

All 6 test files pass — 164 tests total:
- tool-helpers.test.ts (8)
- request-bodies.test.ts (7)
- api-paths.test.ts (18)
- tool-registration.test.ts (13)
- removed-tools.test.ts (3)
- swagger-spec.test.ts (115) ← new

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1+2 | ac2f5fc | feat(02-02): add swagger-spec.test.ts validating all 114 tool paths |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed sync_to_quickbooks incorrect URL path**
- **Found during:** Task 1 (first test run)
- **Issue:** `sync_to_quickbooks` tool built URL as `/api/v1/{entityType}/{entityId}/synctoqbo` but the Swagger spec shows `/api/v1/{entityType}/synctoqbo` (no entity ID in path)
- **Fix:** Changed `utilities.ts` to use `/api/v1/${entityType}/synctoqbo` and send `{ Id: entityId }` in the POST body
- **Files modified:** `src/tools/utilities.ts`
- **Commit:** ac2f5fc

## Known Stubs

None — all test cases make real tool calls and capture real URLs.

## Threat Flags

None — test file reads a committed JSON cache file only; no new network endpoints introduced.
