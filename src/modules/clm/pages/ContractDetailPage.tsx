import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  Download,
  Edit,
  FileText,
  PenTool,
  Send,
  XCircle,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";

import { Badge } from "@/ui/shadcn/badge";
import { Button } from "@/ui/shadcn/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/shadcn/card";
import { Separator } from "@/ui/shadcn/separator";
import { useAuth } from "@/core/auth/useAuth";
import { supabase } from "@/core/api/client";
import type { Database } from "@/core/api/types";
import { tenantModulePath } from "@/core/utils/routes";

type ContractRow = Database["public"]["Tables"]["contracts"]["Row"];
type ContractStatus = ContractRow["status"] extends string ? ContractRow["status"] : string;

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-muted text-muted-foreground" },
  pending_review: { label: "Pending Review", className: "bg-warning/20 text-warning-foreground" },
  pending_approval: { label: "Pending Approval", className: "bg-warning/20 text-warning-foreground" },
  approved: { label: "Approved", className: "bg-info/20 text-info-foreground" },
  sent: { label: "Sent for Signature", className: "bg-primary/20 text-primary" },
  signed: { label: "Signed", className: "bg-success/20 text-success-foreground" },
  expired: { label: "Expired", className: "bg-destructive/20 text-destructive" },
  cancelled: { label: "Cancelled", className: "bg-muted text-muted-foreground" },
};

import { getErrorMessage } from "@/core/utils/error";

export default function ContractDetailPage() {
  const { id, tenantSlug } = useParams<{ id: string; tenantSlug: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const contractsRootPath = tenantSlug
    ? tenantModulePath(tenantSlug, "clm", "contracts")
    : "/dashboard/clm/contracts";

  const toTenantPath = (suffix = "") => {
    if (!tenantSlug) {
      return suffix ? `${contractsRootPath}/${suffix}` : contractsRootPath;
    }
    const normalized = suffix.replace(/^\/+/, "");
    return normalized
      ? tenantModulePath(tenantSlug, "clm", `contracts/${normalized}`)
      : tenantModulePath(tenantSlug, "clm", "contracts");
  };

  const { data: contract, isLoading, isError, error } = useQuery({
    queryKey: ["contract-detail", id, user?.id],
    enabled: Boolean(id && user?.id),
    queryFn: async () => {
      if (!id || !user?.id) throw new Error("User or contract context is missing");

      const { data, error: queryError } = await supabase
        .from("contracts")
        .select("*")
        .eq("id", id)
        .single();

      if (queryError) throw queryError;
      return data as ContractRow;
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (status: ContractStatus) => {
      if (!id) throw new Error("Missing contract id");
      const updates: Database["public"]["Tables"]["contracts"]["Update"] = {
        status,
        updated_at: new Date().toISOString(),
        ...(status === "signed" ? { signed_date: new Date().toISOString() } : {}),
      };

      const { error: updateError } = await supabase.from("contracts").update(updates).eq("id", id);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["contract-detail", id, user?.id] });
      void queryClient.invalidateQueries({ queryKey: ["contracts"] });
      toast.success("Contract status updated");
    },
    onError: (mutationError: unknown) => {
      toast.error(`Failed to update contract status: ${getErrorMessage(mutationError)}`);
    },
  });

  const status = contract?.status ?? "draft";
  const statusConfig = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;

  const formatCurrency = (value: number | null) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(value ?? 0);
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-1/3 rounded bg-muted" />
        <div className="h-64 rounded bg-muted" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-6 text-center">
        <h2 className="text-lg font-semibold">Failed to load contract</h2>
        <p className="mt-1 text-sm text-muted-foreground">{getErrorMessage(error)}</p>
        <div className="mt-4">
          <Button variant="outline" onClick={() => navigate(contractsRootPath)}>
            Back to contracts
          </Button>
        </div>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="py-12 text-center">
        <FileText className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Contract not found</h2>
        <Button variant="link" onClick={() => navigate(contractsRootPath)}>
          Go back to contracts
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold md:text-3xl">{contract.contract_number || contract.name}</h1>
              <Badge className={statusConfig.className}>{statusConfig.label}</Badge>
            </div>
            <p className="text-muted-foreground">
              Created on {contract.created_at ? format(new Date(contract.created_at), "MMMM d, yyyy") : "-"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {status === "draft" && (
            <>
              <Button variant="outline" onClick={() => navigate(toTenantPath(`${id}/edit`))}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
              <Button onClick={() => updateStatusMutation.mutate("pending_review")}> 
                <Send className="mr-2 h-4 w-4" />
                Submit for Review
              </Button>
            </>
          )}

          {status === "pending_review" && (
            <>
              <Button variant="outline" onClick={() => updateStatusMutation.mutate("draft")}>
                <XCircle className="mr-2 h-4 w-4" />
                Send Back
              </Button>
              <Button onClick={() => updateStatusMutation.mutate("approved")}>
                <CheckCircle className="mr-2 h-4 w-4" />
                Approve
              </Button>
            </>
          )}

          {status === "approved" && (
            <Button asChild>
              <Link to={toTenantPath(`${id}/sign`)}>
                <PenTool className="mr-2 h-4 w-4" />
                Send for Signature
              </Link>
            </Button>
          )}

          {status === "sent" && (
            <Button onClick={() => updateStatusMutation.mutate("signed")}>
              <CheckCircle className="mr-2 h-4 w-4" />
              Mark as Signed
            </Button>
          )}

          <Button variant="outline" disabled>
            <Download className="mr-2 h-4 w-4" />
            Export PDF
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>{contract.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Contract Number</span>
                <span className="font-medium">{contract.contract_number}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Value</span>
                <span className="font-medium">{formatCurrency(contract.value)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Start Date</span>
                <span>{contract.start_date ? format(new Date(contract.start_date), "MMM d, yyyy") : "-"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">End Date</span>
                <span>{contract.end_date ? format(new Date(contract.end_date), "MMM d, yyyy") : "-"}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contract Content</CardTitle>
            </CardHeader>
            <CardContent>
              {contract.content ? (
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <pre className="whitespace-pre-wrap font-sans text-sm">{contract.content}</pre>
                </div>
              ) : (
                <p className="py-8 text-center text-muted-foreground">No content available</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>Created: {contract.created_at ? format(new Date(contract.created_at), "PPp") : "-"}</span>
              </div>

              <Separator />

              <div className="space-y-2 text-sm">
                <p className="font-medium">Current Status</p>
                <Badge className={statusConfig.className}>{statusConfig.label}</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full" variant="outline" onClick={() => navigate(contractsRootPath)}>
                Back to list
              </Button>
              <Button className="w-full" variant="outline" onClick={() => navigate(toTenantPath(`${id}/edit`))}>
                Edit contract
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
