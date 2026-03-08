import { Link, NavLink, useParams } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Building2,
  UserCircle,
  Target,
  Calendar,
  FileText,
  FileSignature,
  Package,
  Settings,
  ChevronLeft,
  ChevronRight,
  FileStack,
  FilePlus,
  History,
  Send,
  Truck,
  BarChart3,
  DollarSign,
} from "lucide-react";
import { cn } from "@/core/utils/utils";
import { Button } from "@/ui/shadcn/button";
import { useEffect, useMemo, useState, type ComponentType } from "react";
import { tenantAppPath, tenantDashboardPath } from "@/core/utils/routes";

type SidebarLink = {
  title: string;
  icon: ComponentType<{ className?: string }>;
  path: string;
};

type SidebarSection =
  | {
      title: string;
      icon: ComponentType<{ className?: string }>;
      path: string;
      items?: undefined;
    }
  | {
      title: string;
      items: SidebarLink[];
      icon?: undefined;
      path?: undefined;
    };

const buildMenuItems = (tenantSlug: string): SidebarSection[] => [
  {
    title: "Dashboard",
    icon: LayoutDashboard,
    path: tenantDashboardPath(tenantSlug),
  },
  {
    title: "CRM",
    items: [
      { title: "Dashboard", icon: LayoutDashboard, path: tenantAppPath(tenantSlug, "crm") },
      { title: "Leads", icon: Users, path: tenantAppPath(tenantSlug, "crm/leads") },
      { title: "Accounts", icon: Building2, path: tenantAppPath(tenantSlug, "crm/accounts") },
      { title: "Contacts", icon: UserCircle, path: tenantAppPath(tenantSlug, "crm/contacts") },
      { title: "Opportunities", icon: Target, path: tenantAppPath(tenantSlug, "crm/opportunities") },
      { title: "Pipeline", icon: Target, path: tenantAppPath(tenantSlug, "crm/pipeline") },
      { title: "Activities", icon: Calendar, path: tenantAppPath(tenantSlug, "crm/activities") },
    ],
  },
  {
    title: "CPQ",
    items: [
      { title: "Dashboard", icon: LayoutDashboard, path: tenantAppPath(tenantSlug, "cpq") },
      { title: "Products", icon: Package, path: tenantAppPath(tenantSlug, "cpq/products") },
      { title: "Quotes", icon: FileText, path: tenantAppPath(tenantSlug, "cpq/quotes") },
    ],
  },
  {
    title: "CLM",
    items: [
      { title: "Dashboard", icon: LayoutDashboard, path: tenantAppPath(tenantSlug, "clm") },
      { title: "Contracts", icon: FileSignature, path: tenantAppPath(tenantSlug, "clm/contracts") },
      { title: "Templates", icon: FileText, path: tenantAppPath(tenantSlug, "clm/templates") },
    ],
  },
  {
    title: "Documents",
    items: [
      { title: "All Documents", icon: FileStack, path: tenantAppPath(tenantSlug, "documents") },
      { title: "Create Document", icon: FilePlus, path: tenantAppPath(tenantSlug, "documents/create") },
      { title: "Templates", icon: FileText, path: tenantAppPath(tenantSlug, "documents/templates") },
      { title: "History", icon: History, path: tenantAppPath(tenantSlug, "documents/history") },
      { title: "Pending Signatures", icon: Send, path: tenantAppPath(tenantSlug, "documents/pending") },
    ],
  },
  {
    title: "ERP",
    items: [
      { title: "Dashboard", icon: LayoutDashboard, path: tenantAppPath(tenantSlug, "erp") },
      { title: "Inventory", icon: Package, path: tenantAppPath(tenantSlug, "erp/inventory") },
      { title: "Procurement", icon: Truck, path: tenantAppPath(tenantSlug, "erp/procurement") },
      { title: "Production", icon: BarChart3, path: tenantAppPath(tenantSlug, "erp/production") },
      { title: "Finance", icon: DollarSign, path: tenantAppPath(tenantSlug, "erp/finance") },
    ],
  },
];

export function DashboardSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { tenantSlug = "" } = useParams<{ tenantSlug: string }>();
  const menuItems = useMemo(() => buildMenuItems(tenantSlug), [tenantSlug]);
  const settingsPath = tenantAppPath(tenantSlug, "settings");

  useEffect(() => {
    const handleResize = () => {
      setCollapsed(window.innerWidth < 768);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const linkBase = "flex items-center py-2 rounded-lg transition-colors mx-2";

  return (
    <aside
      className={cn(
        "h-screen bg-card border-r border-border flex flex-col transition-all duration-300",
        collapsed ? "w-16" : "w-64",
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-border">
        {!collapsed && (
          <Link to={tenantDashboardPath(tenantSlug)}>
            <span className="text-xl font-bold text-foreground">
              SIS<span className="text-gradient">WIT</span>
            </span>
          </Link>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        {menuItems.map((section, idx) => (
          <div key={idx} className="mb-4">
            {"path" in section && section.path ? (
              <NavLink
                to={section.path}
                end
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
                {/* ICON WRAPPER (fix centering) */}
                <div className="h-5 w-5 flex items-center justify-center flex-shrink-0">
                  <section.icon className="h-5 w-5" />
                </div>

                {!collapsed && (
                  <span className="text-sm font-medium">{section.title}</span>
                )}
              </NavLink>
            ) : (
              <>
                {!collapsed && (
                  <h3 className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    {section.title}
                  </h3>
                )}

                <div className="space-y-1">
                  {section.items?.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end
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
                      {/* ICON WRAPPER (fix centering) */}
                      <div className="h-4 w-4 flex items-center justify-center flex-shrink-0">
                        <item.icon className="h-4 w-4" />
                      </div>

                      {!collapsed && (
                        <span className="text-sm">{item.title}</span>
                      )}
                    </NavLink>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </nav>

      {/* Settings */}
      <div className="border-t border-border p-2">
        <NavLink
          to={settingsPath}
          end
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
          <div className="h-4 w-4 flex items-center justify-center flex-shrink-0">
            <Settings className="h-4 w-4" />
          </div>

          {!collapsed && <span className="text-sm">Settings</span>}
        </NavLink>
      </div>
    </aside>
  );
}
