-- =============================================================================
-- ADD PLATFORM ADMIN
-- Run this to make admin@example.com (user ID: 1ed42098-09c4-49a6-b261-496534297a0b) 
-- a Platform Admin
-- =============================================================================

-- First, delete any existing role entries for this user
DELETE FROM user_roles WHERE user_id = '1ed42098-09c4-49a6-b261-496534297a0b';

-- Add as Platform Admin
INSERT INTO public.user_roles (user_id, role, is_platform_admin, approved)
VALUES ('1ed42098-09c4-49a6-b261-496534297a0b', 'admin', true, true);

-- Verify
SELECT * FROM user_roles WHERE user_id = '1ed42098-09c4-49a6-b261-496534297a0b';
