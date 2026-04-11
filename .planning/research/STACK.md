# Stack Research

**Domain:** MCP server — client-side filtering, field projection, response optimization (v1.1)
**Researched:** 2026-04-11
**Confidence:** HIGH

## Summary

No new dependencies are needed for the v1.1 milestone. Client-side field projection, filtering, smarter defaults, and graceful fallback are all pure TypeScript utility work — array iteration, string matching, and object construction. The existing stack (TypeScript 5.7, Zod 4.3.6, Vitest 3.x) is fully sufficient. Adding any library for this work would violate the explicit project constraint ("no additional frameworks") and introduce maintenance overhead for problems already solved natively.

One important note: the installed version of Zod is **4.3.6** (confirmed from `node_modules`), but the previous STACK.md and CLAUDE.md referenced Zod 3.x. Zod 4's default `from "zod"` import is API-compatible with Zod 3 for all patterns used in this codebase — no migration needed.

---

## Recommended Stack

### Core Technologies (all already installed — no additions)

| Technology | Installed Version | Purpose for v1.1 | Why Sufficient |
|------------|-------------------|-----------------|----------------|
| TypeScript | 5.7.0 | Field projection and filter logic | `Object.fromEntries` (ES2019) + array methods are typed and fast; tsconfig targets ES2022 which includes these |
| Zod | 4.3.6 | Schema for new `fields` parameter | `z.array(z.string()).optional()` adds field selection to any browse tool in one line |
| Vitest | ^3.1.0 | Unit-test projection/filter utilities | Pure synchronous functions need no mocks — `expect(projectFields(...)).toEqual(...)` works directly |
| `@modelcontextprotocol/sdk` | ^1.12.1 | Tool registration unchanged | Field projection/filtering happens before the `content` array is assembled; no SDK changes needed |

### Supporting Libraries

None. Every capability maps to native TypeScript:

| Capability | Native Implementation | Lines of Code |
|------------|-----------------------|---------------|
| Field projection | `Object.fromEntries(fields.map(f => [f, row[f]]))` | ~6 lines as a utility function |
| Client-side text filter | `String.prototype.includes`, `startsWith`, `endsWith`, equality | ~15 lines covering all existing `searchOperator` enum values |
| Smarter page size defaults | Change `.default(25)` to `.default(10)` in `browseSchema` for inventory tools | 1-line change |
| Graceful 500 fallback | Extend `withErrorHandling` try/catch to retry without offending filter param | ~15 lines new branch in existing pattern |

---

## Implementation Patterns

### Field Projection

Add `fields` to `browseSchema` using already-installed Zod:

```typescript
// In tool-helpers.ts — add to browseSchema
fields: z
  .array(z.string())
  .optional()
  .describe("Specific fields to return (e.g. ['ICode', 'Description', 'DailyRate']). Omit for all fields."),
```

Apply after API response:

```typescript
// In tool-helpers.ts — new utility function
export function projectFields(
  rows: Record<string, unknown>[],
  fields?: string[]
): Record<string, unknown>[] {
  if (!fields || fields.length === 0) return rows;
  return rows.map(row =>
    Object.fromEntries(fields.map(f => [f, row[f]]))
  );
}
```

### Client-Side Search/Filter

Handles the broken `masterid`/`rentalitemid` DB column bugs by bypassing server-side search:

```typescript
// In tool-helpers.ts — new utility function
export function filterRows(
  rows: Record<string, unknown>[],
  field: string,
  value: string,
  operator = "like"
): Record<string, unknown>[] {
  const lower = value.toLowerCase();
  return rows.filter(row => {
    const cell = String(row[field] ?? "").toLowerCase();
    switch (operator) {
      case "like":       return cell.includes(lower);
      case "contains":   return cell.includes(lower);
      case "startswith": return cell.startsWith(lower);
      case "endswith":   return cell.endsWith(lower);
      case "=":          return cell === lower;
      case "<>":         return cell !== lower;
      default:           return cell.includes(lower);
    }
  });
}
```

Covers all values in the existing `searchOperator` enum in `browseSchema`.

### Graceful Fallback

Extend the existing `withErrorHandling` wrapper or write a specific `withClientSideFallback(handler, retryFn)` that catches the "Invalid column name" error (already detected) and calls a second fetch with the search params stripped, then applies `filterRows` locally. No new library — this is a control-flow addition to an existing pattern.

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| Native `Array.prototype.filter` | `lodash.filter` / `underscore` | Adds ~70KB dependency for 3 array operations; project constraint says no additional frameworks |
| Native `Object.fromEntries` | `lodash.pick` | Same reason; property picking is a two-liner natively |
| Native string methods | `minimatch` / `micromatch` (glob patterns) | RentalWorks field names are exact strings; no glob/wildcard matching needed |
| Zod `z.array(z.string())` | New schema library | Zod is already present in every tool file; adding another validator creates inconsistency |
| Extend `withErrorHandling` | A separate retry library | The retry behavior is specific to known RW 500 patterns, not general-purpose HTTP retry logic |

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `lodash` / `ramda` | Project constraint: "no additional frameworks"; overkill for flat-object manipulation | Native `Object.fromEntries`, `Array.prototype.filter` |
| `fuse.js` or fuzzy search | RentalWorks data is structured database records; fuzzy matching produces false positives that confuse AI agents | Exact and substring matching already defined in `searchOperator` enum |
| `json-query` / `jsonpath` | Gross over-engineering for selecting named fields from flat row objects | Direct property access via `row[fieldName]` |
| `p-retry` / `axios-retry` | The retry logic here is not general HTTP retry — it's a specific fallback that changes the request shape, not just retries it | Custom branch in `withErrorHandling` |
| `zod@^3.25.0` | CLAUDE.md references Zod 3, but Zod **4.3.6 is already installed and working**. Do not downgrade — all `z.*` calls used in this codebase are API-stable across both versions under the default import | Keep current 4.3.6 |

---

## Version Compatibility

| Package | Installed | Notes |
|---------|-----------|-------|
| `zod` | 4.3.6 | The default `from "zod"` import exposes the Zod 3-compatible API. `z.array()`, `z.string()`, `z.enum()`, `.optional()`, `.default()`, `.describe()` — all used in this codebase — are unchanged in Zod 4. No migration needed for v1.1. |
| `@modelcontextprotocol/sdk` | ^1.12.1 | Tool handler return shape `{ content: [{ type: "text", text: string }] }` is unchanged. Filtering/projection happens before this shape is assembled. |
| TypeScript | 5.7.0 | `Object.fromEntries` requires `lib: ES2019+`; tsconfig targets ES2022. Covered. |
| Vitest | ^3.1.0 | `projectFields` and `filterRows` are pure synchronous functions — no async, no mocks, no setup needed in tests. |

---

## Installation

```bash
# No new packages needed for v1.1.
# All capabilities are implemented with existing dependencies.
```

---

## Sources

- Codebase inspection: `package.json`, `src/utils/tool-helpers.ts`, `src/utils/api-client.ts`, `src/tools/inventory.ts` — HIGH confidence; first-party
- Zod 4.3.6 confirmed installed and functional: `node_modules/zod/package.json`, verified `z.array(z.string()).parse(...)` in local Node REPL
- Project constraint "no additional frameworks" in `CLAUDE.md` — HIGH confidence; explicit requirement
- `.planning/PROJECT.md` v1.1 milestone requirements — HIGH confidence; defines the exact four features

---
*Stack research for: RentalWorks MCP Server v1.1 — inventory browse fix features*
*Researched: 2026-04-11*
