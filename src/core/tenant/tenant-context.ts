import { createContext } from "react";
import type { ModuleType, Tenant, TenantSubscription } from "@/core/types/tenant";

export interface TenantMembership {
  id: string;
  tenant_id: string;
  user_id: string;
  role: string;
  department?: string | null;
  is_active: boolean;
  is_approved: boolean;
  tenant?: Tenant | null;
}

export interface TenantContextType {
  tenant: Tenant | null;
  tenantLoading: boolean;
  activeTenantSlug: string | null;
  subscription: TenantSubscription | null;
  memberships: TenantMembership[];
  hasModule: (module: ModuleType) => boolean;
  enabledModules: ModuleType[];
  switchTenant: (tenantId: string) => Promise<void>;
  switchTenantBySlug: (tenantSlug: string) => Promise<void>;
  refreshTenant: () => Promise<void>;
}

export const TenantContext = createContext<TenantContextType | undefined>(undefined);
