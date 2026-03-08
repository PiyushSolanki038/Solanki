# Data Ownership Rules (V2)

## Principle
- `PLATFORM_ADMIN`: cross-tenant visibility with explicit tenant context.
- `TENANT_ADMIN`, `TENANT_MANAGER`, `TENANT_USER`, `CLIENT_USER`: tenant-scoped access only.

## Mandatory Rules
1. Every business record must carry `tenant_id`.
2. Read queries must scope by `tenant_id` unless actor is `PLATFORM_ADMIN`.
3. Write queries must stamp `tenant_id` and actor fields (`created_by`, `owner_id`) when applicable.
4. Soft-deleted rows (`deleted_at IS NOT NULL`) are excluded from normal reads.
5. Cross-tenant access is denied by default and granted only through explicit platform-admin policy.

## UI + API Contract
- Route scope `/:tenantSlug/app/...` determines active tenant context.
- Tenant context must be resolved before issuing module data queries.
- Platform impersonation is treated as audited elevated access.

## Audit Requirements
- Log create/update/delete/restore actions with actor, tenant, entity, and before/after payloads.
- Log impersonation start/stop events.

