/**
 * Contract, Check-Out, and Check-In tools - Warehouse operations
 *
 * Covers tags: CheckOut (79 endpoints), CheckIn (31), Contract (41),
 * TransferOrder (38), TransferIn (28), Repair (47)
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

export function registerContractTools(server: McpServer) {
  // ── Browse Contracts ────────────────────────────────────────────────────

  server.tool(
    "browse_contracts",
    "Browse contracts (shipping/receiving documents created during check-out and check-in).",
    browseSchema,
    browseTool("contract")
  );

  // ── Get Contract ────────────────────────────────────────────────────────

  server.tool(
    "get_contract",
    "Get full details of a specific contract including associated orders and items.",
    {
      contractId: z.string().describe("The contract ID"),
    },
    withErrorHandling(async ({ contractId }) => {
      const client = getClient();
      const data = await client.get<Record<string, unknown>>(`/api/v1/contract/${contractId}`);
      return { content: [{ type: "text", text: formatEntity(data) }] };
    })
  );

  // ── Get Contract Details ────────────────────────────────────────────────

  server.tool(
    "get_contract_details",
    "Get extended contract details with item-level breakdown.",
    {
      contractId: z.string().describe("The contract ID"),
    },
    withErrorHandling(async ({ contractId }) => {
      const client = getClient();
      const data = await client.get(`/api/v1/contract/${contractId}/contractdetails`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    })
  );

  // ── Check-Out: Start Session ────────────────────────────────────────────

  server.tool(
    "checkout_start_session",
    "Start a new check-out session for an order. This begins the process of staging and shipping items.",
    {
      OrderId: z.string().describe("The order ID to check out"),
      WarehouseId: z.string().optional().describe("Warehouse to check out from"),
    },
    withErrorHandling(async (args) => {
      const client = getClient();
      const data = await client.post("/api/v1/checkout/startcheckoutcontract", args);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    })
  );

  // ── Check-Out: Stage Item ───────────────────────────────────────────────

  server.tool(
    "checkout_stage_item",
    "Stage (scan) an item during check-out by barcode or serial number.",
    {
      SessionId: z.string().describe("Active check-out session ID"),
      Code: z.string().describe("Barcode or serial number to stage"),
    },
    withErrorHandling(async (args) => {
      const client = getClient();
      const data = await client.post("/api/v1/checkout/stageitem", args);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    })
  );

  // ── Check-Out: Stage All ────────────────────────────────────────────────

  server.tool(
    "checkout_stage_all",
    "Stage all remaining items on an order at once (auto-assign for quantity-tracked items).",
    {
      SessionId: z.string().describe("Active check-out session ID"),
    },
    withErrorHandling(async ({ SessionId }) => {
      const client = getClient();
      const data = await client.post("/api/v1/checkout/checkoutallstaged", { SessionId });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    })
  );

  // ── Check-Out: Complete Contract ────────────────────────────────────────

  server.tool(
    "checkout_complete",
    "Complete the check-out session and generate the out-contract.",
    {
      SessionId: z.string().describe("Active check-out session ID"),
    },
    withErrorHandling(async ({ SessionId }) => {
      const client = getClient();
      const data = await client.post("/api/v1/checkout/completecheckoutcontract", { SessionId });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    })
  );

  // ── Check-Out: Browse Staging ───────────────────────────────────────────

  server.tool(
    "browse_checked_out_items",
    "Browse items currently checked out across orders. Shows what equipment is out in the field.",
    browseSchema,
    browseTool("checkedoutitem")
  );

  // ── Check-In: Start Session ─────────────────────────────────────────────

  server.tool(
    "checkin_start_session",
    "Start a new check-in session for returning items from an order/contract.",
    {
      ContractId: z.string().optional().describe("Contract ID to check in against"),
      OrderId: z.string().optional().describe("Order ID to check in against"),
    },
    withErrorHandling(async (args) => {
      const client = getClient();
      const data = await client.post("/api/v1/checkin/startsession", args);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    })
  );

  // ── Check-In: Scan Item ─────────────────────────────────────────────────

  server.tool(
    "checkin_item",
    "Check in (scan return) an item by barcode or serial number.",
    {
      SessionId: z.string().describe("Active check-in session ID"),
      Code: z.string().describe("Barcode or serial number being returned"),
    },
    withErrorHandling(async (args) => {
      const client = getClient();
      const data = await client.post("/api/v1/checkin/checkinitem", args);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    })
  );

  // ── Browse Transfer Orders ──────────────────────────────────────────────

  server.tool(
    "browse_transfer_orders",
    "Browse transfer orders (inter-warehouse inventory transfers).",
    browseSchema,
    browseTool("transferorder")
  );

  // ── Get Transfer Order ──────────────────────────────────────────────────

  server.tool(
    "get_transfer_order",
    "Get details of a specific transfer order.",
    {
      transferOrderId: z.string().describe("The transfer order ID"),
    },
    withErrorHandling(async ({ transferOrderId }) => {
      const client = getClient();
      const data = await client.get<Record<string, unknown>>(`/api/v1/transferorder/${transferOrderId}`);
      return { content: [{ type: "text", text: formatEntity(data) }] };
    })
  );

  // ── Browse Repairs ──────────────────────────────────────────────────────

  server.tool(
    "browse_repairs",
    "Browse repair orders for damaged or maintenance-needed equipment.",
    browseSchema,
    browseTool("repair")
  );

  // ── Get Repair ──────────────────────────────────────────────────────────

  server.tool(
    "get_repair",
    "Get full details of a specific repair order.",
    {
      repairId: z.string().describe("The repair ID"),
    },
    withErrorHandling(async ({ repairId }) => {
      const client = getClient();
      const data = await client.get<Record<string, unknown>>(`/api/v1/repair/${repairId}`);
      return { content: [{ type: "text", text: formatEntity(data) }] };
    })
  );
}
