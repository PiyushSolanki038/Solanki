import { useContext } from "react";
import { TenantContext } from "@/core/tenant/tenant-context";
import type { ModuleType } from "@/core/types/tenant";

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) {
    throw new Error("useTenant must be used inside TenantProvider");
  }
  return ctx;
}

export function useModuleAccess(module: ModuleType) {
  const { hasModule, subscription, tenant } = useTenant();

  return {
    hasAccess: hasModule(module),
    isEnabled: subscription ? hasModule(module) : false,
    isLoading: !subscription && !tenant,
    module,
  };
}
