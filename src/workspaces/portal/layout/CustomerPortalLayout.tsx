import { ReactNode, useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { CustomerSidebar } from "./CustomerSidebar";
import { CustomerHeader } from "./CustomerHeader";
import { useAuth } from "@/core/auth/useAuth";
import { Button } from "@/ui/shadcn/button";
import { cn } from "@/core/utils/utils";
import { ImpersonationBanner } from "@/workspaces/platform/layout/ImpersonationBanner";
import { isPlatformRole } from "@/core/types/roles";

interface CustomerPortalLayoutProps {
  children?: ReactNode;
}

export function CustomerPortalLayout({ children }: CustomerPortalLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { role } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isPlatformRole(role)) {
      navigate("/platform", { replace: true });
    }
  }, [role, navigate]);

  if (isPlatformRole(role)) {
    return null;
  }

  return (
    <div className="flex h-screen bg-background">
      <div className="hidden lg:block">
        <CustomerSidebar />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <ImpersonationBanner />
        <div className="lg:hidden border-b border-border px-4 py-2 bg-card">
          <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
        </div>
        <CustomerHeader />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children || <Outlet />}</main>
      </div>

      <div
        className={cn(
          "fixed inset-0 z-40 bg-background/70 backdrop-blur-sm transition-opacity lg:hidden",
          mobileMenuOpen ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        onClick={() => setMobileMenuOpen(false)}
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 transform transition-transform lg:hidden",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="h-full bg-card border-r border-border flex flex-col">
          <div className="flex items-center justify-end p-2 border-b border-border">
            <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          <CustomerSidebar />
        </div>
      </aside>
    </div>
  );
}
