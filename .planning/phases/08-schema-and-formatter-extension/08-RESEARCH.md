# Phase 8: Schema and Formatter Extension - Research

**Researched:** 2026-04-11
**Domain:** TypeScript schema extension, Zod 4, MCP tool schema design, field projection utilities
**Confidence:** HIGH

## Summary

Phase 8 adds two backward-compatible extension points to the inventory browse infrastructure:

1. An inventory-specific Zod schema fragment (`inventoryFieldSchema`) that adds `fields` and `fieldPreset` optional parameters. This is spread alongside `browseSchema` only in inventory tool definitions — `browseSchema` itself is never modified.
2. A `projectFields` utility function in `browse-helpers.ts` and an extended `formatBrowseResult` signature in `tool-helpers.ts` that accepts an optional second `options` parameter for field projection. All existing callers that pass no second argument remain unaffected.

The key design constraint is that `browseSchema` (in `tool-helpers.ts`) must not gain any `fields`-related keys — verified by the success criterion `grep "fields" src/utils/tool-helpers.ts` returns nothing. The new schema fields live in inventory.ts as a separate spread.

Phase 9 will wire these extension points into the actual handler logic. Phase 8 only creates the schema and formatter infrastructure.

**Primary recommendation:** Add `inventoryFieldSchema` to `browse-helpers.ts` (zero MCP SDK dependency), add `projectFields` to `browse-helpers.ts`, and extend `formatBrowseResult` in `tool-helpers.ts` with an optional `options?: { fields?: string[] }` second parameter.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
All implementation choices are at Claude's discretion — pure infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Key constraints from prior decisions:
- `browseSchema` in tool-helpers.ts must NOT be modified — new `fields`/`clientFilter` params go in inventory tool definitions only via a separate spread schema
- `formatBrowseResult` extension uses optional second parameter only — existing callers unaffected
- Field projection (projectFields) applied on data.Rows before passing to formatter
- browse-helpers.ts has zero MCP SDK dependency — pure TypeScript utility

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase.

### Deferred Ideas (OUT OF SCOPE)
None — infrastructure phase.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FSEL-01 | User can pass an optional `fields` array to inventory browse tools to receive only specified fields per row | Verified pattern: `inventoryFieldSchema` spread in inventory.ts + `projectFields` in browse-helpers.ts + `options.fields` in `formatBrowseResult` |
| FSEL-02 | Named field presets (SUMMARY, FULL) are available as shorthand for common field sets | Verified pattern: `fieldPreset: z.enum(["summary", "full"])` in inventoryFieldSchema; preset resolved to `RENTAL_INVENTORY_BRIEF_FIELDS` constant already in browse-helpers.ts |
</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

| Constraint | Directive |
|------------|-----------|
| No new frameworks | TypeScript, MCP SDK, Vitest, Zod only |
| browseSchema must not be modified | New fields go in inventory tool definitions only, via separate spread |
| browse-helpers.ts zero MCP SDK dependency | Pure TypeScript utility — no SDK imports |
| Naming | Schema objects: camelCase with `Schema` suffix (e.g., `inventoryFieldSchema`) |
| Module design | Utilities export multiple named exports from specific files |
| TypeScript strict mode | Must pass `npx tsc --noEmit` |
| Test location | Unit tests in `src/__tests__/unit/` |
| Read-only integration tests | Live API tests must not mutate data |
| Imports | Use `.js` extension on all relative imports |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Zod | 4.3.6 (installed) | Schema definition for MCP tool parameters | Already in use throughout codebase; Zod 4 `z.array(z.string()).optional()` and `z.enum([...]).optional()` work identically to Zod 3 for this use case [VERIFIED: live node test in session] |
| TypeScript | 5.7.0 | Type-safe implementation | Required by project |
| Vitest | 3.2.4 (installed) | Unit testing | Already in use; `npm run test:unit` runs all unit tests [VERIFIED: test run in session] |

**Note on Zod version:** CLAUDE.md documents Zod 3.x but installed version is 4.3.6. [VERIFIED: `npm view zod version` returned 4.3.6]. The API surface for `optional()`, `array()`, `enum()`, `object()`, and spread of schema shape objects is unchanged between Zod 3 and 4 for this use case — confirmed by live test.

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None needed | — | — | Phase is pure TypeScript/Zod, no new libraries required |

**Installation:** No new packages required. [VERIFIED: existing dependencies sufficient]

---

## Architecture Patterns

### Where Each New Artifact Lives

```
src/
├── utils/
│   ├── browse-helpers.ts      # ADD: inventoryFieldSchema, projectFields
│   └── tool-helpers.ts        # EXTEND: formatBrowseResult with optional options param
└── tools/
    └── inventory.ts           # USE: spread ...inventoryFieldSchema in browse tool schemas
```

**Pattern: inventoryFieldSchema in browse-helpers.ts (not tool-helpers.ts)**

The new schema fragment belongs in `browse-helpers.ts` because:
- `tool-helpers.ts` must not gain any `fields`-related exports (success criterion: `grep "fields" src/utils/tool-helpers.ts` returns nothing)
- `browse-helpers.ts` already owns `RENTAL_INVENTORY_BRIEF_FIELDS` — the preset resolution naturally co-locates with the constants
- `browse-helpers.ts` is already a zero-MCP-SDK pure utility — safe to add Zod schema here (Zod is a project dependency, not the SDK)

**Pattern: Separate spread schema in inventory.ts**

Existing pattern (inventory.ts line 25):
```typescript
{
  ...browseSchema,
  categoryId: z.string().optional().describe("Filter by rental category ID"),
}
```

Extended pattern (Phase 8):
```typescript
{
  ...browseSchema,
  ...inventoryFieldSchema,
  categoryId: z.string().optional().describe("Filter by rental category ID"),
}
```

[VERIFIED: current inventory.ts pattern read in session]

**Pattern: inventoryFieldSchema definition**

```typescript
// Source: browse-helpers.ts — to be added in Phase 8
export const inventoryFieldSchema = {
  fields: z
    .array(z.string())
    .optional()
    .describe("Return only these fields per row (e.g. ['InventoryId', 'Description'])"),
  fieldPreset: z
    .enum(["summary", "full"])
    .optional()
    .describe("Named field preset: 'summary' returns RENTAL_INVENTORY_BRIEF_FIELDS"),
};
```

[VERIFIED: Zod 4 `z.array(z.string()).optional()` and `z.enum([...]).optional()` parse correctly — live node test in session]

**Pattern: projectFields utility**

```typescript
// Source: browse-helpers.ts — to be added in Phase 8
export function projectFields(
  rows: Record<string, unknown>[],
  fields: string[]
): Record<string, unknown>[] {
  if (fields.length === 0) return rows;
  return rows.map((row) => {
    const projected: Record<string, unknown> = {};
    for (const field of fields) {
      if (field in row) {
        projected[field] = row[field];
      }
    }
    return projected;
  });
}
```

[VERIFIED: prototype tested with live node execution in session — correct behavior for both explicit fields and empty fields passthrough]

**Pattern: resolveFieldPreset utility**

Phase 8 also needs a function to translate `fieldPreset` to a concrete `string[]` so callers (in Phase 9) do not need to know about `RENTAL_INVENTORY_BRIEF_FIELDS` directly:

```typescript
// Source: browse-helpers.ts — to be added in Phase 8
export function resolveFieldPreset(
  fieldPreset: string | undefined,
  entityType: "rentalInventory" | "items"
): string[] | undefined {
  if (!fieldPreset) return undefined;
  if (fieldPreset === "summary") {
    return entityType === "rentalInventory"
      ? RENTAL_INVENTORY_BRIEF_FIELDS
      : ITEMS_BRIEF_FIELDS;
  }
  // "full" = no projection (return all fields)
  return undefined;
}
```

**Pattern: Extended formatBrowseResult signature**

The current signature:
```typescript
export function formatBrowseResult(data: {
  TotalRows: number; PageNo: number; PageSize: number; TotalPages: number;
  Rows: Record<string, unknown>[];
}): string
```

Extended signature (optional second parameter — all existing callers are unaffected):
```typescript
export function formatBrowseResult(
  data: {
    TotalRows: number; PageNo: number; PageSize: number; TotalPages: number;
    Rows: Record<string, unknown>[];
  },
  options?: { fields?: string[] }
): string
```

Implementation change: before the loop, project rows if `options?.fields` is provided.

[VERIFIED: prototype tested with live node execution in session — backward-compatible behavior confirmed]

### Anti-Patterns to Avoid

- **Modifying browseSchema:** Any field added to `browseSchema` propagates to all 114 tools. The `inventoryFieldSchema` is a separate export that is spread only in inventory tool definitions.
- **Putting inventoryFieldSchema in tool-helpers.ts:** Success criterion explicitly requires `grep "fields" src/utils/tool-helpers.ts` to return nothing. Place in `browse-helpers.ts`.
- **Importing @modelcontextprotocol/sdk in browse-helpers.ts:** The existing module purity test (Test 16 in browse-helpers.test.ts) will catch this. Zod is safe to import because it is a project dependency, not the SDK.
- **Applying projection inside withClientSideFallback:** Projection is a formatting concern, not a filtering concern. Apply in formatBrowseResult or at the handler level (Phase 9), not inside the fallback logic.
- **Using z.optional().default():** A field with `default()` is no longer optional to the tool handler — it always has a value. For `fields` and `fieldPreset`, use `.optional()` without default so the handler can distinguish "caller passed nothing" from "caller passed []".

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Field preset mapping | Custom registry/factory | Simple `if (fieldPreset === "summary")` switch in `resolveFieldPreset` | Only two presets (summary, full); a registry would be over-engineering |
| Schema spread | Custom merge utility | Native JavaScript spread `{ ...browseSchema, ...inventoryFieldSchema }` | MCP SDK `server.tool()` accepts a plain object of Zod schema fields, spread is the established pattern throughout the codebase |
| Row projection | lodash.pick or similar | `projectFields` inline loop | No new dependencies; ~10 lines; the logic is trivial |

---

## Common Pitfalls

### Pitfall 1: browseSchema contamination
**What goes wrong:** A developer adds `fields` to `browseSchema` in tool-helpers.ts to DRY things up. This passes `fields` to all 114 tools, including orders, customers, billing — where the parameter has no meaning.
**Why it happens:** browseSchema looks like the natural home.
**How to avoid:** Export `inventoryFieldSchema` from browse-helpers.ts. Spread it only in inventory.ts. The success criterion `grep "fields" src/utils/tool-helpers.ts` catches this automatically.
**Warning signs:** TypeScript sees `fields` available on a non-inventory browse tool handler.

### Pitfall 2: TypeScript strict mode rejection of `options?.fields`
**What goes wrong:** TypeScript complains that `options` is `undefined` when used without optional chaining.
**Why it happens:** Strict mode enables `strictNullChecks` — accessing `.fields` on a potentially-undefined `options` is a type error.
**How to avoid:** Use `options?.fields` throughout. The extended signature `options?: { fields?: string[] }` is correctly typed; accessing `options?.fields` returns `string[] | undefined`.
**Warning signs:** `npx tsc --noEmit` reports "Object is possibly 'undefined'".

### Pitfall 3: projectFields mutates the original row objects
**What goes wrong:** Using `delete row[key]` to strip unwanted keys modifies the original response object.
**Why it happens:** Destructive approach seems simpler.
**How to avoid:** Build a new object in `projectFields` — map over rows, create `{}`, copy only wanted keys. The prototype above does this correctly.
**Warning signs:** Test data is corrupted across test cases using shared fixtures.

### Pitfall 4: `fieldPreset: "full"` not handled
**What goes wrong:** `resolveFieldPreset("full", ...)` returns `undefined` (meaning no projection), which is correct — but if it accidentally returns `[]` (empty array), `projectFields` would return rows with zero fields.
**Why it happens:** Off-by-one in the conditional: `if (fields.length === 0) return rows` guard in `projectFields` vs. returning `undefined` from `resolveFieldPreset`.
**How to avoid:** `resolveFieldPreset` returns `undefined` for "full" preset (no projection). `projectFields` is only called when fields is a non-empty string array.
**Warning signs:** browse result returns empty rows when `fieldPreset: "full"` is passed.

### Pitfall 5: Existing tool-helpers.test.ts tests break
**What goes wrong:** The formatBrowseResult tests in `src/__tests__/unit/tool-helpers.test.ts` (Test: "formats browse data") call `formatBrowseResult(data)` with one argument. If the signature change is not backward-compatible, they would fail.
**Why it happens:** TypeScript optional param `options?:` is correctly backward-compatible — no change needed to tests.
**How to avoid:** Use `options?: { fields?: string[] }` (optional parameter, not required). All existing single-argument callers continue to work.
**Warning signs:** `npm run test:unit` shows failures in tool-helpers.test.ts after the extension.

---

## Code Examples

### inventoryFieldSchema (verified pattern)
```typescript
// Source: browse-helpers.ts — verified with live Zod 4 node test
import { z } from "zod";

export const inventoryFieldSchema = {
  fields: z
    .array(z.string())
    .optional()
    .describe("Return only these fields per row (e.g. ['InventoryId', 'Description'])"),
  fieldPreset: z
    .enum(["summary", "full"])
    .optional()
    .describe("Named field preset: 'summary' returns brief fields set, 'full' returns all fields"),
};
```

### Usage in inventory.ts browse tool schema (verified pattern)
```typescript
// Source: src/tools/inventory.ts — existing spread pattern, extended
{
  ...browseSchema,
  ...inventoryFieldSchema,
  categoryId: z.string().optional().describe("Filter by rental category ID"),
}
```

### projectFields (verified logic)
```typescript
// Source: browse-helpers.ts — verified with live node prototype
export function projectFields(
  rows: Record<string, unknown>[],
  fields: string[]
): Record<string, unknown>[] {
  if (fields.length === 0) return rows;
  return rows.map((row) => {
    const projected: Record<string, unknown> = {};
    for (const field of fields) {
      if (field in row) {
        projected[field] = row[field];
      }
    }
    return projected;
  });
}
```

### Extended formatBrowseResult (verified backward-compatible)
```typescript
// Source: tool-helpers.ts — optional second parameter; existing callers unaffected
export function formatBrowseResult(
  data: {
    TotalRows: number;
    PageNo: number;
    PageSize: number;
    TotalPages: number;
    Rows: Record<string, unknown>[];
  },
  options?: { fields?: string[] }
): string {
  const rows =
    options?.fields && options.fields.length > 0
      ? projectFields(data.Rows, options.fields)
      : data.Rows;

  const lines: string[] = [
    `Results: ${data.TotalRows} total (page ${data.PageNo} of ${data.TotalPages})`,
    `Showing ${rows.length} records:`,
    "",
  ];

  for (const row of rows) {
    const parts: string[] = [];
    for (const [key, value] of Object.entries(row)) {
      if (value !== null && value !== undefined && value !== "") {
        parts.push(`${key}: ${value}`);
      }
    }
    lines.push(parts.join(" | "));
  }

  return lines.join("\n");
}
```

**Note:** `projectFields` must be imported or defined in tool-helpers.ts. Since it belongs in browse-helpers.ts, tool-helpers.ts will import it from there. [ASSUMED: this creates a dependency from tool-helpers.ts on browse-helpers.ts — acceptable since browse-helpers.ts has zero MCP SDK dependency and is a pure TS utility]

**Alternative:** Inline the projection logic directly in `formatBrowseResult` to avoid the cross-file dependency. Either approach is valid; co-locating `projectFields` in browse-helpers.ts is preferred for testability.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 |
| Config file | `vitest.config.ts` |
| Quick run command | `npm run test:unit` |
| Full suite command | `npm run test:unit` (integration requires live API credentials) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FSEL-01 | `fields: ["InventoryId", "Description"]` projects only those keys from Rows | unit | `npm run test:unit` | ❌ Wave 0 — new tests in browse-helpers.test.ts and tool-helpers.test.ts |
| FSEL-02 | `fieldPreset: "summary"` resolves to `RENTAL_INVENTORY_BRIEF_FIELDS` via `resolveFieldPreset` | unit | `npm run test:unit` | ❌ Wave 0 — new tests in browse-helpers.test.ts |
| SC-3 | Existing non-inventory unit tests pass unmodified after schema change | unit | `npm run test:unit` | ✅ existing 249 tests |
| SC-4 | `npx tsc --noEmit` passes | typecheck | `npx tsc --noEmit` | N/A — command check |

### Sampling Rate
- **Per task commit:** `npm run test:unit`
- **Per wave merge:** `npm run test:unit`
- **Phase gate:** `npm run test:unit` all green + `npx tsc --noEmit` passes before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/__tests__/unit/browse-helpers.test.ts` — add tests for `projectFields` and `resolveFieldPreset` (existing file, add test suites)
- [ ] `src/__tests__/unit/tool-helpers.test.ts` — add tests for extended `formatBrowseResult` with `options.fields` (existing file, add test cases)

*(No new test files needed — extend existing unit test files for both utilities)*

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `projectFields` can be added to browse-helpers.ts and imported from tool-helpers.ts without creating a circular dependency | Architecture Patterns | TypeScript would report a circular dependency error; alternative is to inline `projectFields` directly in tool-helpers.ts |
| A2 | The `fieldPreset: "full"` variant should return all fields (no projection) | Architecture Patterns | If "full" was intended to mean a different curated set, resolveFieldPreset logic would need updating; but ROADMAP only mentions SUMMARY and FULL as analogues of BRIEF/ALL |

---

## Open Questions

1. **Should `projectFields` live in browse-helpers.ts or tool-helpers.ts?**
   - What we know: CONTEXT.md says "browse-helpers.ts has zero MCP SDK dependency — pure TypeScript utility". Zod is imported into browse-helpers.ts for `inventoryFieldSchema` — this is acceptable as Zod is not the MCP SDK.
   - What's unclear: Does adding a Zod import to browse-helpers.ts conflict with the "zero MCP SDK dependency" intent? Strictly, it's zero SDK dependency, not zero Zod dependency.
   - Recommendation: Add Zod import to browse-helpers.ts for `inventoryFieldSchema`. The module purity test (Test 16) only checks for `@modelcontextprotocol/sdk`. `projectFields` takes no Zod types so it has no Zod import requirement.

2. **Where should tool-helpers.ts import `projectFields` from?**
   - What we know: If `projectFields` is in browse-helpers.ts, tool-helpers.ts must import it, creating a dependency from tool-helpers → browse-helpers.
   - What's unclear: Is this dependency direction acceptable, or should `projectFields` be inlined in tool-helpers.ts?
   - Recommendation: Inline `projectFields` as a module-private helper in tool-helpers.ts to keep the dependency graph simple. The function is ~8 lines and duplicating it is a minor cost. OR export it from browse-helpers.ts and import it — both work, planner can choose.

---

## Environment Availability

Step 2.6: SKIPPED — phase is pure TypeScript/Zod code changes with no external service dependencies. All required tools (TypeScript compiler, Vitest, Node.js) are confirmed available from current test run.

---

## Security Domain

The security enforcement concern does not apply to this phase. Phase 8 adds schema fields for optional field selection and extends a text-formatting function. No authentication, session management, cryptography, or user input reaching an API is introduced by this phase — the fields/fieldPreset parameters affect only post-fetch response shaping, not the API request itself.

---

## Sources

### Primary (HIGH confidence)
- Current codebase read in session: `src/utils/tool-helpers.ts`, `src/utils/browse-helpers.ts`, `src/tools/inventory.ts`, `src/types/api.ts`
- Live test execution: `npm run test:unit` — 249 tests passing [VERIFIED]
- Live Zod 4 node test: `z.array(z.string()).optional()`, `z.enum([...]).optional()`, spread patterns [VERIFIED]
- Live prototype: `projectFields` and extended `formatBrowseResult` logic [VERIFIED]
- `package.json`: Zod 4.3.6 installed [VERIFIED: npm view zod version]
- `vitest.config.ts`: unit/integration project split [VERIFIED]

### Secondary (MEDIUM confidence)
- `npx tsc --noEmit` output: 7 pre-existing errors in error-handling.test.ts only — zero errors in source files [VERIFIED: run in session]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all verified against live codebase and installed packages
- Architecture: HIGH — verified against existing patterns, constraints from CONTEXT.md, and live prototype execution
- Pitfalls: HIGH — derived from direct code analysis and success criteria review
- Test gaps: HIGH — existing test files identified, new test cases needed are clearly scoped

**Research date:** 2026-04-11
**Valid until:** 2026-05-11 (stable TypeScript/Zod; no moving parts)
