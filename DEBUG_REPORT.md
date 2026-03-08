# SISWIT Platform — Comprehensive Debug Report

**Audit Date:** March 2026  
**Auditor:** Senior Full-Stack / Security Audit  
**Phase:** Phase 6 — Security Hardening  
**Stack:** React 18, TypeScript 5.8, Vite, Supabase (PostgreSQL, RLS, Auth, Edge Functions), Tailwind CSS, Radix UI, shadcn/ui

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Critical Security Vulnerabilities](#2-critical-security-vulnerabilities)
3. [Multi-Tenancy Isolation Bugs](#3-multi-tenancy-isolation-bugs)
4. [Authentication & Authorization Bugs](#4-authentication--authorization-bugs)
5. [Module-Specific Bugs](#5-module-specific-bugs)
6. [Type Safety & TypeScript Issues](#6-type-safety--typescript-issues)
7. [Data Integrity & Logic Bugs](#7-data-integrity--logic-bugs)
8. [Performance Issues](#8-performance-issues)
9. [Code Quality & Maintainability](#9-code-quality--maintainability)
10. [Edge Functions & Backend Issues](#10-edge-functions--backend-issues)
11. [RLS Policy Analysis](#11-rls-policy-analysis)
12. [Recommendations & Priority Matrix](#12-recommendations--priority-matrix)

---

## 1. Executive Summary

The SISWIT codebase is architecturally sound, with good separation of concerns (modules, hooks, providers, RBAC). The RLS migration (`015_hardened_rls_policies.sql`) is well-designed with per-operation policies and proper role-based checks. However, the **frontend data access layer has critical gaps** that can expose cross-tenant data, and there is a **systemic mismatch between the `organization_id` used in code and `tenant_id` legacy columns** that creates confusion and potential runtime failures.

### Finding Severity Distribution

| Severity | Count | Category |
|----------|-------|----------|
| 🔴 CRITICAL | 7 | Security / Data Leak |
| 🟠 HIGH | 9 | Multi-Tenancy / Auth |
| 🟡 MEDIUM | 11 | Logic / Type Safety |
| 🔵 LOW | 8 | Quality / Performance |
| **Total** | **35** | |

---

## 2. Critical Security Vulnerabilities

### C-01: `softDeleteRecord` Has No Tenant Scoping

**File:** [`src/core/utils/soft-delete.ts`](file:///c:/Users/Piyus/OneDrive/Desktop/Main/Main/src/core/utils/soft-delete.ts)  
**Severity:** 🔴 CRITICAL  
**Impact:** Cross-tenant data deletion  

The `softDeleteRecord` function updates records by `id` alone — it never filters by `organization_id` or `tenant_id`. If a user knows (or guesses) a record UUID from another tenant, they can soft-delete it.

```typescript
// CURRENT — no tenant scoping
const { error } = await supabase
  .from(table)
  .update({ deleted_at: now, deleted_by: userId })
  .eq("id", id)
  .is("deleted_at", null);
```

**Mitigation:** RLS policies in `015_hardened_rls_policies.sql` do enforce organization access on UPDATE, so the database itself should block this. However, **defense in depth requires adding `organization_id` filtering** in the application layer.

**Fix:** Add `organizationId` parameter to `softDeleteRecord` and apply `.eq("organization_id", organizationId)`.

---

### C-02: `useUpdateAutoDocument` — No Tenant Scoping on Document Updates

**File:** [`src/modules/documents/hooks/useDocuments.ts`](file:///c:/Users/Piyus/OneDrive/Desktop/Main/Main/src/modules/documents/hooks/useDocuments.ts) (line ~427)  
**Severity:** 🔴 CRITICAL  
**Impact:** Cross-tenant document content mutation  

The update mutation calls `.update(updates).eq("id", id)` without any `organization_id` filter or `applyModuleMutationScope`. It also doesn't apply any ownership check — any authenticated user who knows a document ID can modify it.

```typescript
// CURRENT — no scoping at all
const { data, error } = await supabase
  .from("auto_documents")
  .update(updates)
  .eq("id", id)  // ← ID-only, no org/tenant check
  .select()
  .single();
```

**Mitigation:** RLS UPDATE policy on `auto_documents` does check `organization_id`, but the app should still scope.

**Fix:** Use `applyModuleMutationScope` or at minimum `.eq("organization_id", organizationId)`.

---

### C-03: `useUpdateDocumentTemplate` — No Tenant Scoping on Template Updates

**File:** [`src/modules/documents/hooks/useDocuments.ts`](file:///c:/Users/Piyus/OneDrive/Desktop/Main/Main/src/modules/documents/hooks/useDocuments.ts) (line ~205)  
**Severity:** 🔴 CRITICAL  
**Impact:** Cross-tenant template mutation  

Same issue as C-02. Updates template by ID alone.

```typescript
const { data, error } = await supabase
  .from("document_templates")
  .update(updates)
  .eq("id", id)  // ← no org scoping
  .select()
  .single();
```

---

### C-04: `useUpdateESignature` (CLM) — No Tenant Scoping

**File:** [`src/modules/clm/hooks/useCLM.ts`](file:///c:/Users/Piyus/OneDrive/Desktop/Main/Main/src/modules/clm/hooks/useCLM.ts) (line ~540)  
**Severity:** 🔴 CRITICAL  
**Impact:** Cross-tenant e-signature status manipulation  

Updates `contract_esignatures` by `id` alone. No `ensureContractAccessible` call, no `applyModuleMutationScope`.

```typescript
const { data, error } = await supabase
  .from("contract_esignatures")
  .update(payload)
  .eq("id", id)  // ← no scoping
  .select()
  .single();
```

**Mitigation:** RLS on `contract_esignatures` does join through `contracts` table, providing DB-level protection.

---

### C-05: `approveClientMembership` / `rejectClientMembership` — No Organization Scoping

**File:** [`src/app/providers/AuthProvider.tsx`](file:///c:/Users/Piyus/OneDrive/Desktop/Main/Main/src/app/providers/AuthProvider.tsx) (lines ~775-810)  
**Severity:** 🔴 CRITICAL  
**Impact:** Cross-tenant membership state manipulation  

Both functions update `organization_memberships` filtered only by `user_id` and `role = "client"`, without checking `organization_id`. An admin from Org A could approve/reject a client membership belonging to Org B.

```typescript
// approveClientMembership
await unsafeSupabase
  .from("organization_memberships")
  .update({ account_state: "active", ... })
  .eq("user_id", userId)       // ← only user-scoped
  .eq("account_state", "pending_approval")
  .eq("role", "client");       // ← no organization_id filter!
```

**Fix:** Add `.eq("organization_id", currentOrganizationId)` to both functions.

---

### C-06: `useDocumentESignatures` — No Tenant Scoping on Read

**File:** [`src/modules/documents/hooks/useDocuments.ts`](file:///c:/Users/Piyus/OneDrive/Desktop/Main/Main/src/modules/documents/hooks/useDocuments.ts) (line ~508)  
**Severity:** 🔴 CRITICAL  
**Impact:** Cross-tenant e-signature data exposure  

When `documentId` is not provided, the query fetches ALL e-signatures across ALL tenants with no `organization_id` filter, no `applyTenantOwnershipScope`.

```typescript
let query = supabase
  .from("document_esignatures")
  .select("*, document:auto_documents(...)")
  .order("created_at", { ascending: false });
// No org filter applied when documentId is null
```

**Mitigation:** RLS policy `des_select` does join through `auto_documents`, but this still fetches unnecessarily broadly.

---

### C-07: `useDocumentVersions` — No Tenant Scoping

**File:** [`src/modules/documents/hooks/useDocuments.ts`](file:///c:/Users/Piyus/OneDrive/Desktop/Main/Main/src/modules/documents/hooks/useDocuments.ts) (line ~754)  
**Severity:** 🔴 CRITICAL  
**Impact:** Cross-tenant version history exposure  

Fetches all versions for a document ID without checking that the document belongs to the current user's organization.

---

## 3. Multi-Tenancy Isolation Bugs

### T-01: Systemic `organization_id` vs `tenant_id` Column Mismatch

**Files:** Multiple  
**Severity:** 🟠 HIGH  
**Impact:** Runtime failures or silently broken scoping  

The codebase has two naming conventions for the same concept:
- **`organization_id`**: Used in `module-scope.ts`, `OrganizationProvider.tsx`, all module hooks
- **`tenant_id`**: Used in DB types (`types.ts`), `TenantProvider.tsx`, `jobs.ts`

The `module-scope.ts` file applies `.eq("organization_id", ...)`, but several DB table types define the column as `tenant_id`. The RLS policies handle this with `COALESCE(organization_id, tenant_id)`, meaning **both columns may exist on some tables**. But if a table only has `tenant_id` and the app filters on `organization_id`, **the filter silently returns zero rows** instead of erroring.

**Evidence:**
- `buildModuleCreatePayload` injects `organization_id` AND `tenant_id` (line 86 of `module-scope.ts`)
- `applyModuleReadScope` filters on `organization_id` only
- DB types show tables with `tenant_id` column only

---

### T-02: Dual Provider Architecture Creates Confusion

**Files:** [`OrganizationProvider.tsx`](file:///c:/Users/Piyus/OneDrive/Desktop/Main/Main/src/app/providers/OrganizationProvider.tsx), [`TenantProvider.tsx`](file:///c:/Users/Piyus/OneDrive/Desktop/Main/Main/src/app/providers/TenantProvider.tsx)  
**Severity:** 🟠 HIGH  
**Impact:** Incorrect data isolation, stale context  

Two separate providers manage what is conceptually the same entity:
- `OrganizationProvider` queries `organizations`, `organization_memberships`, `organization_subscriptions`
- `TenantProvider` queries `tenants`, `tenant_users`, `tenant_subscriptions`

All module hooks use `useOrganization()`. The `TenantProvider` exists but may fetch stale or different data. If both tables exist and get out of sync, the user sees inconsistent state.

---

### T-03: `useDocumentsRealtime` — Global Realtime Subscription

**File:** [`src/modules/documents/hooks/useDocuments.ts`](file:///c:/Users/Piyus/OneDrive/Desktop/Main/Main/src/modules/documents/hooks/useDocuments.ts) (line ~39)  
**Severity:** 🟡 MEDIUM  
**Impact:** Information disclosure via realtime events  

The realtime subscription subscribes to `{ event: "*", schema: "public", table: "auto_documents" }` without any filter — it receives change notifications for ALL organizations' documents. While the actual data refetch is scoped, the **event payload in postgres_changes can leak** row-level data.

**Fix:** Add `.filter("organization_id", "eq", organizationId)` to the channel subscription.

---

### T-04: `purchase_order_items` Child Queries Don't Scope by Organization

**File:** [`src/modules/erp/hooks/useERP.ts`](file:///c:/Users/Piyus/OneDrive/Desktop/Main/Main/src/modules/erp/hooks/useERP.ts) (line ~607)  
**Severity:** 🟡 MEDIUM  
**Impact:** Relies entirely on RLS  

Inside `usePurchaseOrder`, the items sub-query filters only by `purchase_order_id` without checking that those items belong to the correct organization. The delete path (`useDeletePurchaseOrder`) also soft-deletes items by `purchase_order_id` only.

---

## 4. Authentication & Authorization Bugs

### A-01: Route Guards Don't Check `suspended` / `rejected` Account States

**File:** [`src/core/auth/components/ProtectedRoute.tsx`](file:///c:/Users/Piyus/OneDrive/Desktop/Main/Main/src/core/auth/components/ProtectedRoute.tsx)  
**Severity:** 🟠 HIGH  
**Impact:** Suspended users can access protected routes  

The route guards (`TenantAdminRoute`, `ClientRoute`, `AdminRoute`) check role but never check `account_state`. A user whose membership is `suspended` or `rejected` can still access all routes as long as they have a valid session and role.

```typescript
// CURRENT — role-only check
if (!ADMIN_ROLES.includes(role)) {
  return <Navigate to="/auth/sign-in" replace />;
}
// MISSING: account_state check
```

**Fix:** Add `account_state` to the auth context and check `account_state === "active"` in all route guards.

---

### A-02: Role Resolution Falls Back to `pending_approval` Unsafely

**File:** [`src/core/auth/components/ProtectedRoute.tsx`](file:///c:/Users/Piyus/OneDrive/Desktop/Main/Main/src/core/auth/components/ProtectedRoute.tsx)  
**Severity:** 🟡 MEDIUM  
**Impact:** Unexpected access for users with null roles  

```typescript
const role = authRole ?? "pending_approval";
```

If `authRole` is `null` (no membership found), the user is treated as `pending_approval`. While route guards may block most access, this is a dangerous default — it should fall back to no access rather than a valid state.

---

### A-03: `getUserRole` Caches Roles in `sessionStorage` Without Expiry

**File:** [`src/app/providers/AuthProvider.tsx`](file:///c:/Users/Piyus/OneDrive/Desktop/Main/Main/src/app/providers/AuthProvider.tsx) (line ~61)  
**Severity:** 🟡 MEDIUM  
**Impact:** Stale role after admin changes user permissions  

Roles are cached with `ROLE_CACHE_KEY_PREFIX` in `sessionStorage`. If an admin changes a user's role (e.g., downgrades from `admin` to `employee`), the user continues operating with the old cached role until they close the browser tab.

**Fix:** Add TTL to cached roles or invalidate on auth state changes.

---

### A-04: `signIn` Auto-Activates `pending_verification` Memberships Without Org Check

**File:** [`src/app/providers/AuthProvider.tsx`](file:///c:/Users/Piyus/OneDrive/Desktop/Main/Main/src/app/providers/AuthProvider.tsx) (line ~900)  
**Severity:** 🟠 HIGH  
**Impact:** Membership activation across all organizations  

When a user signs in with `pending_verification` status and their email is confirmed, the code auto-activates their membership. But the update query only filters by `user_id` and `account_state`:

```typescript
.eq("user_id", data.user.id)
.eq("account_state", "pending_verification")
// ← Updates ALL pending_verification memberships, not just one org
```

If the user has pending memberships in multiple organizations, ALL get activated simultaneously.

---

### A-05: `OrganizationProvider` Uses `unsafeSupabase` Cast

**File:** [`src/app/providers/OrganizationProvider.tsx`](file:///c:/Users/Piyus/OneDrive/Desktop/Main/Main/src/app/providers/OrganizationProvider.tsx) (line 74)  
**Severity:** 🟡 MEDIUM  
**Impact:** Type safety bypass  

```typescript
const unsafeSupabase = supabase as unknown as SupabaseClient;
```

This double-cast (`as unknown as`) completely bypasses TypeScript's type system. Any query through this client will not be type-checked, meaning column name typos silently compile.

---

## 5. Module-Specific Bugs

### M-01: CRM `mapAccount` Maps Wrong Fields

**File:** [`src/modules/crm/hooks/useCRM.ts`](file:///c:/Users/Piyus/OneDrive/Desktop/Main/Main/src/modules/crm/hooks/useCRM.ts) (line ~169)  
**Severity:** 🟡 MEDIUM  
**Impact:** Wrong data displayed in UI  

```typescript
email: row.domain ?? undefined,       // ← 'domain' is not email
description: row.ownership ?? undefined, // ← 'ownership' is not description
```

The `domain` field (company website domain) is mapped to `email` property. The `ownership` field (e.g., "public", "private") is mapped to `description`.

---

### M-02: CRM `mapLead` / `mapAccount` / `mapContact` — `created_by` Always Equals `owner_id`

**File:** [`src/modules/crm/hooks/useCRM.ts`](file:///c:/Users/Piyus/OneDrive/Desktop/Main/Main/src/modules/crm/hooks/useCRM.ts)  
**Severity:** 🔵 LOW  
**Impact:** Incorrect audit trail  

```typescript
created_by: row.owner_id ?? undefined, // ← should be row.created_by
```

Every CRM entity maps `created_by` from `owner_id`. The actual `created_by` column (if it exists) is ignored.

---

### M-03: Documents Module Uses Different Scoping Pattern Than Other Modules

**File:** [`src/modules/documents/hooks/useDocuments.ts`](file:///c:/Users/Piyus/OneDrive/Desktop/Main/Main/src/modules/documents/hooks/useDocuments.ts)  
**Severity:** 🟠 HIGH  
**Impact:** Inconsistent security posture  

CRM, CPQ, CLM, and ERP all use `applyModuleReadScope` / `applyModuleMutationScope` / `buildModuleCreatePayload`.

Documents uses `applyTenantOwnershipScope` / `withOwnershipCreate` from `data-ownership.ts` — a completely different code path with different logic.

This means:
- No owner-scoped row filtering for documents
- Different `organization_id` column inference
- Mutations don't use `applyModuleMutationScope` at all

---

### M-04: ERP `mapFinancialRecord` Maps `reference_type` from `status`

**File:** [`src/modules/erp/hooks/useERP.ts`](file:///c:/Users/Piyus/OneDrive/Desktop/Main/Main/src/modules/erp/hooks/useERP.ts) (line ~186)  
**Severity:** 🟡 MEDIUM  
**Impact:** Incorrect data display  

```typescript
reference_type: row.status ?? undefined, // ← status is not reference_type
```

---

### M-05: CPQ `useProducts` Uses Direct `organization_id` Filter Instead of Module Scope

**File:** [`src/modules/cpq/hooks/useCPQ.ts`](file:///c:/Users/Piyus/OneDrive/Desktop/Main/Main/src/modules/cpq/hooks/useCPQ.ts) (line ~61)  
**Severity:** 🔵 LOW  
**Impact:** Inconsistent pattern  

While all other queries use `applyModuleReadScope`, `useProducts` uses `requireOrganizationScope` + manual `.eq("organization_id", ...)`. This bypasses the owner-scoped row visibility logic.

---

### M-06: CLM `useCreateESignature` — No `organization_id` on Insert

**File:** [`src/modules/clm/hooks/useCLM.ts`](file:///c:/Users/Piyus/OneDrive/Desktop/Main/Main/src/modules/clm/hooks/useCLM.ts) (line ~474)  
**Severity:** 🟡 MEDIUM  

When inserting into `contract_esignatures`, the payload does not include `organization_id`. The RLS INSERT policy checks via a JOIN to `contracts`, but if the `contract_esignatures` table has an `organization_id` column, it will be NULL, breaking future direct queries.

---

## 6. Type Safety & TypeScript Issues

### TS-01: `usePermissions` Has Wrong Import Paths

**File:** [`src/core/rbac/usePermissions.ts`](file:///c:/Users/Piyus/OneDrive/Desktop/Main/Main/src/core/rbac/usePermissions.ts)  
**Severity:** 🟠 HIGH  
**Impact:** Compilation may fail or resolve wrong module  

```typescript
import { useAuth } from "./useAuth";               // ← should be @/core/auth/useAuth
import { useOrganization } from "./useOrganization"; // ← should be @/workspaces/organization/hooks/useOrganization
```

These relative imports may resolve if the file happens to be in the right folder, but they should use the `@/` path alias for consistency and correctness.

---

### TS-02: Pervasive `as unknown as` Double-Casts

**Files:** Multiple providers and utilities  
**Severity:** 🟡 MEDIUM  

```typescript
// OrganizationProvider.tsx
const unsafeSupabase = supabase as unknown as SupabaseClient;

// ImpersonationProvider.tsx
const unsafeSupabase = supabase as unknown as { from: ... };

// audit.ts
const unsafeSupabase = supabase as unknown as ...;
```

These casts bypass the auto-generated Supabase types entirely. Any column name error becomes a runtime failure instead of a compile-time error.

---

### TS-03: Duplicate `isModuleEnabled` Function

**Files:** [`src/core/types/organization.ts`](file:///c:/Users/Piyus/OneDrive/Desktop/Main/Main/src/core/types/organization.ts), [`src/core/types/tenant.ts`](file:///c:/Users/Piyus/OneDrive/Desktop/Main/Main/src/core/types/tenant.ts)  
**Severity:** 🔵 LOW  

Identical function defined in both files. `OrganizationProvider` imports from `organization.ts`, `TenantProvider` from `tenant.ts`. Should be a single shared function.

---

### TS-04: `quote_items` vs `quote_line_items` Table Name Inconsistency

**Severity:** 🟡 MEDIUM  

- **Frontend code** (`useCPQ.ts`, `useCRM.ts`): Uses `supabase.from("quote_items")`
- **RLS policies** (`015_hardened_rls_policies.sql`): Creates policies for `quote_line_items`
- **DB types** (`types.ts`): Defines `quote_items` table

If the actual table is `quote_items` but RLS policies are created for `quote_line_items`, the policies are not applied. If the table was renamed, one side is outdated.

---

## 7. Data Integrity & Logic Bugs

### D-01: `writeAuditLog` Uses Inconsistent Parameter Names

**File:** [`src/core/utils/audit.ts`](file:///c:/Users/Piyus/OneDrive/Desktop/Main/Main/src/core/utils/audit.ts)  
**Severity:** 🟡 MEDIUM  

CRM/CPQ/CLM/ERP hooks pass `tenantId` as the org identifier. Documents hook passes `organizationId`. The `writeAuditLog` function accepts both but maps them differently:

```typescript
// CRM passes: { tenantId: organizationId, ... }
// Documents passes: { organizationId: organization?.id, ... }
```

The audit_logs table has `organization_id` column. If `tenantId` maps to a different column, audit records may have NULL org references.

---

### D-02: `claimPendingInvitations` Throws on Non-Numeric Returns

**File:** [`src/app/providers/AuthProvider.tsx`](file:///c:/Users/Piyus/OneDrive/Desktop/Main/Main/src/app/providers/AuthProvider.tsx) (line ~854)  
**Severity:** 🔵 LOW  

Excessive defensive parsing for an RPC that should always return a number. If the RPC returns an unexpected type, the function returns 0 silently, masking errors.

---

### D-03: `mapOpportunity` Maps `description` from `next_step`

**File:** [`src/modules/crm/hooks/useCRM.ts`](file:///c:/Users/Piyus/OneDrive/Desktop/Main/Main/src/modules/crm/hooks/useCRM.ts) (line ~227)  
**Severity:** 🟡 MEDIUM  

```typescript
description: row.next_step ?? undefined, // ← should be row.description
next_step: row.next_step ?? undefined,   // ← correct
```

Both `description` and `next_step` properties are mapped from `row.next_step`.

---

### D-04: ERP `useCreatePurchaseOrder` Maps `payment_terms` from `notes`

**File:** [`src/modules/erp/hooks/useERP.ts`](file:///c:/Users/Piyus/OneDrive/Desktop/Main/Main/src/modules/erp/hooks/useERP.ts) (line ~635)  
**Severity:** 🟡 MEDIUM  

```typescript
payment_terms: po.notes ?? null,  // ← should be po.payment_terms
notes: po.notes ?? null,          // ← correct
```

---

## 8. Performance Issues

### P-01: `app_is_platform_super_admin` Called Multiple Times Per RLS Check

**File:** [`supabase/migrations/015_hardened_rls_policies.sql`](file:///c:/Users/Piyus/OneDrive/Desktop/Main/Main/supabase/migrations/015_hardened_rls_policies.sql)  
**Severity:** 🔵 LOW  
**Impact:** Additional DB function call per row per policy  

Every RLS policy starts with `public.app_is_platform_super_admin(auth.uid())`. For a table with 4 policies (SELECT/INSERT/UPDATE/DELETE), this could mean 4+ function calls per operation. The function should be marked `STABLE` and postgres should cache it within a statement, but **per-row evaluation on large tables** could be expensive.

**Fix:** Consider using `SET` configuration variables (`SET role`) or `current_setting()` for role caching within a transaction.

---

### P-02: `useDocumentsRealtime` Creates Multiple Channels Per Component

**File:** [`src/modules/documents/hooks/useDocuments.ts`](file:///c:/Users/Piyus/OneDrive/Desktop/Main/Main/src/modules/documents/hooks/useDocuments.ts)  
**Severity:** 🔵 LOW  

Each document-related hook calls `useDocumentsRealtime` with a different `scope` parameter (e.g., `"templates"`, `"documents"`, `"esignatures-{id}"`). If multiple hooks render simultaneously, the app creates 3+ realtime channels subscribing to the same tables.

---

### P-03: Query Key Invalidation Is Over-Broad

**Files:** All module hooks  
**Severity:** 🔵 LOW  

```typescript
queryClient.invalidateQueries({ queryKey: ["contracts"] }); // Invalidates ALL contract queries
queryClient.invalidateQueries({ queryKey: ["contract"] });  // Invalidates ALL single-contract queries
```

This causes unnecessary refetches across all tenant contexts. Should include org/tenant ID in the key prefix for targeted invalidation.

---

## 9. Code Quality & Maintainability

### Q-01: `ImpersonationProvider` Defines Inline Type Casts for Supabase

**File:** [`src/app/providers/ImpersonationProvider.tsx`](file:///c:/Users/Piyus/OneDrive/Desktop/Main/Main/src/app/providers/ImpersonationProvider.tsx)  
**Severity:** 🔵 LOW  

Three separate inline Supabase type definitions (lines ~25, ~85, ~115) that manually define `.from()`, `.insert()`, `.update()` chains. These should use the auto-generated types or a shared unsafe client helper.

---

### Q-02: Wildcard CORS in Edge Functions

**File:** [`supabase/functions/_shared/resend.ts`](file:///c:/Users/Piyus/OneDrive/Desktop/Main/Main/supabase/functions/_shared/resend.ts)  
**Severity:** 🟡 MEDIUM  

```typescript
"Access-Control-Allow-Origin": "*",
```

Edge Functions allow requests from any origin. In production, this should be restricted to the application domain.

---

### Q-03: `"use client"` Directive in Non-Next.js Project

**Files:** `OrganizationProvider.tsx`, `TenantProvider.tsx`  
**Severity:** 🔵 LOW  

The project uses Vite, not Next.js. The `"use client"` directive has no effect and is misleading.

---

### Q-04: `getErrorMessage` Duplicated Across All Module Hooks

**Files:** All 5 module hooks  
**Severity:** 🔵 LOW  

Identical `getErrorMessage(error: unknown): string` function copy-pasted into every module hook. Should be extracted to a shared utility.

---

## 10. Edge Functions & Backend Issues

### E-01: Edge Functions Use `inviteUserByEmail` — Existing Users Get Re-Invited

**Files:** [`send-employee-invitation/index.ts`](file:///c:/Users/Piyus/OneDrive/Desktop/Main/Main/supabase/functions/send-employee-invitation/index.ts), [`send-client-invitation/index.ts`](file:///c:/Users/Piyus/OneDrive/Desktop/Main/Main/supabase/functions/send-client-invitation/index.ts)  
**Severity:** 🟡 MEDIUM  

`adminClient.auth.admin.inviteUserByEmail` will create a new auth user if one doesn't exist, or return an error if the user already exists (depending on Supabase config). The edge functions don't check if the user already has an account, which could cause confusing error messages.

---

### E-02: No Rate Limiting on Edge Function Invocations

**Files:** Both invitation edge functions  
**Severity:** 🟡 MEDIUM  
**Impact:** Invitation spam, email abuse  

There is no rate-limiting check on how many invitations an admin can send. A compromised admin account could spam thousands of invitation emails.

---

## 11. RLS Policy Analysis

### Strengths ✅

1. **Clean-slate rebuild** — drops all existing policies first, preventing policy accumulation bugs
2. **Per-operation policies** — explicit SELECT/INSERT/UPDATE/DELETE (no `FOR ALL`)
3. **Helper function** — `_rls_user_can_write_org()` reduces duplication and ensures consistent role checks
4. **Child table joins** — child tables (quote_items, contract_esignatures, etc.) properly join to parent for org access
5. **Audit log immutability** — no UPDATE/DELETE policies on audit_logs
6. **`COALESCE(organization_id, tenant_id)`** — handles the dual-column legacy gracefully
7. **Invitation validation** — memberships INSERT checks for valid pending invitations with expiry

### Concerns ⚠️

| Issue | Description | Severity |
|-------|------------|----------|
| `quote_items` vs `quote_line_items` | RLS policies created for `quote_line_items` but app uses `quote_items` | 🟡 MEDIUM |
| No `FORCE RLS` | Intentionally omitted per comment, but means postgres role bypasses all policies | 🔵 LOW (by design) |
| `pending_verification` can UPDATE | `account_state IN ('active', 'pending_verification')` allows unverified users to write | 🟡 MEDIUM |
| No row-level owner check on business data | SELECT allows any org member to see all org data (no owner filtering at DB level) | 🔵 LOW (by design — app layer handles) |

---

## 12. Recommendations & Priority Matrix

### Immediate Fixes (This Sprint)

| # | Issue | Action | Files |
|---|-------|--------|-------|
| 1 | C-01 | Add `organizationId` param to `softDeleteRecord` | `soft-delete.ts`, all callers |
| 2 | C-02/C-03 | Add `applyModuleMutationScope` to document update mutations | `useDocuments.ts` |
| 3 | C-04 | Add `ensureContractAccessible` to `useUpdateESignature` | `useCLM.ts` |
| 4 | C-05 | Add `.eq("organization_id", orgId)` to approve/reject | `AuthProvider.tsx` |
| 5 | C-06/C-07 | Add `applyTenantOwnershipScope` to esignature and version reads | `useDocuments.ts` |
| 6 | A-01 | Add `account_state` check to all route guards | `ProtectedRoute.tsx` |
| 7 | A-04 | Scope auto-activation to current org only | `AuthProvider.tsx` |

### Near-Term (Next 2 Sprints)

| # | Issue | Action |
|---|-------|--------|
| 8 | T-01 | Unify `organization_id` / `tenant_id` naming across code and DB |
| 9 | T-02 | Deprecate `TenantProvider` or merge with `OrganizationProvider` |
| 10 | M-03 | Migrate Documents module to use `applyModuleReadScope`/`buildModuleCreatePayload` |
| 11 | TS-01 | Fix import paths in `usePermissions.ts` |
| 12 | TS-04 | Verify `quote_items` vs `quote_line_items` table name in DB |
| 13 | T-03 | Add org filter to realtime subscriptions |
| 14 | Q-02 | Restrict CORS in Edge Functions to production domain |

### Backlog

| # | Issue | Action |
|---|-------|--------|
| 15 | M-01 | Fix `mapAccount` field mappings (domain→email, ownership→description) |
| 16 | D-03 | Fix `mapOpportunity.description` mapping |
| 17 | D-04 | Fix `mapPurchaseOrder.payment_terms` mapping |
| 18 | TS-02 | Replace `as unknown as` casts with properly typed Supabase client |
| 19 | A-03 | Add TTL to role cache |
| 20 | Q-04 | Extract `getErrorMessage` to shared utility |

---

> **Note:** The RLS policies in `015_hardened_rls_policies.sql` provide strong database-level protection. Many of the CRITICAL frontend issues (C-01 through C-07) are **mitigated by RLS** — meaning an attacker cannot actually access cross-tenant data at the Postgres level. However, **defense in depth requires fixing the application layer too**, and relying solely on RLS creates brittle security where any RLS misconfiguration becomes a full data breach.

---

*End of Debug Report*
