<!-- GSD:project-start source:PROJECT.md -->
## Project

**RentalWorks MCP Server — Production Readiness**

An MCP server wrapping the RentalWorks rental management platform API. Currently exposes ~114 tools across 11 domains (inventory, orders, customers, contracts, billing, vendors, reports, settings, admin, storefront, utilities). Needs validation against the live Swagger spec, expanded coverage for missing high-value endpoints, comprehensive testing including integration tests against the live instance, and bug fixes to be production-ready.

**Core Value:** Every MCP tool must call the correct API endpoint with the correct method, path, and request body — verified by tests and validated against the live Swagger spec.

### Constraints

- **Read-only integration tests**: Live API tests must not create, update, or delete any data
- **Tech stack**: TypeScript, MCP SDK, Vitest, Zod — no additional frameworks
- **API compatibility**: Must match the exact paths/methods from the Swagger spec — RW API is not REST-conventional in many places
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript 5.7.0 - All source code, type-safe implementation
- JavaScript (Node.js module output) - Compiled runtime
## Runtime
- Node.js 16+ (specified in `tsconfig.json` via `module: "Node16"` and `moduleResolution: "Node16"`)
- npm (Node Package Manager)
- Lockfile: `package-lock.json` present (v3 format)
## Frameworks
- Model Context Protocol (MCP) SDK `@modelcontextprotocol/sdk` ^1.12.1 - Server framework for MCP protocol implementation
- Zod ^3.x (transitive via MCP SDK) - Schema validation and input/output type definitions
- TypeScript 5.7.0 - Compiler with strict mode enabled
- tsx ^4.19.0 - TypeScript executor for development with watch mode (`npm run dev`)
- Vitest ^3.1.0 - Test runner and framework
## Key Dependencies
- `@modelcontextprotocol/sdk` ^1.12.1 - Entire server implementation depends on this. Provides MCP protocol handling, tool registration, server startup, and stdio transport.
- `@types/node` ^22.0.0 - TypeScript definitions for Node.js APIs (fetch, process, etc.)
- `tsx` ^4.19.0 - TypeScript execution and watch mode in development
- `vitest` ^3.1.0 - Unit test framework for validating tool definitions and API paths
- TypeScript compiler support (`typescript` ^5.7.0)
## Configuration
- `RENTALWORKS_BASE_URL` - API base URL (required, e.g., `https://<your-instance>.rentalworks.cloud`)
- `RENTALWORKS_USERNAME` - API username (required for JWT authentication)
- `RENTALWORKS_PASSWORD` - API password (required for JWT authentication)
- `tsconfig.json` - TypeScript compiler options
- `vitest.config.ts` - Test runner configuration
- `dist/` directory - Compiled JavaScript, declarations, and source maps
- Entrypoint: `dist/index.js` (specified in `package.json` main field)
## Build & Development Commands
## Platform Requirements
- Node.js 16 or higher (ESM module support required)
- npm package manager
- TypeScript 5.7.0+
- Node.js 16 or higher
- RentalWorks cloud instance with API access
- Valid JWT credentials (username/password)
- Anthropic Claude integration as MCP server
- Communicates via stdio transport protocol
- Stateless: JWT token managed internally with 4-hour expiry and auto-refresh at 3.5 hours
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- Tool domain files: `{domain}.ts` (e.g., `inventory.ts`, `orders.ts`)
- Utility files: descriptive kebab-case (e.g., `tool-helpers.ts`, `api-client.ts`)
- Type definitions: `api.ts` for all RentalWorks API types
- Test files: `*.test.ts` in `__tests__/` directory (e.g., `api-paths.test.ts`)
- Tool registration functions: `register{Domain}Tools` (e.g., `registerInventoryTools`, `registerOrderTools`)
- Async handler functions: camelCase (e.g., `buildBrowseRequest`, `formatBrowseResult`)
- Private methods: camelCase with leading underscore in classes (e.g., `_ensureAuth`, `_tokenExpiry`)
- Tool handler functions: typically async, no prefix (e.g., `async ({ orderId }) => { ... }`)
- Parameters matching RentalWorks API fields: PascalCase (e.g., `InventoryId`, `OrderId`, `Description`)
- Internal handler parameters: camelCase (e.g., `orderId`, `customerId`, `searchValue`)
- Constants: UPPER_SNAKE_CASE for module-level constants (e.g., `JWT_RESPONSE`, `BASE_URL`)
- Object keys in requests: PascalCase to match API convention (e.g., `{ OrderId: "...", LocationId: "..." }`)
- Interfaces: PascalCase (e.g., `RentalInventory`, `BrowseRequest`, `JwtResponse`)
- Zod schemas: camelCase with `Schema` suffix (e.g., `browseSchema`) or inline (e.g., `z.string()`)
- Type aliases: PascalCase (e.g., `HttpMethod`)
## Code Style
- TypeScript with strict mode enabled
- Target ES2022
- Module resolution: Node16
- Tab width: inferred from use (appears to be 2 spaces)
- No explicit formatter config found (no .prettierrc or eslint config)
- No linting config detected (no .eslintrc or biome.json)
- TypeScript strict mode enabled in `tsconfig.json` enforces type safety
- 2-space indentation (observed throughout codebase)
- Single blank line between method/function definitions
- Double blank lines around major sections (marked with ASCII separators like `── `)
## Import Organization
- No path aliases configured
- Relative imports use `../` pattern consistently
- All imports include `.js` file extension (required for ES modules)
## Error Handling
- Errors thrown from API client (`api-client.ts`) are caught in higher-level handlers
- Error handler wrapper function `withErrorHandling()` catches errors and returns user-friendly messages
- Specific error detection: check for known patterns like "Invalid column name", "503", "500 NullReference"
- Return error response with `isError: true` flag for tools that need to signal errors to user
- Authentication errors from JWT endpoint throw immediately (fail-fast)
- Network errors from failed API requests include method, path, and status in error message
## Logging
- Warnings about missing env vars logged to stderr: `console.error("Warning: RENTALWORKS_USERNAME and RENTALWORKS_PASSWORD env vars not set")`
- Server startup confirmation: `console.error("RentalWorks MCP server running on stdio")`
- Fatal errors logged before process.exit: `console.error("Fatal error:", error)`
- No structured logging or log levels (debug/info/warn) implemented
## Comments
- JSDoc/block comments for exported functions and classes (required)
- Inline comments for complex logic or non-obvious decisions
- Section separators for organizing tool registrations within a domain
- Function documentation above signature: `/** Description here */`
- Parameter descriptions in JSDoc: not consistently used (parameters documented in Zod schema descriptions instead)
- Return type documentation: generally implicit from return statement
- Domain overviews: each tool file starts with JSDoc block listing covered API domains
## Function Design
- Destructuring used for named parameters: `async ({ orderId, customerId }) => { ... }`
- Spread operator used to extract remaining fields: `async ({ InventoryId, ...updates }) => { ... }`
- Complex parameter objects typed with Zod schemas
- MCP tool handlers return: `{ content: [{ type: "text", text: string }], isError?: boolean }`
- API client methods return generic `<T = unknown>` for flexibility
- Helper functions return formatted strings or objects ready for display
- Null/empty responses handled gracefully (API client returns `{}` if response text is empty)
## Module Design
- Each tool domain exports single function: `export function register{Domain}Tools(server: McpServer)`
- Utilities export multiple named exports: `export function buildBrowseRequest(...)`
- Singleton pattern for API client: `export function getClient(): RentalWorksClient` and `export function resetClient(): void`
- No barrel files (index.ts) for re-exporting
- `src/index.ts` serves as server entry point, not module barrel
- Direct imports from specific files required
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- Single-responsibility MCP server with modular tool registration
- JWT-based authentication with automatic token refresh
- Domain-grouped tool organization (11 domains across 114 tools)
- Standardized error handling for known RentalWorks API issues
- Zero external dependencies beyond @modelcontextprotocol/sdk
## Layers
- Purpose: Initialize and start the MCP server
- Location: `src/index.ts`
- Contains: Server instantiation, transport setup, tool registration bootstrapping
- Depends on: All tool registration modules
- Used by: Node.js runtime via `npm start`
- Purpose: Define MCP tools grouped by business domain
- Location: `src/tools/*.ts` (11 files, one per domain)
- Contains: Tool definitions, input schemas (via Zod), tool handlers
- Depends on: API client, tool helpers
- Used by: MCP server to expose 114 tools
- Purpose: Handle authentication and HTTP communication with RentalWorks REST API
- Location: `src/utils/api-client.ts`
- Contains: JWT authentication, token caching, HTTP methods (GET/POST/PUT/DELETE), browse/CRUD helpers
- Depends on: Type definitions, environment variables
- Used by: All tool handlers
- Purpose: Shared formatting, validation, and error handling
- Location: `src/utils/tool-helpers.ts`
- Contains: Common Zod schemas, browse request builders, result formatters, error handling wrapper
- Depends on: Zod, API types
- Used by: All tool registration modules
- Purpose: TypeScript interfaces for API requests/responses
- Location: `src/types/api.ts`
- Contains: JWT authentication types, browse request/response interfaces, business entity types (RentalInventory, Order, Customer, etc.)
- Depends on: None
- Used by: API client, tool registration
## Data Flow
- Client maintains singleton instance (getClient()) with cached JWT token
- Token refresh happens automatically before expiry (3.5 hour TTL)
- No persisted state; session is per-server-lifetime
## Key Abstractions
- Purpose: Encapsulate authentication and API communication
- Examples: `src/utils/api-client.ts`
- Pattern: Singleton with token caching, generic request/browse/CRUD methods
- Hides: JWT refresh logic, URL construction, header management
- Purpose: Group related tools by business domain
- Examples: `registerInventoryTools()`, `registerOrderTools()`, etc.
- Pattern: Each function receives McpServer and calls server.tool() for each tool
- Hides: Server initialization details from individual tools
- Purpose: Validate and document tool parameters
- Examples: `browseSchema` (shared across most tools), domain-specific schemas
- Pattern: Reusable schema objects composed into tool-specific schemas
- Hides: Runtime validation, default values
- Purpose: Catch API errors and translate to LLM-friendly messages
- Example: `withErrorHandling()` function
- Pattern: Higher-order function that detects known RentalWorks issues
- Hides: Raw HTTP errors; detects "Invalid column name", "503", "NullReference"
## Entry Points
- Location: `src/index.ts`
- Triggers: `npm start` or `node dist/index.js`
- Responsibilities:
- Pattern: 114 individual tool handlers, each is async function
- Invoked by: MCP server when client requests specific tool
- Execution: Validate input → call API client → format result → return
## Error Handling
- **Network/Auth Errors:** Caught by withErrorHandling() wrapper, user-friendly message returned
- **RentalWorks Known Issues:** 
- **Validation Errors:** Caught by Zod schemas before API call, returns structured error
- **Empty Responses:** Handled gracefully in API client (returns {} when response body is empty)
## Cross-Cutting Concerns
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
