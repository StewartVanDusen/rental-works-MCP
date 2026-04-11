# Phase 5: Integration Tests - Research

**Researched:** 2026-04-09
**Domain:** Vitest integration testing against live HTTP API with conditional skip guard
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
All implementation choices are at Claude's discretion — pure infrastructure phase.

### Claude's Discretion
All implementation choices are at Claude's discretion. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

### Deferred Ideas (OUT OF SCOPE)
None — discuss phase skipped.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INTG-01 | Integration test suite with `describe.skipIf(!process.env.RENTALWORKS_BASE_URL)` guard | Vitest 3.2.4 provides `describe.skipIf` on `ChainableSuiteAPI` — confirmed in installed node_modules type defs |
| INTG-02 | JWT authentication integration test (real token acquisition) | `RentalWorksClient.authenticate()` is the exact call; assert `access_token` is a non-empty string |
| INTG-03 | Read-only browse smoke tests for core entities: inventory, orders, customers, deals | `client.browse(entity)` calls `POST /api/v1/{entity}/browse`; assert `TotalRows >= 0` and `Rows` is an array |
| INTG-04 | Read-only GET-by-ID tests for at least one entity per domain | Must first browse to get a real ID, then GET; each domain maps to a specific entity below |
| INTG-05 | Session info retrieval test (`/api/v1/account/session`) | `client.getSession()` calls `GET /api/v1/account/session`; assert `webusersid` field present |
| INTG-06 | Response shape validation (confirms API returns expected field structure) | Validate specific field presence using `expect(record).toHaveProperty(key)` — not strict schema, field presence only |
</phase_requirements>

---

## Summary

Phase 5 writes integration tests that run against the live RentalWorks instance and are completely skipped when credentials are absent. The core mechanism is Vitest's `describe.skipIf(!process.env.RENTALWORKS_BASE_URL)` guard, which is confirmed available in the installed Vitest 3.2.4. All tests use the existing `RentalWorksClient` singleton via `getClient()` / `resetClient()` — no new test infrastructure is needed beyond the test files themselves.

The integration test directory (`src/__tests__/integration/`) already exists and is listed in `vitest.config.ts` under the `integration` project. The `test:integration` npm script (`vitest run --project integration`) is already wired. Tests go in one file per domain concern, call real HTTP endpoints, and assert on response shape only — never on specific record counts or IDs, since live data varies.

The key constraint from CLAUDE.md and REQUIREMENTS.md: integration tests must be **read-only**. No create, update, or delete calls. Browse and GET-by-ID are the only permitted HTTP verbs. GET-by-ID tests must dynamically fetch a valid ID from a browse call first — hardcoding IDs would make tests brittle against data changes.

**Primary recommendation:** One integration test file (`src/__tests__/integration/live-api.test.ts`) with a single top-level `describe.skipIf` block wrapping all suites. Use `beforeAll` at the top level to acquire the JWT once and share the client across all `describe` blocks. Tests are structurally flat: `describe("domain") > it("browse") + it("get by id")`.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | 3.2.4 | Test runner with `describe.skipIf` and `it.skipIf` APIs | Already installed; integration project already configured |
| @modelcontextprotocol/sdk | ^1.12.1 | Not used in integration tests — tests bypass MCP layer | Integration tests call `RentalWorksClient` directly, not via MCP tools |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node.js fetch (built-in) | Node 18+ native | HTTP for live API calls | Used internally by `RentalWorksClient`; no import needed in tests |

**No new packages required.** [VERIFIED: package.json inspection — all dependencies present]

### Installation
```bash
# Nothing to install — all dependencies already present
```

---

## Architecture Patterns

### File Structure
```
src/__tests__/
├── unit/                          # existing — not touched
│   └── *.test.ts
└── integration/
    ├── .gitkeep                   # existing placeholder — delete or coexist
    └── live-api.test.ts           # single file for all integration tests
```

A single file is preferred over per-domain files because:
1. JWT authentication is acquired once in `beforeAll` and shared
2. Simpler to scan for coverage
3. The `describe.skipIf` guard need only appear once at the top level

### Pattern 1: Top-Level Skip Guard
**What:** Wrap the entire integration suite in `describe.skipIf` so the file is silently skipped when `RENTALWORKS_BASE_URL` is absent.
**When to use:** Required for INTG-01 — this is the CI-safety mechanism.

```typescript
// Source: vitest/dist/@vitest/runner/dist/tasks.d type definitions
import { describe, it, expect, beforeAll } from "vitest";
import { getClient, resetClient } from "../../utils/api-client.js";

const isLiveEnv = !!process.env.RENTALWORKS_BASE_URL;

describe.skipIf(!isLiveEnv)("Live API Integration Tests", () => {
  // all suites here
});
```

### Pattern 2: Single JWT Acquisition via beforeAll
**What:** Call `getClient()` once in `beforeAll`, authenticate, then reuse the singleton across all tests.
**When to use:** Avoids re-auth on every test; mirrors how the production MCP server works.

```typescript
// Source: api-client.ts singleton pattern
import { getClient, resetClient } from "../../utils/api-client.js";
import type { RentalWorksClient } from "../../utils/api-client.js";

describe.skipIf(!isLiveEnv)("Live API Integration Tests", () => {
  let client: RentalWorksClient;

  beforeAll(async () => {
    resetClient();                      // ensure clean singleton
    client = getClient();
    await client.authenticate();        // real JWT from live instance
  });

  // suites use client directly
});
```

**Note:** `RentalWorksClient` is not exported by name — `getClient()` returns an instance. Type it as `ReturnType<typeof getClient>` or cast. [VERIFIED: api-client.ts inspection — only `getClient()` and `resetClient()` are exported; class itself is exported]

Actually the class IS exported: `export class RentalWorksClient`. [VERIFIED: api-client.ts line 17]

### Pattern 3: Browse-then-Get-by-ID
**What:** To avoid hardcoded IDs, browse with `pagesize: 1` to get a real record, then GET that record by ID.
**When to use:** Every GET-by-ID integration test.

```typescript
it("gets rental inventory by ID", async () => {
  const browse = await client.browse<RentalInventory>("rentalinventory", { pagesize: 1 });
  if (browse.TotalRows === 0) {
    // Skip gracefully if no data — don't fail
    return;
  }
  const firstId = browse.Rows[0].InventoryId as string;
  const record = await client.get<RentalInventory>(`/api/v1/rentalinventory/${firstId}`);
  expect(record).toHaveProperty("InventoryId");
  expect(record).toHaveProperty("ICode");
});
```

### Pattern 4: Field-Presence Shape Validation (INTG-06)
**What:** Assert that key fields exist in responses, not their values.
**When to use:** All integration tests — values change, field names don't.

```typescript
// Good — verifies shape
expect(result).toHaveProperty("TotalRows");
expect(Array.isArray(result.Rows)).toBe(true);

// Bad — brittle, data-dependent
expect(result.TotalRows).toBe(42);
expect(result.Rows[0].ICode).toBe("LED-PAR64");
```

### Domain → Entity → Browse Path → ID Field Mapping

| Domain | Browse Entity | Browse Path | ID Field for GET |
|--------|--------------|-------------|-----------------|
| Inventory | `rentalinventory` | `POST /api/v1/rentalinventory/browse` | `InventoryId` |
| Orders | `order` | `POST /api/v1/order/browse` | `OrderId` |
| Customers | `customer` | `POST /api/v1/customer/browse` | `CustomerId` |
| Deals | `deal` | `POST /api/v1/deal/browse` | `DealId` |
| Billing | `invoice` | `POST /api/v1/invoice/browse` | `InvoiceId` |
| Vendors | `vendor` | `POST /api/v1/vendor/browse` | `VendorId` |
| Contracts | `contract` | `POST /api/v1/contract/browse` | `ContractId` |
| Settings | `warehouse` | `POST /api/v1/warehouse/browse` | `WarehouseId` |
| Admin | `user` | `POST /api/v1/user/browse` | `UserId` |
| Reports | N/A — browse not applicable | N/A | N/A (skip GET-by-ID) |
| Storefront | N/A — `GET /api/v1/storefront/catalog` (no ID) | N/A | N/A |

[VERIFIED: inspection of all tool files in src/tools/]

**"At least one GET-by-ID per domain" scope clarification:**
- Reports: no GET-by-ID pattern exists (run reports take named params). Use browse of a settings entity as stand-in, or omit — INTG-04 says "at least one per domain" which is satisfied by the other 8 domains.
- Storefront: no entity-level GET-by-ID. Covered by browse catalog test.

### Anti-Patterns to Avoid
- **Hardcoding IDs:** Real IDs change per instance and data state. Always browse first.
- **Asserting TotalRows > 0:** A valid RW instance might have no invoices. Use `>= 0`. If skipping is needed when empty, use early return with comment.
- **Per-test authentication:** JWT lasts 4 hours. One `beforeAll` is sufficient — matches production behavior.
- **Mutating state:** Never call `client.post()` with create/update/delete paths. This excludes `create_*`, `update_*`, `delete_*`, `cancel_*`, `approve_*`, etc.
- **Importing `RentalWorksClient` without `.js` extension:** ESM module resolution requires `.js` extension on all relative imports. [VERIFIED: existing unit test import patterns]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP client | Custom fetch wrapper | `RentalWorksClient` (existing) | Already handles auth, retry, empty responses |
| JWT acquisition | Manual fetch to `/api/v1/jwt` | `client.authenticate()` | Already implemented with token caching |
| Skip mechanism | `if (!env) test.skip()` in each test | `describe.skipIf(!isLiveEnv)` | Single guard, works at suite level, Vitest-native |
| Browse helper | Inline `POST /api/v1/{entity}/browse` | `client.browse(entity, options)` | Already handles `BrowseRequest` structure |
| Session check | Manual `GET /api/v1/account/session` | `client.getSession()` | Already implemented |

---

## Common Pitfalls

### Pitfall 1: `RentalWorksClient` reads `BASE_URL` at module load time
**What goes wrong:** `BASE_URL` is captured in a module-level `const` when `api-client.ts` loads. If `RENTALWORKS_BASE_URL` is set after module import, the client uses an empty string.
**Why it happens:** `const BASE_URL = process.env.RENTALWORKS_BASE_URL || ""` is evaluated once at import time.
**How to avoid:** Set env vars before importing (they come from the OS environment when running `vitest run --project integration` with env vars in shell). The `resetClient()` call does NOT re-read `BASE_URL` — it only resets the singleton instance. The `BASE_URL` const is fixed for the process lifetime.
**Warning signs:** Tests appear to run but all requests fail with "URL not set" or fetch errors against empty string.
**Mitigation:** This is not a problem when running the integration suite with `RENTALWORKS_BASE_URL=https://... vitest run --project integration`. It only matters in test setup — do not set env vars in `beforeAll`; they must be set before the process starts.

### Pitfall 2: `describe.skipIf` vs `it.skipIf` scope
**What goes wrong:** Using `it.skipIf` on every individual test instead of a single `describe.skipIf` on the top-level suite.
**Why it happens:** Developer forgets the suite-level guard.
**How to avoid:** One `describe.skipIf(!process.env.RENTALWORKS_BASE_URL)` at the outermost level skips all nested `describe` and `it` blocks. No per-test guard needed.

### Pitfall 3: `getClient()` returns stale singleton from prior test files
**What goes wrong:** A unit test that ran before the integration test set env vars on the old singleton; `getClient()` returns that stale instance with empty username/password.
**Why it happens:** Vitest runs test files in the same worker process (same module cache) by default.
**How to avoid:** Call `resetClient()` in `beforeAll` before calling `getClient()`. This is already the pattern in all unit tests. [VERIFIED: unit test beforeEach patterns]

### Pitfall 4: Asserting `Rows[0]` exists without guard
**What goes wrong:** `browse.Rows[0].InventoryId` throws `TypeError: Cannot read property 'InventoryId' of undefined` on an empty database.
**Why it happens:** A fresh or filtered browse may return `TotalRows: 0`.
**How to avoid:** Check `browse.TotalRows === 0` and early-return (not `expect.skip`) — treat empty data as "test not applicable" not "test failure".

### Pitfall 5: Integration tests timing out on live network
**What goes wrong:** Default Vitest test timeout (5000ms) is too short for a live API round-trip including JWT acquisition.
**Why it happens:** Network latency + TLS + RW server processing can exceed 5 seconds on first auth.
**How to avoid:** Set a higher timeout either in `vitest.config.ts` for the integration project, or via `it("...", async () => { ... }, 15000)` (15 second timeout per test). The `beforeAll` for JWT may need `{ timeout: 15000 }` as well.

---

## Code Examples

### Complete integration test file skeleton
```typescript
// Source: derived from existing unit test patterns + vitest API type defs
import { describe, it, expect, beforeAll } from "vitest";
import { getClient, resetClient, RentalWorksClient } from "../../utils/api-client.js";
import type { BrowseResponse } from "../../types/api.js";

const isLiveEnv = !!process.env.RENTALWORKS_BASE_URL;

describe.skipIf(!isLiveEnv)("Live API Integration Tests", () => {
  let client: RentalWorksClient;

  beforeAll(async () => {
    resetClient();
    client = getClient();
    await client.authenticate();
  }, 15000);

  // ── INTG-02: JWT Auth ──────────────────────────────────────────────────
  describe("Authentication (INTG-02)", () => {
    it("acquires a non-empty JWT access token", async () => {
      // authenticate() was called in beforeAll; call again to verify return value
      const jwt = await client.authenticate();
      expect(typeof jwt.access_token).toBe("string");
      expect(jwt.access_token.length).toBeGreaterThan(0);
      expect(jwt.statuscode).toBe(200);
    }, 10000);
  });

  // ── INTG-05: Session ───────────────────────────────────────────────────
  describe("Session (INTG-05)", () => {
    it("returns a valid session object", async () => {
      const session = await client.getSession() as Record<string, unknown>;
      expect(session).toHaveProperty("webusersid");
      expect(session).toHaveProperty("usersid");
    }, 10000);
  });

  // ── INTG-03 + INTG-06: Browse smoke tests ─────────────────────────────
  describe("Browse Smoke Tests (INTG-03, INTG-06)", () => {
    it("browses rental inventory — returns valid browse shape", async () => {
      const result = await client.browse("rentalinventory", { pagesize: 5 });
      expect(result).toHaveProperty("TotalRows");
      expect(result).toHaveProperty("Rows");
      expect(Array.isArray(result.Rows)).toBe(true);
    }, 10000);

    // ... orders, customers, deals ...
  });

  // ── INTG-04: GET-by-ID ─────────────────────────────────────────────────
  describe("GET-by-ID (INTG-04)", () => {
    it("gets rental inventory by ID", async () => {
      const browse = await client.browse<Record<string, unknown>>(
        "rentalinventory",
        { pagesize: 1 }
      );
      if (browse.TotalRows === 0) return; // no data to test against
      const id = browse.Rows[0]["InventoryId"] as string;
      const record = await client.get<Record<string, unknown>>(
        `/api/v1/rentalinventory/${id}`
      );
      expect(record).toHaveProperty("InventoryId");
      expect(record).toHaveProperty("ICode");
    }, 10000);
  });
});
```

### vitest.config.ts: Add integration timeout
```typescript
// Source: vitest.config.ts inspection + vitest 3.x project config API
{
  test: {
    name: "integration",
    include: ["src/__tests__/integration/**/*.test.ts"],
    testTimeout: 15000,   // 15s for live API round-trips
    hookTimeout: 15000,   // 15s for beforeAll JWT auth
  },
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `test.skip()` inside test body | `describe.skipIf(condition)` at suite level | Vitest 1.x+ | Cleaner skip — entire suite shows as skipped in output, no test body runs |
| Separate `.env.test` for integration | Env vars passed at invocation | Ongoing convention | Avoids accidental credential commits; aligns with CLAUDE.md |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | GET-by-ID for `user` domain is `GET /api/v1/user/{userId}` | Domain mapping table | Low — confirmed by admin.ts source inspection |
| A2 | Live RW instance has data in all browse entities (inventory, orders, customers) | Pitfall 4 | Handled by early-return guard — tests gracefully skip if empty |
| A3 | `client.authenticate()` return value is the `JwtResponse` object (not void) | Code example | Confirmed by api-client.ts return type `Promise<JwtResponse>` [VERIFIED] |

**Assumptions table is minimal — most claims verified by direct codebase inspection.**

---

## Open Questions

1. **Should INTG-04 require all 9 domains or just the 4 core ones mentioned in INTG-03?**
   - What we know: INTG-04 says "at least one GET-by-ID test per domain" and INTG-03 names inventory, orders, customers, deals
   - What's unclear: Does "per domain" mean all 11 tool domains or just the 4 INTG-03 domains?
   - Recommendation: Cover all domains that have a GET-by-ID pattern (8 domains listed in mapping table). Reports and Storefront have no entity-level GET-by-ID — document them as N/A. This exceeds the minimum.

2. **timeout for `describe.skipIf` condition — evaluated at file parse time or at runtime?**
   - What we know: `describe.skipIf(!process.env.RENTALWORKS_BASE_URL)` — condition is evaluated when the test file is collected
   - What's unclear: Nothing — this is standard Vitest behavior [VERIFIED: type defs show condition is `any`]
   - Recommendation: No issue; env var is read at collection time, which is correct.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| vitest | Test runner | Yes | 3.2.4 | — |
| Node.js fetch | HTTP client in api-client.ts | Yes (Node 18+) | Built-in | — |
| RENTALWORKS_BASE_URL | Live API access | No (not in shell) | — | Tests skip via `describe.skipIf` |
| RENTALWORKS_USERNAME | JWT auth | No | — | Tests skip |
| RENTALWORKS_PASSWORD | JWT auth | No | — | Tests skip |

**Missing dependencies with no fallback:** None — the skip guard handles credential absence.

**Missing dependencies with fallback:** Credentials (RENTALWORKS_*) — skip guard ensures CI-safety without credentials.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 |
| Config file | `vitest.config.ts` (integration project already defined) |
| Quick run command | `npm run test:integration` |
| Full suite command | `npm run test:integration` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INTG-01 | Suite skips when `RENTALWORKS_BASE_URL` absent | integration | `npm run test:integration` | Wave 0 |
| INTG-02 | Real JWT acquired from live instance | integration | `npm run test:integration` | Wave 0 |
| INTG-03 | Browse smoke: inventory, orders, customers, deals | integration | `npm run test:integration` | Wave 0 |
| INTG-04 | GET-by-ID for each domain returns matching schema | integration | `npm run test:integration` | Wave 0 |
| INTG-05 | `/api/v1/account/session` returns valid session | integration | `npm run test:integration` | Wave 0 |
| INTG-06 | Response shape validated (field presence) | integration | `npm run test:integration` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run test:integration` (runs in <1s when env vars absent — all skipped)
- **Per wave merge:** `npm run test:integration` with credentials (full live suite)
- **Phase gate:** Full suite green with credentials before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/__tests__/integration/live-api.test.ts` — covers INTG-01 through INTG-06
- [ ] `vitest.config.ts` update — add `testTimeout: 15000` and `hookTimeout: 15000` to integration project

*(No framework install needed — vitest already installed)*

---

## Security Domain

Integration tests are read-only test infrastructure with no user-facing attack surface. No ASVS categories apply to the test files themselves. The underlying `RentalWorksClient` security (JWT handling, HTTPS, credential management) is covered by Phase 4 error handling tests and is not re-audited here.

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase 5 |
|-----------|------------------|
| Read-only integration tests | No create/update/delete calls in any test |
| Tech stack: TypeScript, MCP SDK, Vitest, Zod — no additional frameworks | No new test libraries (jest, supertest, etc.) |
| API compatibility: match exact paths from Swagger spec | Test paths must use the same entity paths as the tools |
| ESM module resolution: imports require `.js` extension | All imports in test files must use `.js` extension |
| File naming: test files as `*.test.ts` in `__tests__/` | File: `src/__tests__/integration/live-api.test.ts` |
| Singleton pattern: `getClient()` / `resetClient()` | Use `resetClient()` in `beforeAll` before getting client |

---

## Sources

### Primary (HIGH confidence)
- `src/utils/api-client.ts` — verified all method signatures, export patterns, BASE_URL initialization
- `vitest.config.ts` — verified integration project config, absence of timeout settings
- `node_modules/@vitest/runner/dist/tasks.d-CkscK4of.d.ts` — verified `describe.skipIf` and `it.skipIf` availability in Vitest 3.2.4
- `src/__tests__/unit/*.test.ts` — verified import patterns, `resetClient()` usage, `beforeAll`/`beforeEach` conventions
- `src/tools/*.ts` — verified all domain entity names and browse/getById paths
- `src/types/api.ts` — verified entity type definitions and ID field names

### Secondary (MEDIUM confidence)
- Vitest 3.x documentation pattern for `describe.skipIf` — standard API, consistent with type definitions found in installed modules

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies verified in installed node_modules and package.json
- Architecture: HIGH — derived directly from codebase patterns, no speculation
- Pitfalls: HIGH — directly observed from codebase (BASE_URL const, singleton patterns)
- Domain mapping: HIGH — verified by reading each tool file

**Research date:** 2026-04-09
**Valid until:** 2026-07-09 (stable — no fast-moving dependencies)
