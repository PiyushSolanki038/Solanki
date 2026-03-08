import { useState } from "react";
import { FileText, Plus, Search, Eye, Edit, Trash2, Send, CheckCircle, XCircle, Clock, PenTool, Upload } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/ui/shadcn/card";
import { Button } from "@/ui/shadcn/button";
import { Input } from "@/ui/shadcn/input";
import { Badge } from "@/ui/shadcn/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/core/api/client";
import { useAuth } from "@/core/auth/useAuth";
import { Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/shadcn/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/ui/shadcn/dropdown-menu";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: LucideIcon }> = {
  draft: { label: "Draft", color: "bg-muted text-muted-foreground", icon: Clock },
  pending_review: { label: "Pending Review", color: "bg-warning/20 text-warning-foreground", icon: Clock },
  pending_approval: { label: "Pending Approval", color: "bg-warning/20 text-warning-foreground", icon: Clock },
  approved: { label: "Approved", color: "bg-info/20 text-info-foreground", icon: CheckCircle },
  sent: { label: "Sent for Signature", color: "bg-primary/20 text-primary", icon: Send },
  signed: { label: "Signed", color: "bg-success/20 text-success-foreground", icon: PenTool },
  expired: { label: "Expired", color: "bg-destructive/20 text-destructive", icon: XCircle },
  cancelled: { label: "Cancelled", color: "bg-muted text-muted-foreground", icon: XCircle },
};

export default function ContractsListPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: contracts, isLoading } = useQuery({
    queryKey: ["contracts-list", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user?.id) throw new Error("User not authenticated");
      const { data, error } = await supabase
        .from("contracts")
        .select("*, accounts(name), contacts(first_name, last_name), quotes(quote_number)")
        .or(`owner_id.eq.${user.id},created_by.eq.${user.id}`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: { status: string; signed_date?: string } = { status };
      if (status === "signed") {
        updates.signed_date = new Date().toISOString();
      }
      const { error } = await supabase.from("contracts").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts-list"] });
      toast.success("Contract status updated");
    },
    onError: (error) => toast.error("Failed to update: " + error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contracts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts-list"] });
      toast.success("Contract deleted");
    },
    onError: (error) => toast.error("Failed to delete: " + error.message),
  });

  const filteredContracts = contracts?.filter((contract) => {
    const matchesSearch =
      contract.contract_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contract.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contract.accounts?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = !selectedStatus || contract.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(value);
  };

  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Contracts</h1>
            <p className="text-muted-foreground">Manage contract lifecycle from creation to signature</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/dashboard/clm/scan"><Upload className="h-4 w-4 mr-2" />Scan Contract</Link>
            </Button>
            <Button asChild>
              <Link to="/dashboard/clm/contracts/new"><Plus className="h-4 w-4 mr-2" />Create Contract</Link>
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search contracts..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant={selectedStatus === null ? "default" : "outline"} size="sm" onClick={() => setSelectedStatus(null)}>All</Button>
            {["draft", "pending_review", "approved", "sent", "signed", "expired"].map((status) => {
              const config = STATUS_CONFIG[status];
              return (
                <Button key={status} variant={selectedStatus === status ? "default" : "outline"} size="sm" onClick={() => setSelectedStatus(status)}>
                  {config.label}
                </Button>
              );
            })}
          </div>
        </div>

        {/* Contracts Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contract #</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={8} className="h-16 animate-pulse bg-muted/20" />
                    </TableRow>
                  ))
                ) : filteredContracts?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12">
                      <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No contracts found</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredContracts?.map((contract) => {
                    const statusConfig = STATUS_CONFIG[contract.status] || STATUS_CONFIG.draft;
                    const StatusIcon = statusConfig.icon;
                    return (
                      <TableRow key={contract.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/dashboard/clm/contracts/${contract.id}`)}>
                        <TableCell className="font-medium">{contract.contract_number || "—"}</TableCell>
                        <TableCell>{contract.name}</TableCell>
                        <TableCell>{contract.accounts?.name || "—"}</TableCell>
                        <TableCell className="font-semibold">{formatCurrency(contract.value || 0)}</TableCell>
                        <TableCell>{contract.start_date ? format(new Date(contract.start_date), "MMM d, yyyy") : "—"}</TableCell>
                        <TableCell>{contract.end_date ? format(new Date(contract.end_date), "MMM d, yyyy") : "—"}</TableCell>
                        <TableCell>
                          <Badge className={statusConfig.color}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {statusConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">Actions</Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => navigate(`/dashboard/clm/contracts/${contract.id}`)}>
                                <Eye className="h-4 w-4 mr-2" />View
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigate(`/dashboard/clm/contracts/${contract.id}/edit`)}>
                                <Edit className="h-4 w-4 mr-2" />Edit
                              </DropdownMenuItem>
                              {contract.status === "approved" && (
                                <DropdownMenuItem onClick={() => navigate(`/dashboard/clm/contracts/${contract.id}/sign`)}>
                                  <PenTool className="h-4 w-4 mr-2" />Send for Signature
                                </DropdownMenuItem>
                              )}
                              {contract.status === "draft" && (
                                <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: contract.id, status: "pending_review" })}>
                                  <Send className="h-4 w-4 mr-2" />Submit for Review
                                </DropdownMenuItem>
                              )}
                              {contract.status === "pending_review" && (
                                <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: contract.id, status: "approved" })}>
                                  <CheckCircle className="h-4 w-4 mr-2" />Approve
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem className="text-destructive" onClick={() => deleteMutation.mutate(contract.id)}>
                                <Trash2 className="h-4 w-4 mr-2" />Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
  );
}
