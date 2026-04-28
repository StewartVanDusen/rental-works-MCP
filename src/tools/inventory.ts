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
  browseTool,
  formatEntity,
  withErrorHandling,
} from "../utils/tool-helpers.js";

export function registerInventoryTools(server: McpServer) {
  // ── Browse Rental Inventory ─────────────────────────────────────────────

  server.tool(
    "browse_rental_inventory",
    "Search and browse rental inventory items with filtering, pagination, and sorting. Returns ICode, description, rates, quantities, category, warehouse info.",
    {
      ...browseSchema,
      pageSize: z
        .coerce.number()
        .int()
        .positive()
        .max(500)
        .optional()
        .default(10)
        .describe("Results per page (default: 10, max: 500)"),
      categoryId: z.string().optional().describe("Filter by rental category ID"),
    },
    browseTool("rentalinventory")
  );

  // ── Get Rental Inventory by ID ──────────────────────────────────────────

  server.tool(
    "get_rental_inventory",
    "Get full details of a specific rental inventory item by its ID. Returns rates, quantities, tracking info, images, and warehouse data.",
    {
      inventoryId: z.string().describe("The rental inventory item ID"),
    },
    withErrorHandling(async ({ inventoryId }) => {
      const client = getClient();
      const data = await client.get<Record<string, unknown>>(`/api/v1/rentalinventory/${inventoryId}`);
      return { content: [{ type: "text", text: formatEntity(data) }] };
    })
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
      DailyRate: z.coerce.number().optional().describe("Daily rental rate"),
      WeeklyRate: z.coerce.number().optional().describe("Weekly rental rate"),
      MonthlyRate: z.coerce.number().optional().describe("Monthly rental rate"),
      ReplacementCost: z.coerce.number().optional().describe("Replacement cost"),
      WarehouseId: z.string().optional().describe("Default warehouse ID"),
    },
    withErrorHandling(async (args) => {
      const client = getClient();
      const data = await client.post<Record<string, unknown>>("/api/v1/rentalinventory", args);
      return { content: [{ type: "text", text: formatEntity(data) }] };
    })
  );

  // ── Update Rental Inventory ─────────────────────────────────────────────

  server.tool(
    "update_rental_inventory",
    "Update an existing rental inventory item's properties (rates, description, category, etc.).",
    {
      InventoryId: z.string().describe("The inventory item ID to update"),
      Description: z.string().optional().describe("Updated description"),
      DailyRate: z.coerce.number().optional().describe("Updated daily rate"),
      WeeklyRate: z.coerce.number().optional().describe("Updated weekly rate"),
      MonthlyRate: z.coerce.number().optional().describe("Updated monthly rate"),
      ReplacementCost: z.coerce.number().optional().describe("Updated replacement cost"),
      CategoryId: z.string().optional().describe("Updated category ID"),
      Inactive: z.coerce.boolean().optional().describe("Set active/inactive status"),
    },
    withErrorHandling(async ({ InventoryId, ...updates }) => {
      const client = getClient();
      const data = await client.put<Record<string, unknown>>(`/api/v1/rentalinventory/${InventoryId}`, updates);
      return { content: [{ type: "text", text: formatEntity(data) }] };
    })
  );

  // ── Delete Rental Inventory ─────────────────────────────────────────────

  server.tool(
    "delete_rental_inventory",
    "Delete a rental inventory item by ID. Only works if the item has no active dependencies.",
    {
      inventoryId: z.string().describe("The inventory item ID to delete"),
    },
    withErrorHandling(async ({ inventoryId }) => {
      const client = getClient();
      await client.delete(`/api/v1/rentalinventory/${inventoryId}`);
      return { content: [{ type: "text", text: `Rental inventory ${inventoryId} deleted.` }] };
    })
  );

  // ── Browse Sales Inventory ──────────────────────────────────────────────

  server.tool(
    "browse_sales_inventory",
    "Search and browse sales inventory items (items for sale, not rental).",
    browseSchema,
    browseTool("salesinventory")
  );

  // ── Get Sales Inventory by ID ───────────────────────────────────────────

  server.tool(
    "get_sales_inventory",
    "Get full details of a specific sales inventory item.",
    {
      inventoryId: z.string().describe("The sales inventory item ID"),
    },
    withErrorHandling(async ({ inventoryId }) => {
      const client = getClient();
      const data = await client.get<Record<string, unknown>>(`/api/v1/salesinventory/${inventoryId}`);
      return { content: [{ type: "text", text: formatEntity(data) }] };
    })
  );

  // ── Browse Parts Inventory ──────────────────────────────────────────────

  server.tool(
    "browse_parts_inventory",
    "Search and browse parts inventory (consumable parts and supplies).",
    browseSchema,
    browseTool("partsinventory")
  );

  // ── Browse Individual Items (Barcoded/Serialized) ───────────────────────

  server.tool(
    "browse_items",
    "Search serialized/barcoded individual items (physical assets). Find by barcode, serial number, or description.",
    {
      ...browseSchema,
      pageSize: z
        .coerce.number()
        .int()
        .positive()
        .max(500)
        .optional()
        .default(10)
        .describe("Results per page (default: 10, max: 500)"),
    },
    browseTool("item")
  );

  // ── Get Item by Barcode ─────────────────────────────────────────────────

  server.tool(
    "get_item_by_barcode",
    "Look up an individual item (asset) by its barcode string.",
    {
      barcode: z.string().describe("The barcode to look up"),
    },
    withErrorHandling(async ({ barcode }) => {
      const client = getClient();
      const data = await client.get<Record<string, unknown>>(`/api/v1/item/bybarcode?barCode=${encodeURIComponent(barcode)}`);
      return { content: [{ type: "text", text: formatEntity(data) }] };
    })
  );

  // ── Inventory Availability ──────────────────────────────────────────────

  server.tool(
    "get_inventory_availability",
    "Get the rental inventory availability legend — reference data explaining what each availability status means.",
    {},
    withErrorHandling(async () => {
      const client = getClient();
      const data = await client.get("/api/v1/rentalinventory/availabilitylegend");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    })
  );

  // ── Physical Inventory Browse ───────────────────────────────────────────

  server.tool(
    "browse_physical_inventory",
    "Browse physical inventory count sessions. Used for cycle counts and full physical inventories.",
    browseSchema,
    browseTool("physicalinventory")
  );

  // ── Copy Rental Inventory ───────────────────────────────────────────────

  server.tool(
    "copy_rental_inventory",
    "Create a copy of an existing rental inventory item with a new ICode.",
    {
      inventoryId: z.string().describe("The source inventory item ID to copy"),
    },
    withErrorHandling(async ({ inventoryId }) => {
      const client = getClient();
      const data = await client.post<Record<string, unknown>>(`/api/v1/rentalinventory/${inventoryId}/copy`);
      return { content: [{ type: "text", text: formatEntity(data) }] };
    })
  );
}
