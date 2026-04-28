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
  browseTool,
  buildBrowseRequest,
  formatBrowseResult,
  withErrorHandling,
} from "../utils/tool-helpers.js";

export function registerUtilityTools(server: McpServer) {
  // ── Inventory Purchase Utility ──────────────────────────────────────────

  server.tool(
    "browse_inventory_purchase_sessions",
    "Browse inventory purchase sessions — tracks items being purchased/restocked.",
    browseSchema,
    browseTool("inventorypurchasesession")
  );

  // ── Change ICode Utility ────────────────────────────────────────────────

  server.tool(
    "change_icode",
    "Change an inventory item's ICode (inventory code) across the system.",
    {
      InventoryId: z.string().describe("The inventory item ID"),
      NewICode: z.string().describe("The new ICode to assign"),
    },
    withErrorHandling(async (args) => {
      const client = getClient();
      const data = await client.post<Record<string, unknown>>("/api/v1/changeicodeutility/changeicode", args);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    })
  );

  // ── Assign Barcodes ─────────────────────────────────────────────────────

  server.tool(
    "assign_barcodes",
    "Assign barcodes to inventory items or view barcode assignments.",
    {
      InventoryId: z.string().describe("Inventory item to assign barcodes to"),
      Quantity: z.coerce.number().optional().describe("Number of barcodes to generate"),
    },
    withErrorHandling(async (args) => {
      const client = getClient();
      const data = await client.post<Record<string, unknown>>("/api/v1/assignbarcodes/assignbarcodes", args);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    })
  );

  // ── Browse Label Designs ────────────────────────────────────────────────

  server.tool(
    "browse_label_designs",
    "Browse label designs for printing barcode labels, asset tags, etc.",
    browseSchema,
    browseTool("labeldesign")
  );

  // ── AI Assistant Utility ────────────────────────────────────────────────

  server.tool(
    "ai_assistant",
    "Interact with the RentalWorks built-in AI assistant utility.",
    {
      query: z.string().describe("The question or request for the AI assistant"),
    },
    withErrorHandling(async ({ query }) => {
      const client = getClient();
      const data = await client.post<Record<string, unknown>>("/api/v1/aiassistantutility/ask", { Query: query });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    })
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
    withErrorHandling(async ({ entity, ...args }) => {
      const client = getClient();
      const request = buildBrowseRequest(args);
      const data = await client.browse(entity, request);
      return { content: [{ type: "text", text: formatBrowseResult(data) }] };
    })
  );

  server.tool(
    "raw_api_get",
    "Make a raw GET request to any RentalWorks API endpoint.",
    {
      path: z.string().describe("Full API path (e.g. '/api/v1/rentalinventory/abc123')"),
    },
    withErrorHandling(async ({ path }) => {
      const client = getClient();
      const data = await client.get<Record<string, unknown>>(path);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    })
  );

  server.tool(
    "raw_api_post",
    "Make a raw POST request to any RentalWorks API endpoint with a JSON body.",
    {
      path: z.string().describe("Full API path (e.g. '/api/v1/order/abc123/createinvoice')"),
      body: z.string().optional().describe("JSON body string to send"),
    },
    withErrorHandling(async ({ path, body }) => {
      const client = getClient();
      const parsedBody = body ? JSON.parse(body) : {};
      const data = await client.post<Record<string, unknown>>(path, parsedBody);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    })
  );

  // ── Change Order Status Utility ────────────────────────────────────────

  server.tool(
    "change_order_status",
    "Change the status of an order using the change order status utility.",
    {
      OrderId: z.string().describe("The order ID to change status for"),
      StatusId: z.string().describe("The new order status ID"),
    },
    withErrorHandling(async (args) => {
      const client = getClient();
      const data = await client.post<Record<string, unknown>>("/api/v1/changeorderstatus/changestatus", args);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    })
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
    withErrorHandling(async ({ entityType, entityId }) => {
      const client = getClient();
      const data = await client.post<Record<string, unknown>>(`/api/v1/${entityType}/synctoqbo`, { Id: entityId });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    })
  );
}
