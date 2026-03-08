import { useEffect, useMemo, useState } from "react";
import { Search, UserCheck, UserX, Users } from "lucide-react";
import { supabase } from "@/core/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/shadcn/card";
import { Input } from "@/ui/shadcn/input";
import { Badge } from "@/ui/shadcn/badge";

interface TenantRef {
  name?: string;
  slug?: string;
}

interface TenantUserRow {
  id: string;
  user_id: string;
  email: string;
  role: string;
  is_active: boolean;
  is_approved: boolean;
  created_at: string;
  tenant?: TenantRef | null;
}

const roleLabel: Record<string, string> = {
  platform_admin: "Platform Admin",
  admin: "Tenant Admin",
  manager: "Manager",
  user: "User",
  client: "Client",
};

export default function UsersPanel() {
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<TenantUserRow[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("tenant_users")
        .select("id,user_id,email,role,is_active,is_approved,created_at,tenant:tenants(name,slug)")
        .order("created_at", { ascending: false });

      if (error) {
        setUsers([]);
        setLoading(false);
        return;
      }

      setUsers((data as TenantUserRow[] | null) ?? []);
      setLoading(false);
    };

    void load();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return users;
    return users.filter((item) => {
      const tenantName = item.tenant?.name?.toLowerCase() ?? "";
      const tenantSlug = item.tenant?.slug?.toLowerCase() ?? "";
      return (
        item.email.toLowerCase().includes(term) ||
        item.role.toLowerCase().includes(term) ||
        tenantName.includes(term) ||
        tenantSlug.includes(term)
      );
    });
  }, [search, users]);

  const stats = useMemo(
    () => ({
      total: users.length,
      active: users.filter((user) => user.is_active).length,
      approved: users.filter((user) => user.is_approved).length,
      pending: users.filter((user) => !user.is_approved).length,
    }),
    [users],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">User Management</h1>
        <p className="text-sm text-muted-foreground">Manage tenant-level members and approval lifecycle.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Members</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-2xl font-semibold">
            <Users className="h-5 w-5 text-muted-foreground" />
            {stats.total}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Active Members</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-2xl font-semibold">
            <UserCheck className="h-5 w-5 text-green-600" />
            {stats.active}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Approved</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{stats.approved}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Pending Approval</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-2xl font-semibold">
            <UserX className="h-5 w-5 text-amber-600" />
            {stats.pending}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="text-base">Directory</CardTitle>
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by email, role, or tenant"
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-6 text-sm text-muted-foreground">Loading users...</p>
          ) : filtered.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">No users found.</p>
          ) : (
            <div className="space-y-3">
              {filtered.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-2 rounded-lg border p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="space-y-1">
                    <p className="font-medium">{item.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.tenant?.name ?? "Unknown tenant"} ({item.tenant?.slug ?? "-"}) · Joined{" "}
                      {new Date(item.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{roleLabel[item.role] ?? item.role}</Badge>
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${
                        item.is_approved
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                      }`}
                    >
                      {item.is_approved ? "approved" : "pending"}
                    </span>
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${
                        item.is_active
                          ? "bg-primary/10 text-primary"
                          : "bg-zinc-100 text-zinc-700 dark:bg-zinc-900/30 dark:text-zinc-300"
                      }`}
                    >
                      {item.is_active ? "active" : "inactive"}
                    </span>
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
