import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { api, API_BASE_URL } from "./api";
import type {
  AppData,
  Customer,
  CustomerInput,
  InventoryTransaction,
  Order,
  OrderItemDraft,
  PageId,
  Product,
  ProductInput,
  ToastState,
} from "./types";

const NAV_ITEMS: [PageId, string, string][] = [
  ["dashboard", "Dashboard", "▦"],
  ["products", "Products", "◈"],
  ["customers", "Customers", "◎"],
  ["orders", "Orders", "▤"],
  ["inventory", "Inventory", "↕"],
];

const emptyProduct: ProductInput = { sku: "", name: "", description: "", unit_price: "", quantity_in_stock: "", reorder_level: "0" };
const emptyCustomer: CustomerInput = { name: "", email: "", phone: "", address: "" };

function formatMoney(value: number | string | null | undefined) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value || 0));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function statusClass(status: string) {
  return status === "CANCELLED" ? "badge badge-muted" : "badge badge-success";
}

function Toast({ toast, onClose }: { toast: ToastState | null; onClose: () => void }) {
  if (!toast) return null;
  return <div className={`toast toast-${toast.type}`} role="status">{toast.message}<button onClick={onClose}>×</button></div>;
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <header className="modal-header"><div><p className="eyebrow">StockPilot</p><h2>{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close">×</button></header>
        {children}
      </section>
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

function EmptyState({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return <div className="empty-state"><div className="empty-icon">◌</div><h3>{title}</h3><p>{text}</p>{action}</div>;
}

function Dashboard({ summary, loading, setPage }: { summary: AppData["summary"]; loading: boolean; setPage: (page: PageId) => void }) {
  const metrics: [string, number | string, string, string][] = [
    ["Products", summary?.total_products ?? "—", "Items currently catalogued", "◈"],
    ["Customers", summary?.total_customers ?? "—", "Contacts ready to order", "◎"],
    ["Active orders", summary?.active_orders ?? "—", "Created and not cancelled", "▤"],
    ["Units in stock", summary?.total_stock_units ?? "—", "Across all products", "▦"],
  ];
  return (
    <div className="page-content">
      <div className="page-hero"><div><p className="eyebrow">Overview</p><h1>Inventory, under control.</h1><p>Track stock, place orders confidently, and surface reordering risks before they become issues.</p></div><button className="primary-button" onClick={() => setPage("orders")}>Create order <span>→</span></button></div>
      <section className="metric-grid">
        {metrics.map(([label, value, note, icon]) => <article className="metric-card" key={label}><div className="metric-icon">{icon}</div><p>{label}</p><strong>{loading ? "…" : value}</strong><small>{note}</small></article>)}
      </section>
      <section className="dashboard-grid">
        <article className="panel"><div className="panel-header"><div><p className="eyebrow">Attention needed</p><h2>Low-stock products</h2></div><button className="text-button" onClick={() => setPage("inventory")}>Inventory →</button></div>
          {summary?.low_stock_items?.length ? <div className="compact-list">{summary.low_stock_items.map((product) => <div className="compact-row" key={product.id}><div><strong>{product.name}</strong><span>{product.sku}</span></div><div className="stock-chip low">{product.quantity_in_stock} left <span>· level {product.reorder_level}</span></div></div>)}</div> : <EmptyState title="Inventory looks healthy" text="No products are currently at or below their reorder level." />}
        </article>
        <article className="panel"><div className="panel-header"><div><p className="eyebrow">Latest activity</p><h2>Recent orders</h2></div><button className="text-button" onClick={() => setPage("orders")}>All orders →</button></div>
          {summary?.recent_orders?.length ? <div className="compact-list">{summary.recent_orders.map((order) => <div className="compact-row" key={order.id}><div><strong>Order #{order.id}</strong><span>{order.customer.name} · {formatDate(order.created_at)}</span></div><div className="order-summary"><strong>{formatMoney(order.total_amount)}</strong><span className={statusClass(order.status)}>{order.status}</span></div></div>)}</div> : <EmptyState title="No orders yet" text="Create the first customer order to see activity here." />}
        </article>
      </section>
      <section className="insight-strip"><div><span className="insight-icon">✓</span><div><strong>Server-side inventory protection</strong><p>Every order validates live stock and writes an auditable inventory transaction in the same operation.</p></div></div><code>{API_BASE_URL}</code></section>
    </div>
  );
}

function ProductsPage({ products, onRefresh, notify }: { products: Product[]; onRefresh: () => Promise<void>; notify: (type: "success" | "error", message: string) => void }) {
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [form, setForm] = useState<ProductInput>(emptyProduct);
  const [saving, setSaving] = useState(false);
  const filtered = useMemo(() => products.filter((product) => `${product.name} ${product.sku}`.toLowerCase().includes(search.toLowerCase())), [products, search]);

  const openCreate = () => { setForm(emptyProduct); setModal("create"); };
  const openEdit = (product: Product) => { setForm({ ...product, unit_price: String(product.unit_price), reorder_level: String(product.reorder_level) }); setModal("edit"); };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true);
    const payload = { ...form, unit_price: Number(form.unit_price), quantity_in_stock: Number(form.quantity_in_stock), reorder_level: Number(form.reorder_level || 0) };
    try { modal === "create" ? await api.createProduct(payload) : await api.updateProduct(form.id!, { sku: payload.sku, name: payload.name, description: payload.description || null, unit_price: payload.unit_price, reorder_level: payload.reorder_level }); setModal(null); await onRefresh(); notify("success", modal === "create" ? "Product created and opening stock recorded." : "Product updated."); }
    catch (error) { notify("error", (error as Error).message); } finally { setSaving(false); }
  };
  const deleteProduct = async (product: Product) => { if (!window.confirm(`Delete ${product.name}? Products used in orders cannot be deleted.`)) return; try { await api.deleteProduct(product.id); await onRefresh(); notify("success", "Product deleted."); } catch (error) { notify("error", (error as Error).message); } };

  return <div className="page-content">
    <div className="page-heading"><div><p className="eyebrow">Catalogue</p><h1>Products</h1><p>Create products with unique SKUs and monitor their current stock.</p></div><button className="primary-button" onClick={openCreate}>+ Add product</button></div>
    <section className="panel table-panel"><div className="table-toolbar"><div className="search-box">⌕<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search product or SKU" /></div><span>{filtered.length} products</span></div>
    {filtered.length ? <div className="table-wrap"><table><thead><tr><th>Product</th><th>SKU</th><th>Unit price</th><th>Stock</th><th>Reorder level</th><th></th></tr></thead><tbody>{filtered.map((product) => <tr key={product.id}><td><strong>{product.name}</strong><small>{product.description || "No description"}</small></td><td><code>{product.sku}</code></td><td>{formatMoney(product.unit_price)}</td><td><span className={`stock-chip ${product.quantity_in_stock <= product.reorder_level ? "low" : ""}`}>{product.quantity_in_stock} units</span></td><td>{product.reorder_level}</td><td className="actions"><button className="text-button" onClick={() => openEdit(product)}>Edit</button><button className="danger-button" onClick={() => deleteProduct(product)}>Delete</button></td></tr>)}</tbody></table></div> : <EmptyState title="No matching products" text="Try a different search, or add your first product." action={<button className="primary-button" onClick={openCreate}>Add product</button>} />}
    </section>
    {modal && <Modal title={modal === "create" ? "Add product" : "Edit product"} onClose={() => setModal(null)}><form className="form-grid" onSubmit={submit}><Field label="Product name"><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Thermal Bottle" /></Field><Field label="SKU" hint="Unique; automatically stored in uppercase"><input required value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="CAP-THERM-02" /></Field><Field label="Unit price (₹)"><input required type="number" min="0.01" step="0.01" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} /></Field>{modal === "create" ? <Field label="Opening stock"><input required type="number" min="0" step="1" value={form.quantity_in_stock} onChange={(e) => setForm({ ...form, quantity_in_stock: e.target.value })} /></Field> : <div className="field read-only-field"><span>Current stock</span><strong>{form.quantity_in_stock} units</strong><small>Use Inventory adjustments to change stock safely.</small></div>}<Field label="Reorder level"><input required type="number" min="0" step="1" value={form.reorder_level} onChange={(e) => setForm({ ...form, reorder_level: e.target.value })} /></Field><Field label="Description"><textarea value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional product detail" rows={3} /></Field><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setModal(null)}>Cancel</button><button className="primary-button" disabled={saving}>{saving ? "Saving…" : modal === "create" ? "Create product" : "Save changes"}</button></div></form></Modal>}
  </div>;
}

function CustomersPage({ customers, onRefresh, notify }: { customers: Customer[]; onRefresh: () => Promise<void>; notify: (type: "success" | "error", message: string) => void }) {
  const [search, setSearch] = useState(""); const [modal, setModal] = useState<"create" | "edit" | null>(null); const [form, setForm] = useState<CustomerInput>(emptyCustomer); const [saving, setSaving] = useState(false);
  const filtered = useMemo(() => customers.filter((customer) => `${customer.name} ${customer.email}`.toLowerCase().includes(search.toLowerCase())), [customers, search]);
  const openCreate = () => { setForm(emptyCustomer); setModal("create"); };
  const openEdit = (customer: Customer) => { setForm({ ...customer }); setModal("edit"); };
  const submit = async (event: FormEvent) => { event.preventDefault(); setSaving(true); try { modal === "create" ? await api.createCustomer(form) : await api.updateCustomer(form.id!, { name: form.name, email: form.email, phone: form.phone || null, address: form.address || null }); setModal(null); await onRefresh(); notify("success", modal === "create" ? "Customer created." : "Customer updated."); } catch (error) { notify("error", (error as Error).message); } finally { setSaving(false); } };
  const deleteCustomer = async (customer: Customer) => { if (!window.confirm(`Delete ${customer.name}? Customers with orders cannot be deleted.`)) return; try { await api.deleteCustomer(customer.id); await onRefresh(); notify("success", "Customer deleted."); } catch (error) { notify("error", (error as Error).message); } };
  return <div className="page-content"><div className="page-heading"><div><p className="eyebrow">Relationships</p><h1>Customers</h1><p>Maintain clean customer records with server-side unique email validation.</p></div><button className="primary-button" onClick={openCreate}>+ Add customer</button></div><section className="panel table-panel"><div className="table-toolbar"><div className="search-box">⌕<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or email" /></div><span>{filtered.length} customers</span></div>{filtered.length ? <div className="table-wrap"><table><thead><tr><th>Customer</th><th>Email</th><th>Phone</th><th>Address</th><th></th></tr></thead><tbody>{filtered.map((customer) => <tr key={customer.id}><td><strong>{customer.name}</strong><small>Added {formatDate(customer.created_at)}</small></td><td>{customer.email}</td><td>{customer.phone || "—"}</td><td className="truncate-cell">{customer.address || "—"}</td><td className="actions"><button className="text-button" onClick={() => openEdit(customer)}>Edit</button><button className="danger-button" onClick={() => deleteCustomer(customer)}>Delete</button></td></tr>)}</tbody></table></div> : <EmptyState title="No matching customers" text="Try another search or add a new customer." action={<button className="primary-button" onClick={openCreate}>Add customer</button>} />}</section>{modal && <Modal title={modal === "create" ? "Add customer" : "Edit customer"} onClose={() => setModal(null)}><form className="form-grid" onSubmit={submit}><Field label="Full name"><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Customer name" /></Field><Field label="Email" hint="Each email can be registered only once"><input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="customer@example.com" /></Field><Field label="Phone"><input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Optional" /></Field><Field label="Address"><textarea value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={3} placeholder="Optional delivery address" /></Field><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setModal(null)}>Cancel</button><button className="primary-button" disabled={saving}>{saving ? "Saving…" : modal === "create" ? "Create customer" : "Save changes"}</button></div></form></Modal>}</div>;
}

function OrderComposer({ customers, products, onCreated, notify }: { customers: Customer[]; products: Product[]; onCreated: () => Promise<void>; notify: (type: "success" | "error", message: string) => void }) {
  const [customerId, setCustomerId] = useState(""); const [notes, setNotes] = useState(""); const [items, setItems] = useState<OrderItemDraft[]>([{ product_id: "", quantity: 1 }]); const [saving, setSaving] = useState(false);
  const selected = (id: number | string) => products.find((product) => product.id === Number(id));
  const changeItem = (index: number, key: keyof OrderItemDraft, value: string) => setItems(items.map((item, current) => current === index ? { ...item, [key]: value } : item));
  const addLine = () => setItems([...items, { product_id: "", quantity: 1 }]);
  const removeLine = (index: number) => setItems(items.length > 1 ? items.filter((_, current) => current !== index) : items);
  const total = items.reduce((sum, item) => sum + (selected(item.product_id)?.unit_price || 0) * Number(item.quantity || 0), 0);
  const submit = async (event: FormEvent) => { event.preventDefault(); const parsedItems = items.filter((item) => item.product_id).map((item) => ({ product_id: Number(item.product_id), quantity: Number(item.quantity) })); if (!customerId || !parsedItems.length || parsedItems.some((item) => item.quantity < 1)) { notify("error", "Select a customer and at least one product with a positive quantity."); return; } if (new Set(parsedItems.map((item) => item.product_id)).size !== parsedItems.length) { notify("error", "Use a product only once in an order."); return; } setSaving(true); try { await api.createOrder({ customer_id: Number(customerId), notes: notes || null, items: parsedItems }); setCustomerId(""); setNotes(""); setItems([{ product_id: "", quantity: 1 }]); await onCreated(); notify("success", "Order created. Stock has been deducted atomically."); } catch (error) { notify("error", (error as Error).message); } finally { setSaving(false); } };
  return <section className="panel order-composer"><div className="panel-header"><div><p className="eyebrow">New transaction</p><h2>Create order</h2></div><span className="badge badge-info">Live stock validation</span></div><form onSubmit={submit}><div className="form-grid two-cols"><Field label="Customer"><select required value={customerId} onChange={(e) => setCustomerId(e.target.value)}><option value="">Select customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} — {customer.email}</option>)}</select></Field><Field label="Order note"><input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional note" /></Field></div><div className="order-lines"><div className="line-header"><span>Product</span><span>Available</span><span>Quantity</span><span>Line total</span><span></span></div>{items.map((item, index) => { const product = selected(item.product_id); return <div className="order-line" key={index}><select value={item.product_id} onChange={(e) => changeItem(index, "product_id", e.target.value)}><option value="">Select product</option>{products.map((candidate) => <option key={candidate.id} value={candidate.id} disabled={candidate.quantity_in_stock === 0}>{candidate.name} ({candidate.sku})</option>)}</select><span className={product && product.quantity_in_stock <= product.reorder_level ? "availability low-text" : "availability"}>{product ? `${product.quantity_in_stock} units` : "—"}</span><input aria-label="Quantity" type="number" min="1" max={product?.quantity_in_stock || 100000} value={item.quantity} onChange={(e) => changeItem(index, "quantity", e.target.value)} /><strong>{formatMoney((product?.unit_price || 0) * Number(item.quantity || 0))}</strong><button type="button" className="icon-button muted" onClick={() => removeLine(index)} disabled={items.length === 1}>×</button></div>; })}</div><div className="order-footer"><button type="button" className="secondary-button" onClick={addLine}>+ Add another item</button><div><span>Order total</span><strong>{formatMoney(total)}</strong></div><button className="primary-button" disabled={saving || !customers.length || !products.length}>{saving ? "Creating…" : "Create order"}</button></div></form></section>;
}

function OrdersPage({ orders, customers, products, onRefresh, notify }: { orders: Order[]; customers: Customer[]; products: Product[]; onRefresh: () => Promise<void>; notify: (type: "success" | "error", message: string) => void }) {
  const cancel = async (order: Order) => { if (!window.confirm(`Cancel order #${order.id}? Its item quantities will return to inventory.`)) return; try { await api.cancelOrder(order.id); await onRefresh(); notify("success", `Order #${order.id} cancelled and stock restored.`); } catch (error) { notify("error", (error as Error).message); } };
  return <div className="page-content"><div className="page-heading"><div><p className="eyebrow">Sales flow</p><h1>Orders</h1><p>Orders validate available stock and deduct inventory only after a successful transaction.</p></div></div><OrderComposer customers={customers} products={products} onCreated={onRefresh} notify={notify} /><section className="panel table-panel"><div className="panel-header"><div><p className="eyebrow">Order log</p><h2>All orders</h2></div><span>{orders.length} total</span></div>{orders.length ? <div className="table-wrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th><th></th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td><strong>#{order.id}</strong><small>{formatDate(order.created_at)}</small></td><td><strong>{order.customer.name}</strong><small>{order.customer.email}</small></td><td><div className="item-list">{order.items.map((item) => <span key={item.id}>{item.product.name} × {item.quantity}</span>)}</div></td><td><strong>{formatMoney(order.total_amount)}</strong></td><td><span className={statusClass(order.status)}>{order.status}</span></td><td>{order.status === "CREATED" && <button className="danger-button" onClick={() => cancel(order)}>Cancel</button>}</td></tr>)}</tbody></table></div> : <EmptyState title="No orders yet" text="Create a customer and product, then place your first order." />}</section></div>;
}

function InventoryPage({ products, transactions, onRefresh, notify }: { products: Product[]; transactions: InventoryTransaction[]; onRefresh: () => Promise<void>; notify: (type: "success" | "error", message: string) => void }) {
  const [productId, setProductId] = useState(""); const [change, setChange] = useState(""); const [note, setNote] = useState(""); const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent) => { event.preventDefault(); if (!productId || !change || !note.trim()) { notify("error", "Select a product, enter a non-zero adjustment, and add a reason."); return; } setSaving(true); try { await api.adjustInventory({ product_id: Number(productId), quantity_change: Number(change), note: note.trim() }); setProductId(""); setChange(""); setNote(""); await onRefresh(); notify("success", "Inventory adjusted and audit record created."); } catch (error) { notify("error", (error as Error).message); } finally { setSaving(false); } };
  return <div className="page-content"><div className="page-heading"><div><p className="eyebrow">Traceability</p><h1>Inventory</h1><p>Use reasoned adjustments and review the complete movement history for each product.</p></div></div><div className="inventory-grid"><section className="panel"><div className="panel-header"><div><p className="eyebrow">Controlled update</p><h2>Manual stock adjustment</h2></div></div><form className="form-grid" onSubmit={submit}><Field label="Product"><select value={productId} onChange={(e) => setProductId(e.target.value)}><option value="">Select product</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.quantity_in_stock} in stock</option>)}</select></Field><Field label="Quantity change" hint="Use positive values for received stock; negative values for write-offs."><input type="number" required value={change} onChange={(e) => setChange(e.target.value)} placeholder="e.g. 12 or -3" /></Field><Field label="Reason"><textarea required rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Received supplier shipment PO-102" /></Field><button className="primary-button" disabled={saving}>{saving ? "Applying…" : "Apply adjustment"}</button></form></section><section className="panel inventory-rules"><p className="eyebrow">Business rules</p><h2>Stock never goes below zero.</h2><ul><li>Order creation locks affected products and validates their latest quantities.</li><li>Manual reductions that would create negative stock are rejected.</li><li>Every adjustment, order deduction, and cancellation return is retained as a transaction.</li></ul></section></div><section className="panel table-panel"><div className="panel-header"><div><p className="eyebrow">Audit trail</p><h2>Inventory transactions</h2></div><span>{transactions.length} records</span></div>{transactions.length ? <div className="table-wrap"><table><thead><tr><th>When</th><th>Product</th><th>Type</th><th>Change</th><th>Reference</th><th>Note</th></tr></thead><tbody>{transactions.map((transaction) => <tr key={transaction.id}><td>{formatDate(transaction.created_at)}</td><td><strong>{transaction.product.name}</strong><small>{transaction.product.sku}</small></td><td><span className="badge badge-info">{transaction.transaction_type.replaceAll("_", " ")}</span></td><td><strong className={transaction.quantity_change < 0 ? "change-negative" : "change-positive"}>{transaction.quantity_change > 0 ? "+" : ""}{transaction.quantity_change}</strong></td><td>{transaction.order_id ? `Order #${transaction.order_id}` : "—"}</td><td className="truncate-cell">{transaction.note || "—"}</td></tr>)}</tbody></table></div> : <EmptyState title="No inventory records" text="Stock movements will appear here." />}</section></div>;
}

export default function App() {
  const [page, setPage] = useState<PageId>("dashboard"); const [mobileOpen, setMobileOpen] = useState(false); const [data, setData] = useState<AppData>({ summary: null, products: [], customers: [], orders: [], transactions: [] }); const [loading, setLoading] = useState(true); const [toast, setToast] = useState<ToastState | null>(null);
  const notify = (type: "success" | "error", message: string) => { setToast({ type, message }); window.setTimeout(() => setToast(null), 4500); };
  const loadData = async () => { setLoading(true); try { const [summary, products, customers, orders, transactions] = await Promise.all([api.dashboard(), api.products(), api.customers(), api.orders(), api.transactions()]); setData({ summary, products, customers, orders, transactions }); } catch (error) { notify("error", `Could not load data: ${(error as Error).message}`); } finally { setLoading(false); } };
  useEffect(() => { loadData(); }, []);
  const changePage = (next: PageId) => { setPage(next); setMobileOpen(false); };
  let content: ReactNode;
  if (page === "products") content = <ProductsPage products={data.products} onRefresh={loadData} notify={notify} />;
  else if (page === "customers") content = <CustomersPage customers={data.customers} onRefresh={loadData} notify={notify} />;
  else if (page === "orders") content = <OrdersPage orders={data.orders} customers={data.customers} products={data.products} onRefresh={loadData} notify={notify} />;
  else if (page === "inventory") content = <InventoryPage products={data.products} transactions={data.transactions} onRefresh={loadData} notify={notify} />;
  else content = <Dashboard summary={data.summary} loading={loading} setPage={changePage} />;
  return <div className="app-shell"><aside className={`sidebar ${mobileOpen ? "open" : ""}`}><div className="brand"><div className="brand-mark">S</div><div><strong>StockPilot</strong><span>Operations console</span></div></div><nav>{NAV_ITEMS.map(([id, label, icon]) => <button key={id} className={page === id ? "nav-item active" : "nav-item"} onClick={() => changePage(id)}><span>{icon}</span>{label}</button>)}</nav><div className="sidebar-footer"><span className="live-dot"></span><span>API connected</span></div></aside><main className="main"><header className="topbar"><button className="menu-button" onClick={() => setMobileOpen(!mobileOpen)}>☰</button><div><span className="workspace-label">Workspace</span><strong>Inventory management</strong></div><div className="topbar-actions"><button className="refresh-button" onClick={loadData} disabled={loading}>{loading ? "Refreshing…" : "↻ Refresh"}</button><div className="avatar">AS</div></div></header>{content}</main><Toast toast={toast} onClose={() => setToast(null)} /></div>;
}
