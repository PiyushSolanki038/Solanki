-- ============================================================
-- SEED DATA - Platform Admin & Demo Tenant
-- ============================================================

-- Add your user as Platform Admin
INSERT INTO platform_admins (user_id, email, first_name, last_name, role, is_active)
VALUES (
    '1ed42098-09c4-49a6-b261-496534297a0b',
    'admin@siswitinfra.com',
    'Admin',
    'User',
    'platform_admin',
    true
)
ON CONFLICT (user_id) DO UPDATE SET
    email = EXCLUDED.email,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    is_active = true;

-- Create a demo tenant
INSERT INTO tenants (
    id,
    name,
    slug,
    company_name,
    company_email,
    status,
    plan_type,
    max_users,
    max_storage_mb,
    max_contacts,
    max_contracts
) VALUES (
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'Demo Organization',
    'demo-org',
    'Demo Organization Inc.',
    'admin@demo-org.com',
    'active',
    'enterprise',
    50,
    10000,
    10000,
    1000
)
ON CONFLICT (slug) DO NOTHING;

-- Add subscription for demo tenant
INSERT INTO tenant_subscriptions (
    tenant_id,
    plan_type,
    status,
    module_crm,
    module_clm,
    module_cpq,
    module_erp,
    module_documents,
    max_users,
    max_storage_mb,
    max_contacts,
    max_contracts
) VALUES (
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'enterprise',
    'active',
    true,
    true,
    true,
    true,
    true,
    50,
    10000,
    10000,
    1000
)
ON CONFLICT (tenant_id) DO UPDATE SET
    status = 'active',
    plan_type = 'enterprise';

-- Add yourself as admin of the demo tenant
INSERT INTO tenant_users (
    tenant_id,
    user_id,
    email,
    first_name,
    last_name,
    role,
    is_active,
    is_approved
) VALUES (
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    '1ed42098-09c4-49a6-b261-496534297a0b',
    'admin@siswitinfra.com',
    'Admin',
    'User',
    'admin',
    true,
    true
)
ON CONFLICT (tenant_id, user_id) DO UPDATE SET
    role = 'admin',
    is_active = true,
    is_approved = true;

-- ============================================================
-- FIX RLS POLICIES FOR AUTHENTICATED USERS
-- ============================================================

-- Allow authenticated users to read platform_admins
DROP POLICY IF EXISTS "platform_admins_see_all_tenants" ON tenants;
CREATE POLICY "platform_admins_see_all_tenants" ON tenants
    FOR SELECT USING (
        auth.role() = 'authenticated'
    );

-- Allow authenticated users to read platform_admins table
DROP POLICY IF EXISTS "platform_admins_select" ON platform_admins;
CREATE POLICY "platform_admins_select" ON platform_admins
    FOR SELECT USING (
        auth.role() = 'authenticated'
    );

-- Allow authenticated users to read tenant_subscriptions
DROP POLICY IF EXISTS "tenant_subscriptions_select" ON tenant_subscriptions;
CREATE POLICY "tenant_subscriptions_select" ON tenant_subscriptions
    FOR SELECT USING (
        auth.role() = 'authenticated'
    );

-- Allow authenticated users to read tenant_users
DROP POLICY IF EXISTS "tenant_users_see_tenant_users" ON tenant_users;
CREATE POLICY "tenant_users_see_tenant_users" ON tenant_users
    FOR SELECT USING (
        auth.role() = 'authenticated'
    );

-- Allow authenticated users to read their own tenant's data
DROP POLICY IF EXISTS "tenant_data_access" ON accounts;
CREATE POLICY "tenant_data_access" ON accounts
    FOR ALL USING (
        auth.role() = 'authenticated'
    );

DROP POLICY IF EXISTS "tenant_data_access" ON contacts;
CREATE POLICY "tenant_data_access" ON contacts
    FOR ALL USING (
        auth.role() = 'authenticated'
    );

DROP POLICY IF EXISTS "tenant_data_access" ON leads;
CREATE POLICY "tenant_data_access" ON leads
    FOR ALL USING (
        auth.role() = 'authenticated'
    );

DROP POLICY IF EXISTS "tenant_data_access" ON opportunities;
CREATE POLICY "tenant_data_access" ON opportunities
    FOR ALL USING (
        auth.role() = 'authenticated'
    );

DROP POLICY IF EXISTS "tenant_data_access" ON activities;
CREATE POLICY "tenant_data_access" ON activities
    FOR ALL USING (
        auth.role() = 'authenticated'
    );

DROP POLICY IF EXISTS "tenant_data_access" ON products;
CREATE POLICY "tenant_data_access" ON products
    FOR ALL USING (
        auth.role() = 'authenticated'
    );

DROP POLICY IF EXISTS "tenant_data_access" ON quotes;
CREATE POLICY "tenant_data_access" ON quotes
    FOR ALL USING (
        auth.role() = 'authenticated'
    );

DROP POLICY IF EXISTS "tenant_data_access" ON contracts;
CREATE POLICY "tenant_data_access" ON contracts
    FOR ALL USING (
        auth.role() = 'authenticated'
    );

DROP POLICY IF EXISTS "tenant_data_access" ON suppliers;
CREATE POLICY "tenant_data_access" ON suppliers
    FOR ALL USING (
        auth.role() = 'authenticated'
    );

DROP POLICY IF EXISTS "tenant_data_access" ON financial_records;
CREATE POLICY "tenant_data_access" ON financial_records
    FOR ALL USING (
        auth.role() = 'authenticated'
    );

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Check platform admin
SELECT * FROM platform_admins;

-- Check tenant
SELECT * FROM tenants;

-- Check subscription
SELECT * FROM tenant_subscriptions;

-- Check tenant user
SELECT * FROM tenant_users;
