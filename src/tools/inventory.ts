/**
 * Inventory tools - Rental, Sales, Parts inventory management
 *
 * Covers tags: RentalInventory (110 endpoints), SalesInventory (51),
 * PartsInventory (42), Item (32), PhysicalInventory (55)
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

export function registerInventoryTools(server: McpServer) {
  // ── Browse Rental Inventory ─────────────────────────────────────────────

  server.tool(
    "browse_rental_inventory",
    "Search and browse rental inventory items with filtering, pagination, and sorting. Returns ICode, description, rates, quantities, category, warehouse info.",
    {
      ...browseSchema,
      categoryId: z.string().optional().describe("Filter by rental category ID"),
    },
    async (args) => {
      const client = getClient();
      const request = buildBrowseRequest(args);
      const data = await client.post("/api/v1/rentalinventory/browse", request);
      return { content: [{ type: "text", text: formatBrowseResult(data as any) }] };
    }
  );

  // ── Get Rental Inventory by ID ──────────────────────────────────────────

  server.tool(
    "get_rental_inventory",
    "Get full details of a specific rental inventory item by its ID. Returns rates, quantities, tracking info, images, and warehouse data.",
    {
      inventoryId: z.string().describe("The rental inventory item ID"),
    },
    async ({ inventoryId }) => {
      const client = getClient();
      const data = await client.get(`/api/v1/rentalinventory/${inventoryId}`);
      return { content: [{ type: "text", text: formatEntity(data as any) }] };
    }
  );

  // ── Create Rental Inventory ─────────────────────────────────────────────

  server.tool(
    "create_rental_inventory",
    "Create a new rental inventory item. Requires ICode and Description at minimum.",
    {
      ICode: z.string().describe("Inventory code (unique identifier)"),
      Description: z.string().describe("Item description"),
      CategoryId: z.string().optional().describe("Rental category ID"),
      SubCategoryId: z.string().optional().describe("Sub-category ID"),
      UnitId: z.string().optional().describe("Unit of measure ID"),
      TrackedBy: z.enum(["QUANTITY", "SERIALNO", "BARCODE"]).optional().describe("How this item is tracked"),
      DailyRate: z.number().optional().describe("Daily rental rate"),
      WeeklyRate: z.number().optional().describe("Weekly rental rate"),
      MonthlyRate: z.number().optional().describe("Monthly rental rate"),
      ReplacementCost: z.number().optional().describe("Replacement cost"),
      WarehouseId: z.string().optional().describe("Default warehouse ID"),
    },
    async (args) => {
      const client = getClient();
      const data = await client.post("/api/v1/rentalinventory", args);
      return { content: [{ type: "text", text: formatEntity(data as any) }] };
    }
  );

  // ── Update Rental Inventory ─────────────────────────────────────────────

  server.tool(
    "update_rental_inventory",
    "Update an existing rental inventory item's properties (rates, description, category, etc.).",
    {
      InventoryId: z.string().describe("The inventory item ID to update"),
      Description: z.string().optional().describe("Updated description"),
      DailyRate: z.number().optional().describe("Updated daily rate"),
      WeeklyRate: z.number().optional().describe("Updated weekly rate"),
      MonthlyRate: z.number().optional().describe("Updated monthly rate"),
      ReplacementCost: z.number().optional().describe("Updated replacement cost"),
      CategoryId: z.string().optional().describe("Updated category ID"),
      Inactive: z.boolean().optional().describe("Set active/inactive status"),
    },
    async ({ InventoryId, ...updates }) => {
      const client = getClient();
      const data = await client.put(`/api/v1/rentalinventory/${InventoryId}`, updates);
      return { content: [{ type: "text", text: formatEntity(data as any) }] };
    }
  );

  // ── Delete Rental Inventory ─────────────────────────────────────────────

  server.tool(
    "delete_rental_inventory",
    "Delete a rental inventory item by ID. Only works if the item has no active dependencies.",
    {
      inventoryId: z.string().describe("The inventory item ID to delete"),
    },
    async ({ inventoryId }) => {
      const client = getClient();
      await client.delete(`/api/v1/rentalinventory/${inventoryId}`);
      return { content: [{ type: "text", text: `Rental inventory ${inventoryId} deleted.` }] };
    }
  );

  // ── Browse Sales Inventory ──────────────────────────────────────────────

  server.tool(
    "browse_sales_inventory",
    "Search and browse sales inventory items (items for sale, not rental).",
    browseSchema,
    async (args) => {
      const client = getClient();
      const request = buildBrowseRequest(args);
      const data = await client.post("/api/v1/salesinventory/browse", request);
      return { content: [{ type: "text", text: formatBrowseResult(data as any) }] };
    }
  );

  // ── Get Sales Inventory by ID ───────────────────────────────────────────

  server.tool(
    "get_sales_inventory",
    "Get full details of a specific sales inventory item.",
    {
      inventoryId: z.string().describe("The sales inventory item ID"),
    },
    async ({ inventoryId }) => {
      const client = getClient();
      const data = await client.get(`/api/v1/salesinventory/${inventoryId}`);
      return { content: [{ type: "text", text: formatEntity(data as any) }] };
    }
  );

  // ── Browse Parts Inventory ──────────────────────────────────────────────

  server.tool(
    "browse_parts_inventory",
    "Search and browse parts inventory (consumable parts and supplies).",
    browseSchema,
    async (args) => {
      const client = getClient();
      const request = buildBrowseRequest(args);
      const data = await client.post("/api/v1/partsinventory/browse", request);
      return { content: [{ type: "text", text: formatBrowseResult(data as any) }] };
    }
  );

  // ── Browse Individual Items (Barcoded/Serialized) ───────────────────────

  server.tool(
    "browse_items",
    "Search serialized/barcoded individual items (physical assets). Find by barcode, serial number, or description.",
    browseSchema,
    async (args) => {
      const client = getClient();
      const request = buildBrowseRequest(args);
      const data = await client.post("/api/v1/item/browse", request);
      return { content: [{ type: "text", text: formatBrowseResult(data as any) }] };
    }
  );

  // ── Get Item by Barcode ─────────────────────────────────────────────────

  server.tool(
    "get_item_by_barcode",
    "Look up an individual item (asset) by its barcode string.",
    {
      barcode: z.string().describe("The barcode to look up"),
    },
    async ({ barcode }) => {
      const client = getClient();
      const data = await client.get(`/api/v1/item/bybarcode/${encodeURIComponent(barcode)}`);
      return { content: [{ type: "text", text: formatEntity(data as any) }] };
    }
  );

  // ── Inventory Availability ──────────────────────────────────────────────

  server.tool(
    "get_inventory_availability",
    "Get the availability legend/status for a rental inventory item, showing quantity breakdown across statuses.",
    {
      inventoryId: z.string().describe("The rental inventory item ID"),
    },
    async ({ inventoryId }) => {
      const client = getClient();
      const data = await client.get(`/api/v1/rentalinventory/${inventoryId}/availabilitylegend`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ── Physical Inventory Browse ───────────────────────────────────────────

  server.tool(
    "browse_physical_inventory",
    "Browse physical inventory count sessions. Used for cycle counts and full physical inventories.",
    browseSchema,
    async (args) => {
      const client = getClient();
      const request = buildBrowseRequest(args);
      const data = await client.post("/api/v1/physicalinventory/browse", request);
      return { content: [{ type: "text", text: formatBrowseResult(data as any) }] };
    }
  );

  // ── Copy Rental Inventory ───────────────────────────────────────────────

  server.tool(
    "copy_rental_inventory",
    "Create a copy of an existing rental inventory item with a new ICode.",
    {
      inventoryId: z.string().describe("The source inventory item ID to copy"),
    },
    async ({ inventoryId }) => {
      const client = getClient();
      const data = await client.post(`/api/v1/rentalinventory/${inventoryId}/copy`);
      return { content: [{ type: "text", text: formatEntity(data as any) }] };
    }
  );
}
