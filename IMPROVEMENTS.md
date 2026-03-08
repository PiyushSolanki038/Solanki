# SISWIT Platform — Improvement Plan

**Based on:** [DEBUG_REPORT.md](file:///c:/Users/Piyus/OneDrive/Desktop/Main/Main/DEBUG_REPORT.md)  
**Created:** March 2026  
**Intended Audience:** Dev team executing sprint-by-sprint  
**Total Items:** 35 improvements across 4 phases

---

## How to Read This Document

- Every improvement traces back to a finding ID from `DEBUG_REPORT.md` (e.g. `C-01`, `T-01`)
- **Before/After** code blocks show the exact change to make
- **Effort** is in developer-hours (1d = 8h), assuming familiarity with the codebase
- Phases align with the PRD roadmap: **Phase 6** (Security Hardening), **Phase 7** (Architecture Consolidation), **Phase 8** (Module Polish), **Phase 9** (DX & Performance)

---

## Phase 6 — Security Hardening (Current Sprint)

> Priority: Close all CRITICAL and HIGH-severity security gaps.  
> Target: 7 critical + 3 high-severity fixes = 10 items.

---

### 6.1 — Add Tenant Scoping to `softDeleteRecord` ← C-01

**File:** `src/core/utils/soft-delete.ts`  
**Effort:** 4h (function + update all 15+ callers)

Add a required `organizationId` parameter and apply it as a filter.

**Before:**
```typescript
export async function softDeleteRecord({
  table,
  id,
  userId,
}: {
  table: string;
  id: string;
  userId: string | null;
}): Promise<boolean> {
  const { error } = await supabase
    .from(table)
    .update({ deleted_at: now, deleted_by: userId })
    .eq("id", id)
    .is("deleted_at", null);
```

**After:**
```typescript
export async function softDeleteRecord({
  table,
  id,
  userId,
  organizationId,
}: {
  table: string;
  id: string;
  userId: string | null;
  organizationId: string;
}): Promise<boolean> {
  if (!organizationId) {
    throw new Error("softDeleteRecord requires organizationId for tenant isolation");
  }

  const { error } = await supabase
    .from(table)
    .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
    .eq("id", id)
    .eq("organization_id", organizationId)
    .is("deleted_at", null);
```

**Caller update pattern** (repeat for every module hook that calls `softDeleteRecord`):
```diff
 const deleted = await softDeleteRecord({
   table: "leads",
   id,
   userId,
+  organizationId: scope.organizationId!,
 });
```

---

### 6.2 — Add Mutation Scoping to Document Updates ← C-02, C-03

**File:** `src/modules/documents/hooks/useDocuments.ts`  
**Effort:** 3h

Add organization scoping to `useUpdateAutoDocument` and `useUpdateDocumentTemplate`.

**Before (`useUpdateAutoDocument`):**
```typescript
const { data, error } = await supabase
  .from("auto_documents")
  .update(updates)
  .eq("id", id)
  .select()
  .single();
```

**After:**
```typescript
if (!organization?.id) {
  throw new Error("Organization context is required");
}

const { data, error } = await supabase
  .from("auto_documents")
  .update(updates)
  .eq("id", id)
  .eq("organization_id", organization.id)
  .select()
  .single();
```

**Before (`useUpdateDocumentTemplate`):**
```typescript
const { data, error } = await supabase
  .from("document_templates")
  .update(updates)
  .eq("id", id)
  .select()
  .single();
```

**After:**
```typescript
if (!organization?.id) {
  throw new Error("Organization context is required");
}

const { data, error } = await supabase
  .from("document_templates")
  .update(updates)
  .eq("id", id)
  .eq("organization_id", organization.id)
  .select()
  .single();
```

---

### 6.3 — Add Access Check to CLM `useUpdateESignature` ← C-04

**File:** `src/modules/clm/hooks/useCLM.ts`  
**Effort:** 1h

The `useUpdateESignature` mutation must verify the user has access to the parent contract before updating the e-signature.

**Before:**
```typescript
mutationFn: async ({ id, ...updates }: Partial<ESignature> & { id: string }) => {
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  // ...
  const { data, error } = await supabase
    .from("contract_esignatures")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
```

**After:**
```typescript
mutationFn: async ({ id, contract_id, ...updates }: Partial<ESignature> & { id: string; contract_id?: string }) => {
  // Verify access to the parent contract
  if (contract_id) {
    await ensureContractAccessible(contract_id, scope);
  }

  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  // ...
  const scopedQuery = applyModuleMutationScope(
    supabase.from("contract_esignatures").update(payload).eq("id", id),
    scope,
    [],
  );
  const { data, error } = await scopedQuery.select().single();
```

---

### 6.4 — Scope `approveClientMembership` / `rejectClientMembership` by Organization ← C-05

**File:** `src/app/providers/AuthProvider.tsx`  
**Effort:** 2h

Both functions must include the current organization in the query filter.

**Before (`approveClientMembership`):**
```typescript
const approveClientMembership = useCallback(
  async (userId: string): Promise<{ error: string | null }> => {
    // ...
    await unsafeSupabase
      .from("organization_memberships")
      .update({ account_state: "active", /* ... */ })
      .eq("user_id", userId)
      .eq("account_state", "pending_approval")
      .eq("role", "client");
```

**After:**
```typescript
const approveClientMembership = useCallback(
  async (userId: string, organizationId: string): Promise<{ error: string | null }> => {
    if (!organizationId) {
      return { error: "Organization context is required" };
    }
    // ...
    await unsafeSupabase
      .from("organization_memberships")
      .update({ account_state: "active", /* ... */ })
      .eq("user_id", userId)
      .eq("organization_id", organizationId)
      .eq("account_state", "pending_approval")
      .eq("role", "client");
```

Apply the identical pattern to `rejectClientMembership`. Update the `AuthContextType` interface in `auth-context.ts` to match the new signatures, and update all call sites.

---

### 6.5 — Add Tenant Scoping to Document E-Signature and Version Reads ← C-06, C-07

**File:** `src/modules/documents/hooks/useDocuments.ts`  
**Effort:** 2h

**Before (`useDocumentESignatures`):**
```typescript
let query = supabase
  .from("document_esignatures")
  .select("*, document:auto_documents(id,name,type,status,created_at,updated_at)")
  .order("created_at", { ascending: false });

if (documentId) {
  query = query.eq("document_id", documentId);
}
```

**After:**
```typescript
if (!user?.id) throw new Error("User not authenticated");

let query = supabase
  .from("document_esignatures")
  .select("*, document:auto_documents(id,name,type,status,created_at,updated_at)")
  .order("created_at", { ascending: false });

if (documentId) {
  query = query.eq("document_id", documentId);
}

// Always scope to organization via the parent document join
query = applyTenantOwnershipScope(query, {
  organizationId: organization?.id,
  isPlatformAdmin: isPlatformRole(role),
  joinColumn: "document.organization_id",
});
```

**Before (`useDocumentVersions`):**
```typescript
const { data, error } = await supabase
  .from("document_versions")
  .select("*")
  .eq("document_id", documentId)
  .order("version_number", { ascending: false });
```

**After:**
```typescript
// First verify the user can access the parent document
const { data: docCheck } = await supabase
  .from("auto_documents")
  .select("id")
  .eq("id", documentId)
  .eq("organization_id", organization?.id ?? "")
  .maybeSingle();

if (!docCheck) throw new Error("Document not found or not accessible");

const { data, error } = await supabase
  .from("document_versions")
  .select("*")
  .eq("document_id", documentId)
  .order("version_number", { ascending: false });
```

---

### 6.6 — Add `account_state` Check to All Route Guards ← A-01

**File:** `src/core/auth/components/ProtectedRoute.tsx`  
**Effort:** 3h

**Step 1:** Expose `accountState` from the auth context.

In `src/core/auth/auth-context.ts`, add to `AuthContextType`:
```diff
 export interface AuthContextType {
   user: User | null;
   session: Session | null;
   role: AuthRole;
+  accountState: string | null;
   loading: boolean;
```

In `AuthProvider.tsx`, resolve and set `accountState` alongside `role` inside `getUserRole`.

**Step 2:** Create a shared guard helper.

**Before (each route guard):**
```typescript
export function TenantAdminRoute({ children }: { children: ReactNode }) {
  const { role: authRole, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  const role = authRole ?? "pending_approval";
  if (!ADMIN_ROLES.includes(role)) {
    return <Navigate to="/auth/sign-in" replace />;
  }
  return <>{children}</>;
}
```

**After:**
```typescript
function useGuardedAuth() {
  const { role: authRole, accountState, loading } = useAuth();
  const role = authRole ?? null;
  const isActiveAccount = accountState === "active";
  return { role, isActiveAccount, loading };
}

export function TenantAdminRoute({ children }: { children: ReactNode }) {
  const { role, isActiveAccount, loading } = useGuardedAuth();
  if (loading) return <LoadingScreen />;

  if (!role || !isActiveAccount) {
    return <Navigate to="/auth/sign-in" replace />;
  }

  if (!ADMIN_ROLES.includes(role)) {
    return <Navigate to="/auth/sign-in" replace />;
  }

  return <>{children}</>;
}
```

Apply `useGuardedAuth()` to **all** route guard components: `PlatformAdminRoute`, `TenantAdminRoute`, `ClientRoute`, `AdminRoute`, `OrganizationOwnerRoute`.

---

### 6.7 — Fix Null Role Fallback ← A-02

**File:** `src/core/auth/components/ProtectedRoute.tsx`  
**Effort:** 30m

This is implicitly fixed by 6.6 above. The key change:

**Before:**
```typescript
const role = authRole ?? "pending_approval"; // Dangerous fallback
```

**After:**
```typescript
const role = authRole ?? null; // Null = no access
if (!role || !isActiveAccount) {
  return <Navigate to="/auth/sign-in" replace />;
}
```

---

### 6.8 — Scope Auto-Activation of Memberships on Sign-In ← A-04

**File:** `src/app/providers/AuthProvider.tsx`  
**Effort:** 1h

**Before:**
```typescript
const { error: activateError } = await unsafeSupabase
  .from("organization_memberships")
  .update({
    account_state: "active",
    is_email_verified: true,
    updated_at: new Date().toISOString(),
  })
  .eq("user_id", data.user.id)
  .eq("account_state", "pending_verification");
```

**After:**
```typescript
// Only activate the FIRST pending membership (deterministic, not blanket)
const { data: pendingMemberships } = await unsafeSupabase
  .from("organization_memberships")
  .select("id, organization_id")
  .eq("user_id", data.user.id)
  .eq("account_state", "pending_verification")
  .limit(1)
  .maybeSingle();

if (pendingMemberships) {
  const { error: activateError } = await unsafeSupabase
    .from("organization_memberships")
    .update({
      account_state: "active",
      is_email_verified: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", pendingMemberships.id); // Activate by PK, not blanket
```

---

### 6.9 — Restrict CORS in Edge Functions ← Q-02

**File:** `supabase/functions/_shared/resend.ts`  
**Effort:** 30m

**Before:**
```typescript
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
```

**After:**
```typescript
const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "https://app.siswitinfra.com";

export const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
```

---

### 6.10 — Add Rate Limiting to Invitation Edge Functions ← E-02

**Files:** `supabase/functions/send-employee-invitation/index.ts`, `supabase/functions/send-client-invitation/index.ts`  
**Effort:** 3h

Add a per-org rate limit check using the `background_jobs` or a dedicated `rate_limits` table.

**After (insert at top of handler, after auth):**
```typescript
// Rate limit: max 50 invitations per org per hour
const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
const { count } = await adminClient
  .from("employee_invitations")
  .select("id", { count: "exact", head: true })
  .eq("organization_id", payload.organizationId)
  .gte("created_at", oneHourAgo);

if ((count ?? 0) >= 50) {
  return jsonResponse(429, { error: "Too many invitations sent. Please try again later." });
}
```

---

**Phase 6 Total Effort: ~20h (2.5 developer-days)**

---

## Phase 7 — Architecture Consolidation (Next 2 Sprints)

> Priority: Eliminate technical debt from the org/tenant duality and unify scoping patterns.  
> Target: 8 items.

---

### 7.1 — Unify `organization_id` / `tenant_id` Naming ← T-01

**Files:** DB migration, `module-scope.ts`, `jobs.ts`, all hooks  
**Effort:** 2d

**Strategy:**
1. Create a new migration that adds `organization_id` as a column alias or renames `tenant_id` → `organization_id` on tables that only have `tenant_id`.
2. Update `buildModuleCreatePayload` to inject only `organization_id` (remove `tenant_id` injection).
3. Update `applyModuleReadScope` — it already uses `organization_id`, so this is a verification pass.
4. Update `jobs.ts` to use `organization_id` instead of `tenant_id`.

**Before (`buildModuleCreatePayload` in `module-scope.ts`):**
```typescript
return {
  ...payload,
  organization_id: scope.organizationId,
  tenant_id: scope.organizationId, // ← legacy alias
  [ownerCol]: scope.userId,
};
```

**After:**
```typescript
return {
  ...payload,
  organization_id: scope.organizationId,
  // tenant_id removed — DB migration handles backward compat
  [ownerCol]: scope.userId,
};
```

**Migration script:**
```sql
-- Add organization_id to tables that only have tenant_id
ALTER TABLE public.some_table
  ADD COLUMN IF NOT EXISTS organization_id uuid
  REFERENCES public.organizations(id);

-- Backfill from tenant_id
UPDATE public.some_table SET organization_id = tenant_id WHERE organization_id IS NULL;
```

---

### 7.2 — Deprecate `TenantProvider`, Merge Into `OrganizationProvider` ← T-02

**Files:** `src/app/providers/TenantProvider.tsx`, `src/app/providers/OrganizationProvider.tsx`, `src/core/tenant/tenant-context.ts`  
**Effort:** 1.5d

**Strategy:**
1. Audit all imports of `useTenant` / `TenantContext` — replace with `useOrganization`.
2. Add any missing fields from `TenantContext` into `OrganizationContext` (e.g., `is_approved`).
3. Remove `TenantProvider` from the provider tree in `App.tsx`.
4. Mark `TenantProvider` and `tenant-context.ts` as `@deprecated` with a removal date.

**Before (provider tree):**
```tsx
<AuthProvider>
  <ImpersonationProvider>
    <OrganizationProvider>
      <TenantProvider>  {/* ← Remove this */}
        {children}
      </TenantProvider>
    </OrganizationProvider>
  </ImpersonationProvider>
</AuthProvider>
```

**After:**
```tsx
<AuthProvider>
  <ImpersonationProvider>
    <OrganizationProvider>
      {children}
    </OrganizationProvider>
  </ImpersonationProvider>
</AuthProvider>
```

---

### 7.3 — Migrate Documents Module to Unified Scoping ← M-03

**File:** `src/modules/documents/hooks/useDocuments.ts`  
**Effort:** 1d

Replace `applyTenantOwnershipScope` / `withOwnershipCreate` with `applyModuleReadScope` / `applyModuleMutationScope` / `buildModuleCreatePayload` to align with CRM, CPQ, CLM, and ERP modules.

**Before (`useAutoDocuments`):**
```typescript
let query = supabase.from("auto_documents").select("*").is("deleted_at", null);
query = applyTenantOwnershipScope(query, {
  organizationId: organization?.id,
  isPlatformAdmin: isPlatformRole(role),
});
if (!isPlatformRole(role)) {
  query = query.or(`owner_id.eq.${user.id},created_by.eq.${user.id}`);
}
```

**After:**
```typescript
function useDocScope() {
  const { user, role } = useAuth();
  const { organization, organizationLoading } = useOrganization();

  const scope: ModuleScopeContext = {
    organizationId: organization?.id ?? null,
    userId: user?.id ?? null,
    role,
  };

  return {
    scope,
    organizationId: scope.organizationId,
    userId: scope.userId,
    enabled: isModuleScopeReady(scope, organizationLoading),
  };
}

// In useAutoDocuments:
const { scope, enabled } = useDocScope();

const scopedQuery = applyModuleReadScope(
  supabase.from("auto_documents").select("*").is("deleted_at", null),
  scope,
  { ownerColumns: ["owner_id", "created_by"] },
);
```

---

### 7.4 — Fix Import Paths in `usePermissions` ← TS-01

**File:** `src/core/rbac/usePermissions.ts`  
**Effort:** 15m

**Before:**
```typescript
import { useAuth } from "./useAuth";
import { useOrganization } from "./useOrganization";
```

**After:**
```typescript
import { useAuth } from "@/core/auth/useAuth";
import { useOrganization } from "@/workspaces/organization/hooks/useOrganization";
```

---

### 7.5 — Resolve `quote_items` vs `quote_line_items` Table Name ← TS-04

**Files:** `015_hardened_rls_policies.sql` or `useCPQ.ts` / `useCRM.ts`  
**Effort:** 2h

**Investigation step:** Run against the database:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('quote_items', 'quote_line_items');
```

**If the table is `quote_items`:** Update the RLS migration to create policies for `quote_items` instead of `quote_line_items`.

**If the table is `quote_line_items`:** Update the frontend hooks to use `supabase.from("quote_line_items")` and update the `Database` types accordingly.

---

### 7.6 — Add Org Filter to Realtime Subscriptions ← T-03

**File:** `src/modules/documents/hooks/useDocuments.ts`  
**Effort:** 2h

**Before:**
```typescript
const channel = supabase
  .channel(`documents-realtime-${userId}-${scope}`)
  .on("postgres_changes", { event: "*", schema: "public", table: "auto_documents" }, () => {
    queryClient.invalidateQueries({ queryKey: ["auto_documents"] });
  })
  .subscribe();
```

**After:**
```typescript
function useDocumentsRealtime(userId?: string, organizationId?: string, scope = "global") {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId || !organizationId) return;

    const channel = supabase
      .channel(`documents-realtime-${organizationId}-${scope}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "auto_documents",
          filter: `organization_id=eq.${organizationId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["auto_documents"] });
          queryClient.invalidateQueries({ queryKey: ["auto_document"] });
        },
      )
      // ... repeat for other tables with same filter
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient, scope, userId, organizationId]);
}
```

---

### 7.7 — Add Existing-User Check to Invitation Edge Functions ← E-01

**Files:** `supabase/functions/send-employee-invitation/index.ts`, `supabase/functions/send-client-invitation/index.ts`  
**Effort:** 2h

**After (insert before `inviteUserByEmail`):**
```typescript
// Check if user already exists
const { data: existingUser } = await adminClient.auth.admin.listUsers();
const alreadyExists = existingUser?.users?.some(
  (u) => u.email?.toLowerCase() === payload.recipientEmail.trim().toLowerCase(),
);

if (alreadyExists) {
  // User exists — send a custom notification email instead of re-inviting
  // This avoids Supabase's "User already registered" error
  return jsonResponse(200, {
    ok: true,
    provider: "existing_user_notification",
    message: "User already has an account. They can sign in and accept the invitation.",
  });
}
```

---

### 7.8 — Add `organization_id` to CLM E-Signature Inserts ← M-06

**File:** `src/modules/clm/hooks/useCLM.ts`  
**Effort:** 30m

**Before:**
```typescript
const payload = {
  contract_id: contractId,
  signer_email: sig.recipient_email || "",
  signer_name: sig.recipient_name || "",
  status: sig.status || "pending",
  sent_at: new Date().toISOString(),
};
```

**After:**
```typescript
const { organizationId: requiredOrganizationId } = requireOrganizationScope(scope);

const payload = {
  contract_id: contractId,
  organization_id: requiredOrganizationId,
  signer_email: sig.recipient_email || "",
  signer_name: sig.recipient_name || "",
  status: sig.status || "pending",
  sent_at: new Date().toISOString(),
};
```

---

**Phase 7 Total Effort: ~5.5 developer-days**

---

## Phase 8 — Module Polish & Data Integrity (Sprint +3)

> Priority: Fix data mapping bugs, unify audit logging, harden child-entity queries.  
> Target: 10 items.

---

### 8.1 — Fix CRM `mapAccount` Field Mappings ← M-01

**File:** `src/modules/crm/hooks/useCRM.ts`  
**Effort:** 30m

**Before:**
```typescript
function mapAccount(row: AccountRow): Account {
  return {
    // ...
    email: row.domain ?? undefined,          // WRONG: domain isn't email
    description: row.ownership ?? undefined,  // WRONG: ownership isn't description
```

**After:**
```typescript
function mapAccount(row: AccountRow): Account {
  return {
    // ...
    email: row.email ?? undefined,            // Map from actual email column
    domain: row.domain ?? undefined,          // Preserve domain separately
    description: row.description ?? undefined, // Map from actual description column
    ownership: row.ownership ?? undefined,     // Preserve ownership separately
```

> **Note:** This requires checking whether the `Account` type in `src/core/types/crm.ts` has `domain` and `ownership` fields. If not, add them. If the DB `accounts` table lacks an `email` column and `domain` was intentionally used as email, add a code comment explaining the mapping rationale.

---

### 8.2 — Fix CRM `created_by` Mapping ← M-02

**File:** `src/modules/crm/hooks/useCRM.ts`  
**Effort:** 30m

**Before (in `mapLead`, `mapAccount`, `mapContact`, `mapOpportunity`, `mapActivity`):**
```typescript
created_by: row.owner_id ?? undefined,
```

**After:**
```typescript
created_by: (row as Record<string, unknown>).created_by as string | undefined ?? row.owner_id ?? undefined,
```

Or better, if the DB types include `created_by`:
```typescript
created_by: row.created_by ?? row.owner_id ?? undefined,
```

---

### 8.3 — Fix `mapOpportunity.description` Mapping ← D-03

**File:** `src/modules/crm/hooks/useCRM.ts`  
**Effort:** 15m

**Before:**
```typescript
description: row.next_step ?? undefined,
next_step: row.next_step ?? undefined,
```

**After:**
```typescript
description: row.description ?? undefined,
next_step: row.next_step ?? undefined,
```

---

### 8.4 — Fix ERP `mapFinancialRecord.reference_type` Mapping ← M-04

**File:** `src/modules/erp/hooks/useERP.ts`  
**Effort:** 15m

**Before:**
```typescript
reference_type: row.status ?? undefined,
```

**After:**
```typescript
reference_type: row.reference_type ?? undefined,
```

> Check the DB schema for the actual column name. If `financial_records` doesn't have `reference_type`, map from the correct column or remove this property.

---

### 8.5 — Fix ERP `useCreatePurchaseOrder` `payment_terms` Mapping ← D-04

**File:** `src/modules/erp/hooks/useERP.ts`  
**Effort:** 15m

**Before:**
```typescript
payment_terms: po.notes ?? null,
notes: po.notes ?? null,
```

**After:**
```typescript
payment_terms: po.payment_terms ?? null,
notes: po.notes ?? null,
```

---

### 8.6 — Unify `writeAuditLog` Parameter Names ← D-01

**File:** `src/core/utils/audit.ts` and all callers  
**Effort:** 3h

**Step 1 — Normalize the function signature:**

**Before:**
```typescript
export async function writeAuditLog(params: {
  action: string;
  entityType: string;
  entityId: string;
  tenantId?: string | null;      // Used by CRM/CPQ/CLM/ERP
  organizationId?: string | null; // Used by Documents
  userId?: string | null;
  // ...
```

**After:**
```typescript
export async function writeAuditLog(params: {
  action: string;
  entityType: string;
  entityId: string;
  organizationId: string | null; // SINGLE canonical name
  userId: string | null;
  // ...
```

**Step 2 — Update all callers:**

```diff
 void writeAuditLog({
   action: "lead_create",
   entityType: "lead",
   entityId: data.id,
-  tenantId,
+  organizationId: scope.organizationId,
   userId,
   newValues: data,
 });
```

---

### 8.7 — Align CPQ `useProducts` With Module Scope Pattern ← M-05

**File:** `src/modules/cpq/hooks/useCPQ.ts`  
**Effort:** 30m

**Before:**
```typescript
export function useProducts() {
  const { scope, enabled, tenantId } = useCpqScope();

  return useQuery({
    queryKey: ["products", tenantId],
    enabled,
    queryFn: async () => {
      const { organizationId: requiredOrganizationId } = requireOrganizationScope(scope);
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("organization_id", requiredOrganizationId)
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("name");
```

**After:**
```typescript
export function useProducts() {
  const { scope, enabled, tenantId, userId } = useCpqScope();

  return useQuery({
    queryKey: ["products", tenantId, userId],
    enabled,
    queryFn: async () => {
      const scopedQuery = applyModuleReadScope(
        supabase
          .from("products")
          .select("*")
          .eq("is_active", true)
          .is("deleted_at", null),
        scope,
        { ownerColumns: [] },
      );

      const { data, error } = await scopedQuery.order("name");
```

---

### 8.8 — Add Org Scoping to ERP Child Queries ← T-04

**File:** `src/modules/erp/hooks/useERP.ts`  
**Effort:** 1h

**Before (inside `usePurchaseOrder`):**
```typescript
const { data: items, error: itemsError } = await supabase
  .from("purchase_order_items")
  .select("*")
  .eq("purchase_order_id", id)
  .is("deleted_at", null)
  .order("created_at");
```

**After:**
```typescript
// The parent PO is already scoped. Scope child items identically.
const { organizationId: requiredOrganizationId } = requireOrganizationScope(scope);
const { data: items, error: itemsError } = await supabase
  .from("purchase_order_items")
  .select("*")
  .eq("purchase_order_id", id)
  .eq("organization_id", requiredOrganizationId)
  .is("deleted_at", null)
  .order("created_at");
```

> If `purchase_order_items` doesn't have `organization_id`, rely on the parent join (which RLS already handles). In that case, add a code comment explaining the delegation.

---

### 8.9 — Simplify `claimPendingInvitations` Return Parsing ← D-02

**File:** `src/app/providers/AuthProvider.tsx`  
**Effort:** 15m

**Before:**
```typescript
const parsed =
  typeof data === "number"
    ? data
    : typeof data === "string"
      ? Number(data)
      : Array.isArray(data) && data.length > 0
        ? Number(data[0])
        : 0;

return Number.isFinite(parsed) ? parsed : 0;
```

**After:**
```typescript
if (typeof data !== "number") {
  console.warn("[claimPendingInvitations] Unexpected return type:", typeof data, data);
  return 0;
}
return data;
```

---

### 8.10 — Add Role Cache TTL ← A-03

**File:** `src/app/providers/AuthProvider.tsx`  
**Effort:** 1h

**Before:**
```typescript
function cacheRole(userId: string, role: AuthRole) {
  sessionStorage.setItem(`${ROLE_CACHE_KEY_PREFIX}${userId}`, role ?? "");
}

function getCachedRole(userId: string): AuthRole | null {
  const cached = sessionStorage.getItem(`${ROLE_CACHE_KEY_PREFIX}${userId}`);
  return cached || null;
}
```

**After:**
```typescript
const ROLE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CachedRole {
  role: string;
  cachedAt: number;
}

function cacheRole(userId: string, role: AuthRole) {
  const entry: CachedRole = { role: role ?? "", cachedAt: Date.now() };
  sessionStorage.setItem(`${ROLE_CACHE_KEY_PREFIX}${userId}`, JSON.stringify(entry));
}

function getCachedRole(userId: string): AuthRole | null {
  const raw = sessionStorage.getItem(`${ROLE_CACHE_KEY_PREFIX}${userId}`);
  if (!raw) return null;

  try {
    const entry = JSON.parse(raw) as CachedRole;
    if (Date.now() - entry.cachedAt > ROLE_CACHE_TTL_MS) {
      sessionStorage.removeItem(`${ROLE_CACHE_KEY_PREFIX}${userId}`);
      return null; // Expired
    }
    return entry.role || null;
  } catch {
    return null;
  }
}
```

---

**Phase 8 Total Effort: ~1.5 developer-days**

---

## Phase 9 — Developer Experience & Performance (Sprint +4)

> Priority: Eliminate code duplication, improve type safety, optimize performance.  
> Target: 7 items.

---

### 9.1 — Replace `as unknown as` Casts With Typed Supabase Client ← TS-02, A-05, Q-01

**Files:** `OrganizationProvider.tsx`, `ImpersonationProvider.tsx`, `AuthProvider.tsx`, `audit.ts`  
**Effort:** 1d

**Strategy:** Create a single `unsafeClient` helper that provides a loosely-typed Supabase client for tables/operations not yet in the generated types.

**New file: `src/core/api/unsafe-client.ts`**
```typescript
import { supabase } from "@/core/api/client";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * A loosely-typed Supabase client for tables or columns not yet
 * represented in the auto-generated Database types.
 *
 * ⚠️  Prefer the typed `supabase` client whenever possible.
 * Every usage of this client should have a TODO to migrate
 * once the Database types are regenerated.
 */
export const unsafeSupabase = supabase as unknown as SupabaseClient;
```

Then replace all inline `as unknown as` casts:

```diff
-const unsafeSupabase = supabase as unknown as SupabaseClient;
+import { unsafeSupabase } from "@/core/api/unsafe-client";
```

---

### 9.2 — Extract Shared `getErrorMessage` Utility ← Q-04

**Files:** All 5 module hooks  
**Effort:** 1h

**New file: `src/core/utils/errors.ts`**
```typescript
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
```

**In each module hook, replace:**
```diff
-function getErrorMessage(error: unknown): string {
-  if (error instanceof Error) return error.message;
-  return String(error);
-}
+import { getErrorMessage } from "@/core/utils/errors";
```

---

### 9.3 — Deduplicate `isModuleEnabled` ← TS-03

**Files:** `src/core/types/organization.ts`, `src/core/types/tenant.ts`  
**Effort:** 30m

**New file: `src/core/utils/modules.ts`**
```typescript
import type { ModuleType } from "@/core/types/modules";

interface SubscriptionWithModules {
  module_crm?: boolean;
  module_clm?: boolean;
  module_cpq?: boolean;
  module_erp?: boolean;
  module_documents?: boolean;
}

export function isModuleEnabled(
  subscription: SubscriptionWithModules | null | undefined,
  module: ModuleType,
): boolean {
  if (!subscription) return false;
  const key = `module_${module}` as keyof SubscriptionWithModules;
  return Boolean(subscription[key]);
}
```

Then update imports in `organization.ts`, `tenant.ts`, `OrganizationProvider.tsx`, `TenantProvider.tsx`:
```diff
-import { isModuleEnabled } from "@/core/types/organization";
+import { isModuleEnabled } from "@/core/utils/modules";
```

---

### 9.4 — Remove `"use client"` Directives ← Q-03

**Files:** `OrganizationProvider.tsx`, `TenantProvider.tsx`  
**Effort:** 5m

```diff
-"use client";
-
 import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
```

---

### 9.5 — Optimize RLS Super-Admin Check ← P-01

**File:** New migration `016_optimize_rls_admin_check.sql`  
**Effort:** 2h

Create a session-level cache using `current_setting`:

```sql
-- Set the admin flag once per transaction using a trigger or connection init
CREATE OR REPLACE FUNCTION public.app_is_platform_super_admin_cached(p_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    nullif(current_setting('app.is_super_admin', true), '')::boolean,
    public.app_is_platform_super_admin(p_uid)
  );
$$;

-- In application connection initialization:
-- SELECT set_config('app.is_super_admin',
--   (SELECT EXISTS(SELECT 1 FROM platform_super_admins WHERE user_id = auth.uid()))::text,
--   true);
```

> **Note:** This is an optimization, not a correctness fix. Only pursue if query performance analysis shows RLS as a bottleneck.

---

### 9.6 — Consolidate Realtime Channels ← P-02

**File:** `src/modules/documents/hooks/useDocuments.ts`  
**Effort:** 2h

Replace per-hook `useDocumentsRealtime` calls with a single shared provider.

**New file: `src/modules/documents/providers/DocumentsRealtimeProvider.tsx`**
```typescript
import { createContext, useContext, useEffect, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/core/api/client";
import { useAuth } from "@/core/auth/useAuth";
import { useOrganization } from "@/workspaces/organization/hooks/useOrganization";

export function DocumentsRealtimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { organization } = useOrganization();

  useEffect(() => {
    if (!user?.id || !organization?.id) return;

    const channel = supabase
      .channel(`docs-${organization.id}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "auto_documents",
        filter: `organization_id=eq.${organization.id}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["auto_documents"] });
        queryClient.invalidateQueries({ queryKey: ["auto_document"] });
      })
      .on("postgres_changes", {
        event: "*", schema: "public", table: "document_templates",
        filter: `organization_id=eq.${organization.id}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["document_templates"] });
      })
      .on("postgres_changes", {
        event: "*", schema: "public", table: "document_esignatures",
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["document_esignatures"] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient, user?.id, organization?.id]);

  return <>{children}</>;
}
```

Then remove all `useDocumentsRealtime()` calls from individual hooks.

---

### 9.7 — Use Scoped Query Key Invalidation ← P-03

**Files:** All module hooks  
**Effort:** 3h

**Before:**
```typescript
queryClient.invalidateQueries({ queryKey: ["contracts"] });
queryClient.invalidateQueries({ queryKey: ["contract"] });
```

**After:**
```typescript
queryClient.invalidateQueries({ queryKey: ["contracts", tenantId] });
queryClient.invalidateQueries({ queryKey: ["contract", variables.id, tenantId] });
```

This ensures only queries for the current tenant context are invalidated, not queries from other org contexts that might exist in the React Query cache.

---

**Phase 9 Total Effort: ~2.5 developer-days**

---

## Summary

| Phase | Focus | Items | Effort |
|-------|-------|-------|--------|
| **Phase 6** | Security Hardening | 10 | 2.5d |
| **Phase 7** | Architecture Consolidation | 8 | 5.5d |
| **Phase 8** | Module Polish & Data Integrity | 10 | 1.5d |
| **Phase 9** | DX & Performance | 7 | 2.5d |
| **Total** | | **35** | **12d** |

---

## Finding → Improvement Cross-Reference

| Finding | Improvement | Phase |
|---------|-------------|-------|
| C-01 | 6.1 | 6 |
| C-02 | 6.2 | 6 |
| C-03 | 6.2 | 6 |
| C-04 | 6.3 | 6 |
| C-05 | 6.4 | 6 |
| C-06 | 6.5 | 6 |
| C-07 | 6.5 | 6 |
| T-01 | 7.1 | 7 |
| T-02 | 7.2 | 7 |
| T-03 | 7.6 | 7 |
| T-04 | 8.8 | 8 |
| A-01 | 6.6 | 6 |
| A-02 | 6.7 | 6 |
| A-03 | 8.10 | 8 |
| A-04 | 6.8 | 6 |
| A-05 | 9.1 | 9 |
| M-01 | 8.1 | 8 |
| M-02 | 8.2 | 8 |
| M-03 | 7.3 | 7 |
| M-04 | 8.4 | 8 |
| M-05 | 8.7 | 8 |
| M-06 | 7.8 | 7 |
| TS-01 | 7.4 | 7 |
| TS-02 | 9.1 | 9 |
| TS-03 | 9.3 | 9 |
| TS-04 | 7.5 | 7 |
| D-01 | 8.6 | 8 |
| D-02 | 8.9 | 8 |
| D-03 | 8.3 | 8 |
| D-04 | 8.5 | 8 |
| P-01 | 9.5 | 9 |
| P-02 | 9.6 | 9 |
| P-03 | 9.7 | 9 |
| Q-01 | 9.1 | 9 |
| Q-02 | 6.9 | 6 |
| Q-03 | 9.4 | 9 |
| Q-04 | 9.2 | 9 |
| E-01 | 7.7 | 7 |
| E-02 | 6.10 | 6 |

---

*End of Improvement Plan*
