import { Link } from "react-router-dom";
import { Button } from "@/ui/shadcn/button";
import { ShieldAlert, Home, ArrowLeft } from "lucide-react";
import { useAuth } from "@/core/auth/useAuth";
import { useTenant } from "@/core/tenant/useTenant";
import { useOrganization } from "@/workspaces/organization/hooks/useOrganization";
import { organizationOwnerPath, platformPath, tenantDashboardPath, tenantPortalPath } from "@/core/utils/routes";
import { isPlatformRole } from "@/core/types/roles";

const Unauthorized = () => {
  const { role } = useAuth();
  const { tenant } = useTenant();
  const { organization } = useOrganization();

  const workspaceSlug = organization?.slug ?? tenant?.slug;

  const homeLink =
    isPlatformRole(role)
      ? platformPath()
      : role === "owner"
        ? organizationOwnerPath()
        : role === "admin" || role === "manager" || role === "employee" || role === "user"
          ? workspaceSlug
            ? tenantDashboardPath(workspaceSlug)
            : "/"
          : role === "client"
            ? workspaceSlug
              ? tenantPortalPath(workspaceSlug)
              : "/"
          : "/";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-destructive/10 flex items-center justify-center">
            <ShieldAlert className="w-10 h-10 text-destructive" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Access Denied</h1>
          <p className="text-muted-foreground">
            You don't have permission to access this page. Please contact your administrator if you believe this is an error.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button variant="outline" asChild>
            <Link to={homeLink}>
              <Home className="w-4 h-4 mr-2" />
              Go to Home
            </Link>
          </Button>
          <Button variant="hero" asChild>
            <Link to={homeLink}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Unauthorized;
