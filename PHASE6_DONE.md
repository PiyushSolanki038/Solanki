# Phase 6 — Security Hardening ✅

> Completed: 2026-03-08 · All 10 items done

---

## Summary

Phase 6 closes all **CRITICAL** and **HIGH** severity security gaps identified in the [DEBUG_REPORT.md](./DEBUG_REPORT.md). Changes span 8 files across core utilities, module hooks, auth providers, route guards, and edge functions.

---

## Completed Items

### 6.1 — Tenant Scoping for Soft Delete (C-01)
**File:** `src/core/utils/soft-delete.ts`

Added optional `organizationId` param to `softDeleteRecord` and `restoreSoftDeletedRecord`. When provided, queries are scoped with `.eq("organization_id", ...)` to prevent cross-tenant deletions. All callers in CLM and Documents hooks updated.

```diff
-export async function softDeleteRecord(input: SoftDeleteInput)
+export async function softDeleteRecord(input: SoftDeleteInput)
+// SoftDeleteInput now includes: organizationId?: string | null
```

---

### 6.2 — Document Update Mutation Scoping (C-02, C-03)
**File:** `src/modules/documents/hooks/useDocuments.ts`

- `useUpdateDocumentTemplate`: Added org context check + `.eq("organization_id", organization.id)`
- `useUpdateAutoDocument`: Same scoping applied
- Both `softDeleteRecord` callers updated with `organizationId`

```diff
 const { data, error } = await supabase
   .from("document_templates")
   .update(updates)
   .eq("id", id)
+  .eq("organization_id", organization.id)
   .select()
   .single();
```

---

### 6.3 — CLM E-Signature Access Check (C-04)
**File:** `src/modules/clm/hooks/useCLM.ts`

- Added `ensureContractAccessible` call before updating e-signatures
- Applied `applyModuleMutationScope` to the update query
- All 3 `softDeleteRecord` callers updated with `organizationId`

```diff
+if (contract_id) {
+  await ensureContractAccessible(contract_id, scope);
+}
+const scopedQuery = applyModuleMutationScope(
+  supabase.from("contract_esignatures").update(payload).eq("id", id),
+  scope, []
+);
```

---

### 6.4 — Membership Approve/Reject Scoping (C-05)
**Files:** `src/app/providers/AuthProvider.tsx`, `src/core/auth/auth-context.ts`

Added optional `organizationId` param to `approveClientMembership` and `rejectClientMembership`. When provided, scopes the update with `.eq("organization_id", ...)`.

```diff
-async (membershipId: string)
+async (membershipId: string, organizationId?: string)
+  if (organizationId) {
+    query = query.eq("organization_id", organizationId);
+  }
```

---

### 6.5 — Document E-Signature & Version Read Scoping (C-06, C-07)
**File:** `src/modules/documents/hooks/useDocuments.ts`

- `useDocumentESignatures`: Added `applyTenantOwnershipScope` with org context
- `useDocumentVersions`: Added parent document ownership verification before fetching versions

```diff
+query = applyTenantOwnershipScope(query, {
+  organizationId: organization?.id,
+  isPlatformAdmin: isPlatformRole(role),
+});
```

---

### 6.6 + 6.7 — Route Guard Account State Check (A-01, A-02)
**File:** `src/core/auth/components/ProtectedRoute.tsx`

- Created `useGuardedAuth()` hook that checks for suspended/rejected/pending_verification states
- All 5 route guards now check `isActiveAccount` before granting access
- Removed dangerous `?? "pending_approval"` fallback — null role now means no access

```diff
+function useGuardedAuth() {
+  const { user, role: authRole, loading } = useAuth();
+  const isSuspendedOrRejected = role === "rejected" || role === "suspended" || ...;
+  const isActiveAccount = !!role && !isSuspendedOrRejected;
+  return { user, role, isActiveAccount, loading };
+}
```

---

### 6.8 — Scoped Auto-Activation (A-04)
**File:** `src/app/providers/AuthProvider.tsx`

Changed sign-in auto-activation from blanket update of all `pending_verification` memberships to selecting a single pending membership by PK, then updating only that specific record.

```diff
-await unsafeSupabase
-  .from("organization_memberships")
-  .update({ account_state: "active", ... })
-  .eq("user_id", data.user.id)
-  .eq("account_state", "pending_verification");
+const { data: pendingMembership } = await unsafeSupabase
+  .from("organization_memberships")
+  .select("id, organization_id")
+  .eq("user_id", data.user.id)
+  .eq("account_state", "pending_verification")
+  .limit(1).maybeSingle();
+if (pendingMembership) {
+  await unsafeSupabase...update(...).eq("id", pendingMembership.id);
+}
```

---

### 6.9 — CORS Restriction (Q-02)
**File:** `supabase/functions/_shared/resend.ts`

Replaced wildcard `"*"` CORS origin with environment-based `ALLOWED_ORIGIN`.

```diff
+const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "https://app.siswitinfra.com";
 export const corsHeaders = {
-  "Access-Control-Allow-Origin": "*",
+  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
 };
```

---

### 6.10 — Edge Function Rate Limiting (E-02)
**Files:** `supabase/functions/send-employee-invitation/index.ts`, `supabase/functions/send-client-invitation/index.ts`

Added per-org rate limit: max 50 invitations per hour. Returns HTTP 429 when exceeded.

```diff
+const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
+const { count } = await adminClient
+  .from("employee_invitations")
+  .select("id", { count: "exact", head: true })
+  .eq("organization_id", payload.organizationId)
+  .gte("created_at", oneHourAgo);
+if ((count ?? 0) >= 50) {
+  return jsonResponse(429, { error: "Too many invitations sent." });
+}
```

---

## Files Modified

| File | Changes |
|------|---------|
| `src/core/utils/soft-delete.ts` | Rewrote with `organizationId` scoping |
| `src/modules/documents/hooks/useDocuments.ts` | Mutation + read scoping (6 changes) |
| `src/modules/clm/hooks/useCLM.ts` | E-signature access check + soft-delete scoping |
| `src/app/providers/AuthProvider.tsx` | Approve/reject scoping + auto-activation fix |
| `src/core/auth/auth-context.ts` | Updated type interface |
| `src/core/auth/components/ProtectedRoute.tsx` | `useGuardedAuth()` + account state checks |
| `supabase/functions/_shared/resend.ts` | CORS restriction |
| `supabase/functions/send-employee-invitation/index.ts` | Rate limiting |
| `supabase/functions/send-client-invitation/index.ts` | Rate limiting |

---

## Known Pre-Existing Issues (Not Introduced by Phase 6)

- **`tenant_id` type mismatches** in `useDocuments.ts` and `useCLM.ts` → Will be resolved in Phase 7 (T-01)
- **`Deno` / module import lint errors** in edge functions → Expected for Supabase edge functions (not runtime errors)
- **`ESignatureRow` `updated_at` mismatch** → DB schema alignment (Phase 7)
