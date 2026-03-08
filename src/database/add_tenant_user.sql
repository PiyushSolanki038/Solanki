-- Add a test tenant user (employee/manager)
-- After creating a new user in Supabase Auth, run this to add them to the tenant

-- Replace 'NEW_USER_ID' with the actual user ID from Supabase Auth
-- Replace 'user@company.com' with the actual email

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
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',  -- Demo Organization tenant ID
    'NEW_USER_ID',  -- Replace with actual user ID from Supabase Auth
    'user@company.com',  -- Replace with actual email
    'John',
    'Doe',
    'admin',  -- Can be: admin, manager, user, client
    true,
    true
)
ON CONFLICT (tenant_id, user_id) DO UPDATE SET
    role = 'admin',
    is_active = true,
    is_approved = true;

-- Or if you want to create a client (portal user):
-- INSERT INTO tenant_users (...)
-- VALUES (..., 'client', true, true);
