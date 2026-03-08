-- =============================================================================
-- V2 FOUNDATION
-- - Audit log hardening
-- - Soft-delete convention
-- - Impersonation session tracking
-- - Background jobs queue for async processing
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Helper Functions
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.app_is_platform_admin(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_admins pa
    WHERE pa.user_id = p_user_id
      AND pa.is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.app_user_has_tenant_access(p_tenant_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    public.app_is_platform_admin(p_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.tenant_users tu
      WHERE tu.user_id = p_user_id
        AND tu.tenant_id = p_tenant_id
        AND tu.is_active = true
    );
$$;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Audit Logs
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NULL REFERENCES public.tenants(id) ON DELETE SET NULL,
  user_id uuid NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  old_values jsonb NULL,
  new_values jsonb NULL,
  metadata jsonb NULL DEFAULT '{}'::jsonb,
  impersonated_by uuid NULL,
  ip_address text NULL,
  user_agent text NULL,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS metadata jsonb NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS impersonated_by uuid NULL,
  ADD COLUMN IF NOT EXISTS ip_address text NULL,
  ADD COLUMN IF NOT EXISTS user_agent text NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id_created_at
  ON public.audit_logs (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id_created_at
  ON public.audit_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
  ON public.audit_logs (entity_type, entity_id);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_logs_select_policy ON public.audit_logs;
CREATE POLICY audit_logs_select_policy ON public.audit_logs
FOR SELECT
USING (
  public.app_is_platform_admin(auth.uid())
  OR (tenant_id IS NOT NULL AND public.app_user_has_tenant_access(tenant_id))
);

DROP POLICY IF EXISTS audit_logs_insert_policy ON public.audit_logs;
CREATE POLICY audit_logs_insert_policy ON public.audit_logs
FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated'
  AND (
    user_id IS NULL
    OR user_id = auth.uid()
    OR public.app_is_platform_admin(auth.uid())
  )
);

-- ---------------------------------------------------------------------------
-- Impersonation Sessions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.impersonation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_admin_user_id uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tenant_slug text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT NOW(),
  ended_at timestamptz NULL,
  reason text NULL,
  metadata jsonb NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_admin_started_at
  ON public.impersonation_sessions (platform_admin_user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_tenant_started_at
  ON public.impersonation_sessions (tenant_id, started_at DESC);

ALTER TABLE public.impersonation_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS impersonation_sessions_policy ON public.impersonation_sessions;
CREATE POLICY impersonation_sessions_policy ON public.impersonation_sessions
FOR ALL
USING (public.app_is_platform_admin(auth.uid()))
WITH CHECK (public.app_is_platform_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- Background Jobs Queue
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.background_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  job_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'succeeded', 'failed', 'cancelled')),
  priority integer NOT NULL DEFAULT 100,
  available_at timestamptz NOT NULL DEFAULT NOW(),
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  last_error text NULL,
  locked_at timestamptz NULL,
  locked_by text NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  finished_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_background_jobs_queue
  ON public.background_jobs (status, available_at, priority, created_at);
CREATE INDEX IF NOT EXISTS idx_background_jobs_tenant_status
  ON public.background_jobs (tenant_id, status, created_at DESC);

DROP TRIGGER IF EXISTS trg_background_jobs_touch_updated_at ON public.background_jobs;
CREATE TRIGGER trg_background_jobs_touch_updated_at
BEFORE UPDATE ON public.background_jobs
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.background_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS background_jobs_select_policy ON public.background_jobs;
CREATE POLICY background_jobs_select_policy ON public.background_jobs
FOR SELECT
USING (
  public.app_is_platform_admin(auth.uid())
  OR public.app_user_has_tenant_access(tenant_id)
);

DROP POLICY IF EXISTS background_jobs_insert_policy ON public.background_jobs;
CREATE POLICY background_jobs_insert_policy ON public.background_jobs
FOR INSERT
WITH CHECK (
  public.app_is_platform_admin(auth.uid())
  OR public.app_user_has_tenant_access(tenant_id)
);

DROP POLICY IF EXISTS background_jobs_update_policy ON public.background_jobs;
CREATE POLICY background_jobs_update_policy ON public.background_jobs
FOR UPDATE
USING (
  public.app_is_platform_admin(auth.uid())
  OR public.app_user_has_tenant_access(tenant_id)
)
WITH CHECK (
  public.app_is_platform_admin(auth.uid())
  OR public.app_user_has_tenant_access(tenant_id)
);

CREATE OR REPLACE FUNCTION public.enqueue_background_job(
  p_tenant_id uuid,
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
    tenant_id,
    job_type,
    payload,
    priority,
    available_at,
    max_attempts,
    created_by
  ) VALUES (
    p_tenant_id,
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

-- ---------------------------------------------------------------------------
-- Soft-delete Convention
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  t text;
  targets text[] := ARRAY[
    'accounts',
    'contacts',
    'leads',
    'opportunities',
    'activities',
    'products',
    'quotes',
    'quote_items',
    'quote_line_items',
    'contract_templates',
    'contracts',
    'contract_versions',
    'contract_esignatures',
    'contract_scans',
    'suppliers',
    'inventory_items',
    'inventory_transactions',
    'purchase_orders',
    'purchase_order_items',
    'production_orders',
    'production_order_items',
    'financial_records',
    'document_templates',
    'auto_documents',
    'document_versions',
    'document_esignatures',
    'document_signatures'
  ];
BEGIN
  FOREACH t IN ARRAY targets LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = t
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL', t);
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS deleted_by uuid NULL', t);
    END IF;
  END LOOP;
END $$;

