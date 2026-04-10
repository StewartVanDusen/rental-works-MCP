# Testing Patterns

**Analysis Date:** 2026-04-09

## Test Framework

**Runner:**
- Vitest 3.1.0
- Config: `vitest.config.ts`
- Environment: node

**Assertion Library:**
- Vitest built-in expect API (from Chai)

**Run Commands:**
```bash
npm test              # Run all tests via "vitest run"
npm run dev          # Watch mode with tsx (not test watch)
npm run build        # Compile TypeScript (creates dist/ for tests to load)
```

## Test File Organization

**Location:**
- Co-located in `src/__tests__/` directory
- All test files in single directory rather than scattered alongside source

**Naming:**
- Pattern: `{feature}.test.ts`
- Examples: `api-paths.test.ts`, `tool-helpers.test.ts`, `request-bodies.test.ts`

**Structure:**
```
src/__tests__/
├── api-paths.test.ts          # HTTP method and path validation tests
├── tool-helpers.test.ts       # Utility function tests
├── tool-registration.test.ts  # Tool count and schema validation tests
├── request-bodies.test.ts     # Request body payload validation tests
└── removed-tools.test.ts      # (exists, not examined)
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";

describe("feature or unit", () => {
  // Setup
  beforeAll(async () => {
    // One-time setup: initialize server, client, register tools
  });

  beforeEach(() => {
    // Reset state before each test: reset client, reset mocks
  });

  afterAll(() => {
    // Cleanup: unstub globals
  });

  // Test cases
  it("describes what it tests", () => {
    // Arrange
    // Act
    // Assert
  });
});
```

**Patterns:**
- Setup pattern: `beforeAll()` initializes MCP server with tool registration, creates in-memory transport, connects client
- Teardown pattern: `afterAll()` calls `vi.unstubAllGlobals()` to clean up mocked fetch
- Reset pattern: `beforeEach()` resets client instance and clears captured request state
- Mock pattern: `vi.stubGlobal("fetch", vi.fn(async (url, init?) => { ... }))`

## Mocking

**Framework:** Vitest `vi` (alias for vitest mocking utilities)

**Patterns:**
```typescript
// Mock global fetch
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL, init?: RequestInit) => {
      const urlStr = url.toString();
      
      // Intercept JWT endpoint
      if (urlStr.endsWith("/api/v1/jwt")) {
        return new Response(JWT_RESPONSE, { status: 200 });
      }
      
      // Capture request for assertion
      capturedUrl = urlStr;
      capturedMethod = init?.method || "GET";
      if (init?.body) {
        capturedBody = JSON.parse(init.body as string);
      }
      
      // Return mock response
      return new Response(ENTITY_RESPONSE, { status: 200 });
    })
  );
});

afterAll(() => {
  vi.unstubAllGlobals();
});
```

**What to Mock:**
- Global `fetch` function (all HTTP calls go through this)
- API responses (JWT auth, browse results, entity responses)
- Environment variables (set in `beforeAll()`)

**What NOT to Mock:**
- MCP SDK internals (use real InMemoryTransport)
- Tool handlers (test them real via MCP Client)
- Zod schema validation (test it real)

## Fixtures and Factories

**Test Data:**
```typescript
const JWT_RESPONSE = JSON.stringify({
  statuscode: 200,
  statusmessage: "OK",
  access_token: "test-token",
  webusersid: "u1",
  usersid: "u2",
  fullname: "Test",
});

const BROWSE_RESPONSE = JSON.stringify({
  TotalRows: 0,
  PageNo: 1,
  PageSize: 25,
  TotalPages: 0,
  Rows: [],
});

const ENTITY_RESPONSE = JSON.stringify({ Id: "123" });

// Used in mock fetch to return appropriate responses
return new Response(
  urlStr.includes("/browse") ? BROWSE_RESPONSE : ENTITY_RESPONSE,
  { status: 200 }
);
```

**Location:**
- Defined as module-level constants in test files
- Not extracted to separate fixtures/ directory
- Inline in the test file where they're used

## Coverage

**Requirements:** Not enforced (no coverage config in vitest.config.ts)

**View Coverage:**
- Not configured; would require `--coverage` flag and coverage provider

## Test Types

**Unit Tests:**
- Scope: Utility functions and helpers (e.g., `buildBrowseRequest`, `formatBrowseResult`, `formatEntity`)
- Approach: Direct function calls with test inputs, assertions on return values
- File: `src/__tests__/tool-helpers.test.ts`
- Example:
```typescript
it("returns defaults with no args", () => {
  const req = buildBrowseRequest({});
  expect(req).toEqual({
    pageno: 1,
    pagesize: 25,
    orderby: "",
    orderbydirection: "asc",
  });
});
```

**Integration Tests:**
- Scope: MCP tool handlers, HTTP paths, request/response mapping
- Approach: Create real MCP server with tool registrations, connect via in-memory transport, call tools, verify captured HTTP requests
- Files: `src/__tests__/api-paths.test.ts`, `src/__tests__/request-bodies.test.ts`, `src/__tests__/tool-registration.test.ts`
- Example:
```typescript
async function callTool(name: string, args: Record<string, unknown> = {}) {
  return client.callTool({ name, arguments: args });
}

it("cancel_order → POST .../order/cancel/...", async () => {
  await callTool("cancel_order", { orderId: "O1" });
  expect(capturedMethod).toBe("POST");
  expect(capturedUrl).toContain("/api/v1/order/cancel/O1");
});
```

**E2E Tests:**
- Framework: Not used
- RentalWorks API requires live credentials (not suitable for automated E2E in CI)

## Common Patterns

**Async Testing:**
```typescript
it("async test", async () => {
  const result = await client.callTool({ name: "tool_name", arguments: {} });
  expect(result).toBeDefined();
});
```

**Error Testing:**
- No explicit error test cases found
- Error handling tested implicitly through request validation tests
- `withErrorHandling` wrapper tested via successful tool execution (error paths not explicitly exercised)

**Parametrized Testing:**
```typescript
it.each([
  "browse_rental_inventory",
  "get_order",
  "browse_customers",
  // ... more tool names
])("registers key tool: %s", (name) => {
  expect(tools.find((t) => t.name === name)).toBeDefined();
});
```

## Test Execution Flow

**Tool Path Testing (api-paths.test.ts):**
1. Setup: Register tools, create server/client pair, mock fetch
2. Reset before each: Reset client instance to force re-auth on each test
3. Call tool with parameters
4. Assert: Check HTTP method and URL path (including query strings, path params)
5. Confirm path matches expected RentalWorks API endpoint pattern

**Request Body Testing (request-bodies.test.ts):**
1. Setup: Similar to path testing
2. Call tool with specific parameter values
3. Capture the request body that was sent in the fetch call
4. Assert: Verify body contains correct keys and values with proper case (e.g., `{ OrderId: "O1" }` not `{ orderId: "O1" }`)

**Tool Registration Testing (tool-registration.test.ts):**
1. List all registered tools via `client.listTools()`
2. Count tools: expect exactly 114
3. Verify no duplicates by checking Set size equals array length
4. Verify every tool has non-empty description
5. Verify every tool has proper inputSchema shape

---

*Testing analysis: 2026-04-09*
