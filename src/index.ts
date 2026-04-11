#!/usr/bin/env node

/**
 * RentalWorks MCP Server
 *
 * MCP server for the RentalWorks rental management platform.
 * Provides 80+ tools across 8 domains covering the full rental lifecycle:
 *
 *   Inventory  - Rental, sales, parts inventory and individual asset management
 *   Orders     - Quotes, orders, order items, and order lifecycle
 *   Customers  - Customers, contacts, deals, and projects
 *   Contracts  - Check-out, check-in, contracts, transfers, and repairs
 *   Billing    - Invoices, billing worksheets, receipts, vendor invoices
 *   Vendors    - Vendor management and purchase orders
 *   Reports    - 100+ report types with browse/render/export
 *   Settings   - Warehouses, categories, crews, templates, rates
 *   Admin      - Users, sessions, activity log, alerts
 *   Storefront - Customer-facing catalog
 *   Utilities  - Barcodes, AI assistant, QBO sync, raw API access
 *
 * API: https://<your-instance>.rentalworks.cloud/swagger/index.html
 * Auth: JWT Bearer token (POST /api/v1/jwt)
 *
 * Environment variables:
 *   RENTALWORKS_BASE_URL  - API base URL (e.g. https://<your-instance>.rentalworks.cloud)
 *   RENTALWORKS_USERNAME  - API username
 *   RENTALWORKS_PASSWORD  - API password
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { registerInventoryTools } from "./tools/inventory.js";
import { registerOrderTools } from "./tools/orders.js";
import { registerCustomerTools } from "./tools/customers.js";
import { registerContractTools } from "./tools/contracts.js";
import { registerBillingTools } from "./tools/billing.js";
import { registerVendorTools } from "./tools/vendors.js";
import { registerReportTools } from "./tools/reports.js";
import { registerSettingsTools } from "./tools/settings.js";
import { registerAdminTools } from "./tools/admin.js";
import { registerStorefrontTools } from "./tools/storefront.js";
import { registerAddressTools } from "./tools/addresses.js";
import { registerUtilityTools } from "./tools/utilities.js";

const server = new McpServer({
  name: "rentalworks",
  version: "0.1.0",
  description:
    "RentalWorks rental management platform - inventory, orders, billing, warehouse operations, and reporting",
});

// Register all tool domains
registerInventoryTools(server);
registerOrderTools(server);
registerCustomerTools(server);
registerContractTools(server);
registerBillingTools(server);
registerVendorTools(server);
registerReportTools(server);
registerSettingsTools(server);
registerAdminTools(server);
registerStorefrontTools(server);
registerAddressTools(server);
registerUtilityTools(server);

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("RentalWorks MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
