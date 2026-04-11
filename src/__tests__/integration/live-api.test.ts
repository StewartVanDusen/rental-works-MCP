/**
 * Live API Integration Tests
 *
 * Covers: INTG-01 (skip guard), INTG-02 (JWT auth), INTG-03 (browse smoke),
 *         INTG-04 (GET-by-ID), INTG-05 (session), INTG-06 (shape validation)
 *
 * All tests are READ-ONLY — no create, update, or delete calls.
 * Tests skip automatically when RENTALWORKS_BASE_URL is not set.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { getClient, resetClient, RentalWorksClient } from "../../utils/api-client.js";
import type { BrowseResponse, JwtResponse } from "../../types/api.js";
import { RENTAL_INVENTORY_BRIEF_FIELDS, projectFields, withClientSideFallbackTracked } from "../../utils/browse-helpers.js";
import { formatBrowseResult } from "../../utils/tool-helpers.js";

const isLiveEnv = !!process.env.RENTALWORKS_BASE_URL;

describe.skipIf(!isLiveEnv)("Live API Integration Tests", () => {
  let client: RentalWorksClient;

  beforeAll(async () => {
    resetClient();
    client = getClient();
    await client.authenticate();
  }, 15000);

  // -- AUTHENTICATION --

  describe("Authentication (INTG-02)", () => {
    it("acquires a valid JWT token", async () => {
      const jwt = await client.authenticate() as JwtResponse;
      expect(jwt.statuscode).toBe(200);
      expect(typeof jwt.access_token).toBe("string");
      expect(jwt.access_token.length).toBeGreaterThan(0);
    }, 10000);
  });

  // -- SESSION --

  describe("Session (INTG-05)", () => {
    it("returns a valid session object with expected fields", async () => {
      const session = await client.getSession() as Record<string, unknown>;
      expect(session).toHaveProperty("webusersid");
      expect(session).toHaveProperty("usersid");
    }, 10000);
  });

  // -- BROWSE SMOKE TESTS --

  describe("Browse Smoke Tests (INTG-03, INTG-06)", () => {
    it("browses rentalinventory — valid shape", async () => {
      const result = await client.browse<Record<string, unknown>>("rentalinventory", { pagesize: 5 });
      expect(result).toHaveProperty("TotalRows");
      expect(result).toHaveProperty("Rows");
      expect(Array.isArray(result.Rows)).toBe(true);
      expect(typeof result.TotalRows).toBe("number");
      if (result.Rows.length > 0) {
        expect(result.Rows[0]).toHaveProperty("InventoryId");
        expect(result.Rows[0]).toHaveProperty("ICode");
      }
    }, 10000);

    it("browses order — valid shape", async () => {
      const result = await client.browse<Record<string, unknown>>("order", { pagesize: 5 });
      expect(result).toHaveProperty("TotalRows");
      expect(result).toHaveProperty("Rows");
      expect(Array.isArray(result.Rows)).toBe(true);
      expect(typeof result.TotalRows).toBe("number");
      if (result.Rows.length > 0) {
        expect(result.Rows[0]).toHaveProperty("OrderId");
        expect(result.Rows[0]).toHaveProperty("OrderNumber");
      }
    }, 10000);

    it("browses customer — valid shape", async () => {
      const result = await client.browse<Record<string, unknown>>("customer", { pagesize: 5 });
      expect(result).toHaveProperty("TotalRows");
      expect(result).toHaveProperty("Rows");
      expect(Array.isArray(result.Rows)).toBe(true);
      expect(typeof result.TotalRows).toBe("number");
      if (result.Rows.length > 0) {
        expect(result.Rows[0]).toHaveProperty("CustomerId");
        expect(result.Rows[0]).toHaveProperty("Customer");
      }
    }, 10000);

    it("browses deal — valid shape", async () => {
      const result = await client.browse<Record<string, unknown>>("deal", { pagesize: 5 });
      expect(result).toHaveProperty("TotalRows");
      expect(result).toHaveProperty("Rows");
      expect(Array.isArray(result.Rows)).toBe(true);
      expect(typeof result.TotalRows).toBe("number");
      if (result.Rows.length > 0) {
        expect(result.Rows[0]).toHaveProperty("DealId");
        expect(result.Rows[0]).toHaveProperty("Deal");
      }
    }, 10000);

    it("browses address - valid shape", async () => {
      const result = await client.browse<Record<string, unknown>>("address", { pagesize: 5 });
      expect(result).toHaveProperty("TotalRows");
      expect(result).toHaveProperty("Rows");
      expect(Array.isArray(result.Rows)).toBe(true);
      expect(typeof result.TotalRows).toBe("number");
    }, 10000);
  });

  // -- GET-BY-ID TESTS --

  describe("GET-by-ID (INTG-04, INTG-06)", () => {
    it("gets rentalinventory by ID", async () => {
      const browse = await client.browse<Record<string, unknown>>("rentalinventory", { pagesize: 1 });
      if (browse.TotalRows === 0) return; // no data — skip gracefully
      const id = browse.Rows[0]["InventoryId"] as string;
      const record = await client.getById<Record<string, unknown>>("rentalinventory", id);
      expect(record).toHaveProperty("InventoryId");
      expect(record).toHaveProperty("ICode");
    }, 10000);

    it("gets order by ID", async () => {
      const browse = await client.browse<Record<string, unknown>>("order", { pagesize: 1 });
      if (browse.TotalRows === 0) return; // no data — skip gracefully
      const id = browse.Rows[0]["OrderId"] as string;
      const record = await client.getById<Record<string, unknown>>("order", id);
      expect(record).toHaveProperty("OrderId");
      expect(record).toHaveProperty("OrderNumber");
    }, 10000);

    it("gets customer by ID", async () => {
      const browse = await client.browse<Record<string, unknown>>("customer", { pagesize: 1 });
      if (browse.TotalRows === 0) return; // no data — skip gracefully
      const id = browse.Rows[0]["CustomerId"] as string;
      const record = await client.getById<Record<string, unknown>>("customer", id);
      expect(record).toHaveProperty("CustomerId");
      expect(record).toHaveProperty("Customer");
    }, 10000);

    it("gets deal by ID", async () => {
      const browse = await client.browse<Record<string, unknown>>("deal", { pagesize: 1 });
      if (browse.TotalRows === 0) return; // no data — skip gracefully
      const id = browse.Rows[0]["DealId"] as string;
      const record = await client.getById<Record<string, unknown>>("deal", id);
      expect(record).toHaveProperty("DealId");
      expect(record).toHaveProperty("Deal");
    }, 10000);

    it("gets invoice by ID", async () => {
      const browse = await client.browse<Record<string, unknown>>("invoice", { pagesize: 1 });
      if (browse.TotalRows === 0) return; // no data — skip gracefully
      const id = browse.Rows[0]["InvoiceId"] as string;
      const record = await client.getById<Record<string, unknown>>("invoice", id);
      expect(record).toHaveProperty("InvoiceId");
      expect(record).toHaveProperty("InvoiceNumber");
    }, 10000);

    it("gets vendor by ID", async () => {
      const browse = await client.browse<Record<string, unknown>>("vendor", { pagesize: 1 });
      if (browse.TotalRows === 0) return; // no data — skip gracefully
      const id = browse.Rows[0]["VendorId"] as string;
      const record = await client.getById<Record<string, unknown>>("vendor", id);
      expect(record).toHaveProperty("VendorId");
      expect(record).toHaveProperty("Vendor");
    }, 10000);

    it("gets contract by ID", async () => {
      const browse = await client.browse<Record<string, unknown>>("contract", { pagesize: 1 });
      if (browse.TotalRows === 0) return; // no data — skip gracefully
      const id = browse.Rows[0]["ContractId"] as string;
      const record = await client.getById<Record<string, unknown>>("contract", id);
      expect(record).toHaveProperty("ContractId");
      expect(record).toHaveProperty("ContractNumber");
    }, 10000);

    it("gets warehouse by ID", async () => {
      const browse = await client.browse<Record<string, unknown>>("warehouse", { pagesize: 1 });
      if (browse.TotalRows === 0) return; // no data — skip gracefully
      const id = browse.Rows[0]["WarehouseId"] as string;
      const record = await client.getById<Record<string, unknown>>("warehouse", id);
      expect(record).toHaveProperty("WarehouseId");
      expect(record).toHaveProperty("Warehouse");
    }, 10000);

    it("gets address by ID", async () => {
      const browse = await client.browse<Record<string, unknown>>("address", { pagesize: 1 });
      if (browse.TotalRows === 0) return; // no data - skip gracefully
      const id = browse.Rows[0]["AddressId"] as string;
      const record = await client.getById<Record<string, unknown>>("address", id);
      expect(record).toHaveProperty("AddressId");
    }, 10000);
  });

  // -- v1.1 BROWSE ENHANCEMENTS --

  describe("v1.1 Browse Enhancements", () => {
    it("explicit fields array returns only those fields per row", async () => {
      const result = await client.post<BrowseResponse>("/api/v1/rentalinventory/browse", {
        pageno: 1,
        pagesize: 5,
        orderby: "",
        orderbydirection: "asc",
      });

      const projected = projectFields(result.Rows as Record<string, unknown>[], ["InventoryId", "Description"]);

      expect(projected.length).toBeGreaterThan(0);
      for (const row of projected) {
        const keys = Object.keys(row);
        expect(keys.length).toBe(2);
        expect(row).toHaveProperty("InventoryId");
        expect(row).toHaveProperty("Description");
        expect(row).not.toHaveProperty("ICode");
        expect(row).not.toHaveProperty("DailyRate");
      }
    }, 15000);

    it("default BRIEF_FIELDS projection produces compact rows", async () => {
      const result = await client.post<BrowseResponse>("/api/v1/rentalinventory/browse", {
        pageno: 1,
        pagesize: 10,
        orderby: "",
        orderbydirection: "asc",
      });

      const originalRows = result.Rows as Record<string, unknown>[];
      const projected = projectFields(originalRows, RENTAL_INVENTORY_BRIEF_FIELDS);

      expect(projected.length).toBeGreaterThan(0);
      for (const row of projected) {
        const keys = Object.keys(row);
        expect(keys.every((k) => RENTAL_INVENTORY_BRIEF_FIELDS.includes(k))).toBe(true);
      }

      // Projected rows should have fewer keys than originals (if originals have more fields)
      if (originalRows.length > 0 && Object.keys(originalRows[0]).length > RENTAL_INVENTORY_BRIEF_FIELDS.length) {
        expect(Object.keys(projected[0]).length).toBeLessThan(Object.keys(originalRows[0]).length);
      }
    }, 15000);

    it("default browse returns at most 10 items and response under 3,000 chars", async () => {
      const result = await client.post<BrowseResponse>("/api/v1/rentalinventory/browse", {
        pageno: 1,
        pagesize: 10,
        orderby: "",
        orderbydirection: "asc",
      });

      const projectedRows = projectFields(result.Rows as Record<string, unknown>[], RENTAL_INVENTORY_BRIEF_FIELDS);

      const formattedText = formatBrowseResult(
        { ...result, Rows: projectedRows },
        { fields: RENTAL_INVENTORY_BRIEF_FIELDS }
      );

      expect(result.Rows.length).toBeLessThanOrEqual(10);
      expect(formattedText.length).toBeLessThan(3000);
    }, 15000);

    it("client-side fallback handles Invalid column name gracefully", async () => {
      const request = {
        pageno: 1,
        pagesize: 25,
        orderby: "",
        orderbydirection: "asc",
        searchfields: ["masterid"],
        searchfieldvalues: ["test"],
        searchfieldoperators: ["like"],
        searchseparators: [""],
      };

      const result = await withClientSideFallbackTracked(
        (req) => client.post<BrowseResponse>("/api/v1/rentalinventory/browse", req) as Promise<BrowseResponse>,
        request,
        "Description",
        "test",
        "like"
      );

      expect(result.clientFiltered).toBe(true);
      expect(Array.isArray(result.response.Rows)).toBe(true);
      expect(typeof result.unfilteredTotal).toBe("number");
      expect(result.unfilteredTotal).toBeGreaterThanOrEqual(result.response.Rows.length);

      if (result.response.Rows.length > 0) {
        for (const row of result.response.Rows) {
          const desc = row["Description"] as string;
          expect(desc.toLowerCase()).toContain("test");
        }
      }
    }, 15000);
  });
});

describe("Integration Skip Guard", () => {
  it("isLiveEnv reflects RENTALWORKS_BASE_URL presence", () => {
    expect(isLiveEnv).toBe(!!process.env.RENTALWORKS_BASE_URL);
  });
});
