/**
 * Storefront tools - Customer-facing catalog and self-service
 *
 * Covers: storefront-v1 API (27 endpoints)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient } from "../utils/api-client.js";
import {
  browseSchema,
  browseTool,
  formatEntity,
  withErrorHandling,
} from "../utils/tool-helpers.js";

export function registerStorefrontTools(server: McpServer) {
  // ── Storefront: Browse Catalog ──────────────────────────────────────────
  // NOTE: this uses GET /api/v1/storefront/catalog (a list endpoint), NOT a
  // /browse endpoint. Preserved as-is — only wrapped with withErrorHandling.

  server.tool(
    "storefront_browse_catalog",
    "List available storefront catalogs.",
    {},
    withErrorHandling(async () => {
      const client = getClient();
      const data = await client.get<Record<string, unknown>>("/api/v1/storefront/catalog");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    })
  );

  // ── Storefront: Get Item Details ────────────────────────────────────────

  server.tool(
    "storefront_get_product",
    "Get detailed storefront product info including availability for a date range.",
    {
      productId: z.string().describe("The storefront product/inventory ID"),
      warehouseId: z.string().describe("Warehouse ID"),
      locationId: z.string().describe("Location ID"),
      fromDate: z.string().describe("Start date (YYYY-MM-DD)"),
      toDate: z.string().describe("End date (YYYY-MM-DD)"),
    },
    withErrorHandling(async ({ productId, warehouseId, locationId, fromDate, toDate }) => {
      const client = getClient();
      const data = await client.get<Record<string, unknown>>(
        `/api/v1/storefront/product/${productId}/warehouseid/${warehouseId}/locationid/${locationId}/fromdate/${fromDate}/todate/${toDate}`
      );
      return { content: [{ type: "text", text: formatEntity(data) }] };
    })
  );

  // ── Storefront: Browse Categories ───────────────────────────────────────
  // Uses POST /api/v1/storefrontcatalog/browse — the standard browse path.

  server.tool(
    "storefront_browse_categories",
    "Browse the storefront catalog categories available to customers.",
    browseSchema,
    browseTool("storefrontcatalog")
  );
}
