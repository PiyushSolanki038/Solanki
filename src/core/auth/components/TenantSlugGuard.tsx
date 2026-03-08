import { ReactNode, useEffect, useMemo, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/core/auth/useAuth";
import { useTenant } from "@/core/tenant/useTenant";
import { useImpersonation } from "@/core/hooks/useImpersonation";
import { supabase } from "@/core/api/client";
import { isPlatformRole } from "@/core/types/roles";

interface TenantSlugGuardProps {
  children: ReactNode;
}

export function TenantSlugGuard({ children }: TenantSlugGuardProps) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { user, role, loading } = useAuth();
  const { tenant, tenantLoading, memberships, switchTenantBySlug } = useTenant();
  const { state: impersonation, startImpersonation } = useImpersonation();
  const [resolving, setResolving] = useState(false);

  const hasMembership = useMemo(() => {
    if (!tenantSlug) return false;
    return memberships.some((m) => m.tenant?.slug === tenantSlug);
  }, [memberships, tenantSlug]);

  useEffect(() => {
    if (!tenantSlug || loading || tenantLoading || !user) return;

    if (isPlatformRole(role)) {
      if (impersonation.tenantSlug !== tenantSlug) {
        const membershipTenant = memberships.find((m) => m.tenant?.slug === tenantSlug)?.tenant;
        if (membershipTenant?.id) {
          void startImpersonation({
            tenantId: membershipTenant.id,
            tenantSlug,
            reason: "Route scope switch",
          });
          return;
        }

        void (async () => {
          const tenantResult = await supabase
            .from("tenants")
            .select("id,slug")
            .eq("slug", tenantSlug)
            .maybeSingle();

          if (tenantResult.data?.id) {
            await startImpersonation({
              tenantId: tenantResult.data.id,
              tenantSlug: tenantResult.data.slug,
              reason: "Platform admin tenant preview",
            });
          }
        })();
      }
      return;
    }

    if (tenant?.slug === tenantSlug) return;
    if (!hasMembership) return;

    setResolving(true);
    void switchTenantBySlug(tenantSlug).finally(() => setResolving(false));
  }, [
    hasMembership,
    impersonation.tenantSlug,
    loading,
    memberships,
    role,
    startImpersonation,
    switchTenantBySlug,
    tenant?.slug,
    tenantLoading,
    tenantSlug,
    user,
  ]);

  if (loading || tenantLoading || resolving) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth/sign-in" replace />;
  }

  if (isPlatformRole(role)) {
    return <>{children}</>;
  }

  if (!tenantSlug || !hasMembership) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}
