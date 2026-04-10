# Technology Stack

**Project:** RentalWorks MCP Server — Production Readiness
**Researched:** 2026-04-09
**Scope:** Testing and validation stack for a TypeScript MCP server wrapping a REST API

---

## Current State (Baseline)

What the project already has — these are not recommendations, they are facts:

| Technology | Version in package.json | Role |
|------------|------------------------|------|
| `@modelcontextprotocol/sdk` | `^1.12.1` (latest: 1.29.0) | MCP server/client, InMemoryTransport |
| `vitest` | `^3.1.0` (latest: 4.1.3) | Test runner |
| `typescript` | `^5.7.0` | Language |
| `tsx` | `^4.19.0` | Dev runner |
| `@types/node` | `^22.0.0` | Node typings |
| `zod` | NOT installed (listed as Active requirement in PROJECT.md) | Schema validation |

The existing test suite already uses the correct in-memory MCP testing pattern: `InMemoryTransport.createLinkedPair()` + `Client` + `vi.stubGlobal("fetch", vi.fn(...))`. This is the right approach and requires no library additions.

---

## Recommended Stack Additions

### 1. Zod (schema validation — REQUIRED)

| Decision | Value |
|----------|-------|
| Package | `zod` |
| Version | `^3.25.0` (NOT 4.x — see rationale) |
| Install as | `dependency` |
| Confidence | HIGH |

**Why:** The MCP SDK uses Zod internally for tool input schemas. The PROJECT.md already flags the missing `zod` dependency as an active requirement. The MCP SDK v1.12–v1.29 uses Zod 3.x internally; as of SDK v1.23+ there is beta backwards-compat support for Zod v3.25+ and v4, but the stable path is `^3.25.0`.

**Why NOT Zod 4:** Zod 4.0 was released in mid-2025 and has breaking changes in error APIs and object defaults behavior. MCP SDK issue #925 explicitly documented incompatibility. The SDK shipped `v1.23.0-beta.0` with backwards-compat support but this remains in beta. Pin to `^3.25.0` until MCP SDK stable releases confirm v4 support. Zod 3.25 is the last 3.x minor and adds forward-compat with v4 import paths.

```bash
npm install zod@^3.25.0
```

---

### 2. @scalar/openapi-parser (Swagger spec parsing — REQUIRED for validation milestone)

| Decision | Value |
|----------|-------|
| Package | `@scalar/openapi-parser` |
| Version | `^0.25.6` (actively maintained, latest ~10 days ago as of April 2026) |
| Install as | `devDependency` |
| Confidence | MEDIUM |

**Why:** The core validation requirement is "all ~114 existing tool API paths validated against Swagger spec." This means loading the live Swagger JSON from `https://modernlighting.rentalworks.cloud/swagger/index.html` (12 sub-specs), dereferencing them, and extracting path+method pairs to diff against what each MCP tool calls.

`@scalar/openapi-parser` is the actively maintained modern TypeScript-native option. The older `@apidevtools/swagger-parser` (v10.0.3) was last published 5 years ago and is effectively unmaintained. The `@scalar/openapi-parser` repo was archived and migrated into the Scalar monorepo but the npm package continues publishing at high cadence.

**Why NOT `@apidevtools/swagger-parser`:** Last published 5 years ago. The separate GitHub repo is archived. Although 9.x is reported as a newer version in some registries, this is a fork situation — the canonical package is unmaintained. Do not use.

**Why NOT `@readme/openapi-parser`:** A fork of apidevtools with improved error messages. Active, but Scalar's parser has better TypeScript-first design and supports the newer OpenAPI 3.1 spec that RentalWorks may use in sub-specs.

**Usage pattern for this project:**
```typescript
import { dereference, load } from "@scalar/openapi-parser";
import { fetchUrls } from "@scalar/openapi-parser/plugins/fetch-urls";

// Load a remote Swagger sub-spec
const { filesystem } = await load(
  "https://modernlighting.rentalworks.cloud/swagger/v1/swagger.json",
  { plugins: [fetchUrls()] }
);
const { schema } = await dereference(filesystem);

// Extract all paths + methods
const paths = Object.entries(schema.paths ?? {}).flatMap(([path, pathItem]) =>
  Object.keys(pathItem ?? {})
    .filter(m => ["get","post","put","delete","patch"].includes(m))
    .map(method => ({ method: method.toUpperCase(), path }))
);
```

```bash
npm install -D @scalar/openapi-parser
```

---

### 3. Vitest version — HOLD at 3.x, do not upgrade to 4.x yet

| Decision | Value |
|----------|-------|
| Current | `^3.1.0` |
| Latest | `4.1.3` |
| Recommendation | Stay on `^3.1.0` for now |
| Confidence | HIGH |

**Why hold:** Vitest 4.0 requires Node.js >= 20 and Vite >= 6. It changes mock constructor behavior (arrow function mocks now throw), changes `getMockName()` defaults, and changes V8 coverage remapping. The existing test suite uses `vi.fn(async ...)` with arrow functions for the fetch stub — this pattern breaks in Vitest 4 for mocks called with `new` (not relevant here), but the broader risk of coverage and snapshot diff noise during a validation-focused milestone is not worth it.

**When to upgrade:** After the validation milestone is complete and the test suite is stable. Upgrading Vitest is a separate, low-risk task that can be done cleanly.

**What to add now within 3.x:** A `vitest.config.ts` file is not present in the project. Add one to make coverage and environment explicit:

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts"],
      exclude: ["src/__tests__/**"],
    },
  },
});
```

```bash
npm install -D @vitest/coverage-v8
```

---

### 4. MCP SDK — upgrade to latest stable

| Decision | Value |
|----------|-------|
| Current | `^1.12.1` |
| Latest | `1.29.0` |
| Recommendation | Upgrade to `^1.29.0` |
| Confidence | MEDIUM |

**Why:** The SDK has been moving fast. v1.23+ added Zod v3.25/v4 backwards-compat. v1.29 is current. The in-memory testing pattern (`InMemoryTransport`) is stable across all 1.x versions — the existing tests will not break. The upgrade is low-risk and keeps security patches and protocol compliance current.

**Risk:** Verify `InMemoryTransport` import path hasn't moved. It was at `@modelcontextprotocol/sdk/inMemory.js` as of 1.12 — this is confirmed still correct in the existing test files.

```bash
npm install @modelcontextprotocol/sdk@^1.29.0
```

---

## What NOT to Add

### MSW (Mock Service Worker)

**Do not add.** The project's testing pattern — `vi.stubGlobal("fetch", vi.fn(...))` in `beforeEach` with `vi.unstubAllGlobals()` in `afterAll` — is already working correctly and is idiomatic for a Node.js-only server with no browser involvement. MSW adds ~50KB of setup, a `setupServer` lifecycle, and handler definitions for no real benefit over the existing pattern. The existing approach is simpler, faster, and already proven.

### openapi-typescript / openapi-fetch

**Do not add.** These tools generate TypeScript types from OpenAPI specs for use in production code. This project is building an MCP server over a third-party API — it does not own the API contract and does not need type-safe client generation. The validation goal is to diff paths/methods between Swagger spec and tool implementations, which `@scalar/openapi-parser` handles directly. Adding a codegen step would create a maintenance burden (regenerating on spec changes) with no testing benefit.

### swagger-typescript-api

**Do not add.** Same rationale as openapi-fetch. Code generation is not the goal; spec diffing is.

### jest / @jest/globals

**Do not add.** The project already uses Vitest and the patterns are established. Mixing test runners creates configuration complexity and module resolution issues with ESM.

### vitest-fetch-mock

**Do not add.** Adds a wrapper around `vi.stubGlobal` that is unnecessary given the existing pattern already works correctly.

---

## Integration Testing Strategy

The PROJECT.md requires "integration tests that hit the live API (read-only: GET/browse only)."

**Recommended approach:** A separate test file `src/__tests__/integration.test.ts` with a guard:

```typescript
// Skip unless RENTALWORKS_BASE_URL and RENTALWORKS_USERNAME are set
const INTEGRATION = Boolean(
  process.env.RENTALWORKS_BASE_URL &&
  process.env.RENTALWORKS_USERNAME &&
  process.env.RENTALWORKS_PASSWORD
);

describe.skipIf(!INTEGRATION)("live API integration", () => {
  it("browse_rental_inventory returns rows", async () => {
    // calls live API, only asserts shape not content
    const result = await callTool("browse_rental_inventory", {});
    expect(result).toBeDefined();
  });
});
```

**Why this pattern:** Vitest's `describe.skipIf` is the idiomatic way to conditionally skip integration suites in CI. No separate runner or `--project` configuration needed. Integration tests run locally when env vars are present, skip in CI unless explicitly configured.

**No new dependencies needed** for integration testing — it uses the same MCP `Client` + `InMemoryTransport` pattern but with the real `fetch` (not stubbed) and real `RENTALWORKS_BASE_URL` set.

---

## Swagger Spec Validation Strategy

The 12 RentalWorks sub-specs must be parsed and compared against tool implementations. Recommended approach:

1. Write a Vitest test (`src/__tests__/swagger-coverage.test.ts`) that:
   - Fetches each sub-spec URL using `@scalar/openapi-parser` with `fetchUrls` plugin
   - Extracts `{ method, path }` pairs from `spec.paths`
   - Compares against a manually-curated allowlist of "covered tools"
   - Reports paths in spec that have no corresponding MCP tool (coverage gaps)
   - Reports MCP tools whose expected path does not appear in spec (wrong paths)

2. This test runs in CI (no live API calls needed — only fetches the public Swagger JSON endpoints)

3. Guard with `describe.skipIf(!process.env.RENTALWORKS_BASE_URL)` since the Swagger URLs are instance-specific

---

## Complete Dependency Diff

```bash
# Add as production dependency
npm install zod@^3.25.0

# Upgrade existing production dependency
npm install @modelcontextprotocol/sdk@^1.29.0

# Add as dev dependencies
npm install -D @scalar/openapi-parser @vitest/coverage-v8
```

**Final devDependencies additions:**
- `@scalar/openapi-parser` — OpenAPI spec loading and dereferencing
- `@vitest/coverage-v8` — V8 coverage provider for `vitest run --coverage`

**Final dependencies additions:**
- `zod@^3.25.0` — Required by MCP SDK tools; missing from package.json

---

## Sources

- MCP SDK npm: https://www.npmjs.com/package/@modelcontextprotocol/sdk
- MCP SDK Zod v4 issue: https://github.com/modelcontextprotocol/typescript-sdk/issues/925
- MCP SDK releases: https://github.com/modelcontextprotocol/typescript-sdk/releases
- MCP E2E testing example: https://github.com/mkusaka/mcp-server-e2e-testing-example
- MCP unit testing guide: https://mcpcat.io/guides/writing-unit-tests-mcp-servers/
- @scalar/openapi-parser npm: https://www.npmjs.com/package/@scalar/openapi-parser
- @scalar/openapi-parser GitHub: https://github.com/scalar/openapi-parser
- @apidevtools/swagger-parser GitHub (archived): https://github.com/APIDevTools/swagger-parser
- Vitest 4.0 announcement: https://voidzero.dev/posts/announcing-vitest-4
- Vitest migration guide: https://vitest.dev/guide/migration.html
- Vitest coverage docs: https://vitest.dev/guide/coverage
- Vitest mocking docs: https://vitest.dev/guide/mocking
- Zod releases: https://github.com/colinhacks/zod/releases
- Zod v4 changelog: https://zod.dev/v4/changelog
