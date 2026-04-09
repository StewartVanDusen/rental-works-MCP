/**
 * Utility and Integration tools
 *
 * Covers: utilities-v1 (219 endpoints), integrations-v1 (5 endpoints),
 * mobile-v1 (30 endpoints), plugins-v1 (78 endpoints)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient } from "../utils/api-client.js";
import {
  browseSchema,
  buildBrowseRequest,
  formatBrowseResult,
  formatEntity,
} from "../utils/tool-helpers.js";

export function registerUtilityTools(server: McpServer) {
  // ── Inventory Purchase Utility ──────────────────────────────────────────

  server.tool(
    "browse_inventory_purchase_utility",
    "Browse the inventory purchase utility - helps identify items that need to be purchased/re-stocked.",
    browseSchema,
    async (args) => {
      const client = getClient();
      const request = buildBrowseRequest(args);
      const data = await client.post("/api/v1/inventorypurchaseutility/browse", request);
      return { content: [{ type: "text", text: formatBrowseResult(data as any) }] };
    }
  );

  // ── Change ICode Utility ────────────────────────────────────────────────

  server.tool(
    "change_icode",
    "Change an inventory item's ICode (inventory code) across the system.",
    {
      InventoryId: z.string().describe("The inventory item ID"),
      NewICode: z.string().describe("The new ICode to assign"),
    },
    async (args) => {
      const client = getClient();
      const data = await client.post("/api/v1/changeicodeutility", args);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ── Assign Barcodes ─────────────────────────────────────────────────────

  server.tool(
    "assign_barcodes",
    "Assign barcodes to inventory items or view barcode assignments.",
    {
      InventoryId: z.string().describe("Inventory item to assign barcodes to"),
      Quantity: z.number().optional().describe("Number of barcodes to generate"),
    },
    async (args) => {
      const client = getClient();
      const data = await client.post("/api/v1/assignbarcodes", args);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ── Browse Label Designs ────────────────────────────────────────────────

  server.tool(
    "browse_label_designs",
    "Browse label designs for printing barcode labels, asset tags, etc.",
    browseSchema,
    async (args) => {
      const client = getClient();
      const request = buildBrowseRequest(args);
      const data = await client.post("/api/v1/labeldesign/browse", request);
      return { content: [{ type: "text", text: formatBrowseResult(data as any) }] };
    }
  );

  // ── AI Assistant Utility ────────────────────────────────────────────────

  server.tool(
    "ai_assistant",
    "Interact with the RentalWorks built-in AI assistant utility.",
    {
      query: z.string().describe("The question or request for the AI assistant"),
    },
    async ({ query }) => {
      const client = getClient();
      const data = await client.post("/api/v1/aiassistantutility", { Query: query });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ── Generic Entity Operations ───────────────────────────────────────────

  server.tool(
    "raw_api_browse",
    `Make a raw browse request to any RentalWorks API entity. Use this for entities
    not covered by specific tools. The entity name maps to the URL path segment
    (e.g. 'rentalinventory' -> /api/v1/rentalinventory/browse).`,
    {
      entity: z.string().describe("API entity path segment (e.g. 'rentalinventory', 'order', 'customer')"),
      ...browseSchema,
    },
    async ({ entity, ...args }) => {
      const client = getClient();
      const request = buildBrowseRequest(args);
      const data = await client.post(`/api/v1/${entity}/browse`, request);
      return { content: [{ type: "text", text: formatBrowseResult(data as any) }] };
    }
  );

  server.tool(
    "raw_api_get",
    "Make a raw GET request to any RentalWorks API endpoint.",
    {
      path: z.string().describe("Full API path (e.g. '/api/v1/rentalinventory/abc123')"),
    },
    async ({ path }) => {
      const client = getClient();
      const data = await client.get(path);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "raw_api_post",
    "Make a raw POST request to any RentalWorks API endpoint with a JSON body.",
    {
      path: z.string().describe("Full API path (e.g. '/api/v1/order/abc123/createinvoice')"),
      body: z.string().optional().describe("JSON body string to send"),
    },
    async ({ path, body }) => {
      const client = getClient();
      const parsedBody = body ? JSON.parse(body) : {};
      const data = await client.post(path, parsedBody);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ── QuickBooks Sync ─────────────────────────────────────────────────────

  server.tool(
    "sync_to_quickbooks",
    "Trigger a sync of a record to QuickBooks Online. Available for customers, vendors, invoices, and inventory.",
    {
      entityType: z.enum(["rentalinventory", "salesinventory", "customer", "vendor", "invoice", "vendorinvoice", "receipt"])
        .describe("Type of entity to sync"),
      entityId: z.string().describe("The entity ID to sync"),
    },
    async ({ entityType, entityId }) => {
      const client = getClient();
      const data = await client.post(`/api/v1/${entityType}/${entityId}/synctoqbo`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
}
