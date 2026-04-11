---
phase: 06-expansion
reviewed: 2026-04-09T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - src/__tests__/integration/live-api.test.ts
  - src/__tests__/unit/address-tools.test.ts
  - src/__tests__/unit/swagger-spec.test.ts
  - src/__tests__/unit/tool-registration.test.ts
  - src/index.ts
  - src/tools/addresses.ts
  - src/tools/utilities.ts
findings:
  critical: 0
  warning: 4
  info: 5
  total: 9
status: issues_found
---

# Phase 06: Code Review Report

**Reviewed:** 2026-04-09
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

This phase added `addresses.ts` (5 CRUD tools), expanded `utilities.ts` (change order status, QBO sync), and added corresponding unit tests (address-tools, swagger-spec entries) plus live integration tests for the address entity.

The source tool implementations are clean. The main issues are in the test suite: `tool-registration.test.ts` is missing `registerAddressTools` entirely (the new domain is invisible to that test), and both test files carry stale tool-count assertions that diverge from each other and from the actual registered set. Multiple `describe` block comments also misstate the number of `it()` tests they contain. One `raw_api_post` path in `utilities.ts` lacks error handling for malformed JSON input.

---

## Warnings

### WR-01: `tool-registration.test.ts` — `registerAddressTools` not imported or called

**File:** `src/__tests__/unit/tool-registration.test.ts:1-41`
**Issue:** The new `addresses.ts` domain (`registerAddressTools`) is never imported or called inside `tool-registration.test.ts`. As a result the "registers the expected number of tools" assertion uses `toBe(115)` instead of the full count, and no address tools are exercised by this test suite. The swagger-spec test correctly registers all 12 domains and expects 120 tools — the two test files are inconsistent with each other and with production `src/index.ts`.
**Fix:** Add the missing import and registration call, then update the count assertion to match the true registered total.

```typescript
// Add to imports block
import { registerAddressTools } from "../../tools/addresses.js";

// Add inside beforeAll, after registerUtilityTools(server)
registerAddressTools(server);

// Update count assertion
expect(tools.length).toBe(120); // or whatever the verified total is
```

---

### WR-02: `swagger-spec.test.ts` — stale/incorrect tool count assertion

**File:** `src/__tests__/unit/swagger-spec.test.ts:150`
**Issue:** The top-level "covers all registered tools" test asserts `tools.length === 120`, but the sub-describe blocks add up to more than 120 individual `it()` tests (13 inventory, 15 orders, 14 contracts, 13 customers, 13 billing, 9 vendors, 14 settings, 6 reports, 5 admin, 3 storefront, 10 utilities, 5 addresses = 120 tests). While the final count may currently pass, all per-section comments are wrong (e.g., "orders (12 tools)" has 15 tests, "contracts (12 tools)" has 14 tests), creating a misleading document. If the assertion passes today it is coincidental; if new tools are added without updating the count it will silently mask gaps.
**Fix:** Verify the true registered count with `npm test` and update both the assertion value and every describe-block label to match reality. The comments "X tools" should equal the number of `it()` blocks they contain.

---

### WR-03: `raw_api_post` — unguarded `JSON.parse` will throw on malformed input

**File:** `src/tools/utilities.ts:135`
**Issue:** `const parsedBody = body ? JSON.parse(body) : {}` has no try/catch. If an MCP caller passes a non-empty `body` string that is not valid JSON (e.g. `"{"key":}`), `JSON.parse` throws a `SyntaxError` and the tool crashes with an unhandled exception rather than returning a user-friendly error. All other error paths in the codebase are expected to return `{ content: [...], isError: true }`.
**Fix:**
```typescript
let parsedBody: unknown = {};
if (body) {
  try {
    parsedBody = JSON.parse(body);
  } catch {
    return {
      content: [{ type: "text", text: `Invalid JSON body: ${body}` }],
      isError: true,
    };
  }
}
const data = await client.post(path, parsedBody);
```

---

### WR-04: `addresses.ts` — all handlers missing error handling wrapper

**File:** `src/tools/addresses.ts:17-106`
**Issue:** None of the five address tool handlers use `withErrorHandling()` (defined in `tool-helpers.ts` and described in CLAUDE.md as the project-standard pattern for catching known RentalWorks API errors). Raw exceptions from `client.get/post/put/delete` will propagate as unhandled promise rejections rather than returning `{ isError: true }` responses. The same omission applies to `utilities.ts` but the new `addresses.ts` handlers are the freshest additions and the highest-risk because they include mutating operations (create, update, delete).
**Fix:** Wrap each handler body in `withErrorHandling`:
```typescript
import { withErrorHandling } from "../utils/tool-helpers.js";

// Example: get_address handler
async ({ addressId }) =>
  withErrorHandling(async () => {
    const client = getClient();
    const data = await client.get(`/api/v1/address/${addressId}`);
    return { content: [{ type: "text", text: formatEntity(data as any) }] };
  })
```

---

## Info

### IN-01: `src/index.ts` — JSDoc comment says "80+ tools across 8 domains" but server now has 12 domains

**File:** `src/index.ts:7`
**Issue:** The module header says "Provides 80+ tools across 8 domains" but the production server now registers 12 domains and approximately 120 tools.
**Fix:** Update the comment to "Provides 120+ tools across 12 domains" (or whatever the verified total is).

---

### IN-02: `swagger-spec.test.ts` — describe block labels misstate test counts

**File:** `src/__tests__/unit/swagger-spec.test.ts:155,224,303,377,446,513,562,638,670,699,724,779`
**Issue:** Multiple `describe("X (N tools)", ...)` labels are inconsistent with the number of `it()` blocks inside them. Examples: "inventory (12 tools)" contains 13 tests; "orders (12 tools)" contains 15 tests; "contracts (12 tools)" contains 14 tests; "customers (11 tools)" contains 13 tests; "billing (11 tools)" contains 13 tests; "vendors (7 tools)" contains 9 tests; "settings (13 tools)" contains 14 tests; "reports (7 tools)" contains 6 tests; "utilities (9 tools)" contains 10 tests.
**Fix:** Update each describe label to match the actual `it()` count inside it.

---

### IN-03: `address-tools.test.ts` — `capturedBody` typed as `any`

**File:** `src/__tests__/unit/address-tools.test.ts:13`
**Issue:** `let capturedBody: any;` uses the `any` type, which bypasses TypeScript's strict checks on test assertions. The project uses strict mode throughout.
**Fix:** Type it as `Record<string, unknown> | null` to stay consistent with how the rest of the file uses the variable.

---

### IN-04: `live-api.test.ts` — `beforeAll` timeout is generous but `authenticate()` is called twice

**File:** `src/__tests__/integration/live-api.test.ts:20-35`
**Issue:** `beforeAll` calls `client.authenticate()` to warm the token, and then the "acquires a valid JWT token" test in `Authentication (INTG-02)` calls `client.authenticate()` again. Depending on the API client's token caching behaviour, the second call may either re-use the cached token (making the test a no-op) or issue a second network round-trip. Neither is wrong, but it is worth noting that the test is not guaranteeing a fresh token acquisition — it may be testing the cached path.
**Fix:** If the intent is to verify a fresh token acquisition, call `resetClient()` inside the authentication test before calling `authenticate()`. If testing the cached path is acceptable, add a comment to document the intent.

---

### IN-05: `utilities.ts` — `raw_api_browse` spreads `browseSchema` fields without encapsulation

**File:** `src/tools/utilities.ts:103`
**Issue:** `{ entity: z.string()..., ...browseSchema }` spreads the shared browse schema directly into the inline object. This is the project pattern for other tools that only use `browseSchema`, but for `raw_api_browse` it creates a subtle ambiguity: the `entity` field name could conflict with any future `browseSchema` field named `entity`. Currently safe, but fragile.
**Fix:** No immediate change required. Document the dependency or restructure as `z.object({ entity: ..., ...browseSchema })` if Zod supports that form in the SDK version in use.

---

_Reviewed: 2026-04-09_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
