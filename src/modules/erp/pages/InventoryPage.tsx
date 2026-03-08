import { useState, useEffect } from "react";
import { Plus, AlertTriangle, Package, Search, Loader2, Warehouse } from "lucide-react";
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
import { useToast } from "@/core/hooks/use-toast";
import { Label } from "@/ui/shadcn/label";

interface InventoryListItem {
  id: string;
  quantity_on_hand: number;
  reorder_level: number | null;
  warehouse_location: string | null;
  products: {
    name: string | null;
    sku: string | null;
    category: string | null;
  } | null;
}

interface InventoryFormData {
  product_id: string;
  quantity_on_hand: number;
  reorder_level: number;
  warehouse_location: string;
}

import { getErrorMessage } from "@/core/utils/error";

export default function InventoryPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  // SECTION: Real-time Sync
  // Listens for any changes to the inventory_items table and refreshes data
  useEffect(() => {
    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'inventory_items' }, 
        () => {
          queryClient.invalidateQueries({ queryKey: ["inventory-list"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // SECTION: Fast Data Fetching - UPDATED: Filter by current user
  const { data: inventory, isLoading } = useQuery({
    queryKey: ["inventory-list", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user?.id) throw new Error("User not authenticated");
      const { data, error } = await supabase
        .from("inventory_items")
        .select(`
          *,
          products (
            name,
            sku,
            category
          )
        `)
        .eq("created_by", user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 2, // Cache data for 2 minutes
  });

  // SECTION: Add Item Mutation
  const addItemMutation = useMutation({
    mutationFn: async (newItem: InventoryFormData) => {
      const { data, error } = await supabase
        .from("inventory_items")
        .insert([{ ...newItem, created_by: user?.id }])
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-list"] });
      toast({ title: "Success", description: "Stock record created." });
      setIsSheetOpen(false);
    },
    onError: (err: unknown) => {
      toast({ title: "Database Error", description: getErrorMessage(err), variant: "destructive" });
    }
  });

  const filteredItems = (inventory as InventoryListItem[] | undefined)?.filter((item) => 
    item.products?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.products?.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
        {/* Header Section */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <h1 className="text-xl md:text-3xl font-semibold tracking-tight">Inventory Management</h1>
            <p className="text-sm text-muted-foreground">Monitor warehouse stock and reorder thresholds.</p>
          </div>

          <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <SheetTrigger asChild>
              <Button className="shrink-0 shadow-sm">
                <Plus className="h-4 w-4 mr-2" /> Add Stock Item
              </Button>
            </SheetTrigger>
            <SheetContent className="sm:max-w-md">
              <SheetHeader>
                <SheetTitle>New Inventory Record</SheetTitle>
                <SheetDescription>Assign a product to a warehouse location with initial quantities.</SheetDescription>
              </SheetHeader>
              <InventoryForm 
                onSubmit={(data) => addItemMutation.mutate(data)} 
                isLoading={addItemMutation.isPending} 
              />
            </SheetContent>
          </Sheet>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search by name or SKU..." 
              className="pl-9 h-10" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)} 
            />
          </div>
        </div>

        {/* Inventory Table Card */}
        
        <Card className="shadow-sm border-muted/60 overflow-hidden">
          <CardHeader className="bg-muted/20 pb-4">
            <div className="flex items-center gap-2">
              <Warehouse className="h-5 w-5 text-primary" />
              <CardTitle className="text-base font-medium">Warehouse Stock</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex h-64 flex-col items-center justify-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground animate-pulse">Fetching inventory data...</p>
              </div>
            ) : filteredItems && filteredItems.length > 0 ? (
              <Table>
                <TableHeader className="bg-muted/10">
                  <TableRow>
                    <TableHead className="w-[300px]">Product Details</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">On Hand</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => {
                    const isLow = item.quantity_on_hand <= (item.reorder_level || 0);
                    return (
                      <TableRow key={item.id} className="hover:bg-muted/5 transition-colors">
                        <TableCell>
                          <div className="font-semibold text-sm">{item.products?.name}</div>
                          <div className="text-xs font-mono text-muted-foreground">{item.products?.sku}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="font-normal">{item.products?.category || "N/A"}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {item.warehouse_location || "Unassigned"}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold">
                          {item.quantity_on_hand}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-center">
                            {isLow ? (
                              <Badge variant="destructive" className="gap-1 px-2">
                                <AlertTriangle className="h-3 w-3" /> Low Stock
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
                                Healthy
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Package className="h-12 w-12 text-muted/40" />
                <div className="text-center">
                  <p className="text-lg font-medium">No items found</p>
                  <p className="text-sm text-muted-foreground">Adjust your search or add a new item.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
  );
}

// SECTION: Form Component with Product Picker
function InventoryForm({ onSubmit, isLoading }: { onSubmit: (data: InventoryFormData) => void; isLoading: boolean }) {
  const [formData, setFormData] = useState({
    product_id: "",
    quantity_on_hand: 0,
    reorder_level: 10,
    warehouse_location: ""
  });

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
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 pt-6">
      <div className="space-y-2">
        <Label>Select Product</Label>
        <select 
          required
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={formData.product_id}
          onChange={(e) => setFormData({...formData, product_id: e.target.value})}
        >
          <option value="">-- Choose a Product --</option>
          {products?.map(p => (
            <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Stock Quantity</Label>
          <Input 
            type="number" 
            min="0"
            required
            placeholder="0"
            onChange={(e) => setFormData({...formData, quantity_on_hand: parseInt(e.target.value) || 0})}
          />
        </div>
        <div className="space-y-2">
          <Label>Reorder Level</Label>
          <Input 
            type="number" 
            min="1"
            required
            placeholder="10"
            onChange={(e) => setFormData({...formData, reorder_level: parseInt(e.target.value) || 0})}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Warehouse Location</Label>
        <Input 
          placeholder="e.g. Zone A, Rack 4" 
          onChange={(e) => setFormData({...formData, warehouse_location: e.target.value})}
        />
      </div>

      <Button type="submit" className="w-full h-11" disabled={isLoading || !formData.product_id}>
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Creating Record...
          </>
        ) : (
          "Finalize Inventory Entry"
        )}
      </Button>
    </form>
  );
}
