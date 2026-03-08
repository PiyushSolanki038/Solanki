-- Signup and owner-management RLS fixes for org-native auth flows.

SET search_path = public, extensions;

-- ============================================================================
-- PROFILES
-- ============================================================================

DROP POLICY IF EXISTS profiles_insert_self ON public.profiles;
CREATE POLICY profiles_insert_self ON public.profiles
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  OR public.app_is_platform_super_admin(auth.uid())
);

DROP POLICY IF EXISTS profiles_update_self ON public.profiles;
CREATE POLICY profiles_update_self ON public.profiles
FOR UPDATE
USING (
  auth.uid() = user_id
  OR public.app_is_platform_super_admin(auth.uid())
)
WITH CHECK (
  auth.uid() = user_id
  OR public.app_is_platform_super_admin(auth.uid())
);

-- ============================================================================
-- ORGANIZATIONS
-- ============================================================================

DROP POLICY IF EXISTS organizations_insert_owner_signup ON public.organizations;
CREATE POLICY organizations_insert_owner_signup ON public.organizations
FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated'
  AND owner_user_id = auth.uid()
);

DROP POLICY IF EXISTS organizations_update_owner_admin ON public.organizations;
CREATE POLICY organizations_update_owner_admin ON public.organizations
FOR UPDATE
USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    WHERE om.organization_id = organizations.id
      AND om.user_id = auth.uid()
      AND om.is_active = true
      AND om.account_state IN ('active', 'pending_verification')
      AND om.role IN ('owner', 'admin')
  )
)
WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    WHERE om.organization_id = organizations.id
      AND om.user_id = auth.uid()
      AND om.is_active = true
      AND om.account_state IN ('active', 'pending_verification')
      AND om.role IN ('owner', 'admin')
  )
);

-- ============================================================================
-- ORGANIZATION SUBSCRIPTIONS
-- ============================================================================

DROP POLICY IF EXISTS subs_insert_owner_signup ON public.organization_subscriptions;
CREATE POLICY subs_insert_owner_signup ON public.organization_subscriptions
FOR INSERT
WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.organizations o
    WHERE o.id = organization_subscriptions.organization_id
      AND o.owner_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS subs_update_owner_admin ON public.organization_subscriptions;
CREATE POLICY subs_update_owner_admin ON public.organization_subscriptions
FOR UPDATE
USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    WHERE om.organization_id = organization_subscriptions.organization_id
      AND om.user_id = auth.uid()
      AND om.is_active = true
      AND om.account_state IN ('active', 'pending_verification')
      AND om.role IN ('owner', 'admin')
  )
)
WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    WHERE om.organization_id = organization_subscriptions.organization_id
      AND om.user_id = auth.uid()
      AND om.is_active = true
      AND om.account_state IN ('active', 'pending_verification')
      AND om.role IN ('owner', 'admin')
  )
);

-- ============================================================================
-- ORGANIZATION MEMBERSHIPS
-- ============================================================================

DROP POLICY IF EXISTS memberships_insert_signup_paths ON public.organization_memberships;
CREATE POLICY memberships_insert_signup_paths ON public.organization_memberships
FOR INSERT
WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR (
    user_id = auth.uid()
    AND lower(email) = lower(coalesce(auth.jwt() ->> 'email', email))
    AND (
      (
        role = 'owner'
        AND account_state = 'pending_verification'
        AND is_active = true
        AND EXISTS (
          SELECT 1
          FROM public.organizations o
          WHERE o.id = organization_memberships.organization_id
            AND o.owner_user_id = auth.uid()
        )
      )
      OR (
        role = 'client'
        AND account_state = 'pending_approval'
        AND is_active = true
        AND EXISTS (
          SELECT 1
          FROM public.organizations o
          WHERE o.id = organization_memberships.organization_id
            AND o.status IN ('active', 'trial')
        )
      )
      OR (
        role IN ('admin', 'manager', 'employee')
        AND account_state = 'pending_verification'
        AND is_active = true
        AND EXISTS (
          SELECT 1
          FROM public.employee_invitations ei
          WHERE ei.organization_id = organization_memberships.organization_id
            AND lower(ei.invited_email) = lower(organization_memberships.email)
            AND ei.role = organization_memberships.role
            AND ei.status = 'pending'
            AND ei.expires_at > NOW()
        )
      )
      OR (
        role = 'client'
        AND account_state = 'pending_verification'
        AND is_active = true
        AND EXISTS (
          SELECT 1
          FROM public.client_invitations ci
          WHERE ci.organization_id = organization_memberships.organization_id
            AND lower(ci.invited_email) = lower(organization_memberships.email)
            AND ci.status = 'pending'
            AND ci.expires_at > NOW()
        )
      )
    )
  )
);

DROP POLICY IF EXISTS memberships_update_owner_admin ON public.organization_memberships;
CREATE POLICY memberships_update_owner_admin ON public.organization_memberships
FOR UPDATE
USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    WHERE om.organization_id = organization_memberships.organization_id
      AND om.user_id = auth.uid()
      AND om.is_active = true
      AND om.account_state IN ('active', 'pending_verification')
      AND om.role IN ('owner', 'admin')
  )
)
WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    WHERE om.organization_id = organization_memberships.organization_id
      AND om.user_id = auth.uid()
      AND om.is_active = true
      AND om.account_state IN ('active', 'pending_verification')
      AND om.role IN ('owner', 'admin')
  )
);

-- ============================================================================
-- INVITATION MUTATION POLICY RELAXATION
-- ============================================================================

DROP POLICY IF EXISTS employee_invites_mutate ON public.employee_invitations;
CREATE POLICY employee_invites_mutate ON public.employee_invitations
FOR ALL
USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = employee_invitations.organization_id
      AND om.is_active = true
      AND om.account_state IN ('active', 'pending_verification')
      AND om.role IN ('owner', 'admin')
  )
)
WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = employee_invitations.organization_id
      AND om.is_active = true
      AND om.account_state IN ('active', 'pending_verification')
      AND om.role IN ('owner', 'admin')
  )
);

DROP POLICY IF EXISTS client_invites_mutate ON public.client_invitations;
CREATE POLICY client_invites_mutate ON public.client_invitations
FOR ALL
USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = client_invitations.organization_id
      AND om.is_active = true
      AND om.account_state IN ('active', 'pending_verification')
      AND om.role IN ('owner', 'admin')
  )
)
WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = client_invitations.organization_id
      AND om.is_active = true
      AND om.account_state IN ('active', 'pending_verification')
      AND om.role IN ('owner', 'admin')
  )
);
