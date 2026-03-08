// ERP Type Definitions

export type InventoryStatus = 'in_stock' | 'low_stock' | 'out_of_stock' | 'discontinued';
export type PurchaseOrderStatus = 'draft' | 'pending' | 'approved' | 'received' | 'cancelled';
export type ProductionOrderStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled';
export type FinancialRecordType = 'income' | 'expense' | 'asset' | 'liability' | 'equity';

export interface Supplier {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  payment_terms?: string;
  rating?: number;
  is_active?: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  description?: string;
  category?: string;
  quantity_on_hand?: number;
  quantity_reserved?: number;
  quantity_available?: number;
  reorder_level?: number;
  reorder_quantity?: number;
  unit_cost?: number;
  warehouse_location?: string;
  status?: InventoryStatus;
  supplier_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  supplier?: Supplier;
}

export interface PurchaseOrder {
  id: string;
  po_number?: string;
  supplier_id: string;
  status?: PurchaseOrderStatus;
  order_date?: string;
  due_date?: string;
  expected_delivery_date?: string;
  actual_delivery_date?: string;
  subtotal?: number;
  tax_amount?: number;
  shipping_cost?: number;
  total?: number;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  supplier?: Supplier;
  items?: PurchaseOrderItem[];
}

export interface PurchaseOrderItem {
  id: string;
  purchase_order_id: string;
  inventory_item_id?: string;
  item_name: string;
  description?: string;
  quantity: number;
  unit_cost: number;
  total?: number;
  sort_order?: number;
  created_at: string;
}

export interface ProductionOrder {
  id: string;
  production_order_number?: string;
  inventory_item_id?: string;
  status?: ProductionOrderStatus;
  quantity_ordered?: number;
  quantity_produced?: number;
  start_date?: string;
  due_date?: string;
  completion_date?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  inventory_item?: InventoryItem;
}

export interface FinancialRecord {
  id: string;
  transaction_date?: string;
  type?: FinancialRecordType;
  category?: string;
  description?: string;
  amount?: number;
  reference_id?: string;
  reference_type?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

// Status colors
export const INVENTORY_STATUS_COLORS: Record<InventoryStatus, string> = {
  in_stock: 'bg-success/15 text-success',
  low_stock: 'bg-warning/15 text-warning',
  out_of_stock: 'bg-destructive/15 text-destructive',
  discontinued: 'bg-secondary text-secondary-foreground',
};

export const PURCHASE_ORDER_STATUS_COLORS: Record<PurchaseOrderStatus, string> = {
  draft: 'bg-secondary text-secondary-foreground',
  pending: 'bg-warning/15 text-warning',
  approved: 'bg-info/15 text-info',
  received: 'bg-success/15 text-success',
  cancelled: 'bg-destructive/15 text-destructive',
};

export const PRODUCTION_ORDER_STATUS_COLORS: Record<ProductionOrderStatus, string> = {
  planned: 'bg-info/15 text-info',
  in_progress: 'bg-warning/15 text-warning',
  completed: 'bg-success/15 text-success',
  cancelled: 'bg-destructive/15 text-destructive',
};

export const FINANCIAL_RECORD_TYPE_COLORS: Record<FinancialRecordType, string> = {
  income: 'bg-success/15 text-success',
  expense: 'bg-destructive/15 text-destructive',
  asset: 'bg-info/15 text-info',
  liability: 'bg-warning/15 text-warning',
  equity: 'bg-primary/15 text-primary',
};
