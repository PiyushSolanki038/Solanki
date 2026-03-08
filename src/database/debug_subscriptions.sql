-- ============================================================
-- DIAGNOSTIC QUERY: Check all data for debugging tenant subscription issues
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Check all tenants
SELECT '=== TENANTS ===' as section;
SELECT id, name, slug, created_at FROM tenants;

-- 2. Check all tenant subscriptions
SELECT '=== TENANT SUBSCRIPTIONS ===' as section;
SELECT 
    ts.id,
    ts.tenant_id,
    t.name as tenant_name,
    ts.plan_type,
    ts.status,
    ts.module_crm,
    ts.module_clm,
    ts.module_cpq,
    ts.module_erp,
    ts.module_documents,
    ts.max_users
FROM tenant_subscriptions ts
LEFT JOIN tenants t ON ts.tenant_id = t.id;

-- 3. Check all tenant users
SELECT '=== TENANT USERS ===' as section;
SELECT 
    tu.id,
    tu.tenant_id,
    t.name as tenant_name,
    tu.user_id,
    tu.email,
    tu.role,
    tu.is_active,
    tu.is_approved
FROM tenant_users tu
LEFT JOIN tenants t ON tu.tenant_id = t.id;

-- 4. Check if subscription exists for each tenant
SELECT '=== SUBSCRIPTION STATUS PER TENANT ===' as section;
SELECT 
    t.id as tenant_id,
    t.name as tenant_name,
    CASE WHEN ts.id IS NOT NULL THEN 'HAS SUBSCRIPTION' ELSE 'NO SUBSCRIPTION' END as subscription_status,
    ts.module_crm,
    ts.module_clm,
    ts.module_cpq,
    ts.module_erp,
    ts.module_documents
FROM tenants t
LEFT JOIN tenant_subscriptions ts ON t.id = ts.tenant_id;

-- ============================================================
-- FIX QUERIES: Run these if you find issues
-- ============================================================

-- FIX 1: If tenant has no subscription, create one
-- Replace 'YOUR_TENANT_ID' with the actual tenant ID
/*
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
    'YOUR_TENANT_ID',
    'enterprise',
    'active',
    true,
    true,
    true,
    true,
    true,
    100,
    10000,
    10000,
    10000
);
*/

-- FIX 2: Update existing subscription to enable all modules
-- Replace 'YOUR_TENANT_ID' with the actual tenant ID
/*
UPDATE tenant_subscriptions
SET 
    module_crm = true,
    module_clm = true,
    module_cpq = true,
    module_erp = true,
    module_documents = true,
    plan_type = 'enterprise',
    status = 'active'
WHERE tenant_id = 'YOUR_TENANT_ID';
*/

-- FIX 3: Create missing subscription for demo tenant (a1b2c3d4-e5f6-7890-abcd-ef1234567890)
/*
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
    100,
    10000,
    10000,
    10000
)
ON CONFLICT (tenant_id) DO UPDATE SET
    module_crm = true,
    module_clm = true,
    module_cpq = true,
    module_erp = true,
    module_documents = true;
*/
