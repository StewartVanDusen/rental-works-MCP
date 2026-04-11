---
plan: 04-01
phase: 04-error-handling
status: complete
started: 2026-04-09
completed: 2026-04-09
---

# Plan 04-01 Summary

## Objective
Harden RentalWorksClient.request() with 401/403 retry logic and JSON.parse guard.

## What Was Built
Two defensive fixes to `src/utils/api-client.ts`:

1. **401/403 Retry Logic**: When `request()` gets a 401 or 403 response, it clears `this.token` and `this.tokenExpiry`, calls `ensureAuth()` to re-authenticate, and retries the request once. If the retry also fails, throws immediately.

2. **JSON.parse Guard**: Wrapped `JSON.parse(text)` in try/catch on both the primary and retry response paths. HTML error pages or malformed responses now throw a descriptive error with `text.slice(0, 200)` truncation instead of crashing.

## Key Files

### Created
- (none)

### Modified
- `src/utils/api-client.ts` — Added 401/403 retry block and JSON.parse try/catch guards

## Deviations
None — plan executed as specified.

## Self-Check: PASSED
- 401/403 branch clears token and retries: confirmed
- JSON.parse wrapped in try/catch on primary path: confirmed
- JSON.parse wrapped in try/catch on retry path: confirmed
- TypeScript compiles without errors: confirmed
