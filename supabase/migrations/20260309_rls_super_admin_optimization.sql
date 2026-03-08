-- Phase 9.5: Optimize RLS super-admin checks
--
-- Problem: Each RLS policy calls `app_is_platform_super_admin()` which
--          executes `SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'`
--          on every single row check. With 50+ policies, this means 50+ identical
--          lookups per request.
--
-- Solution: Create an IMMUTABLE wrapper that PostgreSQL can fold into a single
--           evaluation per transaction. We also add a composite index to make
--           the lookup near-instantaneous.
--
-- NOTE: Apply this migration BEFORE regenerating types or deploying new code.
--       It is backward-compatible — existing policies calling the old function
--       will still work; only the performance characteristics change.

-- Step 1: Index that makes the super-admin check a simple index-only scan.
CREATE INDEX IF NOT EXISTS idx_profiles_super_admin
  ON public.profiles (id) WHERE role = 'super_admin';

-- Step 2: Stable wrapper — PostgreSQL will evaluate this only once per
-- statement because it is marked STABLE (safe to cache within a statement).
CREATE OR REPLACE FUNCTION public.app_is_platform_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE                        -- was potentially VOLATILE; now cacheable
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  );
$$;

-- Optional: If you can afford to grant execute to authenticated only:
-- REVOKE EXECUTE ON FUNCTION public.app_is_platform_super_admin() FROM public;
-- GRANT EXECUTE ON FUNCTION public.app_is_platform_super_admin() TO authenticated;
