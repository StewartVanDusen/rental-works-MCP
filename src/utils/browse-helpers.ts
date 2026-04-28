/**
 * Client-side browse filtering utilities for RentalWorks API.
 *
 * Provides fallback logic for endpoints that return "Invalid column name" errors
 * when server-side search is attempted on unsupported fields. In those cases,
 * we fetch all rows (no server filter) and apply filtering client-side.
 *
 * Zero MCP SDK dependency — pure TypeScript utility with no external imports.
 */

import { z } from "zod";
import type { BrowseResponse } from "../types/api.js";


// ── Field constants ────────────────────────────────────────────────────────────

/**
 * Field names for a brief/summary view of rental inventory records.
 * Used to limit response size when fetching all rows for client-side filtering.
 */
export const RENTAL_INVENTORY_BRIEF_FIELDS: string[] = [
  "InventoryId",
  "ICode",
  "Description",
  "AvailFor",
  "Category",
  "SubCategory",
  "Manufacturer",
  "TrackedBy",
  "DailyRate",
  "WeeklyRate",
  "MonthlyRate",
  "Quantity",
  "QuantityIn",
  "QuantityOut",
  "Warehouse",
];

/**
 * Field names for a brief/summary view of individual item records.
 * Used to limit response size when fetching all rows for client-side filtering.
 */
export const ITEMS_BRIEF_FIELDS: string[] = [
  "ItemId",
  "BarCode",
  "SerialNumber",
  "RfId",
  "ICode",
  "Description",
  "InventoryId",
  "Warehouse",
  "OwnershipStatus",
  "Condition",
];


// ── Field selection schema ───────────────────────────────────────────────────

/**
 * Zod schema fields for optional field selection in inventory browse tools.
 * Spread alongside browseSchema in inventory tool definitions only —
 * must NOT be added to the shared browseSchema in tool-helpers.ts.
 */
export const inventoryFieldSchema = {
  fields: z
    .array(z.string())
    .optional()
    .describe("Return only these fields per row (e.g. ['InventoryId', 'Description'])"),
  fieldPreset: z
    .enum(["summary", "full"])
    .optional()
    .describe("Named field preset: 'summary' returns brief fields set, 'full' returns all fields"),
};


// ── Field projection ─────────────────────────────────────────────────────────

/**
 * Project rows to include only the specified fields.
 * Returns new row objects — does not mutate the originals.
 * If fields is empty, returns rows unchanged.
 */
export function projectFields(
  rows: Record<string, unknown>[],
  fields: string[]
): Record<string, unknown>[] {
  if (fields.length === 0) return rows;
  return rows.map((row) => {
    const projected: Record<string, unknown> = {};
    for (const field of fields) {
      if (field in row) {
        projected[field] = row[field];
      }
    }
    return projected;
  });
}

/**
 * Resolve a field preset name to a concrete array of field names.
 * Returns undefined for "full" preset or undefined input (meaning no projection).
 */
export function resolveFieldPreset(
  fieldPreset: string | undefined,
  entityType: "rentalInventory" | "items"
): string[] | undefined {
  if (!fieldPreset) return undefined;
  if (fieldPreset === "summary") {
    return entityType === "rentalInventory"
      ? RENTAL_INVENTORY_BRIEF_FIELDS
      : ITEMS_BRIEF_FIELDS;
  }
  // "full" = no projection (return all fields)
  return undefined;
}


// ── applyClientFilter ──────────────────────────────────────────────────────────

/**
 * Filter an array of rows by a field value using the specified operator.
 *
 * Supported operators:
 *   - "like" / "contains": case-insensitive substring match
 *   - "startswith": case-insensitive prefix match
 *   - "endswith": case-insensitive suffix match
 *   - "=": exact string equality (case-sensitive)
 *   - "<>": exact string inequality (case-sensitive)
 *   - ">", ">=", "<", "<=": numeric comparison (both sides parsed via Number());
 *      rows where the field cannot be coerced to a finite number are excluded
 *
 * Rows where the target field is null, undefined, or missing are excluded.
 *
 * @param rows - Array of row objects from a BrowseResponse
 * @param field - Field name to filter on
 * @param value - Value to compare against
 * @param operator - Comparison operator (see above)
 * @returns Filtered array of rows
 */
export function applyClientFilter(
  rows: Record<string, unknown>[],
  field: string,
  value: string,
  operator: string
): Record<string, unknown>[] {
  return rows.filter((row) => {
    const rawValue = row[field];

    // Exclude rows where the field is missing or null/undefined
    if (rawValue === null || rawValue === undefined || !(field in row)) {
      return false;
    }

    const fieldStr = String(rawValue);
    const valueLower = value.toLowerCase();
    const fieldLower = fieldStr.toLowerCase();

    switch (operator) {
      case "like":
      case "contains":
        return fieldLower.includes(valueLower);
      case "startswith":
        return fieldLower.startsWith(valueLower);
      case "endswith":
        return fieldLower.endsWith(valueLower);
      case "=":
        return fieldStr === value;
      case "<>":
        return fieldStr !== value;
      case ">":
      case ">=":
      case "<":
      case "<=": {
        const fieldNum = Number(fieldStr);
        const valueNum = Number(value);
        if (!Number.isFinite(fieldNum) || !Number.isFinite(valueNum)) return false;
        if (operator === ">")  return fieldNum >  valueNum;
        if (operator === ">=") return fieldNum >= valueNum;
        if (operator === "<")  return fieldNum <  valueNum;
        return fieldNum <= valueNum;
      }
      default:
        // Unknown operator — exclude row (safe default)
        return false;
    }
  });
}


// ── withClientSideFallback ─────────────────────────────────────────────────────

/**
 * Result type for withClientSideFallbackTracked — includes metadata about
 * whether client-side filtering was applied and the pre-filter total row count.
 */
export type ClientSideFallbackResult<
  T extends Record<string, unknown> = Record<string, unknown>
> = {
  response: BrowseResponse<T>;
  clientFiltered: boolean;
  unfilteredTotal: number;
};

/**
 * Execute a browse fetch, falling back to client-side filtering if the API
 * returns an "Invalid column name" error (a known RentalWorks DB bug on some
 * browse endpoints like rentalinventory and item).
 *
 * Fallback behavior:
 *   1. First attempt: call fetchFn with the original request (includes server-side search fields).
 *   2. On "Invalid column name" error: strip search fields from the request and retry.
 *   3. If searchField + searchValue are provided, apply applyClientFilter to the retry result.
 *   4. Update result.TotalRows to reflect the filtered count.
 *
 * Non-column-name errors are re-thrown immediately without retry.
 * If the retry also fails, the retry error is thrown.
 *
 * @param fetchFn - Async function that accepts a request object and returns a BrowseResponse
 * @param request - The browse request object (may contain searchfields, searchfieldvalues, etc.)
 * @param searchField - Optional field name to use for client-side filtering on fallback
 * @param searchValue - Optional value to use for client-side filtering on fallback
 * @param searchOperator - Optional operator for client-side filtering (default: "like")
 * @returns BrowseResponse, potentially with client-side-filtered rows
 */
export async function withClientSideFallback<
  T extends Record<string, unknown> = Record<string, unknown>
>(
  fetchFn: (request: Record<string, unknown>) => Promise<BrowseResponse<T>>,
  request: Record<string, unknown>,
  searchField?: string,
  searchValue?: string,
  searchOperator?: string
): Promise<BrowseResponse<T>> {
  try {
    return await fetchFn(request);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (!message.includes("Invalid column name")) {
      // Not a column error — re-throw unchanged
      throw err;
    }

    // Strip server-side search fields and retry
    const strippedRequest = { ...request };
    delete strippedRequest.searchfields;
    delete strippedRequest.searchfieldvalues;
    delete strippedRequest.searchfieldoperators;
    delete strippedRequest.searchseparators;

    const retryResult = await fetchFn(strippedRequest);

    // Apply client-side filter if search params were provided
    if (searchField && searchValue) {
      const operator = searchOperator ?? "like";
      const filteredRows = applyClientFilter(
        retryResult.Rows as Record<string, unknown>[],
        searchField,
        searchValue,
        operator
      ) as T[];

      return {
        ...retryResult,
        Rows: filteredRows,
        TotalRows: filteredRows.length,
      };
    }

    return retryResult;
  }
}


// ── withClientSideFallbackTracked ──────────────────────────────────────────────

/**
 * Like withClientSideFallback, but returns a ClientSideFallbackResult that
 * includes metadata about whether client-side filtering was applied and the
 * pre-filter total row count. Use this when callers need to surface
 * "Showing X of Y (client-filtered)" information to the end user.
 *
 * @param fetchFn - Async function that accepts a request object and returns a BrowseResponse
 * @param request - The browse request object (may contain searchfields, etc.)
 * @param searchField - Optional field name for client-side filtering on fallback
 * @param searchValue - Optional value for client-side filtering on fallback
 * @param searchOperator - Optional operator for client-side filtering (default: "like")
 * @returns ClientSideFallbackResult with response, clientFiltered flag, and unfilteredTotal
 */
export async function withClientSideFallbackTracked<
  T extends Record<string, unknown> = Record<string, unknown>
>(
  fetchFn: (request: Record<string, unknown>) => Promise<BrowseResponse<T>>,
  request: Record<string, unknown>,
  searchField?: string,
  searchValue?: string,
  searchOperator?: string
): Promise<ClientSideFallbackResult<T>> {
  try {
    const response = await fetchFn(request);
    return { response, clientFiltered: false, unfilteredTotal: response.TotalRows };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (!message.includes("Invalid column name")) {
      throw err;
    }

    // Strip server-side search fields and retry
    const strippedRequest = { ...request };
    delete strippedRequest.searchfields;
    delete strippedRequest.searchfieldvalues;
    delete strippedRequest.searchfieldoperators;
    delete strippedRequest.searchseparators;

    const retryResult = await fetchFn(strippedRequest);
    const unfilteredTotal = retryResult.TotalRows;

    // Apply client-side filter if search params were provided
    if (searchField && searchValue) {
      const operator = searchOperator ?? "like";
      const filteredRows = applyClientFilter(
        retryResult.Rows as Record<string, unknown>[],
        searchField,
        searchValue,
        operator
      ) as T[];

      return {
        response: {
          ...retryResult,
          Rows: filteredRows,
          TotalRows: filteredRows.length,
        },
        clientFiltered: true,
        unfilteredTotal,
      };
    }

    return { response: retryResult, clientFiltered: false, unfilteredTotal };
  }
}
