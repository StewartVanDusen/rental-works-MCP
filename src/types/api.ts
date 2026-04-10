/**
 * RentalWorks API type definitions
 * Base URL: https://<your-instance>.rentalworks.cloud
 * Auth: JWT Bearer token via POST /api/v1/jwt
 */

// ── Authentication ──────────────────────────────────────────────────────────

export interface JwtRequest {
  UserName: string;
  Password: string;
}

export interface JwtResponse {
  statuscode: number;
  statusmessage: string;
  access_token: string;
  webusersid: string;
  usersid: string;
  fullname: string;
}

export interface SessionInfo {
  webusersid: string;
  usersid: string;
  fullname: string;
  email: string;
  officelocationid: string;
  warehouseid: string;
}

// ── Generic Browse / CRUD ───────────────────────────────────────────────────

export interface BrowseRequest {
  miscfields?: Record<string, unknown>;
  module?: string;
  options?: BrowseOptions;
  orderby?: string;
  orderbydirection?: "asc" | "desc";
  pageno?: number;
  pagesize?: number;
  searchfieldoperators?: string[];
  searchfields?: string[];
  searchfieldvalues?: string[];
  searchseparators?: string[];
  uniqueids?: Record<string, string>;
  activeviewfields?: BrowseActiveViewField[];
}

export interface BrowseOptions {
  outstandingonly?: boolean;
  warehouseid?: string;
  officelocationid?: string;
  departmentid?: string;
}

export interface BrowseActiveViewField {
  datafield: string;
  fieldtype: string;
}

export interface BrowseResponse<T = Record<string, unknown>> {
  PageNo: number;
  PageSize: number;
  TotalRows: number;
  TotalPages: number;
  Rows: T[];
  ColumnHeaders?: ColumnHeader[];
}

export interface ColumnHeader {
  Name: string;
  DataField: string;
  DataType: string;
  IsVisible: boolean;
  Width?: number;
}

// ── Core Business Entities ──────────────────────────────────────────────────

export interface RentalInventory {
  InventoryId?: string;
  ICode?: string;
  Description?: string;
  AvailFor?: string;
  CategoryId?: string;
  Category?: string;
  SubCategoryId?: string;
  SubCategory?: string;
  ManufacturerId?: string;
  Manufacturer?: string;
  Rank?: string;
  TrackedBy?: string;
  UnitId?: string;
  Unit?: string;
  DailyRate?: number;
  WeeklyRate?: number;
  MonthlyRate?: number;
  ReplacementCost?: number;
  Quantity?: number;
  QuantityIn?: number;
  QuantityStaged?: number;
  QuantityOut?: number;
  QuantityOnRepair?: number;
  QuantityOnTransfer?: number;
  WarehouseId?: string;
  Warehouse?: string;
  Inactive?: boolean;
}

export interface Order {
  OrderId?: string;
  OrderNumber?: string;
  OrderDate?: string;
  OrderType?: string;
  OrderTypeId?: string;
  Status?: string;
  StatusDate?: string;
  DealId?: string;
  Deal?: string;
  Description?: string;
  CustomerId?: string;
  Customer?: string;
  Location?: string;
  PickDate?: string;
  PickTime?: string;
  EstimatedStartDate?: string;
  EstimatedStartTime?: string;
  EstimatedStopDate?: string;
  EstimatedStopTime?: string;
  ReturnToWarehouseDate?: string;
  Agent?: string;
  AgentId?: string;
  ProjectManagerId?: string;
  ProjectManager?: string;
  OfficeLocationId?: string;
  WarehouseId?: string;
  RentalTotal?: number;
  SalesTotal?: number;
  LaborTotal?: number;
  MiscTotal?: number;
  SubTotal?: number;
  DiscountTotal?: number;
  Tax?: number;
  Total?: number;
}

export interface Quote {
  QuoteId?: string;
  QuoteNumber?: string;
  QuoteDate?: string;
  Status?: string;
  CustomerId?: string;
  Customer?: string;
  DealId?: string;
  Deal?: string;
  Description?: string;
  Location?: string;
  EstimatedStartDate?: string;
  EstimatedStopDate?: string;
  Total?: number;
}

export interface Customer {
  CustomerId?: string;
  Customer?: string;
  CustomerNumber?: string;
  Address1?: string;
  Address2?: string;
  City?: string;
  State?: string;
  ZipCode?: string;
  Country?: string;
  Phone?: string;
  Fax?: string;
  Email?: string;
  CreditStatus?: string;
  CreditLimit?: number;
  Inactive?: boolean;
}

export interface Contact {
  ContactId?: string;
  FirstName?: string;
  LastName?: string;
  FullName?: string;
  Title?: string;
  Email?: string;
  OfficePhone?: string;
  DirectPhone?: string;
  MobilePhone?: string;
  CustomerId?: string;
  Customer?: string;
  Inactive?: boolean;
}

export interface Deal {
  DealId?: string;
  DealNumber?: string;
  Deal?: string;
  DealType?: string;
  Status?: string;
  CustomerId?: string;
  Customer?: string;
  Location?: string;
  EstimatedStartDate?: string;
  EstimatedEndDate?: string;
  Agent?: string;
  AgentId?: string;
}

export interface Invoice {
  InvoiceId?: string;
  InvoiceNumber?: string;
  InvoiceDate?: string;
  InvoiceType?: string;
  Status?: string;
  DealId?: string;
  Deal?: string;
  OrderId?: string;
  OrderNumber?: string;
  CustomerId?: string;
  Customer?: string;
  BillingStartDate?: string;
  BillingEndDate?: string;
  SubTotal?: number;
  Tax?: number;
  Total?: number;
}

export interface Contract {
  ContractId?: string;
  ContractNumber?: string;
  ContractDate?: string;
  ContractType?: string;
  ContractTime?: string;
  DealId?: string;
  Deal?: string;
  OrderId?: string;
  OrderNumber?: string;
  Truck?: string;
  WarehouseId?: string;
  Warehouse?: string;
  PendingItems?: number;
  SessionId?: string;
}

export interface Vendor {
  VendorId?: string;
  Vendor?: string;
  VendorNumber?: string;
  Address1?: string;
  Address2?: string;
  City?: string;
  State?: string;
  ZipCode?: string;
  Phone?: string;
  Email?: string;
  Inactive?: boolean;
}

export interface PurchaseOrder {
  PurchaseOrderId?: string;
  PurchaseOrderNumber?: string;
  PurchaseOrderDate?: string;
  Status?: string;
  VendorId?: string;
  Vendor?: string;
  DealId?: string;
  Deal?: string;
  OrderId?: string;
  Description?: string;
  SubTotal?: number;
  Tax?: number;
  Total?: number;
}

export interface Item {
  ItemId?: string;
  BarCode?: string;
  SerialNumber?: string;
  RfId?: string;
  ICode?: string;
  Description?: string;
  InventoryId?: string;
  WarehouseId?: string;
  Warehouse?: string;
  OwnershipStatus?: string;
  Condition?: string;
}

export interface Warehouse {
  WarehouseId?: string;
  Warehouse?: string;
  WarehouseCode?: string;
  Address1?: string;
  Address2?: string;
  City?: string;
  State?: string;
  ZipCode?: string;
  Country?: string;
  Phone?: string;
  Inactive?: boolean;
}

export interface Project {
  ProjectId?: string;
  Project?: string;
  ProjectNumber?: string;
  Status?: string;
  CustomerId?: string;
  Customer?: string;
  DealId?: string;
  Deal?: string;
  Description?: string;
}

export interface Repair {
  RepairId?: string;
  RepairNumber?: string;
  Status?: string;
  BarCode?: string;
  ICode?: string;
  Description?: string;
  DamageType?: string;
  Notes?: string;
}

// ── Checkout / Checkin Session Types ────────────────────────────────────────

export interface CheckOutSession {
  SessionId?: string;
  OrderId?: string;
  OrderNumber?: string;
  DealId?: string;
  Deal?: string;
  WarehouseId?: string;
  ContractId?: string;
}

export interface CheckInSession {
  SessionId?: string;
  ContractId?: string;
  OrderId?: string;
}

// ── Report Types ────────────────────────────────────────────────────────────

export interface ReportRequest {
  DealId?: string;
  OrderId?: string;
  WarehouseId?: string;
  OfficeLocationId?: string;
  FromDate?: string;
  ToDate?: string;
  CustomerId?: string;
  IncludeSubHeadingsAndSubTotals?: boolean;
}

export interface ReportResponse {
  ReportId?: string;
  htmlReportUrl?: string;
  urlReport?: string;
}

// ── Storefront Types ────────────────────────────────────────────────────────

export interface StorefrontItem {
  InventoryId?: string;
  ICode?: string;
  Description?: string;
  ImageUrl?: string;
  DailyRate?: number;
  WeeklyRate?: number;
  MonthlyRate?: number;
  CategoryId?: string;
  Category?: string;
  Available?: boolean;
  Quantity?: number;
}

// ── Utility Types ───────────────────────────────────────────────────────────

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

export interface ApiError {
  StatusCode: number;
  Message: string;
  StackTrace?: string;
}
