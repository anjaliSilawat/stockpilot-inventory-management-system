export interface Product {
  id: number;
  sku: string;
  name: string;
  description: string | null;
  unit_price: number;
  quantity_in_stock: number;
  reorder_level: number;
  created_at: string;
  updated_at: string;
}

export interface ProductInput {
  id?: number;
  sku: string;
  name: string;
  description?: string | null;
  unit_price: number | string;
  quantity_in_stock: number | string;
  reorder_level: number | string;
}

export interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerInput {
  id?: number;
  name: string;
  email: string;
  phone?: string | null;
  address?: string | null;
}

export type OrderStatus = "CREATED" | "CANCELLED";

export interface OrderItem {
  id: number;
  product_id: number;
  quantity: number;
  unit_price: number;
  product: Product;
}

export interface Order {
  id: number;
  customer_id: number;
  customer: Customer;
  status: OrderStatus;
  total_amount: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
}

export interface OrderItemDraft {
  product_id: number | string;
  quantity: number | string;
}

export interface OrderDraft {
  customer_id: number;
  notes: string | null;
  items: { product_id: number; quantity: number }[];
}

export type InventoryTransactionType = "PURCHASE_ORDER" | "ORDER_DEDUCTION" | "RETURN_IN" | "MANUAL_ADJUSTMENT";

export interface InventoryTransaction {
  id: number;
  product_id: number;
  product: Product;
  order_id: number | null;
  transaction_type: InventoryTransactionType;
  quantity_change: number;
  note: string | null;
  created_at: string;
}

export interface InventoryAdjustmentInput {
  product_id: number;
  quantity_change: number;
  note: string;
}

export interface DashboardSummary {
  total_products: number;
  total_customers: number;
  active_orders: number;
  low_stock_products: number;
  total_stock_units: number;
  low_stock_items: Product[];
  recent_orders: Order[];
}

export type ToastType = "success" | "error";

export interface ToastState {
  type: ToastType;
  message: string;
}

export type PageId = "dashboard" | "products" | "customers" | "orders" | "inventory";

export interface AppData {
  summary: DashboardSummary | null;
  products: Product[];
  customers: Customer[];
  orders: Order[];
  transactions: InventoryTransaction[];
}
