/**
 * Storefront tools - Customer-facing catalog and self-service
 *
 * Covers: storefront-v1 API (27 endpoints)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient } from "../utils/api-client.js";
import { formatEntity } from "../utils/tool-helpers.js";

export function registerStorefrontTools(server: McpServer) {
  // ── Storefront: Browse Catalog ──────────────────────────────────────────

  server.tool(
    "storefront_browse_catalog",
    "List available storefront catalogs.",
    {},
    async () => {
      const client = getClient();
      const data = await client.get("/api/v1/storefront/catalog");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
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
    async ({ productId, warehouseId, locationId, fromDate, toDate }) => {
      const client = getClient();
      const data = await client.get(
        `/api/v1/storefront/product/${productId}/warehouseid/${warehouseId}/locationid/${locationId}/fromdate/${fromDate}/todate/${toDate}`
      );
      return { content: [{ type: "text", text: formatEntity(data as any) }] };
    }
  );

  // ── Storefront: Browse Categories ───────────────────────────────────────

  server.tool(
    "storefront_browse_categories",
    "Browse the category tree for a storefront catalog. Returns the hierarchical categories customers see.",
    {
      catalogId: z.string().describe("The storefront catalog ID"),
    },
    async ({ catalogId }) => {
      const client = getClient();
      const data = await client.get(`/api/v1/storefront/catalog/${catalogId}/categorytree`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
}
