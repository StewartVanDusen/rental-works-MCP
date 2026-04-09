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
    "Browse the customer-facing storefront catalog of available rental items.",
    {
      categoryId: z.string().optional().describe("Filter by category ID"),
      searchTerm: z.string().optional().describe("Search term for item name/description"),
      page: z.number().optional().default(1).describe("Page number"),
      pageSize: z.number().optional().default(25).describe("Results per page"),
    },
    async (args) => {
      const client = getClient();
      const data = await client.post("/api/v1/storefront/browse", {
        pageno: args.page,
        pagesize: args.pageSize,
        searchfieldvalues: args.searchTerm ? [args.searchTerm] : undefined,
        miscfields: args.categoryId ? { CategoryId: args.categoryId } : undefined,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ── Storefront: Get Item Details ────────────────────────────────────────

  server.tool(
    "storefront_get_item",
    "Get detailed information for a storefront catalog item including images and availability.",
    {
      itemId: z.string().describe("The storefront item/inventory ID"),
    },
    async ({ itemId }) => {
      const client = getClient();
      const data = await client.get(`/api/v1/storefront/${itemId}`);
      return { content: [{ type: "text", text: formatEntity(data as any) }] };
    }
  );

  // ── Storefront: Browse Categories ───────────────────────────────────────

  server.tool(
    "storefront_browse_categories",
    "Browse the storefront catalog categories available to customers.",
    {
      page: z.number().optional().default(1),
      pageSize: z.number().optional().default(50),
    },
    async (args) => {
      const client = getClient();
      const data = await client.post("/api/v1/storefrontcatalog/browse", {
        pageno: args.page,
        pagesize: args.pageSize,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
}
