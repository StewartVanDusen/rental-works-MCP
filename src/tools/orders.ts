/**
 * Order and Quote tools - Order lifecycle management
 *
 * Covers tags: Order (101 endpoints), Quote (80), OrderItem (46),
 * OrderStatus (17)
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

export function registerOrderTools(server: McpServer) {
  // ── Browse Orders ───────────────────────────────────────────────────────

  server.tool(
    "browse_orders",
    "Search and browse rental orders with filtering. Returns order number, status, customer, deal, dates, and totals.",
    {
      ...browseSchema,
      statusFilter: z.string().optional().describe("Filter by order status"),
    },
    async (args) => {
      const client = getClient();
      const request = buildBrowseRequest(args);
      const data = await client.post("/api/v1/order/browse", request);
      return { content: [{ type: "text", text: formatBrowseResult(data as any) }] };
    }
  );

  // ── Get Order Details ───────────────────────────────────────────────────

  server.tool(
    "get_order",
    "Get full details of a specific order including totals, dates, customer info, and status.",
    {
      orderId: z.string().describe("The order ID"),
    },
    async ({ orderId }) => {
      const client = getClient();
      const data = await client.get(`/api/v1/order/${orderId}`);
      return { content: [{ type: "text", text: formatEntity(data as any) }] };
    }
  );

  // ── Get Order Extended Details ──────────────────────────────────────────

  server.tool(
    "get_order_details",
    "Get extended order details including line item summaries, crew info, and labor totals.",
    {
      orderId: z.string().describe("The order ID"),
    },
    async ({ orderId }) => {
      const client = getClient();
      const data = await client.get(`/api/v1/order/${orderId}/orderdetails`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ── Create Order ────────────────────────────────────────────────────────

  server.tool(
    "create_order",
    "Create a new rental order. Requires at minimum a DealId or CustomerId.",
    {
      DealId: z.string().optional().describe("Associated deal ID"),
      CustomerId: z.string().optional().describe("Customer ID"),
      Description: z.string().optional().describe("Order description/name"),
      OrderTypeId: z.string().optional().describe("Order type ID"),
      PickDate: z.string().optional().describe("Pick date (YYYY-MM-DD)"),
      EstimatedStartDate: z.string().optional().describe("Estimated start date"),
      EstimatedStopDate: z.string().optional().describe("Estimated stop date"),
      WarehouseId: z.string().optional().describe("Warehouse ID"),
      AgentId: z.string().optional().describe("Sales agent user ID"),
      ProjectManagerId: z.string().optional().describe("Project manager user ID"),
      Location: z.string().optional().describe("Event/delivery location"),
    },
    async (args) => {
      const client = getClient();
      const data = await client.post("/api/v1/order", args);
      return { content: [{ type: "text", text: formatEntity(data as any) }] };
    }
  );

  // ── Update Order ────────────────────────────────────────────────────────

  server.tool(
    "update_order",
    "Update an existing order's properties (dates, status, description, etc.).",
    {
      OrderId: z.string().describe("The order ID to update"),
      Description: z.string().optional().describe("Updated description"),
      PickDate: z.string().optional().describe("Updated pick date"),
      EstimatedStartDate: z.string().optional().describe("Updated start date"),
      EstimatedStopDate: z.string().optional().describe("Updated stop date"),
      Location: z.string().optional().describe("Updated location"),
      AgentId: z.string().optional().describe("Updated agent ID"),
      ProjectManagerId: z.string().optional().describe("Updated PM ID"),
    },
    async ({ OrderId, ...updates }) => {
      const client = getClient();
      const data = await client.put(`/api/v1/order/${OrderId}`, updates);
      return { content: [{ type: "text", text: formatEntity(data as any) }] };
    }
  );

  // ── Delete Order ────────────────────────────────────────────────────────

  server.tool(
    "cancel_order",
    "Cancel an order by ID. Only works if the order has no active contracts or invoices.",
    {
      orderId: z.string().describe("The order ID to cancel"),
    },
    async ({ orderId }) => {
      const client = getClient();
      await client.post(`/api/v1/order/cancel/${orderId}`);
      return { content: [{ type: "text", text: `Order ${orderId} cancelled.` }] };
    }
  );

  // ── Browse Order Items ──────────────────────────────────────────────────

  server.tool(
    "browse_order_items",
    "Browse line items within a specific order. Shows inventory codes, descriptions, quantities, rates, and extended totals.",
    {
      ...browseSchema,
      orderId: z.string().describe("The parent order ID to browse items for"),
    },
    async ({ orderId, ...args }) => {
      const client = getClient();
      const request = {
        ...buildBrowseRequest(args),
        uniqueids: { OrderId: orderId },
      };
      const data = await client.post("/api/v1/orderitem/browse", request);
      return { content: [{ type: "text", text: formatBrowseResult(data as any) }] };
    }
  );

  // ── Add Item to Order ───────────────────────────────────────────────────

  server.tool(
    "add_order_item",
    "Add a line item to an order. Specify the inventory item and quantity.",
    {
      OrderId: z.string().describe("The order to add the item to"),
      InventoryId: z.string().describe("The inventory item ID to add"),
      QuantityOrdered: z.number().optional().describe("Quantity to order (default: 1)"),
      Rate: z.number().optional().describe("Override rental rate"),
      DaysPerWeek: z.number().optional().describe("Days per week for billing"),
    },
    async (args) => {
      const client = getClient();
      const data = await client.post("/api/v1/orderitem", args);
      return { content: [{ type: "text", text: formatEntity(data as any) }] };
    }
  );

  // ── Create Invoice from Order ───────────────────────────────────────────

  server.tool(
    "create_invoice_from_order",
    "Generate an invoice from an order. Triggers the billing process for the specified order.",
    {
      orderId: z.string().describe("The order ID to create an invoice for"),
    },
    async ({ orderId }) => {
      const client = getClient();
      const data = await client.post("/api/v1/order/createinvoice", { OrderId: orderId });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ── Copy Order to New Order ─────────────────────────────────────────────

  server.tool(
    "copy_order",
    "Create a copy of an existing order, duplicating all line items into a new order.",
    {
      orderId: z.string().describe("The source order ID to copy"),
    },
    async ({ orderId }) => {
      const client = getClient();
      const data = await client.post(`/api/v1/order/${orderId}/copytoorder`);
      return { content: [{ type: "text", text: formatEntity(data as any) }] };
    }
  );

  // ── Browse Quotes ───────────────────────────────────────────────────────

  server.tool(
    "browse_quotes",
    "Search and browse quotes (pre-order proposals sent to customers).",
    browseSchema,
    async (args) => {
      const client = getClient();
      const request = buildBrowseRequest(args);
      const data = await client.post("/api/v1/quote/browse", request);
      return { content: [{ type: "text", text: formatBrowseResult(data as any) }] };
    }
  );

  // ── Get Quote ───────────────────────────────────────────────────────────

  server.tool(
    "get_quote",
    "Get full details of a specific quote.",
    {
      quoteId: z.string().describe("The quote ID"),
    },
    async ({ quoteId }) => {
      const client = getClient();
      const data = await client.get(`/api/v1/quote/${quoteId}`);
      return { content: [{ type: "text", text: formatEntity(data as any) }] };
    }
  );

  // ── Create Quote ────────────────────────────────────────────────────────

  server.tool(
    "create_quote",
    "Create a new quote for a customer/deal.",
    {
      DealId: z.string().optional().describe("Associated deal ID"),
      CustomerId: z.string().optional().describe("Customer ID"),
      Description: z.string().optional().describe("Quote description"),
      EstimatedStartDate: z.string().optional().describe("Estimated start date"),
      EstimatedStopDate: z.string().optional().describe("Estimated stop date"),
      Location: z.string().optional().describe("Event location"),
    },
    async (args) => {
      const client = getClient();
      const data = await client.post("/api/v1/quote", args);
      return { content: [{ type: "text", text: formatEntity(data as any) }] };
    }
  );

  // ── Convert Quote to Order ──────────────────────────────────────────────

  server.tool(
    "convert_quote_to_order",
    "Convert an approved quote into an active order.",
    {
      quoteId: z.string().describe("The quote ID to convert"),
      locationId: z.string().describe("Location ID for the new order"),
      warehouseId: z.string().describe("Warehouse ID for the new order"),
    },
    async ({ quoteId, locationId, warehouseId }) => {
      const client = getClient();
      const data = await client.post("/api/v1/quote/createorder", {
        QuoteId: quoteId,
        LocationId: locationId,
        WarehouseId: warehouseId,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ── Apply Discount to Order ─────────────────────────────────────────────

  server.tool(
    "apply_order_discount",
    "Apply a bottom-line discount percentage to an entire order.",
    {
      orderId: z.string().describe("The order ID"),
      discountPercent: z.number().describe("Discount percentage (e.g. 10 for 10%)"),
    },
    async ({ orderId, discountPercent }) => {
      const client = getClient();
      const data = await client.post(
        "/api/v1/order/applybottomlinediscountpercent",
        { OrderId: orderId, DiscountPercent: discountPercent }
      );
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
}
