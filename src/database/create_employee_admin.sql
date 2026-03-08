-- ============================================================
-- QUICK FIX: Create Employee Admin User
-- Run this in Supabase SQL Editor to create a user with full access
-- ============================================================

-- STEP 1: First, create a new user in Supabase Authentication:
-- Go to Authentication > Users > Add User
-- Enter email and password, then click "Create User"
-- Copy the user ID from the newly created user

-- STEP 2: Replace 'USER_ID_FROM_STEP_1' below with the user ID
-- Then run this script

-- Option A: Create as Tenant Admin (full access to all modules)
INSERT INTO tenant_users (
    tenant_id,
    user_id,
    email,
    first_name,
    last_name,
    role,
    is_active,
    is_approved,
    department
) VALUES (
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',  -- Demo Organization tenant ID
    'USER_ID_FROM_STEP_1',                     -- Replace with actual user ID
    'admin@company.com',                       -- Replace with actual email
    'John',
    'Doe',
    'admin',                                   -- Can be: admin, manager, user
    true,                                      -- is_active = true
    true,                                      -- is_approved = true
    'Management'
)
ON CONFLICT (tenant_id, user_id) DO UPDATE SET
    role = 'admin',
    is_active = true,
    is_approved = true,
    department = 'Management';

-- Option B: Create as Manager (department-level access)
-- Uncomment below and comment out Option A to use
/*
INSERT INTO tenant_users (
    tenant_id,
    user_id,
    email,
    first_name,
    last_name,
    role,
    is_active,
    is_approved,
    department
) VALUES (
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'USER_ID_FROM_STEP_1',
    'manager@company.com',
    'Jane',
    'Smith',
    'manager',
    true,
    true,
    'Sales'
)
ON CONFLICT (tenant_id, user_id) DO UPDATE SET
    role = 'manager',
    is_active = true,
    is_approved = true;
*/

-- Verify the user was created
SELECT 
    tu.email,
    tu.role,
    tu.is_active,
    tu.is_approved,
    t.name as tenant_name
FROM tenant_users tu
LEFT JOIN tenants t ON tu.tenant_id = t.id
WHERE tu.user_id = 'USER_ID_FROM_STEP_1';
