# Coding Conventions

**Analysis Date:** 2026-04-09

## Naming Patterns

**Files:**
- Tool domain files: `{domain}.ts` (e.g., `inventory.ts`, `orders.ts`)
- Utility files: descriptive kebab-case (e.g., `tool-helpers.ts`, `api-client.ts`)
- Type definitions: `api.ts` for all RentalWorks API types
- Test files: `*.test.ts` in `__tests__/` directory (e.g., `api-paths.test.ts`)

**Functions:**
- Tool registration functions: `register{Domain}Tools` (e.g., `registerInventoryTools`, `registerOrderTools`)
- Async handler functions: camelCase (e.g., `buildBrowseRequest`, `formatBrowseResult`)
- Private methods: camelCase with leading underscore in classes (e.g., `_ensureAuth`, `_tokenExpiry`)
- Tool handler functions: typically async, no prefix (e.g., `async ({ orderId }) => { ... }`)

**Variables:**
- Parameters matching RentalWorks API fields: PascalCase (e.g., `InventoryId`, `OrderId`, `Description`)
- Internal handler parameters: camelCase (e.g., `orderId`, `customerId`, `searchValue`)
- Constants: UPPER_SNAKE_CASE for module-level constants (e.g., `JWT_RESPONSE`, `BASE_URL`)
- Object keys in requests: PascalCase to match API convention (e.g., `{ OrderId: "...", LocationId: "..." }`)

**Types:**
- Interfaces: PascalCase (e.g., `RentalInventory`, `BrowseRequest`, `JwtResponse`)
- Zod schemas: camelCase with `Schema` suffix (e.g., `browseSchema`) or inline (e.g., `z.string()`)
- Type aliases: PascalCase (e.g., `HttpMethod`)

## Code Style

**Formatting:**
- TypeScript with strict mode enabled
- Target ES2022
- Module resolution: Node16
- Tab width: inferred from use (appears to be 2 spaces)
- No explicit formatter config found (no .prettierrc or eslint config)

**Linting:**
- No linting config detected (no .eslintrc or biome.json)
- TypeScript strict mode enabled in `tsconfig.json` enforces type safety

**Indentation & Spacing:**
- 2-space indentation (observed throughout codebase)
- Single blank line between method/function definitions
- Double blank lines around major sections (marked with ASCII separators like `── `)

## Import Organization

**Order:**
1. External SDK imports (e.g., `@modelcontextprotocol/sdk`)
2. Type imports from local modules (e.g., `import type { ... } from "../types/api.js"`)
3. Utility/helper imports from local modules (e.g., `import { getClient } from "../utils/api-client.js"`)
4. Named exports from the same module

**Path Aliases:**
- No path aliases configured
- Relative imports use `../` pattern consistently
- All imports include `.js` file extension (required for ES modules)

**Example:**
```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient } from "../utils/api-client.js";
import {
  browseSchema,
  buildBrowseRequest,
  formatBrowseResult,
} from "../utils/tool-helpers.js";
```

## Error Handling

**Patterns:**
- Errors thrown from API client (`api-client.ts`) are caught in higher-level handlers
- Error handler wrapper function `withErrorHandling()` catches errors and returns user-friendly messages
- Specific error detection: check for known patterns like "Invalid column name", "503", "500 NullReference"
- Return error response with `isError: true` flag for tools that need to signal errors to user
- Authentication errors from JWT endpoint throw immediately (fail-fast)
- Network errors from failed API requests include method, path, and status in error message

**Example:**
```typescript
export function withErrorHandling(
  handler: (...handlerArgs: unknown[]) => Promise<ToolResult>
): (...handlerArgs: unknown[]) => Promise<ToolResult> {
  return async (...handlerArgs: unknown[]) => {
    try {
      return await handler(...handlerArgs);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Handle specific RentalWorks server-side issues
      if (message.includes("Invalid column name")) {
        // Return user-friendly error
      }
      return {
        content: [{ type: "text" as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  };
}
```

## Logging

**Framework:** `console.error()` for important messages (e.g., startup warnings, fatal errors)

**Patterns:**
- Warnings about missing env vars logged to stderr: `console.error("Warning: RENTALWORKS_USERNAME and RENTALWORKS_PASSWORD env vars not set")`
- Server startup confirmation: `console.error("RentalWorks MCP server running on stdio")`
- Fatal errors logged before process.exit: `console.error("Fatal error:", error)`
- No structured logging or log levels (debug/info/warn) implemented

## Comments

**When to Comment:**
- JSDoc/block comments for exported functions and classes (required)
- Inline comments for complex logic or non-obvious decisions
- Section separators for organizing tool registrations within a domain

**JSDoc/TSDoc:**
- Function documentation above signature: `/** Description here */`
- Parameter descriptions in JSDoc: not consistently used (parameters documented in Zod schema descriptions instead)
- Return type documentation: generally implicit from return statement
- Domain overviews: each tool file starts with JSDoc block listing covered API domains

**Example:**
```typescript
/**
 * RentalWorks API client with JWT authentication
 */
export class RentalWorksClient { ... }

/**
 * Authenticate and get a JWT token
 */
async authenticate(): Promise<JwtResponse> { ... }

// ── Browse Rental Inventory ─────────────────────────────────────────────
// (ASCII separator for visual section breaks)
```

## Function Design

**Size:** Functions are kept small and focused. Tool handlers are typically 2-15 lines (delegate complex logic to helpers).

**Parameters:** 
- Destructuring used for named parameters: `async ({ orderId, customerId }) => { ... }`
- Spread operator used to extract remaining fields: `async ({ InventoryId, ...updates }) => { ... }`
- Complex parameter objects typed with Zod schemas

**Return Values:**
- MCP tool handlers return: `{ content: [{ type: "text", text: string }], isError?: boolean }`
- API client methods return generic `<T = unknown>` for flexibility
- Helper functions return formatted strings or objects ready for display
- Null/empty responses handled gracefully (API client returns `{}` if response text is empty)

## Module Design

**Exports:**
- Each tool domain exports single function: `export function register{Domain}Tools(server: McpServer)`
- Utilities export multiple named exports: `export function buildBrowseRequest(...)`
- Singleton pattern for API client: `export function getClient(): RentalWorksClient` and `export function resetClient(): void`

**Barrel Files:**
- No barrel files (index.ts) for re-exporting
- `src/index.ts` serves as server entry point, not module barrel
- Direct imports from specific files required

**Tool Registration Pattern:**
All tool domains follow identical registration pattern:
```typescript
export function register{Domain}Tools(server: McpServer) {
  // ── {Feature Name} ────────────────────
  server.tool(
    "tool_name",
    "Tool description",
    { zod schema },
    async (args) => {
      const client = getClient();
      const data = await client.{method}(...);
      return { content: [{ type: "text", text: formatEntity(data) }] };
    }
  );
}
```

---

*Convention analysis: 2026-04-09*
