import { describe, it, expect } from "vitest";
import { buildBrowseRequest, formatBrowseResult, formatEntity } from "../utils/tool-helpers.js";

describe("buildBrowseRequest", () => {
  it("returns defaults with no args", () => {
    const req = buildBrowseRequest({});
    expect(req).toEqual({
      pageno: 1,
      pagesize: 25,
      orderby: "",
      orderbydirection: "asc",
    });
  });

  it("sets pagination", () => {
    const req = buildBrowseRequest({ page: 3, pageSize: 50 });
    expect(req.pageno).toBe(3);
    expect(req.pagesize).toBe(50);
  });

  it("sets search fields when both searchField and searchValue provided", () => {
    const req = buildBrowseRequest({ searchField: "Description", searchValue: "lamp", searchOperator: "contains" });
    expect(req.searchfields).toEqual(["Description"]);
    expect(req.searchfieldvalues).toEqual(["lamp"]);
    expect(req.searchfieldoperators).toEqual(["contains"]);
    expect(req.searchseparators).toEqual([""]);
  });

  it("does not set search fields when only searchField is provided", () => {
    const req = buildBrowseRequest({ searchField: "Description" });
    expect(req.searchfields).toBeUndefined();
  });

  it("sets miscfields with warehouseId", () => {
    const req = buildBrowseRequest({ warehouseId: "W1" });
    expect(req.miscfields).toEqual({ WarehouseId: "W1" });
  });

  it("sets miscfields with officeLocationId", () => {
    const req = buildBrowseRequest({ officeLocationId: "OL1" });
    expect(req.miscfields).toEqual({ OfficeLocationId: "OL1" });
  });
});

describe("formatBrowseResult", () => {
  it("formats browse data", () => {
    const result = formatBrowseResult({
      TotalRows: 2,
      PageNo: 1,
      PageSize: 25,
      TotalPages: 1,
      Rows: [
        { ICode: "LAMP01", Description: "LED Lamp" },
        { ICode: "LAMP02", Description: "Halogen", Notes: null },
      ],
    });
    expect(result).toContain("Results: 2 total (page 1 of 1)");
    expect(result).toContain("ICode: LAMP01 | Description: LED Lamp");
    expect(result).toContain("ICode: LAMP02 | Description: Halogen");
    expect(result).not.toContain("Notes");
  });
});

describe("formatEntity", () => {
  it("filters out null/undefined/empty values", () => {
    const result = formatEntity({
      Id: "123",
      Name: "Test",
      Empty: "",
      Null: null,
      Undef: undefined,
    });
    expect(result).toBe("Id: 123\nName: Test");
  });
});
