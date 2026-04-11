# External Integrations

**Analysis Date:** 2026-04-09

## APIs & External Services

**RentalWorks REST API:**
- Service: RentalWorks rental management platform
- What it's used for: Core business operations — inventory management, orders, billing, contracts, customers, vendors, reports, admin, warehouse operations, and storefront
- SDK/Client: Custom `RentalWorksClient` in `src/utils/api-client.ts`
- Base URL: Environment variable `RENTALWORKS_BASE_URL` (e.g., `https://<your-instance>.rentalworks.cloud`)
- Coverage: 80+ tools across 11 domains (Inventory, Orders, Customers, Contracts, Billing, Vendors, Reports, Settings, Admin, Storefront, Utilities)

**Built-in AI Assistant (RentalWorks):**
- Service: RentalWorks AI Assistant Utility
- What it's used for: Interactive AI-powered assistance within the platform
- Endpoint: `POST /api/v1/aiassistantutility/ask`
- Integration: Tool `ai_assistant` in `src/tools/utilities.ts`

**QBO Sync (QuickBooks Online):**
- Service: QuickBooks Online integration (mentioned in index.ts comments)
- What it's used for: Financial synchronization and accounting integration
- Status: Available via utilities endpoints; specific implementation details in `src/tools/utilities.ts`

## Data Storage

**Databases:**
- Type: RentalWorks managed cloud database
- Connection: Through REST API only (no direct database access)
- Client: `RentalWorksClient` in `src/utils/api-client.ts` using fetch API
- Notes: All data operations go through `/api/v1/*` endpoints; no direct DB connections

## Authentication & Identity

**Auth Provider:**
- Service: RentalWorks JWT-based authentication
- Implementation: Custom JWT Bearer token flow
  - Endpoint: `POST /api/v1/jwt`
  - Request format: `{ UserName: string, Password: string }` (defined in `src/types/api.ts`)
  - Response: `JwtResponse` with `access_token` and session info
  - Token management: Auto-refresh at 3.5 hours (tokens last ~4 hours)
- Code: `src/utils/api-client.ts` (`RentalWorksClient` class)
- Environment variables:
  - `RENTALWORKS_USERNAME` - API username
  - `RENTALWORKS_PASSWORD` - API password

**Authorization:**
- Bearer token in `Authorization: Bearer {token}` header for all authenticated requests
- Tokens managed internally with expiry tracking and automatic re-authentication

## Monitoring & Observability

**Error Tracking:**
- Not detected - errors handled in-application

**Logs:**
- Console-based: `console.error()` for startup messages and errors
- Server startup message: "RentalWorks MCP server running on stdio"
- Error handling in `src/utils/tool-helpers.ts` with `withErrorHandling()` wrapper
  - Detects RentalWorks-specific errors (Invalid column name, 503 Service Unavailable, NullReferenceException)
  - Returns user-friendly error messages

**Activity Tracking:**
- RentalWorks maintains server-side activity logs accessible via `admin` tools
- Tool: `browse_activity_log` in `src/tools/admin.ts`

## CI/CD & Deployment

**Hosting:**
- Deployment target: Anthropic Claude environment as MCP server
- Communication protocol: Model Context Protocol (MCP) via stdio transport
- Transport: `StdioServerTransport` from MCP SDK

**CI Pipeline:**
- Not detected - test suite available but no automated pipeline configuration

## Environment Configuration

**Required Environment Variables:**
- `RENTALWORKS_BASE_URL` - RentalWorks instance URL (required)
- `RENTALWORKS_USERNAME` - API username (required)
- `RENTALWORKS_PASSWORD` - API password (required)

**Configuration Reference:**
- `.env.example` provides template:
  ```
  RENTALWORKS_BASE_URL=https://<your-instance>.rentalworks.cloud
  RENTALWORKS_USERNAME=
  RENTALWORKS_PASSWORD=
  ```

**Secrets Location:**
- `.env` file (local development)
- Environment variables (production deployment)
- Credentials never hardcoded; warnings logged if missing

## Webhooks & Callbacks

**Incoming:**
- Not detected - server is passive MCP tool provider, does not listen for webhooks

**Outgoing:**
- Not detected - integrations are request/response based

## API Integration Patterns

**REST API Communication:**
- HTTP methods: GET, POST, PUT, DELETE (defined in `src/types/api.ts` as `HttpMethod` type)
- Content-Type: `application/json`
- Base path: All endpoints follow `/api/v1/{entity}/{action}` pattern

**Browse/Pagination Pattern:**
- Most entities use `POST /api/v1/{entity}/browse` endpoint
- Request format: `BrowseRequest` (in `src/types/api.ts`)
  - Includes pagination (`pageno`, `pagesize`), sorting (`orderby`, `orderbydirection`)
  - Search filters (`searchfields`, `searchfieldvalues`, `searchfieldoperators`)
  - Options for filtering (`warehouseId`, `officeLocationId`)
- Response format: `BrowseResponse<T>` with `Rows` array, pagination metadata, and optional column headers

**CRUD Pattern:**
- Create: `POST /api/v1/{entity}`
- Read: `GET /api/v1/{entity}/{id}`
- Update: `PUT /api/v1/{entity}/{id}`
- Delete: `DELETE /api/v1/{entity}/{id}`

**Export Pattern:**
- Excel export: `POST /api/v1/{entity}/exportexcelxlsx`
- Used by report tools for generating downloadable files

**Session Pattern:**
- Session info: `GET /api/v1/account/session`
- Office location: `GET /api/v1/account/officelocation`
- Used for user context and workspace settings

## Domain Endpoints Summary

**Inventory:** 110+ endpoints - `rentalinventory`, `salesinventory`, `partsinventory`, `item`, `physicalinventory`

**Orders:** Quote and order lifecycle - `quote`, `order`, `orderitem`

**Customers:** Customer records and relationships - `customer`, `contact`, `deal`, `project`

**Contracts:** Checkout/checkin operations - `checkout`, `checkin`, `contract`, `transfer`, `repair`

**Billing:** Invoices and financial records - `invoice`, `billingworksheet`, `receipt`, `vendorinvoice`

**Vendors:** Vendor management - `vendor`, `purchaseorder`

**Reports:** 100+ report types - `reports` endpoint with browse, render, and export

**Settings:** Configuration and reference data - `warehouse`, `category`, `crew`, `template`, `rate`, `department`

**Admin:** System administration - `user`, `session`, `activitylog`, `alert`

**Storefront:** Customer-facing catalog - `storefront` with item browsing

**Utilities:** Integration utilities - `inventorypurchasesession`, `changeicodeutility`, `assignbarcodes`, `labeldesign`, `aiassistantutility`, `barcode`, `qbosync`, raw API access

---

*Integration audit: 2026-04-09*
