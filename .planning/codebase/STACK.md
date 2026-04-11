# Technology Stack

**Analysis Date:** 2026-04-09

## Languages

**Primary:**
- TypeScript 5.7.0 - All source code, type-safe implementation
- JavaScript (Node.js module output) - Compiled runtime

## Runtime

**Environment:**
- Node.js 16+ (specified in `tsconfig.json` via `module: "Node16"` and `moduleResolution: "Node16"`)

**Package Manager:**
- npm (Node Package Manager)
- Lockfile: `package-lock.json` present (v3 format)

## Frameworks

**Core:**
- Model Context Protocol (MCP) SDK `@modelcontextprotocol/sdk` ^1.12.1 - Server framework for MCP protocol implementation
  - Uses `StdioServerTransport` for stdio-based communication
  - Provides `McpServer` class for tool registration and server initialization

**Validation:**
- Zod ^3.x (transitive via MCP SDK) - Schema validation and input/output type definitions
  - Used in all tool parameter definitions (e.g., `browseSchema` in `src/utils/tool-helpers.ts`)
  - Provides type coercion and enum validation

**Development & Build:**
- TypeScript 5.7.0 - Compiler with strict mode enabled
- tsx ^4.19.0 - TypeScript executor for development with watch mode (`npm run dev`)

**Testing:**
- Vitest ^3.1.0 - Test runner and framework
  - Config: `vitest.config.ts`
  - Environment: Node.js
  - Run tests: `npm run test`

## Key Dependencies

**Critical:**
- `@modelcontextprotocol/sdk` ^1.12.1 - Entire server implementation depends on this. Provides MCP protocol handling, tool registration, server startup, and stdio transport.

**Build & Runtime Support:**
- `@types/node` ^22.0.0 - TypeScript definitions for Node.js APIs (fetch, process, etc.)
- `tsx` ^4.19.0 - TypeScript execution and watch mode in development

**Testing & Development:**
- `vitest` ^3.1.0 - Unit test framework for validating tool definitions and API paths
- TypeScript compiler support (`typescript` ^5.7.0)

## Configuration

**Environment Variables:**
- `RENTALWORKS_BASE_URL` - API base URL (required, e.g., `https://<your-instance>.rentalworks.cloud`)
- `RENTALWORKS_USERNAME` - API username (required for JWT authentication)
- `RENTALWORKS_PASSWORD` - API password (required for JWT authentication)

**Configuration Files:**
- `tsconfig.json` - TypeScript compiler options
  - Target: ES2022
  - Strict mode: enabled
  - Declarations and source maps: enabled
  - Source root: `src/`, output: `dist/`
- `vitest.config.ts` - Test runner configuration
  - Test root: `src/` (co-located tests)
  - Environment: Node.js

**Build Outputs:**
- `dist/` directory - Compiled JavaScript, declarations, and source maps
- Entrypoint: `dist/index.js` (specified in `package.json` main field)

## Build & Development Commands

```bash
npm run build         # TypeScript compilation to dist/
npm run dev           # Watch mode development with tsx
npm run start         # Run compiled server with node
npm run inspect       # Inspect MCP server using @anthropic-ai/model-context-protocol
npm run test          # Run vitest suite
```

## Platform Requirements

**Development:**
- Node.js 16 or higher (ESM module support required)
- npm package manager
- TypeScript 5.7.0+

**Production:**
- Node.js 16 or higher
- RentalWorks cloud instance with API access
- Valid JWT credentials (username/password)

**Deployment Target:**
- Anthropic Claude integration as MCP server
- Communicates via stdio transport protocol
- Stateless: JWT token managed internally with 4-hour expiry and auto-refresh at 3.5 hours

---

*Stack analysis: 2026-04-09*
