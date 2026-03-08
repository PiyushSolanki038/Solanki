import { Calculator, Package, FileText, DollarSign, TrendingUp, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/shadcn/card";
import { Button } from "@/ui/shadcn/button";
import { useQuotes, useProducts } from "@/modules/cpq/hooks/useCPQ";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Link } from "react-router-dom";
import { StatsCard } from "@/modules/crm/components/StatsCard";

const COLORS = ["hsl(250, 85%, 60%)", "hsl(199, 89%, 48%)", "hsl(45, 93%, 47%)", "hsl(25, 95%, 53%)", "hsl(142, 71%, 45%)", "hsl(0, 72%, 50%)"];

export default function CPQDashboard() {
  const { data: quotes } = useQuotes();
  const { data: products } = useProducts();

  // Calculate stats
  const stats = {
    totalProducts: products?.length || 0,
    totalQuotes: quotes?.length || 0,
    draftQuotes: quotes?.filter((q) => q.status === "draft").length || 0,
    approvedQuotes: quotes?.filter((q) => q.status === "approved" || q.status === "accepted").length || 0,
    pendingQuotes: quotes?.filter((q) => q.status === "pending_approval" || q.status === "sent").length || 0,
    totalValue: quotes?.reduce((sum, q) => sum + (q.total || 0), 0) || 0,
    approvalRate: quotes && quotes.length > 0 
      ? (((quotes.filter((q) => q.status === "approved" || q.status === "accepted").length) / quotes.length) * 100).toFixed(1)
      : "0",
    quotesByStatus: {
      draft: quotes?.filter((q) => q.status === "draft").length || 0,
      pending: quotes?.filter((q) => q.status === "pending_approval" || q.status === "sent").length || 0,
      approved: quotes?.filter((q) => q.status === "approved" || q.status === "accepted").length || 0,
      rejected: quotes?.filter((q) => q.status === "rejected").length || 0,
      expired: quotes?.filter((q) => q.status === "expired").length || 0,
    },
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(value);
  };

  const statusData = stats?.quotesByStatus
    ? Object.entries(stats.quotesByStatus).map(([status, count]) => ({
        name: status.charAt(0).toUpperCase() + status.slice(1),
        value: count,
      }))
    : [];

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
  
        {/* Title Section */}
        <div className="space-y-1">
          <h1 className="text-xl md:text-3xl font-semibold">
          CPQ Dashboard
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Configure, Price, Quote — manage products and quotes
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
            asChild
          > 
            <Link to="/dashboard/cpq/products">
              Manage Products
            </Link>
          </Button>

          <Button
            size="sm"
            className="w-full sm:w-auto"
            asChild
          >
            <Link to="/dashboard/cpq/quotes/new">
              Create Quote
            </Link>
          </Button>
        </div>

      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Total Products" value={stats?.totalProducts || 0} icon={Package} />
        <StatsCard title="Total Quotes" value={stats?.totalQuotes || 0} icon={FileText} />
        <StatsCard title="Quote Value" value={formatCurrency(stats?.totalValue || 0)} icon={DollarSign} />
        <StatsCard title="Approval Rate" value={`${stats?.approvalRate || 0}%`} icon={TrendingUp} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Draft Quotes" value={stats?.draftQuotes || 0} icon={Clock} />
        <StatsCard title="Pending Approval" value={stats?.pendingQuotes || 0} icon={AlertCircle} />
        <StatsCard title="Approved Quotes" value={stats?.approvedQuotes || 0} icon={CheckCircle2} />
        <StatsCard title="Avg Quote Size" value={formatCurrency((stats?.totalValue || 0) / Math.max(stats?.totalQuotes || 1, 1))} icon={Calculator} />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quotes by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {statusData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quote Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                  <Bar dataKey="value" fill="hsl(250, 85%, 60%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" asChild>
              <Link to="/dashboard/cpq/quotes/new">
                <Calculator className="h-6 w-6" />
                <span>New Quote</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" asChild>
              <Link to="/dashboard/cpq/products">
                <Package className="h-6 w-6" />
                <span>Products</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" asChild>
              <Link to="/dashboard/cpq/quotes">
                <FileText className="h-6 w-6" />
                <span>All Quotes</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" asChild>
              <Link to="/dashboard/cpq/pricing">
                <DollarSign className="h-6 w-6" />
                <span>Pricing Rules</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}