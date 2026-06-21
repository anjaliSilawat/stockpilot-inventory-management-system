const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1").replace(/\/$/, "");

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });

  if (response.status === 204) return null;

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof body.detail === "string"
      ? body.detail
      : body.detail?.map?.((item) => item.msg).join(", ") || "Something went wrong";
    throw new Error(message);
  }
  return body;
}

export const api = {
  dashboard: () => request("/dashboard/summary"),
  products: (q = "") => request(`/products${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  product: (id) => request(`/products/${id}`),
  createProduct: (payload) => request("/products", { method: "POST", body: JSON.stringify(payload) }),
  updateProduct: (id, payload) => request(`/products/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteProduct: (id) => request(`/products/${id}`, { method: "DELETE" }),
  customers: (q = "") => request(`/customers${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  createCustomer: (payload) => request("/customers", { method: "POST", body: JSON.stringify(payload) }),
  updateCustomer: (id, payload) => request(`/customers/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteCustomer: (id) => request(`/customers/${id}`, { method: "DELETE" }),
  orders: () => request("/orders"),
  createOrder: (payload) => request("/orders", { method: "POST", body: JSON.stringify(payload) }),
  cancelOrder: (id) => request(`/orders/${id}/cancel`, { method: "POST" }),
  transactions: () => request("/inventory/transactions"),
  adjustInventory: (payload) => request("/inventory/adjustments", { method: "POST", body: JSON.stringify(payload) }),
};

export { API_BASE_URL };
