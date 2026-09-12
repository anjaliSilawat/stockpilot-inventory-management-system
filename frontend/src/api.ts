import type {
  Customer,
  CustomerInput,
  DashboardSummary,
  InventoryAdjustmentInput,
  InventoryTransaction,
  Order,
  OrderDraft,
  Product,
  ProductInput,
} from "./types";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1").replace(/\/$/, "");

interface ApiErrorBody {
  detail?: string | { msg: string }[];
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });

  if (response.status === 204) return null as T;

  const body: ApiErrorBody = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof body.detail === "string"
      ? body.detail
      : body.detail?.map?.((item) => item.msg).join(", ") || "Something went wrong";
    throw new Error(message);
  }
  return body as T;
}

export const api = {
  dashboard: () => request<DashboardSummary>("/dashboard/summary"),
  products: (q = "") => request<Product[]>(`/products${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  product: (id: number) => request<Product>(`/products/${id}`),
  createProduct: (payload: ProductInput) => request<Product>("/products", { method: "POST", body: JSON.stringify(payload) }),
  updateProduct: (id: number, payload: Partial<ProductInput>) => request<Product>(`/products/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteProduct: (id: number) => request<null>(`/products/${id}`, { method: "DELETE" }),
  customers: (q = "") => request<Customer[]>(`/customers${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  createCustomer: (payload: CustomerInput) => request<Customer>("/customers", { method: "POST", body: JSON.stringify(payload) }),
  updateCustomer: (id: number, payload: Partial<CustomerInput>) => request<Customer>(`/customers/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteCustomer: (id: number) => request<null>(`/customers/${id}`, { method: "DELETE" }),
  orders: () => request<Order[]>("/orders"),
  createOrder: (payload: OrderDraft) => request<Order>("/orders", { method: "POST", body: JSON.stringify(payload) }),
  cancelOrder: (id: number) => request<Order>(`/orders/${id}/cancel`, { method: "POST" }),
  transactions: () => request<InventoryTransaction[]>("/inventory/transactions"),
  adjustInventory: (payload: InventoryAdjustmentInput) => request<InventoryTransaction>("/inventory/adjustments", { method: "POST", body: JSON.stringify(payload) }),
};

export { API_BASE_URL };
