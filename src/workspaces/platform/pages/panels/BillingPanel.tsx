import { useEffect, useMemo, useState } from "react";
import { CreditCard, PackageCheck } from "lucide-react";
import { supabase } from "@/core/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/shadcn/card";
import { Badge } from "@/ui/shadcn/badge";

interface SubscriptionTenantRef {
  name?: string;
  slug?: string;
  plan_type?: string;
}

interface SubscriptionRow {
  id: string;
  status: "active" | "suspended" | "cancelled";
  module_crm: boolean;
  module_clm: boolean;
  module_cpq: boolean;
  module_erp: boolean;
  module_documents: boolean;
  updated_at: string;
  tenant?: SubscriptionTenantRef | null;
}

function countEnabledModules(subscription: SubscriptionRow): number {
  return [
    subscription.module_crm,
    subscription.module_clm,
    subscription.module_cpq,
    subscription.module_erp,
    subscription.module_documents,
  ].filter(Boolean).length;
}

export default function BillingPanel() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<SubscriptionRow[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("tenant_subscriptions")
        .select(
          "id,status,module_crm,module_clm,module_cpq,module_erp,module_documents,updated_at,tenant:tenants(name,slug,plan_type)",
        )
        .order("updated_at", { ascending: false });

      if (error) {
        setRows([]);
        setLoading(false);
        return;
      }

      setRows((data as SubscriptionRow[] | null) ?? []);
      setLoading(false);
    };

    void load();
  }, []);

  const stats = useMemo(
    () => ({
      total: rows.length,
      active: rows.filter((item) => item.status === "active").length,
      suspended: rows.filter((item) => item.status === "suspended").length,
      enterprise: rows.filter((item) => (item.tenant?.plan_type ?? "").toLowerCase() === "enterprise").length,
    }),
    [rows],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">Billing & Subscriptions</h1>
        <p className="text-sm text-muted-foreground">
          Subscription status, module access, and plan coverage across all tenants.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Subscriptions</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{stats.total}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Active</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{stats.active}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Suspended</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{stats.suspended}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Enterprise Plans</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{stats.enterprise}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Plan Matrix</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-6 text-sm text-muted-foreground">Loading subscriptions...</p>
          ) : rows.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">No subscriptions found.</p>
          ) : (
            <div className="space-y-3">
              {rows.map((row) => (
                <div
                  key={row.id}
                  className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="space-y-1">
                    <p className="font-medium">{row.tenant?.name ?? "Unknown tenant"}</p>
                    <p className="text-xs text-muted-foreground">
                      /{row.tenant?.slug ?? "-"} · Plan {(row.tenant?.plan_type ?? "unknown").toUpperCase()} · Updated{" "}
                      {new Date(row.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      <PackageCheck className="mr-1 h-3 w-3" />
                      {countEnabledModules(row)} modules
                    </Badge>
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${
                        row.status === "active"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                          : row.status === "suspended"
                            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                            : "bg-zinc-100 text-zinc-700 dark:bg-zinc-900/30 dark:text-zinc-300"
                      }`}
                    >
                      {row.status}
                    </span>
                    <Badge variant="outline">
                      <CreditCard className="mr-1 h-3 w-3" />
                      plan
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
