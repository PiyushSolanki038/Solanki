-- Allow newly created owners to read their organization row before membership insert.

SET search_path = public, extensions;

DROP POLICY IF EXISTS organizations_select ON public.organizations;
CREATE POLICY organizations_select ON public.organizations
FOR SELECT
USING (
  public.app_is_platform_super_admin(auth.uid())
  OR owner_user_id = auth.uid()
  OR public.app_user_has_organization_access(id)
);
