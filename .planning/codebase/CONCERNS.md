# Codebase Concerns

**Analysis Date:** 2026-04-09

## Tech Debt

**Type Safety with `as any` Casts:**
- Issue: Widespread use of `as any` type coercion throughout tool implementations, bypassing TypeScript's type checking system
- Files: `src/tools/admin.ts`, `src/tools/billing.ts`, `src/tools/contracts.ts`, `src/tools/customers.ts`, `src/tools/inventory.ts`, `src/tools/orders.ts`, `src/tools/vendors.ts`
- Impact: Type errors can occur at runtime with no compile-time detection. Makes refactoring and API changes risky. Reduces IDE assistance and autocomplete reliability.
- Fix approach: Replace `as any` casts with proper type definitions. Create concrete TypeScript interfaces for API response shapes based on RentalWorks API documentation. Use `@ts-expect-error` with comments only when truly unavoidable.

**Incomplete Error Handling Wrapper Coverage:**
- Issue: `withErrorHandling()` helper is used inconsistently across tool domains. Only 13 of 114 tools use it.
- Files: `src/tools/admin.ts` (3), `src/tools/billing.ts` (2), `src/tools/inventory.ts` (2), `src/tools/orders.ts` (3), `src/tools/reports.ts` (0), `src/tools/storefront.ts` (3), `src/tools/utilities.ts` (0), `src/tools/contracts.ts` (0), `src/tools/customers.ts` (0), `src/tools/vendors.ts` (0), `src/tools/settings.ts` (0)
- Impact: 101 tools lack RentalWorks server-side error detection. When a 503 error occurs or column validation fails, users get raw error text instead of helpful context.
- Fix approach: Apply `withErrorHandling()` wrapper to all tools. Priority: first-pass wrapping, then evaluate which error patterns actually occur.

**Empty BASE_URL Default:**
- Issue: `src/utils/api-client.ts` line 13-15 sets `BASE_URL` to empty string if env var is missing
- Files: `src/utils/api-client.ts`
- Impact: If `RENTALWORKS_BASE_URL` is not set, all API requests will use empty string as base, resulting in malformed URLs (e.g., `/api/v1/order/123` instead of `https://instance.rentalworks.cloud/api/v1/order/123`). Silent failure — requests will fail with cryptic network errors.
- Fix approach: Validate BASE_URL on client initialization. Either throw an error with clear message at startup or log a fatal warning. Add runtime validation in the `RentalWorksClient` constructor.

**Missing Input Validation:**
- Issue: Tool parameters are defined with Zod schemas but API request bodies are not validated before sending
- Files: All tool files (`src/tools/*.ts`), particularly those building custom request bodies
- Impact: Malformed or invalid data can be sent to the API, resulting in server errors. No client-side prevention.
- Fix approach: Add request body validation using Zod schemas before calling `client.post()` or `client.put()`. Create validation schemas for common request patterns.

## Known Bugs

**Large Response Truncation Approach Has Edge Cases:**
- Symptoms: `get_order_details` tool can return very large responses (500K+ chars) even when requesting specific sections. The truncation logic based on `maxItems` parameter may not fully prevent oversized responses.
- Files: `src/tools/orders.ts` (lines 69-130)
- Trigger: Call `get_order_details` with large order IDs that have many line items and request multiple sections
- Workaround: Always specify sections and use maxItems parameter; avoid requesting all sections at once

**Hardcoded Token Expiry Calculation:**
- Symptoms: Token refresh assumes 4-hour expiry and refreshes after 3.5 hours regardless of actual token lifetime
- Files: `src/utils/api-client.ts` (line 56)
- Trigger: RentalWorks instance with different token lifetime (e.g., 1 hour or 8 hours) will cause premature refresh or token expiration mid-request
- Workaround: Extract actual token expiry from JWT payload instead of hardcoding 3.5 hours

## Security Considerations

**Credentials Stored in Environment Variables (Current Mitigation):**
- Risk: `RENTALWORKS_USERNAME` and `RENTALWORKS_PASSWORD` are read from environment at startup. If environment is logged or exposed, credentials are compromised.
- Files: `src/utils/api-client.ts` (lines 24-25)
- Current mitigation: `.env` file is in `.gitignore`, environment variables are not logged
- Recommendations: 
  - Add startup warning if credentials are empty (currently logs console.error at lines 28-31, good)
  - Consider supporting API key authentication as alternative to username/password
  - Add audit logging for authentication attempts

**No Rate Limiting or Request Throttling:**
- Risk: Client can make unlimited rapid requests to RentalWorks API, potentially triggering rate limits or DDoS protections
- Files: `src/utils/api-client.ts` (request methods have no delay)
- Current mitigation: None
- Recommendations: Add exponential backoff on 429/503 responses; add configurable request rate limiting; log rate limit headers

**Bearer Token Exposed in Error Messages:**
- Risk: If API request fails, error message includes full error response which might contain Bearer token info
- Files: `src/utils/api-client.ts` (line 94)
- Current mitigation: Error is truncated in message
- Recommendations: Sanitize error responses before returning to users; redact auth headers from error logs

## Performance Bottlenecks

**JSON Parsing and Serialization for Every Request:**
- Problem: Every API response is JSON-parsed, and every request body is JSON-stringified even for simple operations
- Files: `src/utils/api-client.ts` (lines 89, 99-100)
- Cause: No streaming or response streaming for large results; all data loaded into memory
- Improvement path: For large browse results, implement streaming JSON parsing if backend supports chunked responses; add compression support

**Format Functions Iterate Over Large Objects:**
- Problem: `formatBrowseResult()` and `formatEntity()` iterate through all object properties and concatenate strings
- Files: `src/utils/tool-helpers.ts` (lines 97-121, 186-194)
- Cause: No caching or memoization; repeated calls with same data re-parse entire object
- Improvement path: Add object key caching; consider stream-based formatting for large datasets

**Token Refresh on Every Request:**
- Problem: `ensureAuth()` checks token expiry on every single request (114 tools × unknown request volume)
- Files: `src/utils/api-client.ts` (lines 63-68)
- Cause: Date.now() comparison runs before every fetch, minor overhead but cumulative
- Improvement path: Cache last auth check time to avoid millisecond-level checks; only validate when within 5 minutes of expiry

## Fragile Areas

**Browse Tool Schema and Request Mapping:**
- Files: `src/utils/tool-helpers.ts` (buildBrowseRequest), All 11 tool files using browseSchema
- Why fragile: Tool parameter names (e.g., `pageSize`) must map exactly to RentalWorks API request fields (e.g., `pagesize`). Field name mismatches cause silent failures where parameters are ignored. The schema is reused across 11 domains but API variations are handled with `as any` casts.
- Safe modification: Document exact API request format for each domain; add runtime validation that all parameters were applied to request; test edge cases like null/undefined searchField without searchValue
- Test coverage: `src/__tests__/api-paths.test.ts` validates 20 path patterns but doesn't validate request body field mapping

**Order Details Section Mapping:**
- Files: `src/tools/orders.ts` (lines 87-130)
- Why fragile: Hardcoded section-to-field mapping (line 87-95) must match actual RentalWorks response shape. New fields added to API response won't be discoverable. Case-insensitive string matching (line 125) could have false positives.
- Safe modification: Extract section mappings to a data structure with validation; add schema validation for actual response before mapping; test with real order responses containing various section combinations
- Test coverage: Request/response test at `src/__tests__/request-bodies.test.ts` is minimal (102 lines)

**Tool Registration Pattern:**
- Files: `src/index.ts` (registerXyzTools imported and called 11 times)
- Why fragile: If a registration function throws or is forgotten, the entire server starts but with incomplete capabilities. No detection at startup.
- Safe modification: Add startup validation that expected tool count matches registered tools; log registered tools on startup; add test for tool count
- Test coverage: `src/__tests__/tool-registration.test.ts` validates registration but only for sampled domains

## Scaling Limits

**Single Singleton Client Instance:**
- Current capacity: One RentalWorksClient instance per server process, shared across all concurrent tool calls
- Limit: If 100 concurrent requests come in, the single token will be refreshed multiple times (race condition possible). Token refresh is not atomic.
- Scaling path: Consider instance pooling if horizontal scaling needed; add request queuing to prevent token refresh contention; use async locks for token refresh

**In-Memory Pagination:**
- Current capacity: Browse results default to 25 items per page, max pageSize 500. Single request returns entire page in memory.
- Limit: For entities with millions of rows, 500 items per page still requires 2000+ API calls to retrieve all. No cursor support.
- Scaling path: Check if RentalWorks API supports cursor pagination; implement request caching layer; add streaming results for CLI-like tools

## Dependencies at Risk

**@modelcontextprotocol/sdk Version Pinned to ^1.12.1:**
- Risk: Will accept breaking changes in minor versions (>1.12.1 but <2.0.0). No security patch locking.
- Impact: Automatic updates could break tool registration or transport protocol
- Migration plan: Use exact version pinning (1.12.1) or ~1.12 for patch-only updates; add test for SDK compatibility

**Zod Validation Library (Implicit Risk):**
- Risk: Multiple tools use Zod for schema definition but rely on `as any` to bypass validation. Zod becomes dead code.
- Impact: Removing or updating Zod would have no effect on runtime; validation never runs
- Migration plan: Either use Zod validation results in handlers or remove it; don't validate schema if not enforcing

## Missing Critical Features

**No Request/Response Logging for Debugging:**
- Problem: When tools fail silently or return unexpected data, there's no trace of what was sent to API or received. Makes debugging customer issues difficult.
- Blocks: Troubleshooting customer-reported tool failures; auditing API usage

**No Tool Documentation Generation:**
- Problem: 114 tools are hand-written; descriptions are inconsistent and sometimes inaccurate. No way to generate docs automatically from code.
- Blocks: Keeping documentation synchronized with tool changes

**No Retry Logic for Transient Failures:**
- Problem: Single network error or temporary API outage causes immediate failure. No exponential backoff.
- Blocks: Robust error handling for production deployment

## Test Coverage Gaps

**Real API Integration Tests Missing:**
- What's not tested: Actual API calls to RentalWorks instance. All tests mock fetch. No validation that tools work against real API.
- Files: `src/__tests__/*.test.ts` (all use mocked fetch)
- Risk: API paths tested work in isolation but may fail in production (e.g., response schema changes, new required fields)
- Priority: High — recommend integration test suite with optional real instance testing

**Error Handling Edge Cases:**
- What's not tested: How tools handle partial failures (e.g., browse returns empty, nested object is null, array truncation edge cases)
- Files: All tool handlers
- Risk: Unhandled edge cases in formatting or processing could cause crashes
- Priority: High — add tests for empty responses, null fields, oversized arrays

**Authentication Failure Scenarios:**
- What's not tested: Invalid credentials, expired token during request, authentication endpoint down
- Files: `src/utils/api-client.ts`
- Risk: Auth failures don't have graceful fallback; users see raw error messages
- Priority: Medium — add tests for 401, 403, timeout during JWT fetch

**Browse Field Validation:**
- What's not tested: Behavior when searchField/searchValue mismatched (only field or only value), unknown operators, out-of-range page numbers
- Files: `src/utils/tool-helpers.ts`, `src/__tests__/request-bodies.test.ts`
- Risk: Invalid combinations silently create invalid API requests that succeed but return no results
- Priority: Medium — add input validation tests

---

*Concerns audit: 2026-04-09*
