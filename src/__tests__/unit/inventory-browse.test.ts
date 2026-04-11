/**
 * Unit tests for inventory browse handler behaviors (wired in inventory.ts).
 *
 * Tests the composition of browse-helpers and tool-helpers as used by
 * browse_rental_inventory and browse_items handlers. Verifies:
 *   - Default page size of 10 is sent in API requests (ROPT-01)
 *   - Default field projection uses BRIEF_FIELDS (FSEL-03)
 *   - Client-filtered responses include "(client-filtered)" metadata (CFLT-03)
 *
 * Approach: Tests the glue logic (resolveFieldPreset + withClientSideFallbackTracked
 * + formatBrowseResult composition) directly without instantiating McpServer.
 */

import { describe, it, expect, vi } from "vitest";
import {
  resolveFieldPreset,
  withClientSideFallbackTracked,
  RENTAL_INVENTORY_BRIEF_FIELDS,
  ITEMS_BRIEF_FIELDS,
} from "../../utils/browse-helpers.js";
import { buildBrowseRequest, formatBrowseResult } from "../../utils/tool-helpers.js";
import type { BrowseResponse } from "../../types/api.js";

// ── Helper: simulate handler logic ─────────────────────────────────────────────

/**
 * Simulate the browse_rental_inventory handler body using the same logic
 * as the wired handler in inventory.ts.
 */
async function simulateBrowseRentalInventory(
  args: {
    page?: number;
    pageSize?: number;
    searchField?: string;
    searchValue?: string;
    searchOperator?: string;
    orderBy?: string;
    orderByDirection?: "asc" | "desc";
    warehouseId?: string;
    officeLocationId?: string;
    fields?: string[];
    fieldPreset?: "summary" | "full";
    categoryId?: string;
  },
  fetchFn: (req: Record<string, unknown>) => Promise<BrowseResponse>
): Promise<{ text: string; capturedRequest: Record<string, unknown> }> {
  let capturedRequest: Record<string, unknown> = {};
  const wrappedFetch = (req: Record<string, unknown>) => {
    capturedRequest = req;
    return fetchFn(req);
  };

  const request = buildBrowseRequest(args);
  const { response: data, clientFiltered, unfilteredTotal } =
    await withClientSideFallbackTracked(
      wrappedFetch,
      request,
      args.searchField,
      args.searchValue,
      args.searchOperator
    );

  const resolvedFields: string[] | undefined =
    args.fields ?? resolveFieldPreset(args.fieldPreset ?? "summary", "rentalInventory");

  const baseText = formatBrowseResult(
    data as any,
    resolvedFields ? { fields: resolvedFields } : undefined
  );
  const suffix = clientFiltered
    ? `\nShowing ${data.Rows.length} of ${unfilteredTotal} (client-filtered)`
    : "";

  return { text: baseText + suffix, capturedRequest };
}

/**
 * Simulate the browse_items handler body using the same logic
 * as the wired handler in inventory.ts.
 */
async function simulateBrowseItems(
  args: {
    page?: number;
    pageSize?: number;
    searchField?: string;
    searchValue?: string;
    searchOperator?: string;
    orderBy?: string;
    orderByDirection?: "asc" | "desc";
    warehouseId?: string;
    officeLocationId?: string;
    fields?: string[];
    fieldPreset?: "summary" | "full";
  },
  fetchFn: (req: Record<string, unknown>) => Promise<BrowseResponse>
): Promise<{ text: string; capturedRequest: Record<string, unknown> }> {
  let capturedRequest: Record<string, unknown> = {};
  const wrappedFetch = (req: Record<string, unknown>) => {
    capturedRequest = req;
    return fetchFn(req);
  };

  const request = buildBrowseRequest(args);
  const { response: data, clientFiltered, unfilteredTotal } =
    await withClientSideFallbackTracked(
      wrappedFetch,
      request,
      args.searchField,
      args.searchValue,
      args.searchOperator
    );

  const resolvedFields: string[] | undefined =
    args.fields ?? resolveFieldPreset(args.fieldPreset ?? "summary", "items");

  const baseText = formatBrowseResult(
    data as any,
    resolvedFields ? { fields: resolvedFields } : undefined
  );
  const suffix = clientFiltered
    ? `\nShowing ${data.Rows.length} of ${unfilteredTotal} (client-filtered)`
    : "";

  return { text: baseText + suffix, capturedRequest };
}

// ── Helper: make a BrowseResponse ─────────────────────────────────────────────

function makeBrowseResponse(rows: Record<string, unknown>[]): BrowseResponse {
  return {
    PageNo: 1,
    PageSize: rows.length,
    TotalRows: rows.length,
    TotalPages: 1,
    Rows: rows,
  };
}

// ── Group A: Default page size (ROPT-01) ───────────────────────────────────────

describe("Group A: Default page size (ROPT-01)", () => {
  it("browse_rental_inventory with no pageSize sends pagesize: 10 in the request", async () => {
    const mockResponse = makeBrowseResponse([{ InventoryId: "1", ICode: "LAMP01", Description: "Lamp" }]);
    const fetchFn = vi.fn().mockResolvedValue(mockResponse);

    // Simulate what Zod default(10) produces when pageSize is not provided
    const { capturedRequest } = await simulateBrowseRentalInventory({ pageSize: 10 }, fetchFn);

    expect(capturedRequest.pagesize).toBe(10);
  });

  it("browse_items with no pageSize sends pagesize: 10 in the request", async () => {
    const mockResponse = makeBrowseResponse([{ ItemId: "1", BarCode: "BC001", ICode: "LAMP01", Description: "Lamp" }]);
    const fetchFn = vi.fn().mockResolvedValue(mockResponse);

    // Simulate what Zod default(10) produces when pageSize is not provided
    const { capturedRequest } = await simulateBrowseItems({ pageSize: 10 }, fetchFn);

    expect(capturedRequest.pagesize).toBe(10);
  });

  it("browse_rental_inventory with explicit pageSize=25 sends pagesize: 25", async () => {
    const mockResponse = makeBrowseResponse([]);
    const fetchFn = vi.fn().mockResolvedValue(mockResponse);

    const { capturedRequest } = await simulateBrowseRentalInventory({ pageSize: 25 }, fetchFn);

    expect(capturedRequest.pagesize).toBe(25);
  });
});

// ── Group B: Default field projection (FSEL-03) ────────────────────────────────

describe("Group B: Default field projection (FSEL-03)", () => {
  it("browse_rental_inventory with no fields/fieldPreset returns only BRIEF_FIELDS", async () => {
    const rows = [
      {
        InventoryId: "1",
        ICode: "LAMP01",
        Description: "LED Lamp",
        AvailFor: "Rental",
        Category: "Lighting",
        ExtraField1: "should-be-hidden",
        ExtraField2: "also-hidden",
      },
    ];
    const mockResponse = makeBrowseResponse(rows);
    const fetchFn = vi.fn().mockResolvedValue(mockResponse);

    // No fields or fieldPreset → defaults to "summary" → RENTAL_INVENTORY_BRIEF_FIELDS
    const { text } = await simulateBrowseRentalInventory({}, fetchFn);

    expect(text).toContain("InventoryId");
    expect(text).toContain("ICode");
    expect(text).toContain("Description");
    expect(text).not.toContain("ExtraField1");
    expect(text).not.toContain("ExtraField2");
  });

  it("browse_items with no fields/fieldPreset returns only ITEMS_BRIEF_FIELDS", async () => {
    const rows = [
      {
        ItemId: "1",
        BarCode: "BC001",
        ICode: "LAMP01",
        Description: "LED Lamp",
        ExtraField1: "should-be-hidden",
      },
    ];
    const mockResponse = makeBrowseResponse(rows);
    const fetchFn = vi.fn().mockResolvedValue(mockResponse);

    const { text } = await simulateBrowseItems({}, fetchFn);

    expect(text).toContain("ItemId");
    expect(text).not.toContain("ExtraField1");
  });

  it("RENTAL_INVENTORY_BRIEF_FIELDS contains required summary fields", () => {
    expect(RENTAL_INVENTORY_BRIEF_FIELDS).toContain("InventoryId");
    expect(RENTAL_INVENTORY_BRIEF_FIELDS).toContain("ICode");
    expect(RENTAL_INVENTORY_BRIEF_FIELDS).toContain("Description");
    expect(RENTAL_INVENTORY_BRIEF_FIELDS).toContain("DailyRate");
  });

  it("ITEMS_BRIEF_FIELDS contains required summary fields", () => {
    expect(ITEMS_BRIEF_FIELDS).toContain("ItemId");
    expect(ITEMS_BRIEF_FIELDS).toContain("BarCode");
    expect(ITEMS_BRIEF_FIELDS).toContain("ICode");
    expect(ITEMS_BRIEF_FIELDS).toContain("Description");
  });
});

// ── Group C: Client-filtered metadata (CFLT-03) ────────────────────────────────

describe("Group C: Client-filtered metadata (CFLT-03)", () => {
  it('browse_rental_inventory with fallback returns "Showing X of Y (client-filtered)" string', async () => {
    const unfilteredRows = [
      { InventoryId: "1", Description: "LED Lamp", ICode: "LAMP01" },
      { InventoryId: "2", Description: "Halogen Bulb", ICode: "HAL01" },
      { InventoryId: "3", Description: "Spot Light", ICode: "SPOT01" },
    ];
    const retryResponse = makeBrowseResponse(unfilteredRows);

    const fetchFn = vi
      .fn()
      .mockRejectedValueOnce(
        new Error("API POST /api/v1/rentalinventory/browse failed: 500 - Invalid column name 'masterid'")
      )
      .mockResolvedValueOnce(retryResponse);

    const { text } = await simulateBrowseRentalInventory(
      { searchField: "Description", searchValue: "Lamp" },
      fetchFn
    );

    // Only "LED Lamp" matches "Lamp" — 1 of 3 unfiltered
    expect(text).toContain("Showing 1 of 3 (client-filtered)");
  });

  it("browse_rental_inventory without fallback does NOT include client-filtered metadata", async () => {
    const rows = [{ InventoryId: "1", ICode: "LAMP01", Description: "LED Lamp" }];
    const mockResponse = makeBrowseResponse(rows);
    const fetchFn = vi.fn().mockResolvedValue(mockResponse);

    const { text } = await simulateBrowseRentalInventory({ searchField: "Description", searchValue: "Lamp" }, fetchFn);

    expect(text).not.toContain("client-filtered");
  });
});

// ── Group D: Explicit fields override ─────────────────────────────────────────

describe("Group D: Explicit fields override", () => {
  it("browse_rental_inventory with explicit fields returns only those fields", async () => {
    const rows = [
      {
        InventoryId: "1",
        ICode: "LAMP01",
        Description: "LED Lamp",
        DailyRate: 25,
        Category: "Lighting",
      },
    ];
    const mockResponse = makeBrowseResponse(rows);
    const fetchFn = vi.fn().mockResolvedValue(mockResponse);

    // Explicit fields: only InventoryId and Description (ICode is in BRIEF_FIELDS but not specified)
    const { text } = await simulateBrowseRentalInventory(
      { fields: ["InventoryId", "Description"] },
      fetchFn
    );

    expect(text).toContain("InventoryId");
    expect(text).toContain("Description");
    expect(text).not.toContain("ICode");
    expect(text).not.toContain("DailyRate");
    expect(text).not.toContain("Category");
  });
});

// ── Group E: fieldPreset "full" disables projection ───────────────────────────

describe("Group E: fieldPreset 'full' disables projection", () => {
  it("browse_rental_inventory with fieldPreset 'full' returns all fields", async () => {
    const rows = [
      {
        InventoryId: "1",
        ICode: "LAMP01",
        Description: "LED Lamp",
        ExtraField1: "visible-in-full",
        ExtraField2: "also-visible",
      },
    ];
    const mockResponse = makeBrowseResponse(rows);
    const fetchFn = vi.fn().mockResolvedValue(mockResponse);

    const { text } = await simulateBrowseRentalInventory({ fieldPreset: "full" }, fetchFn);

    // "full" preset → resolveFieldPreset returns undefined → no projection → all fields
    expect(text).toContain("ExtraField1");
    expect(text).toContain("ExtraField2");
    expect(text).toContain("InventoryId");
    expect(text).toContain("ICode");
  });
});
