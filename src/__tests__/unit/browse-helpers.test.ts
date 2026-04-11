/**
 * Unit tests for browse-helpers.ts
 * Tests applyClientFilter, withClientSideFallback, and field constants.
 * All tests run without network access or environment variables.
 */

import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  applyClientFilter,
  withClientSideFallback,
  RENTAL_INVENTORY_BRIEF_FIELDS,
  ITEMS_BRIEF_FIELDS,
} from "../../utils/browse-helpers.js";
import type { BrowseResponse } from "../../types/api.js";

// ── applyClientFilter ──────────────────────────────────────────────────────────

describe("applyClientFilter", () => {
  it('Test 1: "like" operator returns case-insensitive substring matches', () => {
    const rows = [{ Description: "LED Lamp" }, { Description: "Halogen" }];
    const result = applyClientFilter(rows, "Description", "lamp", "like");
    expect(result).toEqual([{ Description: "LED Lamp" }]);
  });

  it('Test 2: "contains" operator returns case-insensitive substring matches', () => {
    const rows = [{ Description: "LED Lamp" }, { Description: "Halogen" }];
    const result = applyClientFilter(rows, "Description", "lamp", "contains");
    expect(result).toEqual([{ Description: "LED Lamp" }]);
  });

  it('Test 3: "startswith" operator returns case-insensitive prefix matches', () => {
    const rows = [{ ICode: "LAMP01" }, { ICode: "SPOT02" }];
    const result = applyClientFilter(rows, "ICode", "LAMP", "startswith");
    expect(result).toEqual([{ ICode: "LAMP01" }]);
  });

  it('Test 4: "endswith" operator returns case-insensitive suffix matches', () => {
    const rows = [{ ICode: "LAMP01" }, { ICode: "SPOT01" }];
    const result = applyClientFilter(rows, "ICode", "01", "endswith");
    expect(result).toEqual([{ ICode: "LAMP01" }, { ICode: "SPOT01" }]);
  });

  it('Test 5: "=" operator returns exact string matches (case-sensitive)', () => {
    const rows = [{ Status: "Active" }, { Status: "Inactive" }];
    const result = applyClientFilter(rows, "Status", "Active", "=");
    expect(result).toEqual([{ Status: "Active" }]);
  });

  it('Test 6: "<>" operator returns rows that do not equal the value', () => {
    const rows = [{ Status: "Active" }, { Status: "Inactive" }];
    const result = applyClientFilter(rows, "Status", "Active", "<>");
    expect(result).toEqual([{ Status: "Inactive" }]);
  });

  it("Test 7: rows with null/undefined field values are excluded for substring operators", () => {
    const rows = [
      { Description: null },
      { Description: undefined },
      { Description: "LED Lamp" },
    ] as unknown as Record<string, unknown>[];
    const result = applyClientFilter(rows, "Description", "lamp", "like");
    expect(result).toEqual([{ Description: "LED Lamp" }]);
  });

  it("Test 8: empty rows array returns empty array", () => {
    const result = applyClientFilter([], "Description", "lamp", "like");
    expect(result).toEqual([]);
  });

  it("Test 9: rows missing the target field are excluded", () => {
    const rows = [{ OtherField: "LED Lamp" }, { Description: "Halogen" }];
    const result = applyClientFilter(rows, "Description", "lamp", "like");
    expect(result).toEqual([]);
  });
});

// ── withClientSideFallback ─────────────────────────────────────────────────────

describe("withClientSideFallback", () => {
  it("Test 10: when fetchFn succeeds, returns result directly without retry", async () => {
    const mockResponse: BrowseResponse = {
      PageNo: 1,
      PageSize: 25,
      TotalRows: 2,
      TotalPages: 1,
      Rows: [{ Description: "LED Lamp" }, { Description: "Halogen" }],
    };
    const fetchFn = vi.fn().mockResolvedValue(mockResponse);
    const request = { searchfields: ["Description"], searchfieldvalues: ["lamp"] };

    const result = await withClientSideFallback(fetchFn, request);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(result).toEqual(mockResponse);
  });

  it('Test 11: when fetchFn throws "Invalid column name", retries without search fields and applies client filter', async () => {
    const retryResponse: BrowseResponse = {
      PageNo: 1,
      PageSize: 25,
      TotalRows: 3,
      TotalPages: 1,
      Rows: [
        { Description: "LED Lamp" },
        { Description: "Halogen" },
        { Description: "Spot Light" },
      ],
    };

    const fetchFn = vi
      .fn()
      .mockRejectedValueOnce(
        new Error(
          "API POST /api/v1/rentalinventory/browse failed: 500 - Invalid column name 'masterid'"
        )
      )
      .mockResolvedValueOnce(retryResponse);

    const request = {
      searchfields: ["Description"],
      searchfieldvalues: ["Lamp"],
      searchfieldoperators: ["like"],
      searchseparators: ["and"],
    };

    const result = await withClientSideFallback(
      fetchFn,
      request,
      "Description",
      "Lamp",
      "like"
    );

    expect(fetchFn).toHaveBeenCalledTimes(2);
    // Second call should have search fields stripped
    const secondCallArg = fetchFn.mock.calls[1][0] as Record<string, unknown>;
    expect(secondCallArg.searchfields).toBeUndefined();
    expect(secondCallArg.searchfieldvalues).toBeUndefined();
    expect(secondCallArg.searchfieldoperators).toBeUndefined();
    expect(secondCallArg.searchseparators).toBeUndefined();

    // Result rows should be filtered client-side
    expect(result.Rows).toEqual([{ Description: "LED Lamp" }]);
    expect(result.TotalRows).toBe(1);
  });

  it("Test 12: when fetchFn throws a non-column error, re-throws unchanged", async () => {
    const originalError = new Error("503 Service Unavailable");
    const fetchFn = vi.fn().mockRejectedValue(originalError);

    await expect(
      withClientSideFallback(fetchFn, {})
    ).rejects.toThrow("503 Service Unavailable");

    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("Test 13: when retry also fails, throws the retry error", async () => {
    const retryError = new Error("503 Service Unavailable on retry");

    const fetchFn = vi
      .fn()
      .mockRejectedValueOnce(
        new Error("API POST failed: 500 - Invalid column name 'foo'")
      )
      .mockRejectedValueOnce(retryError);

    await expect(
      withClientSideFallback(fetchFn, {})
    ).rejects.toThrow("503 Service Unavailable on retry");

    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});

// ── field constants ────────────────────────────────────────────────────────────

describe("field constants", () => {
  it("Test 14: RENTAL_INVENTORY_BRIEF_FIELDS is a string array containing required fields", () => {
    expect(Array.isArray(RENTAL_INVENTORY_BRIEF_FIELDS)).toBe(true);
    expect(RENTAL_INVENTORY_BRIEF_FIELDS).toContain("InventoryId");
    expect(RENTAL_INVENTORY_BRIEF_FIELDS).toContain("ICode");
    expect(RENTAL_INVENTORY_BRIEF_FIELDS).toContain("Description");
  });

  it("Test 15: ITEMS_BRIEF_FIELDS is a string array containing required fields", () => {
    expect(Array.isArray(ITEMS_BRIEF_FIELDS)).toBe(true);
    expect(ITEMS_BRIEF_FIELDS).toContain("ItemId");
    expect(ITEMS_BRIEF_FIELDS).toContain("BarCode");
    expect(ITEMS_BRIEF_FIELDS).toContain("ICode");
    expect(ITEMS_BRIEF_FIELDS).toContain("Description");
  });
});

// ── module purity ──────────────────────────────────────────────────────────────

describe("module purity", () => {
  it("Test 16: browse-helpers.ts does not import from @modelcontextprotocol/sdk", () => {
    const filePath = join(
      process.cwd(),
      "src/utils/browse-helpers.ts"
    );
    const content = readFileSync(filePath, "utf-8");
    expect(content).not.toContain("@modelcontextprotocol/sdk");
  });
});
