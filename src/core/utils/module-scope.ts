import type { AppRole } from "@/core/types/roles";
import { canReadAllTenantRows, isOwnerScopedRole } from "@/core/types/roles";

export interface ModuleScopeContext {
  organizationId: string | null;
  // Compatibility alias during tenant->organization migration.
  tenantId?: string | null;
  userId: string | null;
  role: AppRole | null;
}

interface ScopedQuery<TQuery> {
  eq: (column: string, value: string) => TQuery;
  is: (column: string, value: null) => TQuery;
  or: (filters: string) => TQuery;
}

interface ReadScopeOptions {
  ownerColumns?: string[];
  includeSoftDeleted?: boolean;
}

interface CreatePayloadOptions {
  ownerColumn?: string | null;
  createdByColumn?: string | null;
}

function getScopeOrganizationId(scope: ModuleScopeContext): string | null {
  return scope.organizationId ?? scope.tenantId ?? null;
}

export function isModuleScopeReady(scope: ModuleScopeContext, organizationLoading: boolean): boolean {
  return Boolean(getScopeOrganizationId(scope) && scope.userId && scope.role && !organizationLoading);
}

export function requireOrganizationScope(scope: ModuleScopeContext): { organizationId: string; userId: string } {
  if (!scope.userId) {
    throw new Error("User not authenticated");
  }
  const organizationId = getScopeOrganizationId(scope);
  if (!organizationId) {
    throw new Error("Organization context is required");
  }
  return { organizationId, userId: scope.userId };
}

// Compatibility alias for existing tenant-scoped call sites.
export function requireTenantScope(scope: ModuleScopeContext): { tenantId: string; userId: string } {
  const { organizationId, userId } = requireOrganizationScope(scope);
  return { tenantId: organizationId, userId };
}

export function applyModuleReadScope<TQuery extends ScopedQuery<TQuery>>(
  query: TQuery,
  scope: ModuleScopeContext,
  options: ReadScopeOptions = {},
): TQuery {
  const { organizationId, userId } = requireOrganizationScope(scope);
  const ownerColumns = options.ownerColumns ?? ["owner_id"];
  const includeSoftDeleted = options.includeSoftDeleted ?? false;

  let scoped = query.eq("organization_id", organizationId);
  if (!includeSoftDeleted) {
    scoped = scoped.is("deleted_at", null);
  }

  if (!canReadAllTenantRows(scope.role) && isOwnerScopedRole(scope.role) && ownerColumns.length > 0) {
    const ownerFilter = ownerColumns.map((column) => `${column}.eq.${userId}`).join(",");
    if (ownerFilter) {
      scoped = scoped.or(ownerFilter);
    }
  }

  return scoped;
}

export function applyModuleMutationScope<TQuery extends ScopedQuery<TQuery>>(
  query: TQuery,
  scope: ModuleScopeContext,
  ownerColumns: string[] = ["owner_id"],
): TQuery {
  const { organizationId, userId } = requireOrganizationScope(scope);
  let scoped = query.eq("organization_id", organizationId);

  if (!canReadAllTenantRows(scope.role) && isOwnerScopedRole(scope.role) && ownerColumns.length > 0) {
    const ownerFilter = ownerColumns.map((column) => `${column}.eq.${userId}`).join(",");
    if (ownerFilter) {
      scoped = scoped.or(ownerFilter);
    }
  }

  return scoped;
}

export function buildModuleCreatePayload<TPayload extends Record<string, unknown>>(
  payload: TPayload,
  scope: ModuleScopeContext,
  options: CreatePayloadOptions = {},
): TPayload {
  const { organizationId, userId } = requireOrganizationScope(scope);
  const ownerColumn = options.ownerColumn === undefined ? "owner_id" : options.ownerColumn;
  const createdByColumn = options.createdByColumn;

  const nextPayload = {
    ...payload,
    organization_id: organizationId,
  } as TPayload;

  if (ownerColumn) {
    (nextPayload as Record<string, unknown>)[ownerColumn] = userId;
  }

  if (createdByColumn) {
    return {
      ...nextPayload,
      [createdByColumn]: userId,
    } as TPayload;
  }

  return nextPayload;
}
