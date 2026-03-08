-- Public-safe organization lookup for signup flows.
-- Exposes only minimal identity fields and only eligible organizations.

CREATE OR REPLACE FUNCTION public.search_signup_organizations(
  p_query text,
  p_limit integer DEFAULT 8
)
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  org_code text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_query text := trim(coalesce(p_query, ''));
  v_limit integer := greatest(1, least(coalesce(p_limit, 8), 20));
BEGIN
  IF length(v_query) < 2 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    o.id,
    o.name,
    o.slug,
    o.org_code
  FROM public.organizations o
  WHERE
    o.status IN ('active', 'trial')
    AND (
      o.name ILIKE '%' || v_query || '%'
      OR o.slug ILIKE v_query || '%'
      OR o.org_code ILIKE v_query || '%'
    )
  ORDER BY
    CASE
      WHEN lower(o.name) = lower(v_query) THEN 0
      WHEN lower(o.slug) = lower(v_query) THEN 1
      WHEN upper(o.org_code) = upper(v_query) THEN 2
      WHEN o.name ILIKE v_query || '%' THEN 3
      ELSE 4
    END,
    o.name ASC
  LIMIT v_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.find_signup_organization(
  p_slug_or_code text
)
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  org_code text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.id,
    o.name,
    o.slug,
    o.org_code
  FROM public.organizations o
  WHERE
    o.status IN ('active', 'trial')
    AND (
      lower(o.slug) = lower(trim(coalesce(p_slug_or_code, '')))
      OR upper(o.org_code) = upper(trim(coalesce(p_slug_or_code, '')))
    )
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.search_signup_organizations(text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.find_signup_organization(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.search_signup_organizations(text, integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.find_signup_organization(text) TO anon, authenticated, service_role;

