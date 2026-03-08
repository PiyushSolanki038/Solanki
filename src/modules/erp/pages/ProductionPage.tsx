import { useState } from "react";
import { 
  Plus, 
  Search, 
  Loader2, 
  Factory, 
  MoreHorizontal, 
  Pencil, 
  Trash2, 
  Calendar, 
  CheckCircle2,
  AlertTriangle
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/core/api/client";
import { useAuth } from "@/core/auth/useAuth";

// UI Components
import { Button } from "@/ui/shadcn/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/shadcn/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/shadcn/table";
import { Badge } from "@/ui/shadcn/badge";
import { Input } from "@/ui/shadcn/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/ui/shadcn/sheet";
import { Label } from "@/ui/shadcn/label";
import { useToast } from "@/core/hooks/use-toast";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger, 
  DropdownMenuSeparator 
} from "@/ui/shadcn/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/ui/shadcn/alert-dialog";

interface ProductionOrderRow {
  id: string;
  order_number: string;
  product_id: string | null;
  quantity_to_produce: number;
  status: string;
  start_date: string | null;
  due_date: string | null;
  products: {
    name: string | null;
    sku: string | null;
  } | null;
}

interface ProductionOrderFormInput {
  id?: string;
  order_number: string;
  product_id: string;
  quantity_to_produce: number;
  status: string;
  start_date: string;
  due_date: string | null;
}

interface ProductOption {
  id: string;
  name: string;
  sku: string;
}

import { getErrorMessage } from "@/core/utils/error";

// Status Visuals
const STATUS_STYLES: Record<string, string> = {
  planned: "bg-slate-100 text-slate-700 border-slate-200",
  in_progress: "bg-blue-100 text-blue-700 border-blue-200",
  completed: "bg-green-100 text-green-700 border-green-200",
  cancelled: "bg-red-100 text-red-700 border-red-200",
};

export default function ProductionPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  
  // State for Edit/Delete
  const [editingOrder, setEditingOrder] = useState<ProductionOrderRow | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<ProductionOrderRow | null>(null);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  // 1. FETCH DATA - UPDATED: Filter by current user
  const { data: orders, isLoading } = useQuery({
    queryKey: ["production-orders", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user?.id) throw new Error("User not authenticated");
      const { data, error } = await supabase
        .from("production_orders")
        .select(`
          *,
          products (
            name,
            sku
          )
        `)
        .eq("created_by", user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // 2. CREATE / UPDATE MUTATION - UPDATED: Include user ID
  const upsertOrderMutation = useMutation({
    mutationFn: async (orderData: ProductionOrderFormInput) => {
      const payload = { ...orderData, created_by: user?.id };

      if (payload.id) {
        // Update
        const { data, error } = await supabase
          .from("production_orders")
          .update(payload)
          .eq('id', payload.id)
          .select();
        if (error) throw error;
        return data;
      } else {
        // Create
        const { data, error } = await supabase
          .from("production_orders")
          .insert([payload])
          .select();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-orders"] });
      toast({ 
        title: editingOrder ? "Order Updated" : "Production Scheduled", 
        description: "The production schedule has been updated.",
      });
      setIsSheetOpen(false);
      setEditingOrder(null);
    },
    onError: (err: unknown) => {
      toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" });
    }
  });

  // 3. DELETE MUTATION
  const deleteOrderMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("production_orders").delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-orders"] });
      toast({ title: "Deleted", description: "Production order removed." });
      setOrderToDelete(null);
    },
  });

  // 4. QUICK STATUS UPDATE (Mark Completed)
  const completeOrderMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("production_orders")
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-orders"] });
      toast({ title: "Completed", description: "Order marked as completed." });
    }
  });

  const handleEditClick = (order: ProductionOrderRow) => {
    setEditingOrder(order);
    setIsSheetOpen(true);
  };

  const handleCreateClick = () => {
    setEditingOrder(null);
    setIsSheetOpen(true);
  };

  const filteredOrders = orders?.filter((order) => 
    order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.products?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <h1 className="text-xl md:text-3xl font-semibold tracking-tight">Production Management</h1>
            <p className="text-sm text-muted-foreground">Track manufacturing orders and shop floor progress.</p>
          </div>

          <Sheet open={isSheetOpen} onOpenChange={(open) => { setIsSheetOpen(open); if(!open) setEditingOrder(null); }}>
            <SheetTrigger asChild>
              <Button onClick={handleCreateClick} className="shadow-sm">
                <Plus className="h-4 w-4 mr-2" /> New Production Order
              </Button>
            </SheetTrigger>
            <SheetContent className="sm:max-w-md overflow-y-auto">
              <SheetHeader>
                <SheetTitle>{editingOrder ? `Edit ${editingOrder.order_number}` : "Schedule Production"}</SheetTitle>
                <SheetDescription>
                  {editingOrder ? "Update manufacturing details." : "Create a new job for the production line."}
                </SheetDescription>
              </SheetHeader>
              <ProductionOrderForm 
                initialData={editingOrder}
                onSubmit={(data) => upsertOrderMutation.mutate(data)} 
                isLoading={upsertOrderMutation.isPending} 
              />
            </SheetContent>
          </Sheet>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search Order # or Product..." 
            className="pl-9" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Delete Alert */}
        <AlertDialog open={!!orderToDelete} onOpenChange={(open) => !open && setOrderToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" /> Delete Production Order?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently remove order <strong>{orderToDelete?.order_number}</strong>. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                className="bg-destructive hover:bg-destructive/90"
                onClick={() => deleteOrderMutation.mutate(orderToDelete.id)}
              >
                {deleteOrderMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Table */}
        <Card className="shadow-sm border-muted/60">
          <CardHeader className="bg-muted/10 pb-4">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Factory className="h-5 w-5 text-primary" />
              Production Schedule
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>
            ) : filteredOrders?.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Factory className="h-10 w-10 mb-2 opacity-20" />
                    <p>No active production orders.</p>
                </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders?.map((order) => (
                    <TableRow key={order.id} className="group hover:bg-muted/5">
                      <TableCell className="font-mono font-medium">{order.order_number}</TableCell>
                      <TableCell>
                        <div className="font-medium">{order.products?.name || "Unknown"}</div>
                        <div className="text-xs text-muted-foreground">{order.products?.sku}</div>
                      </TableCell>
                      <TableCell>{order.quantity_to_produce}</TableCell>
                      <TableCell>
                        {order.due_date ? (
                          <div className="flex items-center text-sm text-muted-foreground">
                            <Calendar className="mr-1 h-3 w-3" />
                            {new Date(order.due_date).toLocaleDateString()}
                          </div>
                        ) : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_STYLES[order.status] || ""}>
                          {order.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end items-center gap-2">
                          {order.status !== 'completed' && order.status !== 'cancelled' && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                              title="Mark as Completed"
                              onClick={() => completeOrderMutation.mutate(order.id)}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEditClick(order)}>
                                <Pencil className="mr-2 h-4 w-4" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-red-600 focus:text-red-600 focus:bg-red-50"
                                onClick={() => setOrderToDelete(order)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
  );
}

// FORM COMPONENT
function ProductionOrderForm({
  onSubmit,
  isLoading,
  initialData,
}: {
  onSubmit: (data: ProductionOrderFormInput) => void;
  isLoading: boolean;
  initialData?: ProductionOrderRow | null;
}) {
  const [formData, setFormData] = useState({
    order_number: initialData?.order_number || `PROD-${Math.floor(1000 + Math.random() * 9000)}`,
    product_id: initialData?.product_id || "",
    quantity_to_produce: initialData?.quantity_to_produce || 1,
    status: initialData?.status || "planned",
    start_date: initialData?.start_date ? new Date(initialData.start_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    due_date: initialData?.due_date ? new Date(initialData.due_date).toISOString().split('T')[0] : ""
  });

  // Fetch Products for Dropdown
  const { data: products } = useQuery({
    queryKey: ["products-active"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, name, sku").eq('is_active', true);
      return data;
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.product_id) return;

    const payload: ProductionOrderFormInput = { ...formData };
    if (!payload.due_date) payload.due_date = null; // Handle empty date
    if (initialData?.id) payload.id = initialData.id;

    onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 pt-6">
      <div className="space-y-2">
        <Label>Order Number</Label>
        <Input 
          required
          value={formData.order_number}
          onChange={(e) => setFormData({...formData, order_number: e.target.value})}
        />
      </div>

      <div className="space-y-2">
        <Label>Product to Produce</Label>
        <select 
          required
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={formData.product_id}
          onChange={(e) => setFormData({...formData, product_id: e.target.value})}
        >
          <option value="">-- Select Product --</option>
          {(products as ProductOption[] | null)?.map((p) => (
            <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label>Quantity to Produce</Label>
        <Input 
          type="number" 
          min="1"
          required
          value={formData.quantity_to_produce}
          onChange={(e) => setFormData({...formData, quantity_to_produce: parseInt(e.target.value)})} 
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Start Date</Label>
          <Input 
            type="date" 
            required
            value={formData.start_date}
            onChange={(e) => setFormData({...formData, start_date: e.target.value})} 
          />
        </div>
        <div className="space-y-2">
          <Label>Due Date</Label>
          <Input 
            type="date" 
            value={formData.due_date}
            onChange={(e) => setFormData({...formData, due_date: e.target.value})} 
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Status</Label>
        <select 
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={formData.status}
          onChange={(e) => setFormData({...formData, status: e.target.value})}
        >
          <option value="planned">Planned</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <Button type="submit" className="w-full h-11" disabled={isLoading || !formData.product_id}>
        {isLoading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : (initialData ? "Update Schedule" : "Create Production Order")}
      </Button>
    </form>
  );
}
