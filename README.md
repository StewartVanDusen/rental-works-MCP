# RentalWorks MCP Server

MCP server for the [RentalWorks](https://www.dbsrentals.com/rentalworks/) rental management platform. Exposes 114 tools across 11 domains covering the full rental lifecycle.

## Domains

| Domain | File | Description |
|--------|------|-------------|
| Inventory | `inventory.ts` | Rental, sales, parts inventory and individual asset management |
| Orders | `orders.ts` | Quotes, orders, order items, and order lifecycle |
| Customers | `customers.ts` | Customers, contacts, deals, and projects |
| Contracts | `contracts.ts` | Check-out, check-in, contracts, transfers, and repairs |
| Billing | `billing.ts` | Invoices, billing worksheets, receipts, vendor invoices |
| Vendors | `vendors.ts` | Vendor management and purchase orders |
| Reports | `reports.ts` | 100+ report types with browse/render/export |
| Settings | `settings.ts` | Warehouses, categories, crews, templates, rates |
| Admin | `admin.ts` | Users, sessions, alerts |
| Storefront | `storefront.ts` | Customer-facing catalog and product availability |
| Utilities | `utilities.ts` | Barcodes, AI assistant, QuickBooks sync, raw API access |

## Setup

### Prerequisites

- Node.js 18+
- RentalWorks API credentials

### Install

```bash
npm install
```

### Environment Variables

```bash
RENTALWORKS_BASE_URL=https://<your-instance>.rentalworks.cloud
RENTALWORKS_USERNAME=your-username
RENTALWORKS_PASSWORD=your-password
```

### Build and Run

```bash
npm run build    # Compile TypeScript to dist/
npm start        # Run the compiled server via stdio
npm run dev      # Run in watch mode with tsx
```

### Claude Desktop Configuration

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "rentalworks": {
      "command": "node",
      "args": ["/path/to/rentalworks-mcp-server/dist/index.js"],
      "env": {
        "RENTALWORKS_USERNAME": "your-username",
        "RENTALWORKS_PASSWORD": "your-password"
      }
    }
  }
}
```

## Development

```bash
npm run dev      # Watch mode
npm test         # Run test suite (vitest)
npm run inspect  # MCP Inspector
```

### Project Structure

```
src/
  index.ts              # Server entry point
  tools/                # Tool definitions by domain (11 files)
  utils/
    api-client.ts       # RentalWorks API client with JWT auth
    tool-helpers.ts     # Shared browse/format helpers
  types/
    api.ts              # TypeScript type definitions
  __tests__/            # Test suite (5 files, 49 tests)
```

### Testing

Tests use vitest with the MCP SDK's `InMemoryTransport` to spin up a real server and client in-process. Coverage includes:

- **tool-registration** -- Tool count, no duplicates, schema validation
- **api-paths** -- All 18 endpoint URLs are correct
- **request-bodies** -- POST bodies have the right shape
- **removed-tools** -- Deleted tools don't appear
- **tool-helpers** -- Unit tests for browse request building and formatting

## API Reference

The server connects to the RentalWorks REST API with JWT bearer authentication. API docs: `https://<your-instance>.rentalworks.cloud/swagger/index.html`
