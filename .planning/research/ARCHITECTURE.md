# Architecture Patterns: MCP Server Production Test Suite

**Domain:** MCP server test hardening — API path validation, integration test isolation, Swagger spec validation
**Researched:** 2026-04-09
**Overall confidence:** HIGH for test organization patterns; MEDIUM for Swagger validation approach (spec is split across 12 sub-specs, needs live discovery)

---

## Current Architecture Assessment

The existing codebase has a solid foundation with one critical gap.

**What works well:**

- `InMemoryTransport` pattern for full-stack unit tests — correct, standard, keep it
- `vi.stubGlobal("fetch", ...)` in `beforeEach` with `resetClient()` — correct isolation approach
- `capturedUrl` / `capturedBody` assertion pattern — simple and effective, keep it
- `withErrorHandling` wrapper covering known RW server-side quirks
- Domain-grouped tool files with shared `tool-helpers.ts` utilities

**The critical gap:**

The current tests manually hardcode expected API paths (e.g. `expect(capturedUrl).toContain("/api/v1/order/cancel/O1")`). This is maintainable for 20 paths but becomes unmanageable at 114+ tools across 12 Swagger sub-specs. The missing layer is a **spec-driven validation step** that catches path drift automatically without requiring humans to compare Swagger docs against test assertions.

---

## Recommended Architecture

### Component Map

```
src/
  __tests__/
    unit/                          ← existing tests, reorganized
      api-paths.test.ts            ← keep (mock fetch, assert URL/method)
      request-bodies.test.ts       ← keep (mock fetch, assert body shape)
      tool-registration.test.ts    ← keep (count, duplicates, schema shape)
      tool-helpers.test.ts         ← keep (pure function tests, no MCP infra)
      removed-tools.test.ts        ← keep (regression guard)
      error-handling.test.ts       ← ADD (auth failures, 500s, malformed JSON)

    integration/                   ← ADD: live API calls, read-only only
      auth.integration.test.ts     ← JWT acquisition, token refresh logic
      browse-smoke.integration.test.ts  ← browse 3-5 key entities, assert shape
      get-by-id.integration.test.ts     ← fetch single known records

    swagger/                       ← ADD: spec-driven validation layer
      swagger-spec.test.ts         ← parse specs, assert every tool has a matching path
      swagger-loader.ts            ← utility: fetch and cache all 12 sub-specs

scripts/
  fetch-swagger.ts                 ← one-time: download all 12 sub-specs to local JSON
  validate-paths.ts                ← standalone: diff tool paths vs spec paths
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| Unit tests (`unit/`) | Assert correct method, path, body via mocked fetch | MCP InMemoryTransport + vi.stubGlobal fetch |
| Integration tests (`integration/`) | Hit live API to confirm tools work end-to-end | RentalWorksClient directly (not through MCP protocol) |
| Swagger tests (`swagger/`) | Parse spec, assert tool-registered paths exist in spec | swagger-loader + MCP tool list |
| swagger-loader | Fetch/cache the 12 sub-spec JSONs from the live instance | Live RW API (`/swagger/v1/swagger.json?urls.primaryName=...`) |
| scripts/validate-paths | Developer CLI for one-off path audits | swagger-loader, tool source files |

---

## Data Flow Direction

### Unit test flow (no network)

```
Vitest runner
  → beforeEach: vi.stubGlobal("fetch", mock) + resetClient()
  → InMemoryTransport: client.callTool(name, args)
  → tool handler: calls client.request(method, path, body)
  → stubbed fetch: captures (url, method, body) → returns canned response
  → assertions on (capturedUrl, capturedMethod, capturedBody)
```

No network. No env vars required. Runs in CI without credentials.

### Integration test flow (live network, read-only)

```
Vitest runner (integration project)
  → beforeAll: requires RENTALWORKS_BASE_URL, _USERNAME, _PASSWORD env vars
  → calls RentalWorksClient directly (skip MCP layer)
  → RentalWorksClient.authenticate() → real JWT
  → RentalWorksClient.browse(entity) or .get(path) → real response
  → assertions: response shape matches expected schema, TotalRows is number, etc.
```

Read-only: only `.browse()` and `.get()` / `.getById()` methods. Never `.create()`, `.update()`, `.remove()`. Tests skip if env vars absent.

### Swagger validation flow

```
Vitest runner (swagger project)
  → swagger-loader: GET /swagger/v1/swagger.json for each sub-spec name
  → dereference all $ref pointers (swagger-parser)
  → build Set<string> of all { method, path } pairs across all 12 specs
  → InMemoryTransport: client.listTools() → get all 114 registered tool names
  → for each tool: call with minimal args, capture (capturedMethod, capturedUrl)
  → assert (method, normalizedPath) exists in spec Set
```

The "normalized path" step is important: RW paths contain IDs like `/api/v1/order/cancel/O1` which must be matched against spec templates like `/api/v1/order/cancel/{orderId}`. Normalize by replacing UUID/alphanumeric segments with `{param}` before comparison.

---

## Swagger Validation Architecture

### Why swagger-parser, not vitest-openapi

`vitest-openapi` validates *responses* against a spec — not useful here. The RW API is the external system; what matters is that the *requests* (method + path) the MCP tools send are valid. The right tool is `@apidevtools/swagger-parser` to parse and dereference the spec, then custom logic to assert path coverage.

**Confidence: HIGH** — swagger-parser is the standard, actively maintained, works with Swagger 2.0 and OpenAPI 3.0. RentalWorks almost certainly serves Swagger 2.0 given its ASP.NET architecture.

### Fetching the 12 sub-specs

Swagger UI's multi-spec endpoint follows the pattern:

```
GET {BASE_URL}/swagger/v1/swagger.json?urls.primaryName={spec-name}
```

Where `{spec-name}` values are discoverable by fetching the Swagger UI index:

```
GET {BASE_URL}/swagger/index.html
```

And parsing the `SwaggerUIBundle({ urls: [...] })` config embedded in the HTML. The `urls` array contains `{ name, url }` objects for each of the 12 sub-specs.

The `swagger-loader.ts` utility should:
1. Fetch the Swagger UI HTML
2. Extract the `urls` array via regex on the embedded script block
3. Fetch each spec URL
4. Pass each through `SwaggerParser.dereference()` to resolve all `$ref` pointers
5. Merge all `paths` objects into one master path set
6. Cache to `.planning/swagger-cache/` as JSON files (gitignored)

Run the loader once before the swagger tests execute, or run it as a pre-test script for the swagger project.

### Path normalization for matching

The hardest part: tool tests capture concrete paths like `/api/v1/order/cancel/O1` but the spec defines `/api/v1/order/cancel/{orderId}`. Matching strategy:

```typescript
// Replace any path segment that looks like an ID (alphanumeric, no dots)
// with a generic {param} token, then match against spec path templates
function normalizePath(concretePath: string, specPaths: string[]): string | null {
  // Try exact match first
  if (specPaths.includes(concretePath)) return concretePath;

  // Replace ID-like segments and find the best matching spec path
  for (const specPath of specPaths) {
    const specSegments = specPath.split("/");
    const concreteSegments = concretePath.split("?")[0].split("/");
    if (specSegments.length !== concreteSegments.length) continue;

    const matches = specSegments.every((seg, i) =>
      seg.startsWith("{") || seg === concreteSegments[i]
    );
    if (matches) return specPath;
  }
  return null;
}
```

This handles RW's non-REST patterns like `/api/v1/order/cancel/{id}` and `/api/v1/storefront/product/{id}/warehouseid/{wid}/locationid/{lid}/...`.

---

## Integration Test Isolation Pattern

### Why call RentalWorksClient directly (not through MCP)

Integration tests through `InMemoryTransport` add two layers of complexity without benefit: the MCP protocol layer and `withErrorHandling` masking real API errors as success responses. Calling `RentalWorksClient` directly gives cleaner error surfaces and faster feedback.

### Vitest workspace configuration

Use Vitest's `projects` array to create three independently runnable test suites:

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          root: "src",
          include: ["__tests__/unit/**/*.test.ts", "__tests__/tool-helpers.test.ts"],
          environment: "node",
        },
      },
      {
        test: {
          name: "integration",
          root: "src",
          include: ["__tests__/integration/**/*.integration.test.ts"],
          environment: "node",
        },
      },
      {
        test: {
          name: "swagger",
          root: "src",
          include: ["__tests__/swagger/**/*.test.ts"],
          environment: "node",
          // Longer timeout: swagger-loader hits network
          testTimeout: 30_000,
        },
      },
    ],
  },
});
```

CLI usage:
- `vitest --project unit` — fast, no credentials, runs in CI
- `vitest --project integration` — requires env vars, read-only, optional in CI
- `vitest --project swagger` — requires env vars + network, run on demand or in dedicated CI job

### Integration test guard pattern

```typescript
// At the top of every integration test file
const SKIP = !process.env.RENTALWORKS_BASE_URL;

describe.skipIf(SKIP)("browse smoke tests", () => {
  // ...
});
```

This makes integration tests silently pass in environments without credentials — no failures in standard CI, no accidental mutation of live data.

### Read-only constraint enforcement

Do not import or expose write methods in integration test files. Use a restricted wrapper:

```typescript
// src/__tests__/integration/read-only-client.ts
import { getClient } from "../../utils/api-client.js";

export async function browseEntity(entity: string) {
  return getClient().browse(entity);
}
export async function getEntity(path: string) {
  return getClient().get(path);
}
// No create, update, remove, post methods exported
```

This is not a technical lock but a clear architectural boundary — a grep for `getClient().create` or `getClient().post` in `integration/` files should never return results.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Shared MCP server instance across test files

**What goes wrong:** The existing `tool-registration.test.ts` and `api-paths.test.ts` each create a `McpServer` instance in `beforeAll`. If Vitest runs them in parallel (which it does by default), the global fetch stub from one test file can leak into another.

**Why it happens:** `vi.stubGlobal` mutates the global `fetch` — it's process-wide, not file-scoped.

**Instead:** Each test file that stubs `fetch` must call `vi.unstubAllGlobals()` in `afterAll` (already done in api-paths and request-bodies, but verify all files do this). Use `beforeEach`/`afterEach` rather than `beforeAll`/`afterAll` for fetch stubs when possible.

### Anti-Pattern 2: Hardcoded expected-path strings as the only validation

**What goes wrong:** A developer fixes a path in the tool file but forgets to update the test assertion. Both test and implementation are wrong in sync. The Swagger spec is the only ground truth.

**Instead:** The swagger validation layer catches drift automatically. Unit test assertions on specific paths remain as regression guards but are no longer the *only* safety net.

### Anti-Pattern 3: Integration tests that assert exact data values

**What goes wrong:** `expect(result.Rows[0].ICode).toBe("LAMP001")` fails the moment any data changes on the live instance.

**Instead:** Assert shape and type only:
```typescript
expect(result.TotalRows).toBeTypeOf("number");
expect(result.Rows).toBeInstanceOf(Array);
expect(result.Rows.length).toBeGreaterThanOrEqual(0);
```

### Anti-Pattern 4: Fetching Swagger spec inside every test run

**What goes wrong:** 12 network calls per test run adds 5-15 seconds. Flaky network = flaky tests.

**Instead:** Cache spec JSON files to `.planning/swagger-cache/`. Run the fetch script manually or in a dedicated CI step. Swagger test suite reads from cache, not live network.

---

## Build Order Implications

The three test layers have explicit dependencies that dictate build order:

```
Phase 1: Reorganize existing unit tests
  - Move existing 5 test files into src/__tests__/unit/
  - Update vitest.config.ts to use projects array
  - Verify: vitest --project unit still passes

Phase 2: Add missing unit test coverage
  - error-handling.test.ts (auth failures, 500 wrapping, NullReference detection)
  - Remaining tool paths not yet covered in api-paths.test.ts
  - Depends on: Phase 1 (organization in place)

Phase 3: Build Swagger validation layer
  - scripts/fetch-swagger.ts (download and cache all 12 sub-specs)
  - src/__tests__/swagger/swagger-loader.ts
  - src/__tests__/swagger/swagger-spec.test.ts
  - Depends on: Phase 1 (listTools() wiring understood), live RW instance accessible
  - Note: path normalization logic is the hardest part; budget extra time

Phase 4: Build integration test suite
  - src/__tests__/integration/read-only-client.ts
  - auth.integration.test.ts
  - browse-smoke.integration.test.ts
  - Depends on: nothing from Phases 2-3, but pairs well with Phase 3 findings
    (Swagger validation identifies which endpoints to smoke-test)

Phase 5: Bug fixes from validation findings
  - Run swagger-spec.test.ts, collect all path mismatches
  - Fix tool files, re-run, iterate
  - Depends on: Phase 3 complete
```

Phases 3 and 4 can run in parallel. Phase 5 depends on Phase 3.

---

## Technology Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Spec parsing | `@apidevtools/swagger-parser` | Standard, actively maintained, handles Swagger 2.0 + OpenAPI 3.0, TypeScript-typed, dereferences $ref automatically |
| Test separation | Vitest `projects` array | First-class support in Vitest, allows `vitest --project unit` without touching integration/swagger |
| Integration client | `RentalWorksClient` directly | Avoids MCP protocol overhead, gives clean error surfaces, easier to assert raw API shapes |
| Spec caching | Local JSON files in `.planning/swagger-cache/` | Decouples test speed from network reliability; cache is gitignored |
| Read-only enforcement | Wrapper module with restricted exports | Clear architectural boundary, grep-checkable |

---

## Scalability Considerations

| Concern | Now (114 tools) | At 200 tools | At 500 tools |
|---------|----------------|-------------|-------------|
| Unit test run time | ~5s | ~10s | ~25s |
| Swagger validation | ~10s (with cache) | ~12s | ~20s |
| Integration smoke tests | ~30s (5 entities) | ~60s (10 entities) | Run subset only |
| Swagger cache freshness | Re-fetch on RW updates | Same | Same |

The architecture remains valid through significant tool count growth. The main concern at scale is integration test time — keep smoke tests to 5-10 key entities and assert shape only, not data.

---

## Sources

- [vitest-dev/vitest Discussion #4675: How to separate unit and integration tests](https://github.com/vitest-dev/vitest/discussions/4675) — MEDIUM confidence (community discussion, not official docs)
- [vitest-dev/vitest Discussion #5557: Splitting tests based on file suffix](https://github.com/vitest-dev/vitest/discussions/5557) — MEDIUM confidence
- [APIDevTools/swagger-parser GitHub](https://github.com/APIDevTools/swagger-parser) — HIGH confidence (official repo)
- [swagger-parser npm](https://www.npmjs.com/package/swagger-parser) — HIGH confidence
- [MCPcat: Unit Testing MCP Servers](https://mcpcat.io/guides/writing-unit-tests-mcp-servers/) — MEDIUM confidence (third-party guide)
- [MCPcat: MCP Integration Testing](https://mcpcat.io/guides/integration-tests-mcp-flows/) — MEDIUM confidence
- [yutak23/vitest-openapi GitHub](https://github.com/yutak23/vitest-openapi) — HIGH confidence (response validation only, not applicable here)
- [openapi-ts testing docs](https://openapi-ts.dev/openapi-fetch/testing) — MEDIUM confidence (different use case but pattern informative)
