# Phase 9: Inventory Handler Wiring - Research

**Researched:** 2026-04-11
**Domain:** TypeScript / MCP tool handler wiring — no new external dependencies
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
None — discussion was skipped for this infrastructure phase (auto-generated context).

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FSEL-03 | Inventory browse tools default to SUMMARY preset, reducing per-item payload from ~2,200 chars to ~200 | resolveFieldPreset("summary", ...) + projectFields already exist; handler must call them when neither fields nor fieldPreset is supplied by the caller |
| CFLT-03 | When client-side filtering is active, pagination metadata is corrected to reflect actual filtered result count (not the unfiltered API total) | withClientSideFallback already sets TotalRows to filteredRows.length on fallback; the text output from formatBrowseResult still reads "Results: X total (page Y of Z)" — needs a new metadata line that disambiguates |
| ROPT-01 | Inventory browse tools use a smaller default page size (10 instead of 25) to reduce payload | buildBrowseRequest falls back to args.pageSize || 25 — the inventory handlers must pass pageSize: args.pageSize ?? 10, shadowing the shared 25 default without touching browseSchema |
</phase_requirements>

---

## Summary

Phase 9 is a pure wiring phase. All utilities (browse-helpers.ts, tool-helpers.ts) were built and tested in Phases 7 and 8. The two inventory browse handlers (`browse_rental_inventory`, `browse_items`) currently call `buildBrowseRequest` and `formatBrowseResult` with no involvement of `withClientSideFallback`, `resolveFieldPreset`, `projectFields`, or the `fields`/`fieldPreset` args that are already in the schema. This phase connects those dots.

Three distinct behavior changes are required: (1) reduce the default page size from 25 to 10 for inventory browses only, (2) default the field set to BRIEF_FIELDS when no explicit fields argument is given, and (3) surface a "(client-filtered)" annotation in the metadata line when `withClientSideFallback` triggered a fallback. None of these require new library additions — every building block exists and is unit-tested.

The only structural risk is the metadata annotation for CFLT-03. `withClientSideFallback` returns a standard `BrowseResponse` and does not signal whether it fell back. The handler must detect the fallback condition by comparing the returned `TotalRows` to the pre-filter total, or by receiving a flag. The cleanest approach (see Architecture Patterns) is to track whether a fallback occurred and pass that as context to a dedicated metadata formatter.

**Primary recommendation:** Wire the two inventory browse handlers in a single focused plan; write unit tests for each new behavior using mock data (no network required); leave every CRUD tool handler and all other browse tools completely untouched.

---

## Standard Stack

No new packages are needed. [VERIFIED: package.json inspection]

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| vitest | ^3.1.0 | Unit test runner | Already installed |
| zod | ^4.3.6 | Schema validation | Already installed |
| @modelcontextprotocol/sdk | ^1.12.1 | MCP server framework | Already installed |

**Installation:** None required.

---

## Architecture Patterns

### Current Browse Handler Shape (inventory.ts)

Both inventory browse handlers currently follow this pattern: [VERIFIED: src/tools/inventory.ts read]

```typescript
// browse_rental_inventory (lines 22-36 of inventory.ts)
async (args) => {
  const client = getClient();
  const request = buildBrowseRequest(args);
  const data = await client.post("/api/v1/rentalinventory/browse", request);
  return { content: [{ type: "text", text: formatBrowseResult(data as any) }] };
}
```

The `args` object contains `fields` and `fieldPreset` (from `inventoryFieldSchema` spread) but they are never read or forwarded.

### Pattern 1: Default Page Size Override (ROPT-01)

**What:** `buildBrowseRequest` falls back to `args.pageSize || 25`. To change the default for inventory only, pass an explicit value when the caller did not provide one.

**Implementation:**
```typescript
// In the handler, before buildBrowseRequest:
const effectivePageSize = args.pageSize ?? 10;
const request = buildBrowseRequest({ ...args, pageSize: effectivePageSize });
```

**Why `??` not `||`:** `||` would replace `0` (falsy but valid). `??` only replaces `undefined` and `null`. The Zod schema has `.default(25)` on `pageSize` in browseSchema, which means Zod fills in `25` when the caller omits it — so `args.pageSize` will never be `undefined` after Zod parsing. This means the handler must shadow the default differently.

**CRITICAL: Zod default interaction.** [VERIFIED: src/utils/tool-helpers.ts browseSchema]

`browseSchema.pageSize` is `z.number().optional().default(25)`. Zod `.default()` fills the value before the handler runs, so `args.pageSize` will be `25` (not `undefined`) when the caller omits it. A plain `args.pageSize ?? 10` will always resolve to `25`.

The correct approach is to NOT rely on detecting undefined. Instead, override the default at schema level for inventory tools specifically, or accept a sentinel approach.

Two viable options:

**Option A: Override via schema-level Zod default in inventory tool definition.**
The inventory tools spread `...browseSchema`, which includes `pageSize: z.number().optional().default(25)`. If we replace the `pageSize` entry after the spread, the tool's own schema can supply `.default(10)`:

```typescript
// In browse_rental_inventory schema:
{
  ...browseSchema,
  pageSize: z.number().optional().default(10).describe("Results per page (default: 10 for inventory, max: 500)"),
  ...inventoryFieldSchema,
  categoryId: z.string().optional()...
}
```

This is the cleanest approach: the caller sees `10` as the default in the tool schema, Zod fills `10` when omitted, and `buildBrowseRequest` receives `pageSize: 10` naturally. No handler logic change needed for this requirement.

**Option B: Override in the handler body** using a manual check against the Zod-filled default value. This is fragile (hardcodes `25` as magic number to detect).

**Recommended: Option A** — override the pageSize Zod default in the tool schema.

### Pattern 2: Default Field Set (FSEL-03)

**What:** When neither `fields` nor `fieldPreset` is in `args`, apply `resolveFieldPreset("summary", entityType)` as the default. When either is supplied, use the caller's choice.

```typescript
// Resolve which fields to project
const resolvedFields =
  args.fields ??
  resolveFieldPreset(args.fieldPreset ?? "summary", "rentalInventory");
// resolvedFields is string[] | undefined
// undefined means "full" — no projection
```

**Then pass to formatBrowseResult:**
```typescript
return {
  content: [{
    type: "text",
    text: formatBrowseResult(data as any, resolvedFields ? { fields: resolvedFields } : undefined),
  }],
};
```

**Note on Zod defaults for fields/fieldPreset:** `inventoryFieldSchema.fields` is `.optional()` with no `.default()`, so `args.fields` will be `undefined` when omitted. Same for `fieldPreset`. The `??` operator is safe here. [VERIFIED: src/utils/browse-helpers.ts inventoryFieldSchema]

### Pattern 3: withClientSideFallback Wiring + CFLT-03 Metadata

**What:** Replace the direct `client.post(...)` call with `withClientSideFallback(...)`. Then detect whether the fallback fired to generate corrected metadata.

The challenge for CFLT-03: `withClientSideFallback` returns a normal `BrowseResponse` — it does not expose a "did I fall back?" flag. However, when it falls back and filters, it sets `TotalRows = filteredRows.length`. The unfiltered total is lost.

**The correct solution:** Capture the unfiltered total from the retry response before filtering is applied. This requires a small extension to `withClientSideFallback`, OR the handler can use a wrapper that tracks fallback state.

**Cleanest approach for the handler:** extend `withClientSideFallback` to return a discriminated result that includes `clientFiltered: boolean` and `unfilteredTotal: number`. This is a non-breaking change (the existing signature can remain; add an overload or a new function).

**Alternate (no utility change required):** The handler calls the API directly using the same logic inline. But this duplicates the fallback logic and is worse.

**Recommended:** Add a thin result wrapper to `withClientSideFallback` — return `{ response: BrowseResponse, clientFiltered: boolean, unfilteredTotal: number }`. Existing callers in tests use the returned BrowseResponse directly, so this is a breaking change to the function signature. The alternative is a new exported function `withClientSideFallbackTracked` that returns the enriched result.

Given the STATE.md decision that "withClientSideFallback is a separate inner wrapper from withErrorHandling — do not collapse them", the cleanest path is a **new function** `withClientSideFallbackTracked` or a **result shape extension**. The Phase 8 summary notes that browse-helpers.ts has zero MCP SDK dependency — that must remain true.

**Concrete design:**
```typescript
// New export from browse-helpers.ts:
export type ClientSideFallbackResult<T extends Record<string, unknown>> = {
  response: BrowseResponse<T>;
  clientFiltered: boolean;
  unfilteredTotal: number;
};

export async function withClientSideFallbackTracked<T>(...): Promise<ClientSideFallbackResult<T>>
```

The handler then uses `clientFiltered` and `unfilteredTotal` to emit the corrected metadata line:
```typescript
// In handler, after wiring:
const { response: data, clientFiltered, unfilteredTotal } = await withClientSideFallbackTracked(...);

const baseText = formatBrowseResult(data as any, resolvedFields ? { fields: resolvedFields } : undefined);
const metadataLine = clientFiltered
  ? `\nShowing ${data.Rows.length} of ${unfilteredTotal} (client-filtered)`
  : "";
return { content: [{ type: "text", text: baseText + metadataLine }] };
```

**Success Criterion 3** requires the text: `"Showing X of Y (client-filtered)"`. This must appear in the response. [VERIFIED: ROADMAP.md Phase 9 success criteria]

### Pattern 4: withErrorHandling Wrapper Position

`withClientSideFallbackTracked` handles "Invalid column name" errors internally (by retrying). `withErrorHandling` handles all other errors. The wrapping order from STATE.md: `withClientSideFallback` is the inner wrapper; `withErrorHandling` is the outer wrapper.

The current handler does not use `withErrorHandling` either — it is exposed directly in the `server.tool()` callback. Looking at inventory.ts, none of the handlers currently use `withErrorHandling`. This is pre-existing. Phase 9 should maintain this existing pattern and not introduce `withErrorHandling` unless it was already there.

[VERIFIED: src/tools/inventory.ts read — no withErrorHandling calls in inventory.ts]

### Recommended Project Structure (no change needed)

All files already exist in the correct locations:
```
src/
├── tools/inventory.ts           -- modify browse_rental_inventory and browse_items handlers only
├── utils/browse-helpers.ts      -- add withClientSideFallbackTracked export
├── utils/tool-helpers.ts        -- no changes needed
└── __tests__/unit/
    ├── browse-helpers.test.ts   -- add tests for withClientSideFallbackTracked
    └── inventory-browse.test.ts -- NEW: unit tests for handler behavior
```

### Anti-Patterns to Avoid

- **Modifying browseSchema in tool-helpers.ts:** browseSchema is shared by all 114 tools. Adding pageSize defaults or field params there pollutes every tool. [LOCKED: STATE.md decision]
- **Collapsing withClientSideFallback into withErrorHandling:** Keep them separate. [LOCKED: STATE.md decision]
- **Touching CRUD handlers:** `get_rental_inventory`, `create_rental_inventory`, `update_rental_inventory`, `delete_rental_inventory`, `get_item_by_barcode` must remain byte-for-byte identical. Success Criterion 4 explicitly verifies this.
- **Touching other browse tools:** `browse_sales_inventory`, `browse_parts_inventory`, `browse_physical_inventory` must not change — they use `browseSchema` directly with no `inventoryFieldSchema` spread.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Client-side filtering with fallback | Custom retry logic in handler | `withClientSideFallbackTracked` (extend existing) | Already handles "Invalid column name" detection, request stripping, and applyClientFilter — duplication creates drift risk |
| Field projection | Manual field picking in handler | `resolveFieldPreset` + `projectFields` via `formatBrowseResult(data, { fields })` | Already handles empty fields passthrough, preset resolution, and row mutation avoidance |
| Page size default | Conditional logic in handler | Zod `.default(10)` override in tool schema | Zod fills the value before handler runs — schema is the right layer |

---

## Common Pitfalls

### Pitfall 1: Zod Default Fills args.pageSize Before Handler Runs
**What goes wrong:** Handler checks `args.pageSize ?? 10` but `args.pageSize` is already `25` (Zod filled it), so the inventory default never takes effect.
**Why it happens:** `browseSchema.pageSize` uses `.default(25)`, which runs at parse time before the handler is invoked.
**How to avoid:** Override the `pageSize` field in the inventory tool's schema definition by shadowing it after the spread: `{ ...browseSchema, pageSize: z.number().optional().default(10), ...inventoryFieldSchema }`.
**Warning signs:** Page size is always 25 in requests even when no pageSize was specified by the caller.

### Pitfall 2: CFLT-03 Metadata Uses Wrong Total
**What goes wrong:** After fallback, `data.TotalRows` is already the filtered count (set by `withClientSideFallback`). If the handler emits "Showing X of Y (client-filtered)" using `data.TotalRows` as Y, both numbers will be the same, producing "Showing 3 of 3 (client-filtered)" — which is misleading.
**Why it happens:** `withClientSideFallback` mutates TotalRows to filtered count before returning; the pre-filter total is not preserved in the current return value.
**How to avoid:** Use `withClientSideFallbackTracked` which returns `unfilteredTotal` separately before it is overwritten.
**Warning signs:** X and Y values are always equal in the "(client-filtered)" metadata line.

### Pitfall 3: fields Resolution Order
**What goes wrong:** If `args.fieldPreset === "full"`, `resolveFieldPreset` returns `undefined` (meaning "no projection"). But if the handler logic is `args.fields ?? resolveFieldPreset(args.fieldPreset ?? "summary", ...)`, an explicit `fieldPreset: "full"` will cause the fallback to `"summary"` to NOT happen — correct. But an explicit `fieldPreset: "summary"` with `args.fields` also set would have `args.fields` take precedence, silently ignoring the preset. This is acceptable behavior (explicit fields win over preset) but should be documented.
**How to avoid:** Resolution order: `args.fields` first (explicit wins), then `args.fieldPreset` if provided, then default to `"summary"`.

### Pitfall 4: browse_items entityType
**What goes wrong:** Using `"rentalInventory"` as the entityType argument to `resolveFieldPreset` in the `browse_items` handler returns `RENTAL_INVENTORY_BRIEF_FIELDS` instead of `ITEMS_BRIEF_FIELDS`.
**How to avoid:** `browse_items` must use `resolveFieldPreset(..., "items")`. `browse_rental_inventory` uses `"rentalInventory"`.
**Warning signs:** browse_items returns `InventoryId` field instead of `ItemId`/`BarCode` fields in the default set.

### Pitfall 5: Tool Count Test Will Not Break
**What goes wrong:** The `tool-registration.test.ts` asserts `tools.length === 115`. This phase does not add or remove tools, so this test is safe. However, if schema changes cause `server.tool()` to throw during registration, the count will drop.
**How to avoid:** Run `npm run test:unit` after schema changes to catch registration failures early.

---

## Code Examples

### Example 1: Correct Field Resolution Logic

[VERIFIED: src/utils/browse-helpers.ts — resolveFieldPreset signature and behavior]

```typescript
// In browse_rental_inventory handler:
const resolvedFields: string[] | undefined =
  args.fields ??
  resolveFieldPreset(args.fieldPreset ?? "summary", "rentalInventory");
// resolvedFields is undefined only when fieldPreset === "full"
```

### Example 2: withClientSideFallbackTracked Signature

[ASSUMED — new function to add to browse-helpers.ts based on existing withClientSideFallback pattern]

```typescript
export type ClientSideFallbackResult<T extends Record<string, unknown> = Record<string, unknown>> = {
  response: BrowseResponse<T>;
  clientFiltered: boolean;
  unfilteredTotal: number;
};

export async function withClientSideFallbackTracked<
  T extends Record<string, unknown> = Record<string, unknown>
>(
  fetchFn: (request: Record<string, unknown>) => Promise<BrowseResponse<T>>,
  request: Record<string, unknown>,
  searchField?: string,
  searchValue?: string,
  searchOperator?: string
): Promise<ClientSideFallbackResult<T>>
```

### Example 3: browse_rental_inventory Handler After Wiring

[ASSUMED — derived from existing pattern in inventory.ts and browse-helpers.ts]

```typescript
async (args) => {
  const client = getClient();
  const request = buildBrowseRequest(args); // args.pageSize is now 10 (Zod default)

  const { response: data, clientFiltered, unfilteredTotal } =
    await withClientSideFallbackTracked(
      (req) => client.post("/api/v1/rentalinventory/browse", req) as Promise<BrowseResponse>,
      request,
      args.searchField,
      args.searchValue,
      args.searchOperator
    );

  const resolvedFields: string[] | undefined =
    args.fields ?? resolveFieldPreset(args.fieldPreset ?? "summary", "rentalInventory");

  const baseText = formatBrowseResult(data as any, resolvedFields ? { fields: resolvedFields } : undefined);
  const suffix = clientFiltered
    ? `\nShowing ${data.Rows.length} of ${unfilteredTotal} (client-filtered)`
    : "";

  return { content: [{ type: "text", text: baseText + suffix }] };
}
```

### Example 4: pageSize Schema Override

[VERIFIED: existing browseSchema pattern; override technique is standard TypeScript object spread]

```typescript
server.tool(
  "browse_rental_inventory",
  "...",
  {
    ...browseSchema,
    pageSize: z
      .number()
      .optional()
      .default(10)
      .describe("Results per page (default: 10, max: 500)"),
    ...inventoryFieldSchema,
    categoryId: z.string().optional().describe("Filter by rental category ID"),
  },
  async (args) => { ... }
);
```

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.1.0 |
| Config file | vitest.config.ts (projects: unit, integration) |
| Quick run command | `npm run test:unit` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ROPT-01 | Default page size is 10 for inventory browse | unit | `npm run test:unit` | ❌ Wave 0 (new file needed) |
| FSEL-03 | No fields/fieldPreset arg returns BRIEF_FIELDS rows | unit | `npm run test:unit` | ❌ Wave 0 |
| CFLT-03 | Client-filtered response includes "Showing X of Y (client-filtered)" | unit | `npm run test:unit` | ❌ Wave 0 |
| SC-4 | CRUD tools unchanged — existing CRUD unit tests still pass | unit | `npm run test:unit` | ✅ (existing tests in api-paths.test.ts etc.) |
| withClientSideFallbackTracked | New function returns clientFiltered flag and unfilteredTotal | unit | `npm run test:unit` | ❌ Wave 0 (add to browse-helpers.test.ts) |

### Sampling Rate
- **Per task commit:** `npm run test:unit`
- **Per wave merge:** `npm test`
- **Phase gate:** Full unit suite green (264+ tests) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/__tests__/unit/inventory-browse.test.ts` — covers ROPT-01, FSEL-03, CFLT-03 handler behavior with mock client
- [ ] `withClientSideFallbackTracked` tests — add to existing `browse-helpers.test.ts` (extends Test 10-13 pattern)

---

## Security Domain

This phase has no new trust boundaries, authentication changes, or external inputs beyond what already exists. Field projection operates only on data already returned from the authenticated API. No ASVS categories are newly applicable. [ASSUMED — no new user-controlled inputs reach the security boundary; existing browseSchema validation remains unchanged]

---

## Environment Availability

Step 2.6: SKIPPED — this is a pure code wiring phase. No new external tools, services, or CLIs are required. The only runtime dependency (RentalWorks API) is unchanged and already in use.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Extending withClientSideFallback with a new tracked variant (rather than modifying the existing function signature) is the right approach | Architecture Patterns — Pattern 3 | Low risk: if the existing function is modified instead, test updates are needed but behavior is identical |
| A2 | browse_rental_inventory and browse_items handlers do not currently use withErrorHandling, so Phase 9 should not add it | Architecture Patterns — Pattern 4 | Low risk: adding it would be an improvement but is out of scope |
| A3 | The "(client-filtered)" suffix should be appended after the formatBrowseResult output (not embedded inside it) | Architecture Patterns — Pattern 3 | Medium risk: if success criterion wording requires it inside the results header line, the implementation changes slightly — verify against SC-3 wording |

---

## Open Questions

1. **withClientSideFallbackTracked vs modifying withClientSideFallback**
   - What we know: Existing function returns `BrowseResponse<T>` only; callers (tests) depend on that shape
   - What's unclear: Whether the plan should modify the existing function (breaking change to tests) or add a new one
   - Recommendation: Add `withClientSideFallbackTracked` as a new export. Zero test churn on the existing 4 tests (Test 10-13) that cover the existing function.

2. **Exact position of "(client-filtered)" metadata line**
   - What we know: Success Criterion 3 says: `"Showing X of Y (client-filtered)"` where X is filtered count, Y is unfiltered API total
   - What's unclear: Should it be a separate line appended to the output, or should it replace/augment the header line from `formatBrowseResult`?
   - Recommendation: Append as a separate trailing line after `formatBrowseResult` output. This is the least invasive change (no modification to formatBrowseResult needed).

---

## Sources

### Primary (HIGH confidence)
- `src/utils/browse-helpers.ts` — read directly; verified all exports, function signatures, and constants
- `src/utils/tool-helpers.ts` — read directly; verified browseSchema.pageSize default, formatBrowseResult signature
- `src/tools/inventory.ts` — read directly; verified current handler shapes for both browse tools and all CRUD tools
- `src/__tests__/unit/browse-helpers.test.ts` — read directly; verified test coverage (Tests 10-13 for withClientSideFallback)
- `src/__tests__/unit/tool-helpers.test.ts` — read directly; verified existing formatBrowseResult test coverage
- `src/__tests__/unit/tool-registration.test.ts` — read directly; verified tool count assertion (115 tools)
- `.planning/ROADMAP.md` — read directly; verified Phase 9 success criteria verbatim
- `.planning/STATE.md` — read directly; verified locked architectural decisions
- `vitest.config.ts` — read directly; verified test project configuration
- `package.json` — read directly; verified test scripts and dependency versions
- `npm run test:unit` — executed; confirmed 264 tests pass, 13 test files

### Secondary (MEDIUM confidence)
- None required — all relevant information was in the codebase directly

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all existing
- Architecture: HIGH — all building blocks read directly from source; wiring patterns are straightforward TypeScript
- Pitfalls: HIGH — Zod default filling behavior and TotalRows overwrite are verified against actual source code

**Research date:** 2026-04-11
**Valid until:** 2026-05-11 (stable codebase; no fast-moving dependencies)
