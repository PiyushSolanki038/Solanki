# Phase 9 — Developer Experience & Performance ✅

All 7 items in Phase 9 have been implemented (or documented as migration/guideline items).

---

## 9.1 Replace `as unknown as` casts → Typed Supabase client

**Status**: Documented — requires **Phase 8 database migration** first  
The `as unknown as` casts exist because the generated `types.ts` still has `tenant_id` as required on every table. Once `tenant_id` is dropped (Phase 8 schema migration) and types are regenerated, these casts can be removed organically. No code change needed at this stage.

---

## 9.2 Extract shared `getErrorMessage` utility ✅

**New file**: `src/core/utils/error.ts`

```typescript
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try { return JSON.stringify(error); }
  catch { return String(error); }
}
```

Replaced **11 duplicate local definitions** with a single import across:

| File | Module |
|------|--------|
| `src/modules/erp/hooks/useERP.ts` | ERP |
| `src/modules/crm/hooks/useCRM.ts` | CRM |
| `src/modules/cpq/hooks/useCPQ.ts` | CPQ |
| `src/modules/clm/hooks/useCLM.ts` | CLM |
| `src/app/providers/AuthProvider.tsx` | Auth |
| `src/modules/erp/pages/InventoryPage.tsx` | ERP |
| `src/modules/erp/pages/FinancePage.tsx` | ERP |
| `src/modules/erp/pages/ProductionPage.tsx` | ERP |
| `src/modules/erp/pages/ProcurementPage.tsx` | ERP |
| `src/modules/clm/pages/ContractBuilderPage.tsx` | CLM |
| `src/modules/clm/pages/ContractDetailPage.tsx` | CLM |

---

## 9.3 Deduplicate `isModuleEnabled` ✅

**Problem**: Two identical `isModuleEnabled` functions existed in:
- `src/core/types/tenant.ts` (canonical)
- `src/core/types/organization.ts` (duplicate)

**Fix**: Removed the duplicate from `organization.ts`, replaced with:
```typescript
export { isModuleEnabled } from "./tenant";
```
Consumers importing from either file now get the same single implementation.

---

## 9.4 Remove `"use client"` directives

**Status**: Not applicable  
After auditing the codebase, Vite + React Router (non-Next.js) does not use or respect `"use client"` directives. The strings found were inside template literals and string comparisons, not actual module-level directives. No changes needed.

---

## 9.5 Optimize RLS super-admin checks ✅

**New migration**: `supabase/migrations/20260309_rls_super_admin_optimization.sql`

- Added **partial index** `idx_profiles_super_admin` for index-only scans
- Marked `app_is_platform_super_admin()` as `STABLE` so PostgreSQL caches the result per-statement instead of re-executing for every row across 50+ RLS policies

---

## 9.6 Consolidate realtime channels

**Status**: Already addressed in Phase 7 (item 7.6)  
Organization-scoped realtime channels were consolidated and filtered in `useDocuments.ts` during Phase 7. The ERP `InventoryPage.tsx` uses a simple `schema-db-changes` channel that is page-local and doesn't require consolidation.

---

## 9.7 Scoped query key invalidation

**Status**: Guideline documented  
All hook files already use scoped query keys (e.g., `["suppliers", tenantId, userId]`). The `invalidateQueries` calls use `{ queryKey: ["suppliers"] }` which correctly matches all supplier keys regardless of scope parameters. This is the recommended React Query pattern — no code change needed.

---

## Pre-existing lint errors (not introduced by Phase 9)

The following lint errors persist across the codebase and are **not related to Phase 9 changes**:

- **`tenant_id` missing**: The generated `types.ts` still requires `tenant_id` on insert payloads. This will be resolved when the database schema drops `tenant_id` (Phase 8) and types are regenerated.
- **`ESignatureRow.updated_at`**: The `contract_esignatures` table doesn't have an `updated_at` column, but the local type expects it. Pre-existing.
- **`ContractStatus` unused**: Pre-existing unused type alias in `useCLM.ts`.
- **Various ERP page errors**: `due_date`, `order_number`, `transaction_type` etc. — all pre-existing schema mismatches between the page code and the generated types.

---

## Files Modified / Created

| Action | File |
|--------|------|
| **NEW** | `src/core/utils/error.ts` |
| **NEW** | `supabase/migrations/20260309_rls_super_admin_optimization.sql` |
| MODIFIED | `src/core/types/organization.ts` |
| MODIFIED | `src/modules/erp/hooks/useERP.ts` |
| MODIFIED | `src/modules/crm/hooks/useCRM.ts` |
| MODIFIED | `src/modules/cpq/hooks/useCPQ.ts` |
| MODIFIED | `src/modules/clm/hooks/useCLM.ts` |
| MODIFIED | `src/app/providers/AuthProvider.tsx` |
| MODIFIED | `src/modules/erp/pages/InventoryPage.tsx` |
| MODIFIED | `src/modules/erp/pages/FinancePage.tsx` |
| MODIFIED | `src/modules/erp/pages/ProductionPage.tsx` |
| MODIFIED | `src/modules/erp/pages/ProcurementPage.tsx` |
| MODIFIED | `src/modules/clm/pages/ContractBuilderPage.tsx` |
| MODIFIED | `src/modules/clm/pages/ContractDetailPage.tsx` |
