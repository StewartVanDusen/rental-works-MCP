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
  buildBrowseRequest,
  formatBrowseResult,
  formatEntity,
} from "../utils/tool-helpers.js";

export function registerContractTools(server: McpServer) {
  // ── Browse Contracts ────────────────────────────────────────────────────

  server.tool(
    "browse_contracts",
    "Browse contracts (shipping/receiving documents created during check-out and check-in).",
    browseSchema,
    async (args) => {
      const client = getClient();
      const request = buildBrowseRequest(args);
      const data = await client.post("/api/v1/contract/browse", request);
      return { content: [{ type: "text", text: formatBrowseResult(data as any) }] };
    }
  );

  // ── Get Contract ────────────────────────────────────────────────────────

  server.tool(
    "get_contract",
    "Get full details of a specific contract including associated orders and items.",
    {
      contractId: z.string().describe("The contract ID"),
    },
    async ({ contractId }) => {
      const client = getClient();
      const data = await client.get(`/api/v1/contract/${contractId}`);
      return { content: [{ type: "text", text: formatEntity(data as any) }] };
    }
  );

  // ── Get Contract Details ────────────────────────────────────────────────

  server.tool(
    "get_contract_details",
    "Get extended contract details with item-level breakdown.",
    {
      contractId: z.string().describe("The contract ID"),
    },
    async ({ contractId }) => {
      const client = getClient();
      const data = await client.get(`/api/v1/contract/${contractId}/contractdetails`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ── Check-Out: Start Session ────────────────────────────────────────────

  server.tool(
    "checkout_start_session",
    "Start a new check-out session for an order. This begins the process of staging and shipping items.",
    {
      OrderId: z.string().describe("The order ID to check out"),
      WarehouseId: z.string().optional().describe("Warehouse to check out from"),
    },
    async (args) => {
      const client = getClient();
      const data = await client.post("/api/v1/checkout/startcheckoutcontract", args);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ── Check-Out: Stage Item ───────────────────────────────────────────────

  server.tool(
    "checkout_stage_item",
    "Stage (scan) an item during check-out by barcode or serial number.",
    {
      SessionId: z.string().describe("Active check-out session ID"),
      Code: z.string().describe("Barcode or serial number to stage"),
    },
    async (args) => {
      const client = getClient();
      const data = await client.post("/api/v1/checkout/stageitem", args);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ── Check-Out: Stage All ────────────────────────────────────────────────

  server.tool(
    "checkout_stage_all",
    "Stage all remaining items on an order at once (auto-assign for quantity-tracked items).",
    {
      SessionId: z.string().describe("Active check-out session ID"),
    },
    async ({ SessionId }) => {
      const client = getClient();
      const data = await client.post("/api/v1/checkout/checkoutallstaged", { SessionId });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ── Check-Out: Complete Contract ────────────────────────────────────────

  server.tool(
    "checkout_complete",
    "Complete the check-out session and generate the out-contract.",
    {
      SessionId: z.string().describe("Active check-out session ID"),
    },
    async ({ SessionId }) => {
      const client = getClient();
      const data = await client.post("/api/v1/checkout/completecheckoutcontract", { SessionId });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ── Check-Out: Browse Staging ───────────────────────────────────────────

  server.tool(
    "checkout_browse",
    "Browse items in a check-out session, showing staged vs pending items.",
    {
      ...browseSchema,
      sessionId: z.string().optional().describe("Check-out session ID to filter by"),
    },
    async ({ sessionId, ...args }) => {
      const client = getClient();
      const request = buildBrowseRequest(args);
      if (sessionId) {
        request.uniqueids = { SessionId: sessionId };
      }
      const data = await client.post("/api/v1/checkout/browse", request);
      return { content: [{ type: "text", text: formatBrowseResult(data as any) }] };
    }
  );

  // ── Check-In: Start Session ─────────────────────────────────────────────

  server.tool(
    "checkin_start_session",
    "Start a new check-in session for returning items from an order/contract.",
    {
      ContractId: z.string().optional().describe("Contract ID to check in against"),
      OrderId: z.string().optional().describe("Order ID to check in against"),
    },
    async (args) => {
      const client = getClient();
      const data = await client.post("/api/v1/checkin/startsession", args);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ── Check-In: Scan Item ─────────────────────────────────────────────────

  server.tool(
    "checkin_item",
    "Check in (scan return) an item by barcode or serial number.",
    {
      SessionId: z.string().describe("Active check-in session ID"),
      Code: z.string().describe("Barcode or serial number being returned"),
    },
    async (args) => {
      const client = getClient();
      const data = await client.post("/api/v1/checkin/checkinitem", args);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ── Browse Transfer Orders ──────────────────────────────────────────────

  server.tool(
    "browse_transfer_orders",
    "Browse transfer orders (inter-warehouse inventory transfers).",
    browseSchema,
    async (args) => {
      const client = getClient();
      const request = buildBrowseRequest(args);
      const data = await client.post("/api/v1/transferorder/browse", request);
      return { content: [{ type: "text", text: formatBrowseResult(data as any) }] };
    }
  );

  // ── Get Transfer Order ──────────────────────────────────────────────────

  server.tool(
    "get_transfer_order",
    "Get details of a specific transfer order.",
    {
      transferOrderId: z.string().describe("The transfer order ID"),
    },
    async ({ transferOrderId }) => {
      const client = getClient();
      const data = await client.get(`/api/v1/transferorder/${transferOrderId}`);
      return { content: [{ type: "text", text: formatEntity(data as any) }] };
    }
  );

  // ── Browse Repairs ──────────────────────────────────────────────────────

  server.tool(
    "browse_repairs",
    "Browse repair orders for damaged or maintenance-needed equipment.",
    browseSchema,
    async (args) => {
      const client = getClient();
      const request = buildBrowseRequest(args);
      const data = await client.post("/api/v1/repair/browse", request);
      return { content: [{ type: "text", text: formatBrowseResult(data as any) }] };
    }
  );

  // ── Get Repair ──────────────────────────────────────────────────────────

  server.tool(
    "get_repair",
    "Get full details of a specific repair order.",
    {
      repairId: z.string().describe("The repair ID"),
    },
    async ({ repairId }) => {
      const client = getClient();
      const data = await client.get(`/api/v1/repair/${repairId}`);
      return { content: [{ type: "text", text: formatEntity(data as any) }] };
    }
  );
}
