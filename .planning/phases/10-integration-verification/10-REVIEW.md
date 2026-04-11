---
phase: 10-integration-verification
reviewed: 2026-04-11T00:00:00Z
depth: standard
files_reviewed: 1
files_reviewed_list:
  - src/__tests__/integration/live-api.test.ts
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-04-11
**Depth:** standard
**Files Reviewed:** 1
**Status:** issues_found

## Summary

The integration test file covers authentication, session, browse smoke tests, GET-by-ID for 8 entities, and three v1.1 browse-enhancement scenarios. The skip guard and read-only constraint are correctly implemented. Three reliability issues were found: one test has a hard assertion that will fail (not skip) on an empty inventory, one test has a fragile assertion that presupposes specific server behavior that may not hold on all instances, and one test contains a misleading/incorrect assertion. Two info items cover minor style and test-naming concerns.

## Warnings

### WR-01: Hard failure on empty inventory in "explicit fields" test

**File:** `src/__tests__/integration/live-api.test.ts:206`
**Issue:** The test at line 196 calls `client.post` with `pagesize: 5` and then asserts `expect(projected.length).toBeGreaterThan(0)` without first checking whether the server returned any rows. If the live instance has zero `rentalinventory` records (unlikely but possible in a test/staging environment) the test fails hard rather than skipping gracefully. Every other GET-by-ID test in the file uses `if (browse.TotalRows === 0) return;` — this test is the only one missing that guard.
**Fix:**
```typescript
it("explicit fields array returns only those fields per row", async () => {
  const result = await client.post<BrowseResponse>("/api/v1/rentalinventory/browse", {
    pageno: 1,
    pagesize: 5,
    orderby: "",
    orderbydirection: "asc",
  });

  if (!result.Rows || result.Rows.length === 0) return; // no data — skip gracefully

  const projected = projectFields(result.Rows as Record<string, unknown>[], ["InventoryId", "Description"]);
  // ... rest of assertions unchanged
});
```
The same fix applies to the "default BRIEF_FIELDS projection" test (line 217) and "default browse returns at most 10 items" test (line 240) which also assert `projected.length > 0` without a guard.

---

### WR-02: "client-side fallback" test asserts `clientFiltered: true` unconditionally — fails if server accepts the column

**File:** `src/__tests__/integration/live-api.test.ts:279`
**Issue:** `expect(result.clientFiltered).toBe(true)` is a hard assertion. `withClientSideFallbackTracked` only sets `clientFiltered: true` when the API throws an "Invalid column name" error. If the RentalWorks instance happens to accept `masterid` as a valid column name (or the API is updated to accept it), the first request succeeds, `clientFiltered` is `false`, and the assertion fails. This makes the test brittle and tightly coupled to a specific server-side quirk. The test should either be made conditional or the assertion should document why this column is always expected to be rejected.
**Fix:** Either add a comment explaining the assumption and make it conditional, or use a field name that is definitively not in the schema:
```typescript
// masterid is a known-invalid column on rentalinventory browse — server always rejects it
// If this ever passes without clientFiltered=true, the server's validation changed
if (result.clientFiltered) {
  expect(result.clientFiltered).toBe(true);
  expect(result.unfilteredTotal).toBeGreaterThanOrEqual(result.response.Rows.length);
} else {
  // Server accepted the column — fallback was not triggered; validate shape only
  expect(Array.isArray(result.response.Rows)).toBe(true);
}
```

---

### WR-03: "default browse returns at most 10 items" assertion verifies the request parameter, not server enforcement

**File:** `src/__tests__/integration/live-api.test.ts:255`
**Issue:** `expect(result.Rows.length).toBeLessThanOrEqual(10)` passes `pagesize: 10` in the request (line 244) and then asserts the response has at most 10 rows. This assertion can never fail because the client itself requested `pagesize: 10` — it is circular and does not test anything meaningful. If the intent is to verify the server honours the page size cap, the assertion should compare against the requested page size or verify the configured default (not the echoed request value). If the intent is to test the MCP tool's default page size enforcement, the test should invoke the tool handler rather than calling `client.post` directly.
**Fix:** Clarify intent and fix the assertion. If testing server compliance:
```typescript
// Server should return exactly pagesize rows (or fewer if TotalRows < pagesize)
expect(result.Rows.length).toBeLessThanOrEqual(Math.min(10, result.TotalRows));
```
If testing MCP default page-size enforcement, invoke the registered tool handler directly instead of `client.post`.

---

## Info

### IN-01: Repeated boilerplate in browse smoke tests with no shared helper

**File:** `src/__tests__/integration/live-api.test.ts:52-106`
**Issue:** The five browse smoke tests (rentalinventory, order, customer, deal, address) are structurally identical: call `client.browse`, assert `TotalRows`, assert `Rows` is array, assert `typeof TotalRows === "number"`, then conditionally check entity-specific ID/name fields. This is not a bug, but the duplication makes future maintenance fragile — a change to the expected shape must be applied to all five.
**Fix:** Extract a shared helper for the common assertions, parametrize the entity-specific checks. Example:
```typescript
function expectBrowseShape(result: Record<string, unknown>) {
  expect(result).toHaveProperty("TotalRows");
  expect(result).toHaveProperty("Rows");
  expect(Array.isArray(result.Rows)).toBe(true);
  expect(typeof result.TotalRows).toBe("number");
}
```

---

### IN-02: `authenticate()` return value cast via `as JwtResponse` discards the declared return type

**File:** `src/__tests__/integration/live-api.test.ts:32`
**Issue:** `const jwt = await client.authenticate() as JwtResponse;` — `authenticate()` is already typed as `Promise<JwtResponse>`, so the `as JwtResponse` cast is redundant. It does not cause a bug but is unnecessary noise that could mask future type drift if the return type changes.
**Fix:** Remove the redundant cast:
```typescript
const jwt = await client.authenticate();
```

---

_Reviewed: 2026-04-11_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
