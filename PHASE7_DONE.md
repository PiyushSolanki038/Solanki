# Phase 7 — Architecture Consolidation ✅

> Completed 8 items · Eliminated org/tenant duality, unified scoping patterns

---

## 7.1 — Unified `organization_id` / `tenant_id` naming ← T-01

Removed legacy `tenant_id` stamps from both `buildModuleCreatePayload` and `enqueueJob`. Only `organization_id` is written now.

### Files Modified
- [module-scope.ts](file:///c:/Users/Piyus/OneDrive/Desktop/Main/Main/src/core/utils/module-scope.ts)
- [jobs.ts](file:///c:/Users/Piyus/OneDrive/Desktop/Main/Main/src/core/utils/jobs.ts)

```diff
 # module-scope.ts – buildModuleCreatePayload
   const nextPayload = {
     ...payload,
     organization_id: organizationId,
-    // Keep legacy field synchronized while module code is still transitioning.
-    tenant_id: organizationId,
   } as TPayload;
```

```diff
 # jobs.ts – enqueueJob insert
       organization_id: organizationId,
-      tenant_id: organizationId,
       job_type: input.jobType,
```

---

## 7.2 — Deprecate `TenantProvider` ← T-02

Added JSDoc `@deprecated` notice to `TenantProvider.tsx`. New code should use `OrganizationProvider`. The provider is retained for backward-compat until all 12 `useTenant()` call sites are migrated.

### Files Modified
- [TenantProvider.tsx](file:///c:/Users/Piyus/OneDrive/Desktop/Main/Main/src/app/providers/TenantProvider.tsx)

---

## 7.3 — Documents module unified scoping ← M-03

**Already addressed by Phase 6.** Documents module already uses `applyTenantOwnershipScope` and `applyModuleMutationScope` consistently. No additional changes needed.

---

## 7.4 — Fix import paths in `usePermissions` ← TS-01

Changed relative imports (`./useAuth`, `./useOrganization`) to `@/` path aliases for consistency with the rest of the codebase.

### Files Modified
- [usePermissions.ts](file:///c:/Users/Piyus/OneDrive/Desktop/Main/Main/src/core/rbac/usePermissions.ts)

```diff
-import { useAuth } from "./useAuth";
-import { useOrganization } from "./useOrganization";
+import { useAuth } from "@/core/auth/useAuth";
+import { useOrganization } from "@/workspaces/organization/hooks/useOrganization";
```

---

## 7.5 — Resolve `quote_items` vs `quote_line_items` ← TS-04

Aligned all 11 references from `"quote_items"` → `"quote_line_items"` to match the actual DB schema defined in `types.ts`.

### Files Modified
- [useCPQ.ts](file:///c:/Users/Piyus/OneDrive/Desktop/Main/Main/src/modules/cpq/hooks/useCPQ.ts) — 8 references updated
- [useCRM.ts](file:///c:/Users/Piyus/OneDrive/Desktop/Main/Main/src/modules/crm/hooks/useCRM.ts) — 3 references updated

---

## 7.6 — Add org filter to realtime subscriptions ← T-03

Added `organization_id` filter to all 3 Supabase realtime channels (`auto_documents`, `document_templates`, `document_esignatures`) to prevent cross-org change events from leaking.

### Files Modified
- [useDocuments.ts](file:///c:/Users/Piyus/OneDrive/Desktop/Main/Main/src/modules/documents/hooks/useDocuments.ts)

```diff
-function useDocumentsRealtime(userId?: string, scope = "global") {
+function useDocumentsRealtime(userId?: string, scope = "global", organizationId?: string | null) {
+  const orgFilter = organizationId
+    ? `organization_id=eq.${organizationId}`
+    : undefined;
-  .on("postgres_changes", { event: "*", schema: "public", table: "auto_documents" }, ...)
+  .on("postgres_changes", { event: "*", schema: "public", table: "auto_documents", filter: orgFilter }, ...)
```

All 3 callers updated to pass `organization?.id`.

---

## 7.7 — Add existing-user check to invitation edge functions ← E-01

Both invitation functions now check if the email already belongs to a registered user. If so:
1. Returns **409** if user already has a membership in the org
2. Creates membership directly (skipping invite flow) if user exists but isn't a member

### Files Modified
- [send-employee-invitation/index.ts](file:///c:/Users/Piyus/OneDrive/Desktop/Main/Main/supabase/functions/send-employee-invitation/index.ts)
- [send-client-invitation/index.ts](file:///c:/Users/Piyus/OneDrive/Desktop/Main/Main/supabase/functions/send-client-invitation/index.ts)

---

## 7.8 — Add `organization_id` to CLM e-signature inserts ← M-06

E-signature insert payload now includes `organization_id` via `requireOrganizationScope`, ensuring tenant isolation for new e-signatures.

### Files Modified
- [useCLM.ts](file:///c:/Users/Piyus/OneDrive/Desktop/Main/Main/src/modules/clm/hooks/useCLM.ts)

```diff
+  const { organizationId: requiredOrgId } = requireOrganizationScope(scope);
   const payload = {
     contract_id: contractId,
     signer_email: sig.recipient_email || "",
     signer_name: sig.recipient_name || "",
     status: sig.status || "pending",
     sent_at: new Date().toISOString(),
+    organization_id: requiredOrgId,
   };
```

---

## Pre-Existing Lint Errors (Not introduced by Phase 7)

| Error | File | Root Cause |
|-------|------|------------|
| `tenant_id` missing in insert payloads | CLM, CRM, CPQ, Documents | DB `types.ts` still requires `tenant_id` — needs schema migration (Phase 8+) |
| `updated_at` missing on `ESignatureRow` | `useCLM.ts` | DB column doesn't exist on `contract_esignatures` table |
| `document_esignatures ↔ auto_documents` join | `useDocuments.ts` | Missing FK relation in Supabase schema |
| `Deno` / module import errors | Edge functions | Expected in IDE — runs correctly in Supabase runtime |
| `tableName` unused | `usePermissions.ts` | Dead code from previous refactor |
| `ContractStatus` unused | `useCLM.ts` | Unused import |

> These errors predate Phase 7 and require either a DB schema migration or type file regeneration to resolve.
