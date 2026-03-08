-- =============================================================================
-- CREATE USER_ROLES TABLE IF NOT EXISTS
-- This table stores platform admin roles
-- =============================================================================

-- Create user_roles table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'admin',
  is_platform_admin BOOLEAN DEFAULT false,
  approved BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (but allow all authenticated users to read)
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated users to read user_roles
DROP POLICY IF EXISTS "Allow authenticated users to read user_roles" ON public.user_roles;
CREATE POLICY "Allow authenticated users to read user_roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Create policy to allow service role to manage user_roles
DROP POLICY IF EXISTS "Allow service role to manage user_roles" ON public.user_roles;
CREATE POLICY "Allow service role to manage user_roles" ON public.user_roles
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Verify table exists and has the admin user
SELECT * FROM public.user_roles;
