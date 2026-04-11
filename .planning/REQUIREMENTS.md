# Requirements: RentalWorks MCP Server — v1.1 Inventory Browse Fix

**Defined:** 2026-04-11
**Core Value:** Every MCP tool must call the correct API endpoint with the correct method, path, and request body — verified by tests and validated against the live Swagger spec.

## v1.1 Requirements

Requirements for inventory browse fix milestone. Each maps to roadmap phases.

### Field Selection

- [ ] **FSEL-01**: User can pass an optional `fields` array to inventory browse tools to receive only specified fields per row
- [ ] **FSEL-02**: Named field presets (SUMMARY, FULL) are available as shorthand for common field sets
- [ ] **FSEL-03**: Inventory browse tools default to SUMMARY preset, reducing per-item payload from ~2,200 chars to ~200

### Client-Side Filtering

- [ ] **CFLT-01**: When API server-side filter returns a 500 "Invalid column name" error, the MCP layer automatically retries without server filters and applies the search logic client-side
- [ ] **CFLT-02**: Client-side filtering supports all existing search operators (like, contains, startswith, endswith, =, <>)
- [ ] **CFLT-03**: When client-side filtering is active, pagination metadata is corrected to reflect actual filtered result count (not the unfiltered API total)

### Response Optimization

- [ ] **ROPT-01**: Inventory browse tools use a smaller default page size (10 instead of 25) to reduce payload

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Advanced Search

- **ASRCH-01**: Multi-page scan tool that fetches and filters across multiple pages for broad inventory searches

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Fix RW server-side DB bugs (masterid/rentalitemid) | Server-side issues in RentalWorks SQL query builder — cannot fix from MCP layer |
| Multi-page scan tool | High complexity, narrow use case — defer to v1.2 |
| Report discovery endpoint | Separate concern from browse optimization |
| AI assistant OpenAI config | Environment configuration issue, not MCP code |
| Modify shared browseSchema | Research confirmed: spreads to all 114 tools, must not be polluted with inventory-specific params |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FSEL-01 | Phase 8 | Pending |
| FSEL-02 | Phase 8 | Pending |
| FSEL-03 | Phase 9 | Pending |
| CFLT-01 | Phase 7 | Pending |
| CFLT-02 | Phase 7 | Pending |
| CFLT-03 | Phase 9 | Pending |
| ROPT-01 | Phase 9 | Pending |

**Coverage:**
- v1.1 requirements: 7 total
- Mapped to phases: 7
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-11*
*Last updated: 2026-04-11 — traceability filled in after roadmap creation*
