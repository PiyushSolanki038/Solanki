import { useEffect, useMemo, useState } from "react";
import { Activity, Search } from "lucide-react";
import { supabase } from "@/core/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/shadcn/card";
import { Input } from "@/ui/shadcn/input";
import { Badge } from "@/ui/shadcn/badge";

interface TenantRef {
  name?: string;
  slug?: string;
}

interface AuditLogRow {
  id: string;
  created_at: string;
  action: string;
  entity_type: string;
  entity_id: string;
  user_id?: string | null;
  tenant?: TenantRef | null;
}

export default function AuditLogsPanel() {
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [logs, setLogs] = useState<AuditLogRow[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id,created_at,action,entity_type,entity_id,user_id,tenant:tenants(name,slug)")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) {
        setLogs([]);
        setLoading(false);
        return;
      }

      setLogs((data as AuditLogRow[] | null) ?? []);
      setLoading(false);
    };

    void load();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return logs;
    return logs.filter((log) => {
      const tenantName = log.tenant?.name?.toLowerCase() ?? "";
      const tenantSlug = log.tenant?.slug?.toLowerCase() ?? "";
      return (
        log.action.toLowerCase().includes(term) ||
        log.entity_type.toLowerCase().includes(term) ||
        log.entity_id.toLowerCase().includes(term) ||
        (log.user_id ?? "").toLowerCase().includes(term) ||
        tenantName.includes(term) ||
        tenantSlug.includes(term)
      );
    });
  }, [logs, search]);

  const stats = useMemo(
    () => ({
      total: logs.length,
      authEvents: logs.filter((log) => log.entity_type === "auth").length,
      impersonation: logs.filter((log) => log.entity_type === "impersonation").length,
    }),
    [logs],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">Audit Logs</h1>
        <p className="text-sm text-muted-foreground">
          Security and operational events across platform and tenant activities.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Events (Loaded)</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{stats.total}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Auth Events</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{stats.authEvents}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Impersonation Events</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{stats.impersonation}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="text-base">Event Stream</CardTitle>
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by action, entity, user, or tenant"
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-6 text-sm text-muted-foreground">Loading audit logs...</p>
          ) : filtered.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">No events found.</p>
          ) : (
            <div className="space-y-3">
              {filtered.map((log) => (
                <div
                  key={log.id}
                  className="flex flex-col gap-2 rounded-lg border p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-muted-foreground" />
                      <p className="font-medium">{log.action}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(log.created_at).toLocaleString()} · {log.entity_type}:{log.entity_id}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{log.tenant?.slug ?? "platform"}</Badge>
                    <Badge variant="outline">{log.user_id ?? "system"}</Badge>
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
