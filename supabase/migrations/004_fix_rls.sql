-- =============================================================================
-- FIX RLS POLICIES
-- Run this to allow authenticated users to read user_roles and tenant_users
-- =============================================================================

-- Disable RLS on user_roles table (or create policies)
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read their own user_roles
CREATE POLICY "Allow authenticated users to read user_roles" 
ON user_roles FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- Disable RLS on tenant_users table
ALTER TABLE tenant_users DISABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read tenant_users
CREATE POLICY "Allow authenticated users to read tenant_users" 
ON tenant_users FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- Disable RLS on tenants table
ALTER TABLE tenants DISABLE ROW LEVEL SECURITY;

-- Disable RLS on tenant_subscriptions table
ALTER TABLE tenant_subscriptions DISABLE ROW LEVEL SECURITY;

-- Verify
SELECT 'RLS status:' as info, relname, relrowsecurity as rls_enabled 
FROM pg_class 
WHERE relname IN ('user_roles', 'tenant_users', 'tenants', 'tenant_subscriptions');
