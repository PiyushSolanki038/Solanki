import { useState, useMemo } from "react";
import { 
  Plus, 
  Search, 
  Loader2, 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  PieChart, 
  ArrowUpRight, 
  ArrowDownRight,
  Wallet
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/shadcn/select";

interface TransactionFormData {
  description: string;
  amount: number;
  transaction_type: string;
  category: string;
  transaction_date: string;
}

import { getErrorMessage } from "@/core/utils/error";

export default function FinancePage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  // 1. FETCH FINANCIAL DATA - UPDATED: Filter by current user
  const { data: records, isLoading } = useQuery({
    queryKey: ["financial-records", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user?.id) throw new Error("User not authenticated");
      const { data, error } = await supabase
        .from("financial_records")
        .select("*")
        .eq("created_by", user.id)
        .order('transaction_date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // 2. CALCULATE TOTALS (Revenue, Expense, Profit)
  const stats = useMemo(() => {
    if (!records) return { revenue: 0, expense: 0, profit: 0 };
    
    const revenue = records
      .filter(r => r.transaction_type === 'income')
      .reduce((acc, curr) => acc + Number(curr.amount), 0);
      
    const expense = records
      .filter(r => r.transaction_type === 'expense')
      .reduce((acc, curr) => acc + Number(curr.amount), 0);

    return {
      revenue,
      expense,
      profit: revenue - expense
    };
  }, [records]);

  // 3. ADD TRANSACTION MUTATION - UPDATED: Include user ID
  const addTransactionMutation = useMutation({
    mutationFn: async (newRecord: TransactionFormData) => {
      const recordWithUser = { ...newRecord, created_by: user?.id };
      const { data, error } = await supabase.from("financial_records").insert([recordWithUser]).select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-records"] });
      toast({ title: "Recorded", description: "Financial transaction saved successfully." });
      setIsSheetOpen(false);
    },
    onError: (err: unknown) => {
      toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" });
    }
  });

  const filteredRecords = records?.filter((record) => 
    record.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <h1 className="text-xl md:text-3xl font-semibold tracking-tight">Finance & Accounting</h1>
            <p className="text-sm text-muted-foreground">
              Track company cash flow, expenses, and profitability.
            </p>
          </div>
          <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <SheetTrigger asChild>
              <Button className="shadow-sm">
                <Plus className="h-4 w-4 mr-2" /> Record Transaction
              </Button>
            </SheetTrigger>
            <SheetContent className="sm:max-w-md">
              <SheetHeader>
                <SheetTitle>New Transaction</SheetTitle>
                <SheetDescription>Log an income or expense record.</SheetDescription>
              </SheetHeader>
              <TransactionForm 
                onSubmit={(data) => addTransactionMutation.mutate(data)} 
                isLoading={addTransactionMutation.isPending} 
              />
            </SheetContent>
          </Sheet>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-l-4 border-l-emerald-500 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-700">{formatCurrency(stats.revenue)}</div>
              <p className="text-xs text-muted-foreground mt-1">Total income recorded</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-red-500 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Expenses</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-700">{formatCurrency(stats.expense)}</div>
              <p className="text-xs text-muted-foreground mt-1">Total cost of operations</p>
            </CardContent>
          </Card>

          <Card className={`border-l-4 shadow-sm ${stats.profit >= 0 ? 'border-l-blue-500' : 'border-l-orange-500'}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Net Profit</CardTitle>
              <PieChart className={`h-4 w-4 ${stats.profit >= 0 ? 'text-blue-500' : 'text-orange-500'}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${stats.profit >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                {formatCurrency(stats.profit)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Revenue - Expenses</p>
            </CardContent>
          </Card>
        </div>

        {/* Search & Filter */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search transactions..." 
              className="pl-9" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Transactions Table */}
        <Card className="shadow-sm border-muted/60">
          <CardHeader className="bg-muted/10 pb-4">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              General Ledger
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>
            ) : filteredRecords?.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <DollarSign className="h-10 w-10 mb-2 opacity-20" />
                    <p>No transactions found.</p>
                </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords?.map((record) => (
                    <TableRow key={record.id} className="group hover:bg-muted/5">
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(record.transaction_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="font-medium">{record.description}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-normal">{record.category || "Uncategorized"}</Badge>
                      </TableCell>
                      <TableCell>
                        {record.transaction_type === 'income' ? (
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200">
                             <ArrowUpRight className="mr-1 h-3 w-3" /> Income
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-800 hover:bg-red-100 border-red-200">
                            <ArrowDownRight className="mr-1 h-3 w-3" /> Expense
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className={`text-right font-mono font-medium ${
                        record.transaction_type === 'income' ? 'text-emerald-600' : 'text-red-600'
                      }`}>
                        {record.transaction_type === 'income' ? '+' : '-'}{formatCurrency(record.amount)}
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
function TransactionForm({ onSubmit, isLoading }: { onSubmit: (data: TransactionFormData) => void; isLoading: boolean }) {
  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    transaction_type: "expense",
    category: "",
    transaction_date: new Date().toISOString().split('T')[0]
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      amount: parseFloat(formData.amount) // Ensure number format
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 pt-6">
      <div className="space-y-2">
        <Label>Description</Label>
        <Input 
          required 
          placeholder="e.g. Office Rent, Client Payment" 
          value={formData.description}
          onChange={(e) => setFormData({...formData, description: e.target.value})}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Transaction Type</Label>
          <Select 
            value={formData.transaction_type} 
            onValueChange={(val) => setFormData({...formData, transaction_type: val})}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="expense">Expense</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Amount ($)</Label>
          <Input 
            type="number" 
            step="0.01" 
            required 
            placeholder="0.00"
            value={formData.amount}
            onChange={(e) => setFormData({...formData, amount: e.target.value})}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Category</Label>
        <Select 
            value={formData.category} 
            onValueChange={(val) => setFormData({...formData, category: val})}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select Category" />
            </SelectTrigger>
            <SelectContent>
              {formData.transaction_type === 'income' ? (
                <>
                  <SelectItem value="Sales">Sales</SelectItem>
                  <SelectItem value="Services">Services</SelectItem>
                  <SelectItem value="Investments">Investments</SelectItem>
                </>
              ) : (
                <>
                  <SelectItem value="Operations">Operations</SelectItem>
                  <SelectItem value="Payroll">Payroll</SelectItem>
                  <SelectItem value="Inventory">Inventory</SelectItem>
                  <SelectItem value="Marketing">Marketing</SelectItem>
                  <SelectItem value="Utilities">Utilities</SelectItem>
                </>
              )}
            </SelectContent>
          </Select>
      </div>

      <div className="space-y-2">
        <Label>Date</Label>
        <Input 
          type="date" 
          required
          value={formData.transaction_date}
          onChange={(e) => setFormData({...formData, transaction_date: e.target.value})}
        />
      </div>

      <Button type="submit" className="w-full h-11" disabled={isLoading}>
        {isLoading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : "Record Transaction"}
      </Button>
    </form>
  );
}
