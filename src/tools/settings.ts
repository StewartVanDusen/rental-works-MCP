/**
 * Settings and Configuration tools
 *
 * Covers: settings-v1 API (1,433 endpoints) - warehouses, categories,
 * crews, discount items, templates, etc.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient } from "../utils/api-client.js";
import {
  browseSchema,
  browseTool,
  buildBrowseRequest,
  formatBrowseResult,
  formatEntity,
  withErrorHandling,
} from "../utils/tool-helpers.js";

export function registerSettingsTools(server: McpServer) {
  // ── Browse Warehouses ───────────────────────────────────────────────────

  server.tool(
    "browse_warehouses",
    "Browse all warehouses/locations configured in the system.",
    browseSchema,
    browseTool("warehouse")
  );

  // ── Get Warehouse ───────────────────────────────────────────────────────

  server.tool(
    "get_warehouse",
    "Get details of a specific warehouse.",
    {
      warehouseId: z.string().describe("The warehouse ID"),
    },
    withErrorHandling(async ({ warehouseId }) => {
      const client = getClient();
      const data = await client.get<Record<string, unknown>>(`/api/v1/warehouse/${warehouseId}`);
      return { content: [{ type: "text", text: formatEntity(data) }] };
    })
  );

  // ── Browse Rental Categories ────────────────────────────────────────────

  server.tool(
    "browse_rental_categories",
    "Browse rental inventory categories (e.g. Lighting, Audio, Video, Staging).",
    browseSchema,
    browseTool("rentalcategory")
  );

  // ── Browse Sales Categories ─────────────────────────────────────────────

  server.tool(
    "browse_sales_categories",
    "Browse sales inventory categories.",
    browseSchema,
    browseTool("salescategory")
  );

  // ── Browse Order Types ──────────────────────────────────────────────────

  server.tool(
    "browse_order_types",
    "Browse configured order types (e.g. Rental, Sales, Internal, etc.).",
    browseSchema,
    browseTool("ordertype")
  );

  // ── Browse Crews ────────────────────────────────────────────────────────

  server.tool(
    "browse_crews",
    "Browse crew members (labor/staff that can be assigned to orders).",
    browseSchema,
    browseTool("crew")
  );

  // ── Get Crew ────────────────────────────────────────────────────────────

  server.tool(
    "get_crew",
    "Get details of a specific crew member.",
    {
      crewId: z.string().describe("The crew member ID"),
    },
    withErrorHandling(async ({ crewId }) => {
      const client = getClient();
      const data = await client.get<Record<string, unknown>>(`/api/v1/crew/${crewId}`);
      return { content: [{ type: "text", text: formatEntity(data) }] };
    })
  );

  // ── Browse Discount Items ───────────────────────────────────────────────

  server.tool(
    "browse_discount_items",
    "Browse discount configurations and templates.",
    browseSchema,
    browseTool("discountitem")
  );

  // ── Browse Templates ────────────────────────────────────────────────────

  server.tool(
    "browse_templates",
    "Browse order templates (pre-configured item lists for common setups).",
    browseSchema,
    browseTool("template")
  );

  // ── Browse Labor Rates ──────────────────────────────────────────────────

  server.tool(
    "browse_labor_rates",
    "Browse configured labor rate categories and their rates.",
    browseSchema,
    browseTool("laborrate")
  );

  // ── Get Default Settings ────────────────────────────────────────────────

  server.tool(
    "get_default_settings",
    "Get the system's default settings (default warehouse, office, billing settings, etc.).",
    {},
    withErrorHandling(async () => {
      const client = getClient();
      const data = await client.get<Record<string, unknown>>("/api/v1/defaultsettings");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    })
  );

  // ── Browse Office Locations ─────────────────────────────────────────────

  server.tool(
    "browse_office_locations",
    "Browse configured office locations.",
    browseSchema,
    browseTool("officelocation")
  );

  // ── Browse GL Accounts ──────────────────────────────────────────────────

  server.tool(
    "browse_gl_accounts",
    "Browse general ledger accounts configured in the system.",
    browseSchema,
    browseTool("glaccount")
  );

  // ── Generic Settings Browse ─────────────────────────────────────────────

  server.tool(
    "browse_settings_entity",
    `Browse any settings entity by name. Available entities include:
    Crew, DefaultSettings, DiscountItem, DepartmentAccess, StorefrontCatalog,
    RentalCategory, Warehouse, AvailabilitySettings, SalesCategory, PartsCategory,
    LaborCategory, MiscCategory, OrderType, StorageContainer, TaxOption,
    UserAccess, LaborRate, PoApprover, Position, Template, VendorCatalog,
    CrewPosition, DiscountTemplate, GlAccount, OfficeLocation, Building, and more.`,
    {
      entityName: z.string().describe("Settings entity name (e.g. 'crew', 'warehouse', 'rentalcategory')"),
      ...browseSchema,
    },
    withErrorHandling(async ({ entityName, ...args }) => {
      const client = getClient();
      const request = buildBrowseRequest(args);
      const data = await client.browse(entityName.toLowerCase(), request);
      return { content: [{ type: "text", text: formatBrowseResult(data) }] };
    })
  );
}
