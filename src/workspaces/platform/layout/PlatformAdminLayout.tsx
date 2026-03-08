import { ReactNode, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Shield,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/ui/shadcn/button";
import { cn } from "@/core/utils/utils";
import { useAuth } from "@/core/auth/useAuth";
import { platformPath } from "@/core/utils/routes";
import { ImpersonationBanner } from "./ImpersonationBanner";

const menuItems = [
  { title: "Overview", icon: LayoutDashboard, path: platformPath() },
  { title: "Tenants", icon: Building2, path: platformPath("tenants") },
  { title: "Users", icon: Users, path: platformPath("users") },
  { title: "Audit Logs", icon: FileText, path: platformPath("audit-logs") },
  { title: "Billing", icon: CreditCard, path: platformPath("billing") },
  { title: "Settings", icon: Settings, path: platformPath("settings") },
];

interface PlatformAdminLayoutProps {
  children?: ReactNode;
}

function SidebarContent({
  collapsed,
  hideCollapseControl = false,
  onCollapseToggle,
  onSignOut,
}: {
  collapsed: boolean;
  hideCollapseControl?: boolean;
  onCollapseToggle: () => void;
  onSignOut: () => void;
}) {
  const linkBase = "flex items-center py-2.5 rounded-lg transition-colors mx-2";

  return (
    <>
      <div className="h-16 flex items-center justify-between px-4 border-b border-border">
        {!collapsed && (
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold">S</span>
            </div>
            <span className="font-bold text-foreground">
              SIS<span className="text-primary">WIT</span>
            </span>
          </Link>
        )}
        {collapsed && (
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center mx-auto">
            <span className="text-primary-foreground font-bold">S</span>
          </div>
        )}
      </div>

      {!collapsed && (
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 text-primary">
            <Shield className="w-4 h-4" />
            <span className="text-sm font-medium">Platform Admin</span>
          </div>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto py-4">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === platformPath()}
            className={({ isActive }) =>
              cn(
                linkBase,
                collapsed ? "justify-center px-2" : "gap-3 px-4",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
              )
            }
          >
            <div className="h-5 w-5 flex items-center justify-center flex-shrink-0">
              <item.icon className="h-5 w-5" />
            </div>
            {!collapsed && <span className="text-sm font-medium">{item.title}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-border p-2">
        {!hideCollapseControl && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onCollapseToggle}
            className={cn("w-full", collapsed ? "justify-center" : "justify-start")}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4 mr-2" />
                <span>Collapse</span>
              </>
            )}
          </Button>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={onSignOut}
          className={cn(
            "w-full mt-2 text-destructive hover:text-destructive",
            collapsed ? "justify-center" : "justify-start",
          )}
        >
          <LogOut className="w-4 h-4 mr-2" />
          {!collapsed && <span>Sign Out</span>}
        </Button>
      </div>
    </>
  );
}

export function PlatformAdminLayout({ children }: PlatformAdminLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth/sign-in", { replace: true });
  };

  return (
    <div className="flex h-screen bg-background">
      <aside
        className={cn(
          "hidden lg:flex h-screen bg-card border-r border-border flex-col transition-all duration-300",
          collapsed ? "w-16" : "w-64",
        )}
      >
        <SidebarContent
          collapsed={collapsed}
          onCollapseToggle={() => setCollapsed((current) => !current)}
          onSignOut={handleSignOut}
        />
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <ImpersonationBanner />
        <header className="h-16 border-b border-border bg-card px-4 md:px-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileMenuOpen(true)}>
              <Menu className="w-5 h-5" />
            </Button>
            <h1 className="text-lg font-semibold">Platform Administration</h1>
          </div>

          <span className="text-sm text-muted-foreground">SaaS Owner Console</span>
        </header>

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
          "fixed inset-y-0 left-0 z-50 w-72 bg-card border-r border-border flex flex-col transform transition-transform lg:hidden",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-end p-2 border-b border-border">
          <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(false)}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        <SidebarContent
          collapsed={false}
          hideCollapseControl
          onCollapseToggle={() => undefined}
          onSignOut={handleSignOut}
        />
      </aside>
    </div>
  );
}
