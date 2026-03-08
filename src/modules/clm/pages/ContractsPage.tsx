import { useState } from "react";
import { 
  useContracts, 
  useCreateContract, 
  useUpdateContract, 
  useDeleteContract,
  useContractTemplates
} from "@/modules/clm/hooks/useCLM";
import { useAccounts } from "@/modules/crm/hooks/useCRM";
import { DataTable } from "@/modules/crm/components/DataTable";
import { Button } from "@/ui/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/ui/shadcn/dialog";
import { Input } from "@/ui/shadcn/input";
import { Label } from "@/ui/shadcn/label";
import { Textarea } from "@/ui/shadcn/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/shadcn/select";
import { 
  MoreHorizontal, 
  Pencil, 
  Trash2, 
  FileSignature, 
  Calendar, 
  DollarSign
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/ui/shadcn/dropdown-menu";
import { format } from "date-fns";
import { Badge } from "@/ui/shadcn/badge";

export type ContractStatus = 
  | "draft"
  | "pending_review"
  | "pending_approval"
  | "approved"
  | "sent"
  | "signed"
  | "expired"
  | "cancelled";

export interface ContractRow {
  id: string;
  name: string;
  status: ContractStatus;
  value: number | null;
  start_date: string | null;
  end_date: string | null;
  account_id: string | null;
  account?: { name: string } | null; 
  content: string | null;
  created_at: string;
}

interface AccountOption {
  id: string;
  name: string;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending_review: "Pending Review",
  pending_approval: "Pending Approval",
  approved: "Approved",
  sent: "Sent",
  signed: "Signed",
  expired: "Expired",
  cancelled: "Cancelled",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-secondary text-secondary-foreground",
  pending_review: "bg-warning/15 text-warning",
  pending_approval: "bg-warning/15 text-warning",
  approved: "bg-info/15 text-info",
  sent: "bg-primary/15 text-primary",
  signed: "bg-success/15 text-success",
  expired: "bg-destructive/15 text-destructive",
  cancelled: "bg-secondary text-secondary-foreground",
};

export default function ContractsPage() {
  const { data: contracts = [], isLoading } = useContracts();
  const { data: accounts = [] } = useAccounts();
  
  const createContract = useCreateContract();
  const updateContract = useUpdateContract();
  const deleteContract = useDeleteContract();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<ContractRow | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    account_id: "",
    status: "draft" as ContractStatus,
    value: "",
    start_date: "",
    end_date: "",
    content: "",
  });

  const openCreateDialog = () => {
    setEditingContract(null);
    setFormData({
      name: "",
      account_id: "",
      status: "draft",
      value: "",
      start_date: "",
      end_date: "",
      content: "",
    });
    setDialogOpen(true);
  };

  const openEditDialog = (row: ContractRow) => {
    setEditingContract(row);
    setFormData({
      name: row.name,
      account_id: row.account_id || "",
      status: row.status,
      value: row.value ? row.value.toString() : "",
      start_date: row.start_date ? format(new Date(row.start_date), "yyyy-MM-dd") : "",
      end_date: row.end_date ? format(new Date(row.end_date), "yyyy-MM-dd") : "",
      content: row.content || "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    const payload = {
      ...formData,
      value: parseFloat(formData.value) || null,
      start_date: formData.start_date || null,
      end_date: formData.end_date || null,
      account_id: formData.account_id || null, 
    };

    if (editingContract) {
      await updateContract.mutateAsync({ id: editingContract.id, ...payload });
    } else {
      await createContract.mutateAsync(payload);
    }
    setDialogOpen(false);
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return "-";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const columns = [
    {
      key: "name",
      header: "Contract Name",
      cell: (row: ContractRow) => (
        <div className="flex items-center gap-2">
          <div className="bg-primary/10 p-2 rounded-full">
            <FileSignature className="h-4 w-4 text-primary" />
          </div>
          <div className="flex flex-col">
            <span className="font-medium">{row.name}</span>
            <span className="text-xs text-muted-foreground">
              {row.account?.name || "No Account"}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (row: ContractRow) => (
        <Badge className={STATUS_COLORS[row.status] || "bg-secondary text-secondary-foreground"}>
          {STATUS_LABELS[row.status] || row.status}
        </Badge>
      ),
    },
    {
      key: "value",
      header: "Value",
      cell: (row: ContractRow) => (
        <span className="font-medium">{formatCurrency(row.value)}</span>
      ),
    },
    {
      key: "dates",
      header: "Duration",
      cell: (row: ContractRow) => {
        const start = row.start_date ? format(new Date(row.start_date), "MMM d, yyyy") : "?";
        const end = row.end_date ? format(new Date(row.end_date), "MMM d, yyyy") : "?";
        
        if (!row.start_date && !row.end_date) return <span className="text-muted-foreground">-</span>;

        return (
          <div className="flex flex-col text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>{start} - {end}</span>
            </div>
          </div>
        );
      },
    },
    {
      key: "actions",
      header: "",
      cell: (row: ContractRow) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openEditDialog(row)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => deleteContract.mutate(row.id)}
              className="text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Contracts</h1>
          <p className="text-muted-foreground">Manage legal agreements</p>
        </div>

        <DataTable
          data={contracts as unknown as ContractRow[]}
          columns={columns}
          loading={isLoading}
          onAdd={openCreateDialog}
          addLabel="New Contract"
          searchPlaceholder="Search contracts..."
        />

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingContract ? "Edit Contract" : "New Contract"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Contract Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. MSA - Acme Corp"
                />
              </div>

              <div className="grid gap-2">
                <Label>Account (Client)</Label>
                <Select
                  value={formData.account_id}
                  onValueChange={(v) => setFormData({ ...formData, account_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a client..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(accounts as AccountOption[]).map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Value ($)</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="number"
                      className="pl-9"
                      value={formData.value}
                      onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(v) => setFormData({ ...formData, status: v as ContractStatus })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key as ContractStatus}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Details / Content</Label>
                <Textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Paste terms or notes here..."
                  className="h-20"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={createContract.isPending || updateContract.isPending}>
                {editingContract ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
  );
}
