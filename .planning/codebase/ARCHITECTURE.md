# Architecture

**Analysis Date:** 2026-04-09

## Pattern Overview

**Overall:** Model Context Protocol (MCP) Server - Adapter/Facade pattern

The codebase implements an MCP server that wraps the RentalWorks REST API. It acts as an intermediary that translates MCP tool requests into authenticated RentalWorks API calls, handling authentication, pagination, error handling, and result formatting for LLM consumption.

**Key Characteristics:**
- Single-responsibility MCP server with modular tool registration
- JWT-based authentication with automatic token refresh
- Domain-grouped tool organization (11 domains across 114 tools)
- Standardized error handling for known RentalWorks API issues
- Zero external dependencies beyond @modelcontextprotocol/sdk

## Layers

**Entry Point Layer:**
- Purpose: Initialize and start the MCP server
- Location: `src/index.ts`
- Contains: Server instantiation, transport setup, tool registration bootstrapping
- Depends on: All tool registration modules
- Used by: Node.js runtime via `npm start`

**Tool Registration Layer:**
- Purpose: Define MCP tools grouped by business domain
- Location: `src/tools/*.ts` (11 files, one per domain)
- Contains: Tool definitions, input schemas (via Zod), tool handlers
- Depends on: API client, tool helpers
- Used by: MCP server to expose 114 tools

**API Client Layer:**
- Purpose: Handle authentication and HTTP communication with RentalWorks REST API
- Location: `src/utils/api-client.ts`
- Contains: JWT authentication, token caching, HTTP methods (GET/POST/PUT/DELETE), browse/CRUD helpers
- Depends on: Type definitions, environment variables
- Used by: All tool handlers

**Helper/Utility Layer:**
- Purpose: Shared formatting, validation, and error handling
- Location: `src/utils/tool-helpers.ts`
- Contains: Common Zod schemas, browse request builders, result formatters, error handling wrapper
- Depends on: Zod, API types
- Used by: All tool registration modules

**Type Definition Layer:**
- Purpose: TypeScript interfaces for API requests/responses
- Location: `src/types/api.ts`
- Contains: JWT authentication types, browse request/response interfaces, business entity types (RentalInventory, Order, Customer, etc.)
- Depends on: None
- Used by: API client, tool registration

## Data Flow

**Typical Tool Execution Flow:**

1. **MCP Client Request** → Tool invocation with arguments
2. **Tool Handler Entry** → Parse/validate input (Zod schema)
3. **API Client** → Authenticate if needed (JWT check + refresh)
4. **HTTP Request** → POST/GET/PUT/DELETE to RentalWorks API
5. **Response Handling** → Parse JSON, detect known errors
6. **Formatting** → Convert to text for LLM (formatBrowseResult or formatEntity)
7. **MCP Response** → Return { content: [{ type: "text", text: ... }] }

**Browse Flow (Most Common Pattern):**

1. Tool receives browse args (page, searchField, searchValue, orderBy, etc.)
2. buildBrowseRequest() transforms args into RentalWorks BrowseRequest structure
3. client.browse() calls POST /api/v1/{entity}/browse with request body
4. formatBrowseResult() converts response to paginated text summary
5. Returns table-like text with results count and field values

**State Management:**
- Client maintains singleton instance (getClient()) with cached JWT token
- Token refresh happens automatically before expiry (3.5 hour TTL)
- No persisted state; session is per-server-lifetime

## Key Abstractions

**RentalWorksClient:**
- Purpose: Encapsulate authentication and API communication
- Examples: `src/utils/api-client.ts`
- Pattern: Singleton with token caching, generic request/browse/CRUD methods
- Hides: JWT refresh logic, URL construction, header management

**Tool Registration Functions:**
- Purpose: Group related tools by business domain
- Examples: `registerInventoryTools()`, `registerOrderTools()`, etc.
- Pattern: Each function receives McpServer and calls server.tool() for each tool
- Hides: Server initialization details from individual tools

**Zod Input Schemas:**
- Purpose: Validate and document tool parameters
- Examples: `browseSchema` (shared across most tools), domain-specific schemas
- Pattern: Reusable schema objects composed into tool-specific schemas
- Hides: Runtime validation, default values

**Error Handling Wrapper:**
- Purpose: Catch API errors and translate to LLM-friendly messages
- Example: `withErrorHandling()` function
- Pattern: Higher-order function that detects known RentalWorks issues
- Hides: Raw HTTP errors; detects "Invalid column name", "503", "NullReference"

## Entry Points

**Main Server Entry:**
- Location: `src/index.ts`
- Triggers: `npm start` or `node dist/index.js`
- Responsibilities:
  - Instantiate McpServer with name/version
  - Register all 11 tool modules
  - Create stdio transport
  - Connect and run server
  - Handle fatal errors

**Tool Handler Entry Points:**
- Pattern: 114 individual tool handlers, each is async function
- Invoked by: MCP server when client requests specific tool
- Execution: Validate input → call API client → format result → return

## Error Handling

**Strategy:** Trap-and-translate approach with known RentalWorks issue detection

**Patterns:**

- **Network/Auth Errors:** Caught by withErrorHandling() wrapper, user-friendly message returned
- **RentalWorks Known Issues:** 
  - Invalid column name → detected from error message, explains schema mismatch
  - 503 Service Unavailable → explains module may be disabled
  - 500 NullReferenceException → suggests server configuration issue
- **Validation Errors:** Caught by Zod schemas before API call, returns structured error
- **Empty Responses:** Handled gracefully in API client (returns {} when response body is empty)

## Cross-Cutting Concerns

**Logging:** Console.error() only for fatal errors in main(). No structured logging or debug output.

**Validation:** All tool inputs validated via Zod schemas. Operator enums constrained (like, =, <>, >, >=, <, <=, startswith, endswith, contains).

**Authentication:** JWT bearer token, auto-refresh at 3.5 hour mark (before 4h expiry). Credentials from env vars (RENTALWORKS_USERNAME, RENTALWORKS_PASSWORD, RENTALWORKS_BASE_URL).

**Pagination:** Standardized browse pattern with page/pageSize (default 25, max 500). TotalRows/PageNo/TotalPages in response.

**Formatting:** Text-based output for all results (LLM consumption). No JSON blobs passed through; converted to readable format.

---

*Architecture analysis: 2026-04-09*
