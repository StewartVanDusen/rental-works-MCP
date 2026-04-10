# Requirements: RentalWorks MCP Server — Production Readiness

**Defined:** 2026-04-09
**Core Value:** Every MCP tool must call the correct API endpoint with the correct method, path, and request body — verified by tests and validated against the live Swagger spec.

## v1 Requirements

### Foundation

- [ ] **FOUND-01**: `zod` added to package.json dependencies (not just devDependencies)
- [ ] **FOUND-02**: `@vitest/coverage-v8` added to devDependencies
- [ ] **FOUND-03**: Test files reorganized into `src/__tests__/unit/` and `src/__tests__/integration/` directories
- [ ] **FOUND-04**: `vitest.config.ts` configured with separate test projects (unit, integration)

### Path Validation

- [ ] **PATH-01**: All 114 existing tool API paths audited against the 12 Swagger sub-specs
- [x] **PATH-02**: Sub-spec domain mapping table built (tool → Swagger spec → confirmed path)
- [ ] **PATH-03**: All incorrect API paths fixed to match Swagger spec
- [ ] **PATH-04**: Storefront category browsing path corrected to match storefront-v1 spec
- [ ] **PATH-05**: Checkout/checkin paths verified against warehouse-v1 spec
- [ ] **PATH-06**: Invoice lifecycle paths (approve, process, void) verified against home-v1 spec
- [x] **PATH-07**: Automated Swagger spec parser that fetches and diffs tool paths against live spec JSON

### Unit Tests

- [ ] **TEST-01**: Path + method + body unit tests for all billing domain tools (13 tools)
- [ ] **TEST-02**: Path + method + body unit tests for all admin domain tools (5 tools)
- [ ] **TEST-03**: Path + method + body unit tests for all customer domain tools (13 tools)
- [ ] **TEST-04**: Path + method + body unit tests for all settings domain tools (14 tools)
- [ ] **TEST-05**: Existing test assertions audited — every `it()` block asserts `capturedUrl` and `capturedMethod`
- [ ] **TEST-06**: Error handling tests: API 4xx/5xx responses return user-friendly messages
- [ ] **TEST-07**: Error handling tests: authentication failure triggers re-auth
- [ ] **TEST-08**: Error handling tests: malformed/empty API responses handled gracefully
- [ ] **TEST-09**: Error handling tests: `withErrorHandling` correctly detects known RW server issues

### Integration Tests

- [ ] **INTG-01**: Integration test suite with `describe.skipIf(!process.env.RENTALWORKS_BASE_URL)` guard
- [ ] **INTG-02**: JWT authentication integration test (real token acquisition)
- [ ] **INTG-03**: Read-only browse smoke tests for core entities (inventory, orders, customers, deals)
- [ ] **INTG-04**: Read-only GET-by-ID tests for at least one entity per domain
- [ ] **INTG-05**: Session info retrieval test (`/api/v1/account/session`)
- [ ] **INTG-06**: Response shape validation (confirms API returns expected field structure)

### Expansion

- [ ] **EXPN-01**: Address management tools (browse, get, create, update, delete) — home-v1 API
- [ ] **EXPN-02**: Change order status utility tool — utilities-v1 API
- [ ] **EXPN-03**: Unit tests for all new tools following established patterns
- [ ] **EXPN-04**: Integration smoke tests for new tools (read-only)

## v2 Requirements

### Expansion — Deferred

- **EXPN-D1**: Dashboard widget loading endpoints
- **EXPN-D2**: Activity log browse/CRUD
- **EXPN-D3**: Inventory merge utility
- **EXPN-D4**: MCP SDK upgrade to ^1.29.0

## Out of Scope

| Feature | Reason |
|---------|--------|
| Mobile/QuikScan endpoints | Specialized scanner hardware workflows, not useful via MCP |
| Plugins API | Instance-specific plugin endpoints, not generalizable |
| Pages API (CardPointe) | Only 2 payment page endpoints, niche use case |
| System admin (CreateNewSystem) | Dangerous operations, shouldn't be exposed via MCP |
| OAuth/Okta/Azure AD auth | JWT auth sufficient for MCP usage |
| Mutable integration tests | Live instance has real data, risk of data corruption |
| Auto-generated tools from Swagger | Unreviewed auto-gen creates maintenance burden, prefer curated tools |
| Vitest 4.x upgrade | Breaking changes, not worth risk during hardening milestone |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 1 | Pending |
| FOUND-02 | Phase 1 | Pending |
| FOUND-03 | Phase 1 | Pending |
| FOUND-04 | Phase 1 | Pending |
| PATH-01 | Phase 2 | Pending |
| PATH-02 | Phase 2 | Complete |
| PATH-03 | Phase 3 | Pending |
| PATH-04 | Phase 3 | Pending |
| PATH-05 | Phase 3 | Pending |
| PATH-06 | Phase 3 | Pending |
| PATH-07 | Phase 2 | Complete |
| TEST-01 | Phase 3 | Pending |
| TEST-02 | Phase 3 | Pending |
| TEST-03 | Phase 3 | Pending |
| TEST-04 | Phase 3 | Pending |
| TEST-05 | Phase 3 | Pending |
| TEST-06 | Phase 4 | Pending |
| TEST-07 | Phase 4 | Pending |
| TEST-08 | Phase 4 | Pending |
| TEST-09 | Phase 4 | Pending |
| INTG-01 | Phase 5 | Pending |
| INTG-02 | Phase 5 | Pending |
| INTG-03 | Phase 5 | Pending |
| INTG-04 | Phase 5 | Pending |
| INTG-05 | Phase 5 | Pending |
| INTG-06 | Phase 5 | Pending |
| EXPN-01 | Phase 6 | Pending |
| EXPN-02 | Phase 6 | Pending |
| EXPN-03 | Phase 6 | Pending |
| EXPN-04 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 30 total
- Mapped to phases: 30
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-09*
*Last updated: 2026-04-09 after initial definition*
