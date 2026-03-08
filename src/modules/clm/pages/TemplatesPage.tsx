import { useState } from "react";
import { 
  useContractTemplates,
  useCreateContractTemplate,
  useUpdateContractTemplate,
  useDeleteContractTemplate 
} from "@/modules/clm/hooks/useCLM";
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
import { Switch } from "@/ui/shadcn/switch"; // Ensure you have this component or use a checkbox
import { 
  MoreHorizontal, 
  Pencil, 
  Trash2, 
  FileText, 
  CheckCircle2,
  XCircle
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/ui/shadcn/dropdown-menu";
import { Badge } from "@/ui/shadcn/badge";
import { ContractTemplate } from "@/core/types/clm";

export default function TemplatesPage() {
  const { data: templates = [], isLoading } = useContractTemplates();
  
  const createTemplate = useCreateContractTemplate();
  const updateTemplate = useUpdateContractTemplate();
  const deleteTemplate = useDeleteContractTemplate();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ContractTemplate | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    content: "",
    is_active: true,
  });

  const openCreateDialog = () => {
    setEditingTemplate(null);
    setFormData({
      name: "",
      content: "",
      is_active: true,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (row: ContractTemplate) => {
    setEditingTemplate(row);
    setFormData({
      name: row.name,
      content: row.content || "",
      is_active: row.is_active ?? true,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name) return; // Basic validation

    const payload = {
      ...formData,
    };

    if (editingTemplate) {
      await updateTemplate.mutateAsync({ id: editingTemplate.id, ...payload });
    } else {
      await createTemplate.mutateAsync(payload);
    }
    setDialogOpen(false);
  };

  const columns = [
    {
      key: "name",
      header: "Template Name",
      cell: (row: ContractTemplate) => (
        <div className="flex items-center gap-2">
          <div className="bg-primary/10 p-2 rounded-full">
            <FileText className="h-4 w-4 text-primary" />
          </div>
          <div className="flex flex-col">
            <span className="font-medium">{row.name}</span>
            <span className="text-xs text-muted-foreground">
                {row.content ? `${row.content.substring(0, 40)}...` : "No content"}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (row: ContractTemplate) => (
        <Badge variant={row.is_active ? "default" : "secondary"} className={row.is_active ? "bg-green-100 text-green-800 hover:bg-green-200" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}>
           {row.is_active ? (
             <div className="flex items-center gap-1">
               <CheckCircle2 className="w-3 h-3" /> Active
             </div>
           ) : (
            <div className="flex items-center gap-1">
               <XCircle className="w-3 h-3" /> Inactive
             </div>
           )}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      cell: (row: ContractTemplate) => (
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
              onClick={() => deleteTemplate.mutate(row.id)}
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
          <h1 className="text-3xl font-bold">Contract Templates</h1>
          <p className="text-muted-foreground">Create reusable templates for your legal agreements</p>
        </div>

        <DataTable
          data={templates}
          columns={columns}
          loading={isLoading}
          onAdd={openCreateDialog}
          addLabel="New Template"
          searchPlaceholder="Search templates..."
        />

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingTemplate ? "Edit Template" : "New Template"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Template Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Standard NDA, Service Agreement"
                />
              </div>

              <div className="grid gap-2">
                 <div className="flex items-center justify-between">
                    <Label>Template Content</Label>
                    <div className="flex items-center space-x-2">
                        <Label htmlFor="active-mode" className="text-xs text-muted-foreground">Active</Label>
                        <Switch
                            id="active-mode"
                            checked={formData.is_active}
                            onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                        />
                    </div>
                 </div>
                <Textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Enter the full legal text here. You can use placeholders like {{CLIENT_NAME}} or {{DATE}}."
                  className="h-64 font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                    Tip: Copy and paste your standard legal clauses here.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={createTemplate.isPending || updateTemplate.isPending}>
                {editingTemplate ? "Update Template" : "Create Template"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
  );
}