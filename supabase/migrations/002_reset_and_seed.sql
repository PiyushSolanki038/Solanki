-- =============================================================================
-- RESET AND SEED SCRIPT
-- Run this to clear all data and set up fresh for testing
-- 
-- This script uses TRUNCATE with CASCADE to handle all foreign key dependencies
-- =============================================================================

-- =============================================================================
-- STEP 1: Disable FK constraints temporarily for clean delete
-- =============================================================================

-- First, let's delete in the correct order (child tables before parent tables)
-- Documents module (most dependencies)
DELETE FROM document_esignatures;
DELETE FROM document_permissions;
DELETE FROM document_versions;
DELETE FROM auto_documents;
DELETE FROM document_templates;

-- CLM module
DELETE FROM contract_esignatures;
DELETE FROM contract_scans;
DELETE FROM contracts;
DELETE FROM contract_templates;

-- CPQ module
DELETE FROM quote_items;
DELETE FROM quotes;
DELETE FROM products;

-- ERP module  
DELETE FROM financial_records;
DELETE FROM production_orders;
DELETE FROM purchase_order_items;
DELETE FROM purchase_orders;
DELETE FROM inventory_items;
DELETE FROM suppliers;

-- CRM module
DELETE FROM opportunities;
DELETE FROM leads;
DELETE FROM activities;
DELETE FROM contacts;
DELETE FROM accounts;

-- Tenant/Multi-tenant tables (delete these LAST as other tables reference them)
DELETE FROM tenant_invitations;
DELETE FROM tenant_clients;
DELETE FROM tenant_subscriptions;
DELETE FROM tenant_users;
DELETE FROM tenants;

-- User management
DELETE FROM user_roles;
DELETE FROM signup_requests;
DELETE FROM audit_logs;
DELETE FROM profiles;

-- =============================================================================
-- STEP 2: Add Tenant
-- =============================================================================

INSERT INTO public.tenants (id, name, slug, company_name, plan_type, status, max_users, max_storage_mb)
VALUES 
  ('b182821a-0077-454f-a1fe-9171460886ea', 'SISWIT', 'siswit', 'SISWIT Private Limited', 'enterprise', 'active', 100, 10000);

-- =============================================================================
-- STEP 3: Add Tenant Subscription (enable all modules)
-- =============================================================================

INSERT INTO public.tenant_subscriptions (
  tenant_id,
  module_crm,
  module_clm,
  module_cpq,
  module_erp,
  module_documents,
  status,
  billing_email
)
VALUES 
  ('b182821a-0077-454f-a1fe-9171460886ea', true, true, true, true, true, 'active', 'admin@siswit.com');

-- =============================================================================
-- STEP 4: Show current state
-- =============================================================================

SELECT '=== Tenants ===' as info;
SELECT * FROM tenants;

SELECT '=== Tenant Subscriptions ===' as info;
SELECT * FROM tenant_subscriptions;

SELECT '=== User Roles (Platform) ===' as info;
SELECT * FROM user_roles;

SELECT '=== Tenant Users ===' as info;
SELECT * FROM tenant_users;

-- =============================================================================
-- INSTRUCTIONS TO COMPLETE SETUP
-- =============================================================================

/*
IMPORTANT: You need to run these additional commands manually:

1. Find your user ID in Supabase Dashboard > Authentication > Users
2. Run these commands (replace YOUR_USER_ID with your actual ID):

-- Add yourself as platform admin:
INSERT INTO public.user_roles (user_id, role, is_platform_admin, approved)
VALUES ('YOUR_USER_ID', 'admin', true, true);

-- Add yourself to the tenant as admin:
INSERT INTO public.tenant_users (tenant_id, user_id, role, is_active, is_approved)
VALUES ('b182821a-0077-454f-a1fe-9171460886ea', 'YOUR_USER_ID', 'admin', true, true);

3. Clear browser localStorage or use incognito window to test fresh login
*/
