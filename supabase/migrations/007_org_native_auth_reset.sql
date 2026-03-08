-- =============================================================================
-- ORG-NATIVE AUTH REBUILD (FULL PUBLIC RESET)
-- =============================================================================
-- WARNING: Destructive migration. This resets the entire public schema.

DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON SCHEMA public TO postgres, service_role;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
SET search_path = public, extensions;

-- =============================================================================
-- ENUMS
-- =============================================================================

CREATE TYPE public.app_role AS ENUM (
  'platform_super_admin',
  'owner',
  'admin',
  'manager',
  'employee',
  'client'
);

CREATE TYPE public.account_state AS ENUM (
  'pending_verification',
  'pending_approval',
  'active',
  'rejected',
  'suspended',
  'inactive'
);

CREATE TYPE public.invitation_state AS ENUM (
  'pending',
  'accepted',
  'expired',
  'cancelled',
  'rejected'
);

CREATE TYPE public.job_status AS ENUM (
  'queued',
  'processing',
  'succeeded',
  'failed',
  'cancelled'
);

-- =============================================================================
-- HELPERS
-- =============================================================================

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.hash_invitation_token(p_token text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT encode(extensions.digest(p_token, 'sha256'), 'hex');
$$;

CREATE OR REPLACE FUNCTION public.sync_scope_ids()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.organization_id IS NULL AND NEW.tenant_id IS NOT NULL THEN
    NEW.organization_id := NEW.tenant_id;
  END IF;

  IF NEW.tenant_id IS NULL AND NEW.organization_id IS NOT NULL THEN
    NEW.tenant_id := NEW.organization_id;
  END IF;

  IF NEW.organization_id IS NULL OR NEW.tenant_id IS NULL THEN
    RAISE EXCEPTION 'organization_id and tenant_id cannot both be null';
  END IF;

  IF NEW.organization_id <> NEW.tenant_id THEN
    RAISE EXCEPTION 'organization_id and tenant_id must match';
  END IF;

  RETURN NEW;
END;
$$;

-- =============================================================================
-- CORE ORG / AUTH TABLES
-- =============================================================================

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  first_name text,
  last_name text,
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE public.platform_super_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  email text NOT NULL,
  first_name text,
  last_name text,
  role public.app_role NOT NULL DEFAULT 'platform_super_admin' CHECK (role = 'platform_super_admin'),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  org_code text NOT NULL UNIQUE,
  owner_user_id uuid,
  status text NOT NULL DEFAULT 'trial' CHECK (status IN ('active', 'suspended', 'cancelled', 'trial')),
  plan_type text NOT NULL DEFAULT 'starter' CHECK (plan_type IN ('starter', 'professional', 'enterprise')),
  company_email text,
  company_phone text,
  company_address text,
  company_website text,
  logo_url text,
  primary_color text,
  max_users integer NOT NULL DEFAULT 5,
  max_storage_mb integer NOT NULL DEFAULT 1000,
  subscription_start_date date,
  subscription_end_date date,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE public.organization_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_type text NOT NULL DEFAULT 'starter' CHECK (plan_type IN ('starter', 'professional', 'enterprise')),
  status text NOT NULL DEFAULT 'trial' CHECK (status IN ('trial', 'active', 'suspended', 'cancelled', 'past_due')),
  module_crm boolean NOT NULL DEFAULT true,
  module_clm boolean NOT NULL DEFAULT false,
  module_cpq boolean NOT NULL DEFAULT true,
  module_erp boolean NOT NULL DEFAULT false,
  module_documents boolean NOT NULL DEFAULT true,
  billing_email text,
  billing_contact_name text,
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  trial_start_date date,
  trial_end_date date,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE public.employee_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  normalized_name text GENERATED ALWAYS AS (lower(regexp_replace(name, '\\s+', '_', 'g'))) STORED,
  is_custom boolean NOT NULL DEFAULT false,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, normalized_name)
);

CREATE TABLE public.organization_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  email text NOT NULL,
  role public.app_role NOT NULL CHECK (role IN ('owner', 'admin', 'manager', 'employee', 'client')),
  employee_role_id uuid REFERENCES public.employee_roles(id) ON DELETE SET NULL,
  department text,
  employee_id text,
  account_state public.account_state NOT NULL DEFAULT 'pending_verification',
  is_email_verified boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  invited_by_user_id uuid,
  last_login_at timestamptz,
  login_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, user_id),
  UNIQUE (organization_id, email)
);

CREATE TABLE public.employee_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  invited_email text NOT NULL,
  role public.app_role NOT NULL CHECK (role IN ('admin', 'manager', 'employee')),
  employee_role_id uuid REFERENCES public.employee_roles(id) ON DELETE SET NULL,
  invited_by_user_id uuid NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  status public.invitation_state NOT NULL DEFAULT 'pending',
  accepted_at timestamptz,
  cancelled_at timestamptz,
  custom_role_name text,
  message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE public.client_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  invited_email text NOT NULL,
  invited_by_user_id uuid NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  status public.invitation_state NOT NULL DEFAULT 'pending',
  accepted_at timestamptz,
  cancelled_at timestamptz,
  message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  tenant_id uuid,
  user_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  old_values jsonb,
  new_values jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  impersonated_by uuid,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE public.impersonation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_super_admin_user_id uuid NOT NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  tenant_id uuid,
  organization_slug text NOT NULL,
  tenant_slug text,
  started_at timestamptz NOT NULL DEFAULT NOW(),
  ended_at timestamptz,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE public.background_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  tenant_id uuid,
  job_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status public.job_status NOT NULL DEFAULT 'queued',
  priority integer NOT NULL DEFAULT 100,
  available_at timestamptz NOT NULL DEFAULT NOW(),
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  last_error text,
  locked_at timestamptz,
  locked_by text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  finished_at timestamptz
);

-- =============================================================================
-- BUSINESS MODULE TABLES (ORG-NATIVE + TENANT COMPAT SCOPE)
-- =============================================================================

CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  domain text,
  industry text,
  website text,
  phone text,
  owner_id uuid,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

CREATE TABLE public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  phone text,
  job_title text,
  owner_id uuid,
  is_primary boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  first_name text,
  last_name text,
  company text,
  email text,
  phone text,
  status text DEFAULT 'new',
  source text,
  owner_id uuid,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

CREATE TABLE public.opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  amount numeric(15,2),
  stage text DEFAULT 'new',
  probability numeric(5,2),
  close_date date,
  owner_id uuid,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

CREATE TABLE public.activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE SET NULL,
  type text,
  subject text,
  description text,
  due_date timestamptz,
  owner_id uuid,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  sku text,
  category text,
  description text,
  price numeric(15,2) DEFAULT 0,
  cost numeric(15,2) DEFAULT 0,
  currency text DEFAULT 'USD',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

CREATE TABLE public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  quote_number text NOT NULL UNIQUE,
  name text,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE SET NULL,
  customer_name text,
  customer_email text,
  status text DEFAULT 'draft',
  subtotal numeric(15,2) DEFAULT 0,
  discount_percent numeric(5,2) DEFAULT 0,
  tax_percent numeric(5,2) DEFAULT 0,
  total_amount numeric(15,2) DEFAULT 0,
  owner_id uuid,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

CREATE TABLE public.quote_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  quantity numeric(12,2) DEFAULT 1,
  unit_price numeric(15,2) DEFAULT 0,
  discount_percent numeric(5,2) DEFAULT 0,
  tax_percent numeric(5,2) DEFAULT 0,
  line_total numeric(15,2) DEFAULT 0,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

CREATE TABLE public.contract_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  content text,
  status text DEFAULT 'draft',
  created_by uuid,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

CREATE TABLE public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  contract_number text,
  name text NOT NULL,
  template_id uuid REFERENCES public.contract_templates(id) ON DELETE SET NULL,
  quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  customer_name text,
  customer_email text,
  status text DEFAULT 'draft',
  value numeric(15,2) DEFAULT 0,
  start_date date,
  end_date date,
  auto_renew boolean DEFAULT false,
  owner_id uuid,
  created_by uuid,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

CREATE TABLE public.contract_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  content text,
  change_summary text,
  created_by uuid,
  created_at timestamptz DEFAULT NOW()
);

CREATE TABLE public.contract_esignatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  signer_name text,
  signer_email text,
  signer_role text,
  status text DEFAULT 'pending',
  signed_at timestamptz,
  viewed_at timestamptz,
  ip_address text,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  contact_name text,
  contact_email text,
  phone text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

CREATE TABLE public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  sku text,
  quantity_on_hand numeric(12,2) DEFAULT 0,
  reorder_point numeric(12,2) DEFAULT 0,
  warehouse_location text,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

CREATE TABLE public.inventory_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  inventory_item_id uuid REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  type text,
  quantity numeric(12,2) DEFAULT 0,
  reason text,
  created_by uuid,
  created_at timestamptz DEFAULT NOW()
);

CREATE TABLE public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  po_number text,
  status text DEFAULT 'draft',
  order_date date,
  expected_date date,
  total_amount numeric(15,2) DEFAULT 0,
  created_by uuid,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

CREATE TABLE public.purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  quantity numeric(12,2) DEFAULT 1,
  unit_cost numeric(15,2) DEFAULT 0,
  line_total numeric(15,2) DEFAULT 0,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

CREATE TABLE public.production_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  order_number text,
  status text DEFAULT 'planned',
  quantity_planned numeric(12,2) DEFAULT 0,
  quantity_completed numeric(12,2) DEFAULT 0,
  start_date date,
  end_date date,
  created_by uuid,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

CREATE TABLE public.production_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  production_order_id uuid REFERENCES public.production_orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  quantity_required numeric(12,2) DEFAULT 0,
  quantity_consumed numeric(12,2) DEFAULT 0,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

CREATE TABLE public.financial_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  type text,
  category text,
  amount numeric(15,2) DEFAULT 0,
  currency text DEFAULT 'USD',
  record_date date,
  description text,
  reference_number text,
  created_by uuid,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

CREATE TABLE public.document_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  content text,
  category text,
  created_by uuid,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

CREATE TABLE public.auto_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.document_templates(id) ON DELETE SET NULL,
  name text NOT NULL,
  document_type text,
  status text DEFAULT 'draft',
  content text,
  owner_id uuid,
  created_by uuid,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

CREATE TABLE public.document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES public.auto_documents(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  content text,
  change_summary text,
  created_by uuid,
  created_at timestamptz DEFAULT NOW()
);

CREATE TABLE public.document_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES public.auto_documents(id) ON DELETE CASCADE,
  signer_name text,
  signer_email text,
  signer_role text,
  status text DEFAULT 'pending',
  signature_data text,
  signed_at timestamptz,
  viewed_at timestamptz,
  created_at timestamptz DEFAULT NOW()
);

CREATE TABLE public.document_esignatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES public.auto_documents(id) ON DELETE CASCADE,
  signer_email text,
  signer_name text,
  status text DEFAULT 'pending',
  signed_at timestamptz,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

CREATE TABLE public.document_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES public.auto_documents(id) ON DELETE CASCADE,
  user_id uuid,
  access_level text DEFAULT 'read',
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

CREATE TABLE public.contract_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid REFERENCES public.contracts(id) ON DELETE CASCADE,
  file_name text,
  file_url text,
  extracted_text text,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

-- =============================================================================
-- UPDATED_AT TRIGGERS
-- =============================================================================

DROP TRIGGER IF EXISTS trg_profiles_touch_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_touch_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_platform_super_admins_touch_updated_at ON public.platform_super_admins;
CREATE TRIGGER trg_platform_super_admins_touch_updated_at BEFORE UPDATE ON public.platform_super_admins
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_organizations_touch_updated_at ON public.organizations;
CREATE TRIGGER trg_organizations_touch_updated_at BEFORE UPDATE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_organization_subscriptions_touch_updated_at ON public.organization_subscriptions;
CREATE TRIGGER trg_organization_subscriptions_touch_updated_at BEFORE UPDATE ON public.organization_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_employee_roles_touch_updated_at ON public.employee_roles;
CREATE TRIGGER trg_employee_roles_touch_updated_at BEFORE UPDATE ON public.employee_roles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_organization_memberships_touch_updated_at ON public.organization_memberships;
CREATE TRIGGER trg_organization_memberships_touch_updated_at BEFORE UPDATE ON public.organization_memberships
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_employee_invitations_touch_updated_at ON public.employee_invitations;
CREATE TRIGGER trg_employee_invitations_touch_updated_at BEFORE UPDATE ON public.employee_invitations
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_client_invitations_touch_updated_at ON public.client_invitations;
CREATE TRIGGER trg_client_invitations_touch_updated_at BEFORE UPDATE ON public.client_invitations
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_background_jobs_touch_updated_at ON public.background_jobs;
CREATE TRIGGER trg_background_jobs_touch_updated_at BEFORE UPDATE ON public.background_jobs
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DO $$
DECLARE
  t text;
  targets text[] := ARRAY[
    'accounts','contacts','leads','opportunities','activities','products','quotes',
    'contract_templates','contracts','suppliers','inventory_items','inventory_transactions',
    'purchase_orders','production_orders','financial_records','document_templates','auto_documents'
  ];
BEGIN
  FOREACH t IN ARRAY targets LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_sync_scope_ids ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%I_sync_scope_ids BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.sync_scope_ids()', t, t);
  END LOOP;
END $$;

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX idx_organizations_slug ON public.organizations(slug);
CREATE INDEX idx_organizations_org_code ON public.organizations(org_code);
CREATE INDEX idx_memberships_user_org ON public.organization_memberships(user_id, organization_id);
CREATE INDEX idx_memberships_org_role ON public.organization_memberships(organization_id, role);
CREATE INDEX idx_memberships_org_state ON public.organization_memberships(organization_id, account_state);
CREATE INDEX idx_employee_invites_org_email ON public.employee_invitations(organization_id, invited_email, status);
CREATE INDEX idx_client_invites_org_email ON public.client_invitations(organization_id, invited_email, status);
CREATE INDEX idx_audit_logs_org_created_at ON public.audit_logs(organization_id, created_at DESC);
CREATE INDEX idx_background_jobs_queue ON public.background_jobs(status, available_at, priority, created_at);

CREATE OR REPLACE FUNCTION public.app_is_platform_super_admin(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_super_admins psa
    WHERE psa.user_id = p_user_id
      AND psa.is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.app_user_has_organization_access(
  p_organization_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    public.app_is_platform_super_admin(p_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.organization_memberships om
      WHERE om.user_id = p_user_id
        AND om.organization_id = p_organization_id
        AND om.is_active = true
        AND om.account_state IN ('active', 'pending_approval', 'pending_verification')
    );
$$;

-- =============================================================================
-- RLS
-- =============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_super_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.impersonation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.background_jobs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_esignatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_esignatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select ON public.profiles
FOR SELECT USING (auth.uid() = user_id OR public.app_is_platform_super_admin(auth.uid()));

CREATE POLICY organizations_select ON public.organizations
FOR SELECT USING (public.app_user_has_organization_access(id) OR public.app_is_platform_super_admin(auth.uid()));

CREATE POLICY memberships_select ON public.organization_memberships
FOR SELECT USING (
  auth.uid() = user_id
  OR public.app_is_platform_super_admin(auth.uid())
  OR public.app_user_has_organization_access(organization_id)
);

CREATE POLICY subs_select ON public.organization_subscriptions
FOR SELECT USING (
  public.app_is_platform_super_admin(auth.uid())
  OR public.app_user_has_organization_access(organization_id)
);

CREATE POLICY employee_roles_select ON public.employee_roles
FOR SELECT USING (
  public.app_is_platform_super_admin(auth.uid())
  OR public.app_user_has_organization_access(organization_id)
);

CREATE POLICY employee_invites_select ON public.employee_invitations
FOR SELECT USING (
  public.app_is_platform_super_admin(auth.uid())
  OR public.app_user_has_organization_access(organization_id)
);

CREATE POLICY employee_invites_mutate ON public.employee_invitations
FOR ALL USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = employee_invitations.organization_id
      AND om.is_active = true
      AND om.account_state = 'active'
      AND om.role IN ('owner', 'admin')
  )
)
WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = employee_invitations.organization_id
      AND om.is_active = true
      AND om.account_state = 'active'
      AND om.role IN ('owner', 'admin')
  )
);

CREATE POLICY client_invites_select ON public.client_invitations
FOR SELECT USING (
  public.app_is_platform_super_admin(auth.uid())
  OR public.app_user_has_organization_access(organization_id)
);

CREATE POLICY client_invites_mutate ON public.client_invitations
FOR ALL USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = client_invitations.organization_id
      AND om.is_active = true
      AND om.account_state = 'active'
      AND om.role IN ('owner', 'admin')
  )
)
WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = client_invitations.organization_id
      AND om.is_active = true
      AND om.account_state = 'active'
      AND om.role IN ('owner', 'admin')
  )
);

CREATE POLICY audit_logs_select ON public.audit_logs
FOR SELECT USING (
  public.app_is_platform_super_admin(auth.uid())
  OR (organization_id IS NOT NULL AND public.app_user_has_organization_access(organization_id))
);

CREATE POLICY audit_logs_insert ON public.audit_logs
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY impersonation_sessions_policy ON public.impersonation_sessions
FOR ALL USING (public.app_is_platform_super_admin(auth.uid()))
WITH CHECK (public.app_is_platform_super_admin(auth.uid()));

CREATE POLICY background_jobs_policy ON public.background_jobs
FOR ALL USING (
  public.app_is_platform_super_admin(auth.uid())
  OR public.app_user_has_organization_access(organization_id)
)
WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR public.app_user_has_organization_access(organization_id)
);

DO $$
DECLARE
  t text;
  targets text[] := ARRAY[
    'accounts','contacts','leads','opportunities','activities','products','quotes',
    'contract_templates','contracts','suppliers','inventory_items','inventory_transactions',
    'purchase_orders','production_orders','financial_records','document_templates','auto_documents'
  ];
BEGIN
  FOREACH t IN ARRAY targets LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_org_scope_select ON public.%I', t, t);
    EXECUTE format('CREATE POLICY %I_org_scope_select ON public.%I FOR SELECT USING (public.app_is_platform_super_admin(auth.uid()) OR public.app_user_has_organization_access(COALESCE(organization_id, tenant_id)))', t, t);

    EXECUTE format('DROP POLICY IF EXISTS %I_org_scope_mutate ON public.%I', t, t);
    EXECUTE format('CREATE POLICY %I_org_scope_mutate ON public.%I FOR ALL USING (public.app_is_platform_super_admin(auth.uid()) OR public.app_user_has_organization_access(COALESCE(organization_id, tenant_id))) WITH CHECK (public.app_is_platform_super_admin(auth.uid()) OR public.app_user_has_organization_access(COALESCE(organization_id, tenant_id)))', t, t);
  END LOOP;
END $$;

CREATE POLICY quote_line_items_scope ON public.quote_line_items
FOR ALL USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.quotes q
    WHERE q.id = quote_line_items.quote_id
      AND public.app_user_has_organization_access(COALESCE(q.organization_id, q.tenant_id))
  )
)
WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.quotes q
    WHERE q.id = quote_line_items.quote_id
      AND public.app_user_has_organization_access(COALESCE(q.organization_id, q.tenant_id))
  )
);

CREATE POLICY contract_versions_scope ON public.contract_versions
FOR ALL USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = contract_versions.contract_id
      AND public.app_user_has_organization_access(COALESCE(c.organization_id, c.tenant_id))
  )
)
WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = contract_versions.contract_id
      AND public.app_user_has_organization_access(COALESCE(c.organization_id, c.tenant_id))
  )
);

CREATE POLICY contract_esignatures_scope ON public.contract_esignatures
FOR ALL USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = contract_esignatures.contract_id
      AND public.app_user_has_organization_access(COALESCE(c.organization_id, c.tenant_id))
  )
)
WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = contract_esignatures.contract_id
      AND public.app_user_has_organization_access(COALESCE(c.organization_id, c.tenant_id))
  )
);

CREATE POLICY contract_scans_scope ON public.contract_scans
FOR ALL USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = contract_scans.contract_id
      AND public.app_user_has_organization_access(COALESCE(c.organization_id, c.tenant_id))
  )
)
WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = contract_scans.contract_id
      AND public.app_user_has_organization_access(COALESCE(c.organization_id, c.tenant_id))
  )
);

CREATE POLICY purchase_order_items_scope ON public.purchase_order_items
FOR ALL USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.purchase_orders po
    WHERE po.id = purchase_order_items.purchase_order_id
      AND public.app_user_has_organization_access(COALESCE(po.organization_id, po.tenant_id))
  )
)
WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.purchase_orders po
    WHERE po.id = purchase_order_items.purchase_order_id
      AND public.app_user_has_organization_access(COALESCE(po.organization_id, po.tenant_id))
  )
);

CREATE POLICY production_order_items_scope ON public.production_order_items
FOR ALL USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.production_orders po
    WHERE po.id = production_order_items.production_order_id
      AND public.app_user_has_organization_access(COALESCE(po.organization_id, po.tenant_id))
  )
)
WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.production_orders po
    WHERE po.id = production_order_items.production_order_id
      AND public.app_user_has_organization_access(COALESCE(po.organization_id, po.tenant_id))
  )
);

CREATE POLICY document_versions_scope ON public.document_versions
FOR ALL USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.auto_documents d
    WHERE d.id = document_versions.document_id
      AND public.app_user_has_organization_access(COALESCE(d.organization_id, d.tenant_id))
  )
)
WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.auto_documents d
    WHERE d.id = document_versions.document_id
      AND public.app_user_has_organization_access(COALESCE(d.organization_id, d.tenant_id))
  )
);

CREATE POLICY document_signatures_scope ON public.document_signatures
FOR ALL USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.auto_documents d
    WHERE d.id = document_signatures.document_id
      AND public.app_user_has_organization_access(COALESCE(d.organization_id, d.tenant_id))
  )
)
WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.auto_documents d
    WHERE d.id = document_signatures.document_id
      AND public.app_user_has_organization_access(COALESCE(d.organization_id, d.tenant_id))
  )
);

CREATE POLICY document_permissions_scope ON public.document_permissions
FOR ALL USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.auto_documents d
    WHERE d.id = document_permissions.document_id
      AND public.app_user_has_organization_access(COALESCE(d.organization_id, d.tenant_id))
  )
)
WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.auto_documents d
    WHERE d.id = document_permissions.document_id
      AND public.app_user_has_organization_access(COALESCE(d.organization_id, d.tenant_id))
  )
);

CREATE POLICY document_esignatures_scope ON public.document_esignatures
FOR ALL USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.auto_documents d
    WHERE d.id = document_esignatures.document_id
      AND public.app_user_has_organization_access(COALESCE(d.organization_id, d.tenant_id))
  )
)
WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.auto_documents d
    WHERE d.id = document_esignatures.document_id
      AND public.app_user_has_organization_access(COALESCE(d.organization_id, d.tenant_id))
  )
);

-- =============================================================================
-- RPC HELPERS
-- =============================================================================

CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_role text;
BEGIN
  IF public.app_is_platform_super_admin(auth.uid()) THEN
    RETURN 'platform_super_admin';
  END IF;

  SELECT
    CASE
      WHEN om.account_state = 'pending_approval' THEN 'pending_approval'
      WHEN om.account_state = 'rejected' THEN 'rejected'
      ELSE om.role::text
    END
  INTO v_role
  FROM public.organization_memberships om
  WHERE om.user_id = auth.uid()
    AND om.is_active = true
  ORDER BY
    CASE om.role
      WHEN 'owner' THEN 1
      WHEN 'admin' THEN 2
      WHEN 'manager' THEN 3
      WHEN 'employee' THEN 4
      WHEN 'client' THEN 5
      ELSE 6
    END
  LIMIT 1;

  RETURN COALESCE(v_role, 'none');
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_organization_role(p_organization_id uuid)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT om.role::text
  FROM public.organization_memberships om
  WHERE om.user_id = auth.uid()
    AND om.organization_id = p_organization_id
    AND om.is_active = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.enqueue_background_job(
  p_organization_id uuid,
  p_job_type text,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_priority integer DEFAULT 100,
  p_available_at timestamptz DEFAULT NOW(),
  p_max_attempts integer DEFAULT 5
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job_id uuid;
BEGIN
  INSERT INTO public.background_jobs (
    organization_id,
    tenant_id,
    job_type,
    payload,
    priority,
    available_at,
    max_attempts,
    created_by
  ) VALUES (
    p_organization_id,
    p_organization_id,
    p_job_type,
    COALESCE(p_payload, '{}'::jsonb),
    COALESCE(p_priority, 100),
    COALESCE(p_available_at, NOW()),
    COALESCE(p_max_attempts, 5),
    auth.uid()
  )
  RETURNING id INTO v_job_id;

  RETURN v_job_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.enqueue_background_job(uuid, text, jsonb, integer, timestamptz, integer) TO authenticated;

-- =============================================================================
-- LEGACY COMPATIBILITY VIEWS (TEMPORARY BRIDGE)
-- =============================================================================

CREATE VIEW public.platform_admins AS
SELECT
  id,
  user_id,
  email,
  first_name,
  last_name,
  'platform_admin'::text AS role,
  is_active,
  created_at,
  updated_at
FROM public.platform_super_admins;

CREATE VIEW public.tenants AS
SELECT
  id,
  name,
  slug,
  status,
  plan_type,
  name AS company_name,
  company_email,
  company_phone,
  company_address,
  company_website,
  logo_url,
  primary_color,
  subscription_start_date,
  subscription_end_date,
  max_users,
  max_storage_mb,
  created_at,
  updated_at
FROM public.organizations;

CREATE VIEW public.tenant_subscriptions AS
SELECT
  id,
  organization_id AS tenant_id,
  plan_type,
  status,
  module_crm,
  module_clm,
  module_cpq,
  module_erp,
  module_documents,
  billing_email,
  billing_contact_name,
  features,
  trial_start_date,
  trial_end_date,
  created_at,
  updated_at
FROM public.organization_subscriptions;

CREATE VIEW public.tenant_users AS
SELECT
  om.id,
  om.organization_id AS tenant_id,
  om.user_id,
  om.email,
  p.first_name,
  p.last_name,
  CASE
    WHEN om.role = 'employee' THEN 'user'
    ELSE om.role::text
  END AS role,
  om.department,
  NULL::text AS job_title,
  NULL::text AS phone,
  p.avatar_url,
  om.is_active,
  CASE
    WHEN om.account_state = 'pending_approval' THEN false
    ELSE true
  END AS is_approved,
  om.is_email_verified AS email_verified,
  false AS can_create_users,
  false AS can_manage_billing,
  false AS can_export_data,
  om.last_login_at,
  om.login_count,
  om.created_at,
  om.updated_at
FROM public.organization_memberships om
LEFT JOIN public.profiles p ON p.user_id = om.user_id;

CREATE VIEW public.tenant_invitations AS
SELECT
  ei.id,
  ei.organization_id AS tenant_id,
  ei.invited_email AS email,
  CASE
    WHEN ei.role = 'employee' THEN 'user'
    ELSE ei.role::text
  END AS role,
  NULL::text AS department,
  ei.invited_by_user_id,
  ei.token_hash AS invitation_token,
  ei.status::text AS status,
  ei.message,
  ei.expires_at,
  ei.accepted_at,
  ei.created_at
FROM public.employee_invitations ei;

CREATE VIEW public.user_roles AS
SELECT
  gen_random_uuid() AS id,
  om.user_id,
  CASE
    WHEN om.role = 'employee' THEN 'employee'
    ELSE om.role::text
  END AS role,
  false AS is_platform_admin,
  (om.account_state = 'active') AS approved,
  om.created_at,
  om.updated_at
FROM public.organization_memberships om
UNION ALL
SELECT
  gen_random_uuid() AS id,
  psa.user_id,
  'admin'::text AS role,
  true AS is_platform_admin,
  true AS approved,
  psa.created_at,
  psa.updated_at
FROM public.platform_super_admins psa;

CREATE VIEW public.signup_requests AS
SELECT
  om.id,
  om.user_id,
  om.email,
  p.first_name,
  p.last_name,
  CASE
    WHEN om.account_state = 'pending_approval' THEN 'pending'
    WHEN om.account_state = 'rejected' THEN 'rejected'
    WHEN om.account_state = 'active' THEN 'approved'
    ELSE om.account_state::text
  END AS status,
  om.created_at,
  om.updated_at
FROM public.organization_memberships om
LEFT JOIN public.profiles p ON p.user_id = om.user_id
WHERE om.role IN ('employee', 'client');

CREATE VIEW public.admin_pending_approvals AS
SELECT
  sr.id AS request_id,
  sr.user_id,
  sr.email,
  sr.first_name,
  sr.last_name,
  sr.created_at,
  sr.status
FROM public.signup_requests sr
WHERE sr.status = 'pending';

-- =============================================================================
-- BASE SEED (EMPTY SAFE)
-- =============================================================================

-- Intentionally does not insert auth.users records.
-- Seed memberships only after creating users in Supabase Auth dashboard or API.
