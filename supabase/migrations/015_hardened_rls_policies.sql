-- =============================================================================
-- 015 HARDENED RLS POLICIES
-- =============================================================================
-- Clean-slate policy rebuild: drops every existing RLS policy on public tables
-- then re-creates per-operation policies following least-privilege principles.
--
-- Principles:
--   1. Every table gets explicit SELECT / INSERT / UPDATE / DELETE policies
--   2. No FOR ALL on business data
--   3. Role-based write control (owner/admin > manager > employee/client)
--   4. platform_super_admin is god mode everywhere
--   5. anon can only reach specific SECURITY DEFINER RPCs

SET search_path = public, extensions;

-- =============================================================================
-- 0. TIGHTEN TABLE-LEVEL GRANTS  (fixes 010_restore_public_grants)
-- =============================================================================
-- Revoke the dangerous blanket grant to anon.
-- Keep authenticated + service_role grants; RLS is the real control.

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;

-- anon still needs USAGE on schema + EXECUTE on specific RPCs (already granted).
GRANT USAGE ON SCHEMA public TO anon;

-- Ensure authenticated / service_role keep their access.
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
GRANT ALL ON TABLES TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
GRANT ALL ON SEQUENCES TO authenticated, service_role;

-- =============================================================================
-- 1. DROP ALL EXISTING POLICIES (clean slate)
-- =============================================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
                   r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- =============================================================================
-- 2. ENSURE RLS IS ENABLED ON EVERY TABLE
-- =============================================================================

DO $$
DECLARE
  t text;
  all_tables text[] := ARRAY[
    'profiles', 'platform_super_admins',
    'organizations', 'organization_subscriptions',
    'employee_roles', 'organization_memberships',
    'employee_invitations', 'client_invitations',
    'audit_logs', 'impersonation_sessions', 'background_jobs',
    -- Business data (with organization_id)
    'accounts', 'contacts', 'leads', 'opportunities', 'activities',
    'products', 'quotes', 'contract_templates', 'contracts',
    'suppliers', 'inventory_items', 'inventory_transactions',
    'purchase_orders', 'production_orders', 'financial_records',
    'document_templates', 'auto_documents',
    -- Child tables (no direct organization_id)
    'quote_line_items', 'contract_versions', 'contract_esignatures',
    'contract_scans', 'purchase_order_items', 'production_order_items',
    'document_versions', 'document_signatures', 'document_permissions',
    'document_esignatures'
  ];
BEGIN
  FOREACH t IN ARRAY all_tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      -- NOTE: We intentionally do NOT use FORCE ROW LEVEL SECURITY here.
      -- FORCE would make even the postgres superuser subject to RLS, which
      -- breaks SECURITY DEFINER RPCs (create_signup_organization, etc.)
      -- that need to bypass RLS for pre-confirmation signup flows.
    END IF;
  END LOOP;
END $$;

-- =============================================================================
-- 3. CORE AUTH / ORG TABLE POLICIES
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 3a. profiles
-- ---------------------------------------------------------------------------

CREATE POLICY profiles_select ON public.profiles
FOR SELECT USING (
  auth.uid() = user_id
  OR public.app_is_platform_super_admin(auth.uid())
);

CREATE POLICY profiles_insert ON public.profiles
FOR INSERT WITH CHECK (
  auth.uid() = user_id
  OR public.app_is_platform_super_admin(auth.uid())
);

CREATE POLICY profiles_update ON public.profiles
FOR UPDATE USING (
  auth.uid() = user_id
  OR public.app_is_platform_super_admin(auth.uid())
) WITH CHECK (
  auth.uid() = user_id
  OR public.app_is_platform_super_admin(auth.uid())
);

CREATE POLICY profiles_delete ON public.profiles
FOR DELETE USING (
  auth.uid() = user_id
  OR public.app_is_platform_super_admin(auth.uid())
);

-- ---------------------------------------------------------------------------
-- 3b. platform_super_admins  (super-admin-only CRUD)
-- ---------------------------------------------------------------------------

CREATE POLICY psa_select ON public.platform_super_admins
FOR SELECT USING (public.app_is_platform_super_admin(auth.uid()));

CREATE POLICY psa_insert ON public.platform_super_admins
FOR INSERT WITH CHECK (public.app_is_platform_super_admin(auth.uid()));

CREATE POLICY psa_update ON public.platform_super_admins
FOR UPDATE
USING (public.app_is_platform_super_admin(auth.uid()))
WITH CHECK (public.app_is_platform_super_admin(auth.uid()));

CREATE POLICY psa_delete ON public.platform_super_admins
FOR DELETE USING (public.app_is_platform_super_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- 3c. organizations
-- ---------------------------------------------------------------------------

-- SELECT: owner, members with access, or super admin
CREATE POLICY organizations_select ON public.organizations
FOR SELECT USING (
  public.app_is_platform_super_admin(auth.uid())
  OR owner_user_id = auth.uid()
  OR public.app_user_has_organization_access(id)
);

-- INSERT: authenticated user creating an org they own, or super admin
CREATE POLICY organizations_insert ON public.organizations
FOR INSERT WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR (
    auth.role() = 'authenticated'
    AND owner_user_id = auth.uid()
  )
);

-- UPDATE: owner or admin members, or super admin
CREATE POLICY organizations_update ON public.organizations
FOR UPDATE USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.organization_memberships om
    WHERE om.organization_id = organizations.id
      AND om.user_id = auth.uid()
      AND om.is_active = true
      AND om.account_state IN ('active', 'pending_verification')
      AND om.role IN ('owner', 'admin')
  )
) WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.organization_memberships om
    WHERE om.organization_id = organizations.id
      AND om.user_id = auth.uid()
      AND om.is_active = true
      AND om.account_state IN ('active', 'pending_verification')
      AND om.role IN ('owner', 'admin')
  )
);

-- DELETE: super admin only
CREATE POLICY organizations_delete ON public.organizations
FOR DELETE USING (
  public.app_is_platform_super_admin(auth.uid())
);

-- ---------------------------------------------------------------------------
-- 3d. organization_subscriptions
-- ---------------------------------------------------------------------------

CREATE POLICY org_subs_select ON public.organization_subscriptions
FOR SELECT USING (
  public.app_is_platform_super_admin(auth.uid())
  OR public.app_user_has_organization_access(organization_id)
);

-- INSERT: org owner or super admin
CREATE POLICY org_subs_insert ON public.organization_subscriptions
FOR INSERT WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = organization_subscriptions.organization_id
      AND o.owner_user_id = auth.uid()
  )
);

-- UPDATE: owner/admin or super admin
CREATE POLICY org_subs_update ON public.organization_subscriptions
FOR UPDATE USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.organization_memberships om
    WHERE om.organization_id = organization_subscriptions.organization_id
      AND om.user_id = auth.uid()
      AND om.is_active = true
      AND om.account_state IN ('active', 'pending_verification')
      AND om.role IN ('owner', 'admin')
  )
) WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.organization_memberships om
    WHERE om.organization_id = organization_subscriptions.organization_id
      AND om.user_id = auth.uid()
      AND om.is_active = true
      AND om.account_state IN ('active', 'pending_verification')
      AND om.role IN ('owner', 'admin')
  )
);

-- DELETE: super admin only
CREATE POLICY org_subs_delete ON public.organization_subscriptions
FOR DELETE USING (
  public.app_is_platform_super_admin(auth.uid())
);

-- ---------------------------------------------------------------------------
-- 3e. employee_roles
-- ---------------------------------------------------------------------------

CREATE POLICY employee_roles_select ON public.employee_roles
FOR SELECT USING (
  public.app_is_platform_super_admin(auth.uid())
  OR public.app_user_has_organization_access(organization_id)
);

CREATE POLICY employee_roles_insert ON public.employee_roles
FOR INSERT WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.organization_memberships om
    WHERE om.organization_id = employee_roles.organization_id
      AND om.user_id = auth.uid()
      AND om.is_active = true
      AND om.account_state IN ('active', 'pending_verification')
      AND om.role IN ('owner', 'admin')
  )
);

CREATE POLICY employee_roles_update ON public.employee_roles
FOR UPDATE USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.organization_memberships om
    WHERE om.organization_id = employee_roles.organization_id
      AND om.user_id = auth.uid()
      AND om.is_active = true
      AND om.account_state IN ('active', 'pending_verification')
      AND om.role IN ('owner', 'admin')
  )
) WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.organization_memberships om
    WHERE om.organization_id = employee_roles.organization_id
      AND om.user_id = auth.uid()
      AND om.is_active = true
      AND om.account_state IN ('active', 'pending_verification')
      AND om.role IN ('owner', 'admin')
  )
);

CREATE POLICY employee_roles_delete ON public.employee_roles
FOR DELETE USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.organization_memberships om
    WHERE om.organization_id = employee_roles.organization_id
      AND om.user_id = auth.uid()
      AND om.is_active = true
      AND om.account_state IN ('active', 'pending_verification')
      AND om.role IN ('owner', 'admin')
  )
);

-- ---------------------------------------------------------------------------
-- 3f. organization_memberships
-- ---------------------------------------------------------------------------

-- SELECT: own row, org members, or super admin
CREATE POLICY memberships_select ON public.organization_memberships
FOR SELECT USING (
  auth.uid() = user_id
  OR public.app_is_platform_super_admin(auth.uid())
  OR public.app_user_has_organization_access(organization_id)
);

-- INSERT: preserves all the signup-path logic from 009
CREATE POLICY memberships_insert ON public.organization_memberships
FOR INSERT WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR (
    user_id = auth.uid()
    AND lower(email) = lower(coalesce(auth.jwt() ->> 'email', email))
    AND (
      -- Owner creating their own membership during org signup
      (
        role = 'owner'
        AND account_state = 'pending_verification'
        AND is_active = true
        AND EXISTS (
          SELECT 1 FROM public.organizations o
          WHERE o.id = organization_memberships.organization_id
            AND o.owner_user_id = auth.uid()
        )
      )
      -- Client self-signup to an active org
      OR (
        role = 'client'
        AND account_state = 'pending_approval'
        AND is_active = true
        AND EXISTS (
          SELECT 1 FROM public.organizations o
          WHERE o.id = organization_memberships.organization_id
            AND o.status IN ('active', 'trial')
        )
      )
      -- Employee accepting an invitation
      OR (
        role IN ('admin', 'manager', 'employee')
        AND account_state = 'pending_verification'
        AND is_active = true
        AND EXISTS (
          SELECT 1 FROM public.employee_invitations ei
          WHERE ei.organization_id = organization_memberships.organization_id
            AND lower(ei.invited_email) = lower(organization_memberships.email)
            AND ei.role = organization_memberships.role
            AND ei.status = 'pending'
            AND ei.expires_at > NOW()
        )
      )
      -- Client accepting an invitation
      OR (
        role = 'client'
        AND account_state = 'pending_verification'
        AND is_active = true
        AND EXISTS (
          SELECT 1 FROM public.client_invitations ci
          WHERE ci.organization_id = organization_memberships.organization_id
            AND lower(ci.invited_email) = lower(organization_memberships.email)
            AND ci.status = 'pending'
            AND ci.expires_at > NOW()
        )
      )
    )
  )
);

-- UPDATE: owner/admin of the org, or super admin
CREATE POLICY memberships_update ON public.organization_memberships
FOR UPDATE USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.organization_memberships om
    WHERE om.organization_id = organization_memberships.organization_id
      AND om.user_id = auth.uid()
      AND om.is_active = true
      AND om.account_state IN ('active', 'pending_verification')
      AND om.role IN ('owner', 'admin')
  )
) WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.organization_memberships om
    WHERE om.organization_id = organization_memberships.organization_id
      AND om.user_id = auth.uid()
      AND om.is_active = true
      AND om.account_state IN ('active', 'pending_verification')
      AND om.role IN ('owner', 'admin')
  )
);

-- DELETE: owner/admin of the org, or super admin
CREATE POLICY memberships_delete ON public.organization_memberships
FOR DELETE USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.organization_memberships om
    WHERE om.organization_id = organization_memberships.organization_id
      AND om.user_id = auth.uid()
      AND om.is_active = true
      AND om.account_state IN ('active', 'pending_verification')
      AND om.role IN ('owner', 'admin')
  )
);

-- ---------------------------------------------------------------------------
-- 3g. employee_invitations
-- ---------------------------------------------------------------------------

CREATE POLICY emp_invites_select ON public.employee_invitations
FOR SELECT USING (
  public.app_is_platform_super_admin(auth.uid())
  OR public.app_user_has_organization_access(organization_id)
);

CREATE POLICY emp_invites_insert ON public.employee_invitations
FOR INSERT WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.organization_memberships om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = employee_invitations.organization_id
      AND om.is_active = true
      AND om.account_state IN ('active', 'pending_verification')
      AND om.role IN ('owner', 'admin')
  )
);

CREATE POLICY emp_invites_update ON public.employee_invitations
FOR UPDATE USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.organization_memberships om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = employee_invitations.organization_id
      AND om.is_active = true
      AND om.account_state IN ('active', 'pending_verification')
      AND om.role IN ('owner', 'admin')
  )
) WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.organization_memberships om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = employee_invitations.organization_id
      AND om.is_active = true
      AND om.account_state IN ('active', 'pending_verification')
      AND om.role IN ('owner', 'admin')
  )
);

CREATE POLICY emp_invites_delete ON public.employee_invitations
FOR DELETE USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.organization_memberships om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = employee_invitations.organization_id
      AND om.is_active = true
      AND om.account_state IN ('active', 'pending_verification')
      AND om.role IN ('owner', 'admin')
  )
);

-- ---------------------------------------------------------------------------
-- 3h. client_invitations
-- ---------------------------------------------------------------------------

CREATE POLICY client_invites_select ON public.client_invitations
FOR SELECT USING (
  public.app_is_platform_super_admin(auth.uid())
  OR public.app_user_has_organization_access(organization_id)
);

CREATE POLICY client_invites_insert ON public.client_invitations
FOR INSERT WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.organization_memberships om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = client_invitations.organization_id
      AND om.is_active = true
      AND om.account_state IN ('active', 'pending_verification')
      AND om.role IN ('owner', 'admin')
  )
);

CREATE POLICY client_invites_update ON public.client_invitations
FOR UPDATE USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.organization_memberships om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = client_invitations.organization_id
      AND om.is_active = true
      AND om.account_state IN ('active', 'pending_verification')
      AND om.role IN ('owner', 'admin')
  )
) WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.organization_memberships om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = client_invitations.organization_id
      AND om.is_active = true
      AND om.account_state IN ('active', 'pending_verification')
      AND om.role IN ('owner', 'admin')
  )
);

CREATE POLICY client_invites_delete ON public.client_invitations
FOR DELETE USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.organization_memberships om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = client_invitations.organization_id
      AND om.is_active = true
      AND om.account_state IN ('active', 'pending_verification')
      AND om.role IN ('owner', 'admin')
  )
);

-- ---------------------------------------------------------------------------
-- 3i. audit_logs  (append-only for users, full access for super admin)
-- ---------------------------------------------------------------------------

CREATE POLICY audit_logs_select ON public.audit_logs
FOR SELECT USING (
  public.app_is_platform_super_admin(auth.uid())
  OR (organization_id IS NOT NULL AND public.app_user_has_organization_access(organization_id))
);

-- INSERT: authenticated only, must set user_id to self (no spoofing)
CREATE POLICY audit_logs_insert ON public.audit_logs
FOR INSERT WITH CHECK (
  auth.role() = 'authenticated'
  AND (
    user_id = auth.uid()
    OR public.app_is_platform_super_admin(auth.uid())
  )
);

-- No UPDATE policy — audit logs are immutable
-- No DELETE policy — audit logs are immutable
-- (Super admin can still bypass via service_role if absolutely needed)

-- ---------------------------------------------------------------------------
-- 3j. impersonation_sessions  (super-admin-only)
-- ---------------------------------------------------------------------------

CREATE POLICY impersonation_select ON public.impersonation_sessions
FOR SELECT USING (public.app_is_platform_super_admin(auth.uid()));

CREATE POLICY impersonation_insert ON public.impersonation_sessions
FOR INSERT WITH CHECK (public.app_is_platform_super_admin(auth.uid()));

CREATE POLICY impersonation_update ON public.impersonation_sessions
FOR UPDATE
USING (public.app_is_platform_super_admin(auth.uid()))
WITH CHECK (public.app_is_platform_super_admin(auth.uid()));

CREATE POLICY impersonation_delete ON public.impersonation_sessions
FOR DELETE USING (public.app_is_platform_super_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- 3k. background_jobs
-- ---------------------------------------------------------------------------

CREATE POLICY bg_jobs_select ON public.background_jobs
FOR SELECT USING (
  public.app_is_platform_super_admin(auth.uid())
  OR public.app_user_has_organization_access(organization_id)
);

CREATE POLICY bg_jobs_insert ON public.background_jobs
FOR INSERT WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR public.app_user_has_organization_access(organization_id)
);

CREATE POLICY bg_jobs_update ON public.background_jobs
FOR UPDATE USING (
  public.app_is_platform_super_admin(auth.uid())
  OR public.app_user_has_organization_access(organization_id)
) WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR public.app_user_has_organization_access(organization_id)
);

-- DELETE: super admin only
CREATE POLICY bg_jobs_delete ON public.background_jobs
FOR DELETE USING (
  public.app_is_platform_super_admin(auth.uid())
);

-- =============================================================================
-- 4. BUSINESS DATA TABLES  (17 tables with organization_id / tenant_id)
-- =============================================================================
-- Role hierarchy for writes:
--   SELECT  : any active org member
--   INSERT  : owner, admin, manager
--   UPDATE  : owner, admin, manager
--   DELETE  : owner, admin only

-- Helper: reusable org membership check function for write operations
CREATE OR REPLACE FUNCTION public._rls_user_can_write_org(
  p_org_id uuid,
  p_min_roles public.app_role[] DEFAULT ARRAY['owner','admin','manager']::public.app_role[]
)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    public.app_is_platform_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.organization_memberships om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = p_org_id
        AND om.is_active = true
        AND om.account_state IN ('active', 'pending_verification')
        AND om.role = ANY(p_min_roles)
    );
$$;

DO $$
DECLARE
  t text;
  biz_tables text[] := ARRAY[
    'accounts','contacts','leads','opportunities','activities',
    'products','quotes','contract_templates','contracts',
    'suppliers','inventory_items','inventory_transactions',
    'purchase_orders','production_orders','financial_records',
    'document_templates','auto_documents'
  ];
BEGIN
  FOREACH t IN ARRAY biz_tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      CONTINUE;
    END IF;

    -- SELECT: any org member or super admin
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT USING (
        public.app_is_platform_super_admin(auth.uid())
        OR public.app_user_has_organization_access(COALESCE(organization_id, tenant_id))
      )',
      t || '_select', t
    );

    -- INSERT: owner, admin, manager or super admin
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (
        public._rls_user_can_write_org(
          COALESCE(organization_id, tenant_id),
          ARRAY[''owner'',''admin'',''manager'']::public.app_role[]
        )
      )',
      t || '_insert', t
    );

    -- UPDATE: owner, admin, manager or super admin
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE
        USING (
          public._rls_user_can_write_org(
            COALESCE(organization_id, tenant_id),
            ARRAY[''owner'',''admin'',''manager'']::public.app_role[]
          )
        )
        WITH CHECK (
          public._rls_user_can_write_org(
            COALESCE(organization_id, tenant_id),
            ARRAY[''owner'',''admin'',''manager'']::public.app_role[]
          )
        )',
      t || '_update', t
    );

    -- DELETE: owner, admin only (or super admin)
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE USING (
        public._rls_user_can_write_org(
          COALESCE(organization_id, tenant_id),
          ARRAY[''owner'',''admin'']::public.app_role[]
        )
      )',
      t || '_delete', t
    );
  END LOOP;
END $$;

-- =============================================================================
-- 5. CHILD TABLES  (no direct organization_id — join through parent)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 5a. quote_line_items  (via quotes)
-- ---------------------------------------------------------------------------

CREATE POLICY qli_select ON public.quote_line_items
FOR SELECT USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.quotes q
    WHERE q.id = quote_line_items.quote_id
      AND public.app_user_has_organization_access(COALESCE(q.organization_id, q.tenant_id))
  )
);

CREATE POLICY qli_insert ON public.quote_line_items
FOR INSERT WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.quotes q
    WHERE q.id = quote_line_items.quote_id
      AND public._rls_user_can_write_org(
        COALESCE(q.organization_id, q.tenant_id),
        ARRAY['owner','admin','manager']::public.app_role[]
      )
  )
);

CREATE POLICY qli_update ON public.quote_line_items
FOR UPDATE USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.quotes q
    WHERE q.id = quote_line_items.quote_id
      AND public._rls_user_can_write_org(
        COALESCE(q.organization_id, q.tenant_id),
        ARRAY['owner','admin','manager']::public.app_role[]
      )
  )
) WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.quotes q
    WHERE q.id = quote_line_items.quote_id
      AND public._rls_user_can_write_org(
        COALESCE(q.organization_id, q.tenant_id),
        ARRAY['owner','admin','manager']::public.app_role[]
      )
  )
);

CREATE POLICY qli_delete ON public.quote_line_items
FOR DELETE USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.quotes q
    WHERE q.id = quote_line_items.quote_id
      AND public._rls_user_can_write_org(
        COALESCE(q.organization_id, q.tenant_id),
        ARRAY['owner','admin']::public.app_role[]
      )
  )
);

-- ---------------------------------------------------------------------------
-- 5b. contract_versions  (via contracts)
-- ---------------------------------------------------------------------------

CREATE POLICY cv_select ON public.contract_versions
FOR SELECT USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = contract_versions.contract_id
      AND public.app_user_has_organization_access(COALESCE(c.organization_id, c.tenant_id))
  )
);

CREATE POLICY cv_insert ON public.contract_versions
FOR INSERT WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = contract_versions.contract_id
      AND public._rls_user_can_write_org(
        COALESCE(c.organization_id, c.tenant_id),
        ARRAY['owner','admin','manager']::public.app_role[]
      )
  )
);

CREATE POLICY cv_update ON public.contract_versions
FOR UPDATE USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = contract_versions.contract_id
      AND public._rls_user_can_write_org(
        COALESCE(c.organization_id, c.tenant_id),
        ARRAY['owner','admin','manager']::public.app_role[]
      )
  )
) WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = contract_versions.contract_id
      AND public._rls_user_can_write_org(
        COALESCE(c.organization_id, c.tenant_id),
        ARRAY['owner','admin','manager']::public.app_role[]
      )
  )
);

CREATE POLICY cv_delete ON public.contract_versions
FOR DELETE USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = contract_versions.contract_id
      AND public._rls_user_can_write_org(
        COALESCE(c.organization_id, c.tenant_id),
        ARRAY['owner','admin']::public.app_role[]
      )
  )
);

-- ---------------------------------------------------------------------------
-- 5c. contract_esignatures  (via contracts)
-- ---------------------------------------------------------------------------

CREATE POLICY ces_select ON public.contract_esignatures
FOR SELECT USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = contract_esignatures.contract_id
      AND public.app_user_has_organization_access(COALESCE(c.organization_id, c.tenant_id))
  )
);

CREATE POLICY ces_insert ON public.contract_esignatures
FOR INSERT WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = contract_esignatures.contract_id
      AND public._rls_user_can_write_org(
        COALESCE(c.organization_id, c.tenant_id),
        ARRAY['owner','admin','manager']::public.app_role[]
      )
  )
);

CREATE POLICY ces_update ON public.contract_esignatures
FOR UPDATE USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = contract_esignatures.contract_id
      AND public._rls_user_can_write_org(
        COALESCE(c.organization_id, c.tenant_id),
        ARRAY['owner','admin','manager']::public.app_role[]
      )
  )
) WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = contract_esignatures.contract_id
      AND public._rls_user_can_write_org(
        COALESCE(c.organization_id, c.tenant_id),
        ARRAY['owner','admin','manager']::public.app_role[]
      )
  )
);

CREATE POLICY ces_delete ON public.contract_esignatures
FOR DELETE USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = contract_esignatures.contract_id
      AND public._rls_user_can_write_org(
        COALESCE(c.organization_id, c.tenant_id),
        ARRAY['owner','admin']::public.app_role[]
      )
  )
);

-- ---------------------------------------------------------------------------
-- 5d. contract_scans  (via contracts)
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='contract_scans') THEN

    EXECUTE 'CREATE POLICY cs_select ON public.contract_scans
    FOR SELECT USING (
      public.app_is_platform_super_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.contracts c
        WHERE c.id = contract_scans.contract_id
          AND public.app_user_has_organization_access(COALESCE(c.organization_id, c.tenant_id))
      )
    )';

    EXECUTE 'CREATE POLICY cs_insert ON public.contract_scans
    FOR INSERT WITH CHECK (
      public.app_is_platform_super_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.contracts c
        WHERE c.id = contract_scans.contract_id
          AND public._rls_user_can_write_org(
            COALESCE(c.organization_id, c.tenant_id),
            ARRAY[''owner'',''admin'',''manager'']::public.app_role[]
          )
      )
    )';

    EXECUTE 'CREATE POLICY cs_update ON public.contract_scans
    FOR UPDATE USING (
      public.app_is_platform_super_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.contracts c
        WHERE c.id = contract_scans.contract_id
          AND public._rls_user_can_write_org(
            COALESCE(c.organization_id, c.tenant_id),
            ARRAY[''owner'',''admin'',''manager'']::public.app_role[]
          )
      )
    ) WITH CHECK (
      public.app_is_platform_super_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.contracts c
        WHERE c.id = contract_scans.contract_id
          AND public._rls_user_can_write_org(
            COALESCE(c.organization_id, c.tenant_id),
            ARRAY[''owner'',''admin'',''manager'']::public.app_role[]
          )
      )
    )';

    EXECUTE 'CREATE POLICY cs_delete ON public.contract_scans
    FOR DELETE USING (
      public.app_is_platform_super_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.contracts c
        WHERE c.id = contract_scans.contract_id
          AND public._rls_user_can_write_org(
            COALESCE(c.organization_id, c.tenant_id),
            ARRAY[''owner'',''admin'']::public.app_role[]
          )
      )
    )';

  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5e. purchase_order_items  (via purchase_orders)
-- ---------------------------------------------------------------------------

CREATE POLICY poi_select ON public.purchase_order_items
FOR SELECT USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.purchase_orders po
    WHERE po.id = purchase_order_items.purchase_order_id
      AND public.app_user_has_organization_access(COALESCE(po.organization_id, po.tenant_id))
  )
);

CREATE POLICY poi_insert ON public.purchase_order_items
FOR INSERT WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.purchase_orders po
    WHERE po.id = purchase_order_items.purchase_order_id
      AND public._rls_user_can_write_org(
        COALESCE(po.organization_id, po.tenant_id),
        ARRAY['owner','admin','manager']::public.app_role[]
      )
  )
);

CREATE POLICY poi_update ON public.purchase_order_items
FOR UPDATE USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.purchase_orders po
    WHERE po.id = purchase_order_items.purchase_order_id
      AND public._rls_user_can_write_org(
        COALESCE(po.organization_id, po.tenant_id),
        ARRAY['owner','admin','manager']::public.app_role[]
      )
  )
) WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.purchase_orders po
    WHERE po.id = purchase_order_items.purchase_order_id
      AND public._rls_user_can_write_org(
        COALESCE(po.organization_id, po.tenant_id),
        ARRAY['owner','admin','manager']::public.app_role[]
      )
  )
);

CREATE POLICY poi_delete ON public.purchase_order_items
FOR DELETE USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.purchase_orders po
    WHERE po.id = purchase_order_items.purchase_order_id
      AND public._rls_user_can_write_org(
        COALESCE(po.organization_id, po.tenant_id),
        ARRAY['owner','admin']::public.app_role[]
      )
  )
);

-- ---------------------------------------------------------------------------
-- 5f. production_order_items  (via production_orders)
-- ---------------------------------------------------------------------------

CREATE POLICY proi_select ON public.production_order_items
FOR SELECT USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.production_orders po
    WHERE po.id = production_order_items.production_order_id
      AND public.app_user_has_organization_access(COALESCE(po.organization_id, po.tenant_id))
  )
);

CREATE POLICY proi_insert ON public.production_order_items
FOR INSERT WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.production_orders po
    WHERE po.id = production_order_items.production_order_id
      AND public._rls_user_can_write_org(
        COALESCE(po.organization_id, po.tenant_id),
        ARRAY['owner','admin','manager']::public.app_role[]
      )
  )
);

CREATE POLICY proi_update ON public.production_order_items
FOR UPDATE USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.production_orders po
    WHERE po.id = production_order_items.production_order_id
      AND public._rls_user_can_write_org(
        COALESCE(po.organization_id, po.tenant_id),
        ARRAY['owner','admin','manager']::public.app_role[]
      )
  )
) WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.production_orders po
    WHERE po.id = production_order_items.production_order_id
      AND public._rls_user_can_write_org(
        COALESCE(po.organization_id, po.tenant_id),
        ARRAY['owner','admin','manager']::public.app_role[]
      )
  )
);

CREATE POLICY proi_delete ON public.production_order_items
FOR DELETE USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.production_orders po
    WHERE po.id = production_order_items.production_order_id
      AND public._rls_user_can_write_org(
        COALESCE(po.organization_id, po.tenant_id),
        ARRAY['owner','admin']::public.app_role[]
      )
  )
);

-- ---------------------------------------------------------------------------
-- 5g. document_versions  (via auto_documents)
-- ---------------------------------------------------------------------------

CREATE POLICY dv_select ON public.document_versions
FOR SELECT USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.auto_documents d
    WHERE d.id = document_versions.document_id
      AND public.app_user_has_organization_access(COALESCE(d.organization_id, d.tenant_id))
  )
);

CREATE POLICY dv_insert ON public.document_versions
FOR INSERT WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.auto_documents d
    WHERE d.id = document_versions.document_id
      AND public._rls_user_can_write_org(
        COALESCE(d.organization_id, d.tenant_id),
        ARRAY['owner','admin','manager']::public.app_role[]
      )
  )
);

CREATE POLICY dv_update ON public.document_versions
FOR UPDATE USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.auto_documents d
    WHERE d.id = document_versions.document_id
      AND public._rls_user_can_write_org(
        COALESCE(d.organization_id, d.tenant_id),
        ARRAY['owner','admin','manager']::public.app_role[]
      )
  )
) WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.auto_documents d
    WHERE d.id = document_versions.document_id
      AND public._rls_user_can_write_org(
        COALESCE(d.organization_id, d.tenant_id),
        ARRAY['owner','admin','manager']::public.app_role[]
      )
  )
);

CREATE POLICY dv_delete ON public.document_versions
FOR DELETE USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.auto_documents d
    WHERE d.id = document_versions.document_id
      AND public._rls_user_can_write_org(
        COALESCE(d.organization_id, d.tenant_id),
        ARRAY['owner','admin']::public.app_role[]
      )
  )
);

-- ---------------------------------------------------------------------------
-- 5h. document_signatures  (via auto_documents)
-- ---------------------------------------------------------------------------

CREATE POLICY ds_select ON public.document_signatures
FOR SELECT USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.auto_documents d
    WHERE d.id = document_signatures.document_id
      AND public.app_user_has_organization_access(COALESCE(d.organization_id, d.tenant_id))
  )
);

CREATE POLICY ds_insert ON public.document_signatures
FOR INSERT WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.auto_documents d
    WHERE d.id = document_signatures.document_id
      AND public._rls_user_can_write_org(
        COALESCE(d.organization_id, d.tenant_id),
        ARRAY['owner','admin','manager']::public.app_role[]
      )
  )
);

CREATE POLICY ds_update ON public.document_signatures
FOR UPDATE USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.auto_documents d
    WHERE d.id = document_signatures.document_id
      AND public._rls_user_can_write_org(
        COALESCE(d.organization_id, d.tenant_id),
        ARRAY['owner','admin','manager']::public.app_role[]
      )
  )
) WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.auto_documents d
    WHERE d.id = document_signatures.document_id
      AND public._rls_user_can_write_org(
        COALESCE(d.organization_id, d.tenant_id),
        ARRAY['owner','admin','manager']::public.app_role[]
      )
  )
);

CREATE POLICY ds_delete ON public.document_signatures
FOR DELETE USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.auto_documents d
    WHERE d.id = document_signatures.document_id
      AND public._rls_user_can_write_org(
        COALESCE(d.organization_id, d.tenant_id),
        ARRAY['owner','admin']::public.app_role[]
      )
  )
);

-- ---------------------------------------------------------------------------
-- 5i. document_permissions  (via auto_documents)
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='document_permissions') THEN

    EXECUTE 'CREATE POLICY dp_select ON public.document_permissions
    FOR SELECT USING (
      public.app_is_platform_super_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.auto_documents d
        WHERE d.id = document_permissions.document_id
          AND public.app_user_has_organization_access(COALESCE(d.organization_id, d.tenant_id))
      )
    )';

    EXECUTE 'CREATE POLICY dp_insert ON public.document_permissions
    FOR INSERT WITH CHECK (
      public.app_is_platform_super_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.auto_documents d
        WHERE d.id = document_permissions.document_id
          AND public._rls_user_can_write_org(
            COALESCE(d.organization_id, d.tenant_id),
            ARRAY[''owner'',''admin'',''manager'']::public.app_role[]
          )
      )
    )';

    EXECUTE 'CREATE POLICY dp_update ON public.document_permissions
    FOR UPDATE USING (
      public.app_is_platform_super_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.auto_documents d
        WHERE d.id = document_permissions.document_id
          AND public._rls_user_can_write_org(
            COALESCE(d.organization_id, d.tenant_id),
            ARRAY[''owner'',''admin'',''manager'']::public.app_role[]
          )
      )
    ) WITH CHECK (
      public.app_is_platform_super_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.auto_documents d
        WHERE d.id = document_permissions.document_id
          AND public._rls_user_can_write_org(
            COALESCE(d.organization_id, d.tenant_id),
            ARRAY[''owner'',''admin'',''manager'']::public.app_role[]
          )
      )
    )';

    EXECUTE 'CREATE POLICY dp_delete ON public.document_permissions
    FOR DELETE USING (
      public.app_is_platform_super_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.auto_documents d
        WHERE d.id = document_permissions.document_id
          AND public._rls_user_can_write_org(
            COALESCE(d.organization_id, d.tenant_id),
            ARRAY[''owner'',''admin'']::public.app_role[]
          )
      )
    )';

  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5j. document_esignatures  (via auto_documents)
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='document_esignatures') THEN

    EXECUTE 'CREATE POLICY des_select ON public.document_esignatures
    FOR SELECT USING (
      public.app_is_platform_super_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.auto_documents d
        WHERE d.id = document_esignatures.document_id
          AND public.app_user_has_organization_access(COALESCE(d.organization_id, d.tenant_id))
      )
    )';

    EXECUTE 'CREATE POLICY des_insert ON public.document_esignatures
    FOR INSERT WITH CHECK (
      public.app_is_platform_super_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.auto_documents d
        WHERE d.id = document_esignatures.document_id
          AND public._rls_user_can_write_org(
            COALESCE(d.organization_id, d.tenant_id),
            ARRAY[''owner'',''admin'',''manager'']::public.app_role[]
          )
      )
    )';

    EXECUTE 'CREATE POLICY des_update ON public.document_esignatures
    FOR UPDATE USING (
      public.app_is_platform_super_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.auto_documents d
        WHERE d.id = document_esignatures.document_id
          AND public._rls_user_can_write_org(
            COALESCE(d.organization_id, d.tenant_id),
            ARRAY[''owner'',''admin'',''manager'']::public.app_role[]
          )
      )
    ) WITH CHECK (
      public.app_is_platform_super_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.auto_documents d
        WHERE d.id = document_esignatures.document_id
          AND public._rls_user_can_write_org(
            COALESCE(d.organization_id, d.tenant_id),
            ARRAY[''owner'',''admin'',''manager'']::public.app_role[]
          )
      )
    )';

    EXECUTE 'CREATE POLICY des_delete ON public.document_esignatures
    FOR DELETE USING (
      public.app_is_platform_super_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.auto_documents d
        WHERE d.id = document_esignatures.document_id
          AND public._rls_user_can_write_org(
            COALESCE(d.organization_id, d.tenant_id),
            ARRAY[''owner'',''admin'']::public.app_role[]
          )
      )
    )';

  END IF;
END $$;

-- =============================================================================
-- 6. VERIFICATION QUERY (run after migration)
-- =============================================================================

-- Uncomment to verify all policies are in place:
-- SELECT tablename, policyname, permissive, roles, cmd, qual IS NOT NULL AS has_using, with_check IS NOT NULL AS has_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, cmd, policyname;
