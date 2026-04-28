/**
 * RentalWorks API client with JWT authentication
 */

import type {
  BrowseRequest,
  BrowseResponse,
  ColumnHeader,
  HttpMethod,
  JwtRequest,
  JwtResponse,
} from "../types/api.js";
import { withClientSideFallback } from "./browse-helpers.js";

/**
 * Base URL for the RentalWorks API. Normalized at module load:
 *   - trailing slash stripped so `${BASE_URL}${path}` never produces `//`
 *   - empty string left alone (lets `request()` fail loudly on missing config)
 */
const BASE_URL = (process.env.RENTALWORKS_BASE_URL || "").replace(/\/+$/, "");

export class RentalWorksClient {
  private token: string | null = null;
  private tokenExpiry: number = 0;
  /**
   * In-flight authentication promise. When set, concurrent `ensureAuth()` calls
   * await the same promise instead of each issuing their own POST `/jwt`. Reset
   * via `.finally()` so a failed auth doesn't permanently lock subsequent calls.
   */
  private authPromise: Promise<JwtResponse> | null = null;
  private username: string;
  private password: string;

  constructor() {
    this.username = process.env.RENTALWORKS_USERNAME || "";
    this.password = process.env.RENTALWORKS_PASSWORD || "";

    if (!this.username || !this.password) {
      console.error(
        "Warning: RENTALWORKS_USERNAME and RENTALWORKS_PASSWORD env vars not set"
      );
    }
  }

  /**
   * Authenticate and get a JWT token
   */
  async authenticate(): Promise<JwtResponse> {
    const body: JwtRequest = {
      UserName: this.username,
      Password: this.password,
    };

    const res = await fetch(`${BASE_URL}/api/v1/jwt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`Authentication failed: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as JwtResponse;
    this.token = data.access_token;
    // Tokens typically last 4 hours; refresh after 3.5h
    this.tokenExpiry = Date.now() + 3.5 * 60 * 60 * 1000;
    return data;
  }

  /**
   * Ensure we have a valid token. Single-flight: concurrent calls during a
   * stale-token window all await the same `/jwt` POST instead of racing.
   */
  private async ensureAuth(): Promise<string> {
    if (this.token && Date.now() < this.tokenExpiry) return this.token;
    if (!this.authPromise) {
      this.authPromise = this.authenticate().finally(() => {
        this.authPromise = null;
      });
    }
    await this.authPromise;
    return this.token!;
  }

  /**
   * Make an authenticated API request.
   *
   * The `body` parameter is typed as a plain object (not pre-serialized) so
   * we control the JSON.stringify boundary in one place — eliminates the
   * "double-encoded body" foot-gun on 401/403 retry.
   */
  async request<T = unknown>(
    method: HttpMethod,
    path: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    const url = `${BASE_URL}${path}`;
    const serialized = body !== undefined ? JSON.stringify(body) : undefined;

    const sendOnce = async (token: string): Promise<Response> =>
      fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: serialized,
      });

    let token = await this.ensureAuth();
    let res = await sendOnce(token);

    // 401/403: clear token, re-authenticate, retry once
    if (res.status === 401 || res.status === 403) {
      this.token = null;
      this.tokenExpiry = 0;
      token = await this.ensureAuth();
      res = await sendOnce(token);
    }

    const text = await res.text();

    if (!res.ok) {
      throw new Error(`API ${method} ${path} failed: ${res.status} - ${text}`);
    }

    if (!text) return {} as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(
        `API ${method} ${path} failed: response was not valid JSON. Received: ${text.slice(0, 200)}`
      );
    }
  }

  /**
   * GET request
   */
  async get<T = unknown>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  /**
   * POST request
   */
  async post<T = unknown>(path: string, body?: Record<string, unknown>): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  /**
   * PUT request
   */
  async put<T = unknown>(path: string, body?: Record<string, unknown>): Promise<T> {
    return this.request<T>("PUT", path, body);
  }

  /**
   * DELETE request
   */
  async delete<T = unknown>(path: string): Promise<T> {
    return this.request<T>("DELETE", path);
  }

  /**
   * Normalize a browse response so that Rows are always keyed objects.
   *
   * Some RentalWorks entities (e.g. order, customer, deal) return Rows as
   * arrays of values alongside a ColumnHeaders array that provides the field
   * names. This method zips them together so every row becomes a
   * Record<string, unknown> keyed by the DataField from each column header.
   *
   * If Rows[0] is already an object (or Rows is empty / ColumnHeaders is
   * absent) the response is returned unchanged.
   */
  private normalizeRows<T = Record<string, unknown>>(
    response: BrowseResponse<T>
  ): BrowseResponse<T> {
    const { Rows } = response;
    if (!Rows || Rows.length === 0 || !Array.isArray(Rows[0])) {
      return response;
    }

    // The RW API returns column metadata as either "Columns" (common) or
    // "ColumnHeaders" depending on the endpoint.  Both carry a DataField
    // property we can use to zip arrays into keyed objects.
    const columns: ColumnHeader[] | undefined =
      (response as unknown as Record<string, unknown>).Columns as ColumnHeader[] | undefined ??
      response.ColumnHeaders;

    if (!columns || columns.length === 0) {
      return response;
    }

    const fields = columns.map((h) => h.DataField);
    const normalizedRows = (Rows as unknown as unknown[][]).map((row) => {
      const obj: Record<string, unknown> = {};
      fields.forEach((field, i) => {
        obj[field] = row[i];
      });
      return obj as T;
    });

    return { ...response, Rows: normalizedRows };
  }

  /**
   * Browse an entity with pagination and filtering.
   * Most RentalWorks entities follow the pattern: POST /api/v1/{entity}/browse
   *
   * Handles two known RentalWorks API quirks automatically:
   *   1. "Invalid column name" 500 errors — retries without search fields and
   *      falls back to client-side filtering (via withClientSideFallback).
   *   2. Array-valued rows — normalizes them to keyed objects using the
   *      ColumnHeaders metadata returned by the API.
   */
  async browse<T extends Record<string, unknown> = Record<string, unknown>>(
    entity: string,
    options?: Partial<BrowseRequest>
  ): Promise<BrowseResponse<T>> {
    const body: BrowseRequest = {
      pageno: 1,
      pagesize: 25,
      orderby: "",
      orderbydirection: "asc",
      ...options,
    };

    const fetchFn = (req: Record<string, unknown>) =>
      this.post<BrowseResponse<T>>(`/api/v1/${entity}/browse`, req);

    // Thread the user-supplied search criteria through to withClientSideFallback
    // so it can apply client-side filtering on retry. Without this, a search by
    // an unsupported column would silently return every record after the
    // server-side filter is stripped on the retry.
    const sf = Array.isArray(body.searchfields) ? body.searchfields[0] : undefined;
    const sv = Array.isArray(body.searchfieldvalues) ? body.searchfieldvalues[0] : undefined;
    const so = Array.isArray(body.searchfieldoperators) ? body.searchfieldoperators[0] : undefined;

    let result: BrowseResponse<T>;
    try {
      result = await withClientSideFallback<T>(
        fetchFn as (req: Record<string, unknown>) => Promise<BrowseResponse<T>>,
        body as Record<string, unknown>,
        sf,
        sv,
        so,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("Invalid column name")) {
        throw err;
      }
      // POST browse is fundamentally broken for this entity — fall back to GET.
      // Defensive arithmetic: the live API has been observed to return
      // PageSize: 0 / undefined on some entities; uncritical Math.ceil produces
      // Infinity / NaN and pollutes downstream rendering. Default to the
      // requested pageSize when the response one is missing.
      const params = new URLSearchParams();
      const requestedPageNo = body.pageno ?? 1;
      const requestedPageSize = body.pagesize ?? 25;
      params.set("pageno", String(requestedPageNo));
      params.set("pagesize", String(requestedPageSize));
      if (body.orderby) {
        const dir = body.orderbydirection || "asc";
        params.set("sort", `${body.orderby}${dir === "desc" ? " desc" : ""}`);
      }
      const raw = await this.get<{
        Items?: T[];
        TotalItems?: number;
        PageNo?: number;
        PageSize?: number;
      }>(`/api/v1/${entity}?${params.toString()}`);

      const safeRows = raw.Items ?? [];
      const safeTotal = typeof raw.TotalItems === "number" ? raw.TotalItems : safeRows.length;
      const safePageSize =
        typeof raw.PageSize === "number" && raw.PageSize > 0
          ? raw.PageSize
          : Number(requestedPageSize) || 25;
      const safePageNo = typeof raw.PageNo === "number" ? raw.PageNo : Number(requestedPageNo) || 1;
      const totalPages = safeTotal > 0 ? Math.ceil(safeTotal / safePageSize) : 0;

      return {
        Rows: safeRows,
        TotalRows: safeTotal,
        PageNo: safePageNo,
        PageSize: safePageSize,
        TotalPages: totalPages,
      };
    }

    return this.normalizeRows(result);
  }

  /**
   * Get a single entity by ID.
   * Pattern: GET /api/v1/{entity}/{id}
   */
  async getById<T = Record<string, unknown>>(
    entity: string,
    id: string
  ): Promise<T> {
    return this.get<T>(`/api/v1/${entity}/${id}`);
  }

  /**
   * Create a new entity.
   * Pattern: POST /api/v1/{entity}
   */
  async create<T = Record<string, unknown>>(
    entity: string,
    data: Record<string, unknown>
  ): Promise<T> {
    return this.post<T>(`/api/v1/${entity}`, data);
  }

  /**
   * Update an entity by ID.
   * Pattern: PUT /api/v1/{entity}/{id}
   */
  async update<T = Record<string, unknown>>(
    entity: string,
    id: string,
    data: Record<string, unknown>
  ): Promise<T> {
    return this.put<T>(`/api/v1/${entity}/${id}`, data);
  }

  /**
   * Delete an entity by ID.
   * Pattern: DELETE /api/v1/{entity}/{id}
   */
  async remove(entity: string, id: string): Promise<void> {
    await this.delete(`/api/v1/${entity}/${id}`);
  }

  /**
   * Export entity data to Excel.
   * Pattern: POST /api/v1/{entity}/exportexcelxlsx
   */
  async exportExcel(
    entity: string,
    options?: Partial<BrowseRequest>
  ): Promise<unknown> {
    return this.post(`/api/v1/${entity}/exportexcelxlsx`, options || {});
  }

  /**
   * Get session info for the authenticated user
   */
  async getSession(): Promise<unknown> {
    return this.get("/api/v1/account/session");
  }

  /**
   * Get office locations
   */
  async getOfficeLocation(): Promise<unknown> {
    return this.get("/api/v1/account/officelocation");
  }
}

// Singleton instance
let client: RentalWorksClient | null = null;

export function getClient(): RentalWorksClient {
  if (!client) {
    client = new RentalWorksClient();
  }
  return client;
}

export function resetClient(): void {
  client = null;
}
