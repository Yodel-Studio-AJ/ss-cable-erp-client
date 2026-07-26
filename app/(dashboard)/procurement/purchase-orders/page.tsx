"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  ShoppingCart, Plus, Search, ChevronRight, Package, Trash2,
  CheckCircle, Truck, XCircle, FileText,
} from "lucide-react";
import {
  listPurchaseOrders, createPurchaseOrder,
} from "@/api/purchaseOrders";
import { listAllProducts } from "@/api/products";
import { getVendors } from "@/api/vendors";
import type { PurchaseOrder, CreatePoPayload, PoStatus, PoItemInput } from "@/types/purchaseOrder";
import { PO_STATUS_LABELS } from "@/types/purchaseOrder";
import type { ProductWithGroup } from "@/api/products";
import type { Vendor } from "@/types/vendor";

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(n: number) {
  if (!n) return "—";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);
}

const STATUS_ICON: Record<PoStatus, React.ReactNode> = {
  draft:      <FileText size={12} />,
  confirmed:  <CheckCircle size={12} />,
  in_transit: <Truck size={12} />,
  delivered:  <CheckCircle size={12} />,
  cancelled:  <XCircle size={12} />,
};

const STATUS_COLOR: Record<PoStatus, string> = {
  draft:      "#6b7280",
  confirmed:  "#3b82f6",
  in_transit: "#f59e0b",
  delivered:  "#22c55e",
  cancelled:  "#ef4444",
};

function StatusBadge({ status }: { status: PoStatus }) {
  const color = STATUS_COLOR[status];
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap"
      style={{
        color,
        backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
      }}>
      {STATUS_ICON[status]} {PO_STATUS_LABELS[status]}
    </span>
  );
}

// ─── vendor selector ──────────────────────────────────────────────────────────

function VendorSelector({
  vendors, groupId, value, onChange, inputCls, inputStyle,
}: {
  vendors: Vendor[]; groupId: string; value: string;
  onChange: (id: string) => void; inputCls: string; inputStyle: React.CSSProperties;
}) {
  const preferred = vendors.filter((v) => v.productGroupIds?.includes(groupId));
  const others    = vendors.filter((v) => !v.productGroupIds?.includes(groupId));

  return (
    <div className="space-y-2">
      {preferred.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider font-semibold mb-1.5" style={{ color: "#8b5cf6" }}>
            ★ Preferred for this group ({preferred.length})
          </p>
          <div className="space-y-1.5">
            {preferred.map((v) => (
              <button key={v.id} type="button" onClick={() => onChange(value === v.id ? "" : v.id)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm text-left transition-all"
                style={{
                  borderColor: value === v.id ? "#8b5cf6" : "color-mix(in srgb, #8b5cf6 30%, var(--color-border))",
                  backgroundColor: value === v.id ? "color-mix(in srgb, #8b5cf6 10%, transparent)" : "color-mix(in srgb, #8b5cf6 4%, transparent)",
                  color: "var(--color-text-primary)",
                }}>
                <div>
                  <p className="font-medium text-sm">{v.companyName}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                    {v.vendorType}{v.city && ` · ${v.city}`}
                  </p>
                </div>
                {value === v.id && <span className="text-xs font-semibold shrink-0 ml-2" style={{ color: "#8b5cf6" }}>✓</span>}
              </button>
            ))}
          </div>
        </div>
      )}
      <select value={preferred.some((v) => v.id === value) ? "" : value}
        onChange={(e) => onChange(e.target.value)} className={inputCls} style={inputStyle}>
        <option value="">{preferred.length > 0 ? "Other vendors…" : "No vendor / TBD"}</option>
        {others.map((v) => (
          <option key={v.id} value={v.id}>{v.companyName}{v.city ? ` — ${v.city}` : ""}</option>
        ))}
      </select>
    </div>
  );
}

// ─── create modal (multi-item) ────────────────────────────────────────────────

interface DraftItem { productId: string; qty: string; unitPrice: string; notes: string }

const EMPTY_ITEM = (): DraftItem => ({ productId: "", qty: "", unitPrice: "", notes: "" });

function CreatePoModal({
  products, vendors, onCreated, onClose, prefilledProductId,
}: {
  products: ProductWithGroup[];
  vendors: Vendor[];
  onCreated: (po: PurchaseOrder) => void;
  onClose: () => void;
  prefilledProductId?: string;
}) {
  const [vendorId, setVendorId]         = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes]               = useState("");
  const [items, setItems]               = useState<DraftItem[]>(
    prefilledProductId ? [{ ...EMPTY_ITEM(), productId: prefilledProductId }] : [EMPTY_ITEM()]
  );
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState<string | null>(null);

  const firstGroupId = products.find((p) => p.id === (items[0]?.productId))?.productGroupId ?? "";

  function setItem(idx: number, field: keyof DraftItem, val: string) {
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, [field]: val } : it));
  }

  function addItem() { setItems((p) => [...p, EMPTY_ITEM()]); }
  function removeItem(idx: number) { if (items.length > 1) setItems((p) => p.filter((_, i) => i !== idx)); }

  const grandTotal = items.reduce((sum, it) => {
    const q = parseFloat(it.qty);
    const u = parseFloat(it.unitPrice);
    return sum + (isNaN(q) || isNaN(u) ? 0 : q * u);
  }, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    for (const it of items) {
      if (!it.productId || !it.qty) { setError("Each item needs a product and quantity."); return; }
    }
    setSaving(true);
    setError(null);
    try {
      const payload: CreatePoPayload = {
        vendorId:             vendorId || null,
        expectedDeliveryDate: expectedDate || null,
        notes:                notes || null,
        items:                items.map((it) => ({
          productId:       it.productId,
          quantityOrdered: parseFloat(it.qty),
          unitPrice:       it.unitPrice ? parseFloat(it.unitPrice) : null,
          notes:           it.notes || null,
        } as PoItemInput)),
      };
      const po = await createPurchaseOrder(payload);
      onCreated(po);
    } catch {
      setError("Failed to create purchase order.");
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "w-full border rounded-lg px-3 py-2 text-sm focus:outline-none";
  const inputStyle: React.CSSProperties = {
    backgroundColor: "var(--color-bg-input)",
    borderColor:     "var(--color-border-input)",
    color:           "var(--color-text-primary)",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
      <div className="w-full max-w-2xl rounded-xl shadow-xl overflow-hidden max-h-[92vh] flex flex-col"
        style={{ backgroundColor: "var(--color-bg-popup)", border: "1px solid var(--color-border)" }}>
        <div className="px-6 py-4 shrink-0" style={{ borderBottom: "1px solid var(--color-border)" }}>
          <h2 className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>New Purchase Order</h2>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {error && (
            <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: "var(--color-text-muted)" }}>
                Items
              </p>
              <button type="button" onClick={addItem}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border hover:opacity-70 transition-opacity"
                style={{ borderColor: "var(--color-border)", color: "var(--color-text-secondary)" }}>
                <Plus size={11} /> Add Item
              </button>
            </div>
            <div className="space-y-3">
              {items.map((it, idx) => {
                const rowTotal = parseFloat(it.qty) * parseFloat(it.unitPrice);
                return (
                  <div key={idx} className="border rounded-xl p-3 space-y-2"
                    style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-bg-subtle)" }}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
                        Item {idx + 1}
                      </span>
                      {items.length > 1 && (
                        <button type="button" onClick={() => removeItem(idx)}
                          className="text-red-400 hover:text-red-600 transition-colors">
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                    <select value={it.productId} onChange={(e) => setItem(idx, "productId", e.target.value)}
                      className={inputCls} style={inputStyle} required>
                      <option value="">Select product…</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.groupName} — {p.name}</option>
                      ))}
                    </select>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="number" min="0.01" step="any" value={it.qty}
                        onChange={(e) => setItem(idx, "qty", e.target.value)}
                        className={inputCls} style={inputStyle} placeholder="Qty" required />
                      <input type="number" min="0.01" step="any" value={it.unitPrice}
                        onChange={(e) => setItem(idx, "unitPrice", e.target.value)}
                        className={inputCls} style={inputStyle} placeholder="Unit price (₹)" />
                    </div>
                    {!isNaN(rowTotal) && rowTotal > 0 && (
                      <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                        Row total: <span className="font-semibold" style={{ color: "var(--color-text-primary)" }}>
                          {formatCurrency(rowTotal)}
                        </span>
                      </p>
                    )}
                    <input type="text" value={it.notes}
                      onChange={(e) => setItem(idx, "notes", e.target.value)}
                      className={inputCls} style={inputStyle} placeholder="Item notes (optional)" />
                  </div>
                );
              })}
            </div>
            {grandTotal > 0 && (
              <p className="mt-2 text-sm font-semibold text-right" style={{ color: "var(--color-text-primary)" }}>
                Grand Total: {formatCurrency(grandTotal)}
              </p>
            )}
          </div>

          {/* Vendor */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2"
              style={{ color: "var(--color-text-muted)" }}>Vendor</p>
            {firstGroupId ? (
              <VendorSelector vendors={vendors} groupId={firstGroupId}
                value={vendorId} onChange={setVendorId} inputCls={inputCls} inputStyle={inputStyle} />
            ) : (
              <select value={vendorId} onChange={(e) => setVendorId(e.target.value)}
                className={inputCls} style={inputStyle}>
                <option value="">No vendor / TBD</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>{v.companyName}</option>
                ))}
              </select>
            )}
          </div>

          {/* Delivery + notes */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--color-text-muted)" }}>Expected Delivery</label>
              <input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)}
                className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--color-text-muted)" }}>PO Notes</label>
              <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
                className={inputCls} style={inputStyle} placeholder="Optional…" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm"
              style={{ backgroundColor: "var(--color-bg-subtle)", color: "var(--color-text-secondary)" }}>
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              style={{ backgroundColor: "var(--color-btn-bg)", color: "var(--color-btn-text)" }}>
              {saving ? "Creating…" : "Create PO"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function PurchaseOrdersPage() {
  const [orders, setOrders]           = useState<PurchaseOrder[]>([]);
  const [products, setProducts]       = useState<ProductWithGroup[]>([]);
  const [vendors, setVendors]         = useState<Vendor[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showCreate, setShowCreate]   = useState(false);
  const [search, setSearch]           = useState("");
  const [statusFilter, setStatusFilter] = useState<PoStatus | "">("");

  useEffect(() => {
    Promise.all([listPurchaseOrders(), listAllProducts(), getVendors()])
      .then(([pos, prods, vends]) => { setOrders(pos); setProducts(prods); setVendors(vends); })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return orders.filter((po) => {
      const matchSearch =
        !q ||
        po.poNumber.toLowerCase().includes(q) ||
        po.items.some((it) => it.productName.toLowerCase().includes(q)) ||
        (po.vendorName?.toLowerCase().includes(q) ?? false);
      const matchStatus = !statusFilter || po.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [orders, search, statusFilter]);

  function handleCreated(po: PurchaseOrder) {
    setOrders((prev) => [po, ...prev]);
    setShowCreate(false);
  }

  if (loading) {
    return <div className="p-8 text-center text-sm" style={{ color: "var(--color-text-muted)" }}>Loading…</div>;
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl" style={{ backgroundColor: "var(--color-bg-subtle)" }}>
            <ShoppingCart size={18} style={{ color: "var(--color-text-secondary)" }} />
          </div>
          <div>
            <h1 className="text-xl font-semibold" style={{ color: "var(--color-text-primary)" }}>Purchase Orders</h1>
            <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>{orders.length} total</p>
          </div>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium hover:opacity-80 transition-opacity"
          style={{ backgroundColor: "var(--color-btn-bg)", color: "var(--color-btn-text)" }}>
          <Plus size={14} /> New PO
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--color-text-muted)" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search PO number, product, vendor…"
            className="w-full border rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none"
            style={{ backgroundColor: "var(--color-bg-input)", borderColor: "var(--color-border-input)", color: "var(--color-text-primary)" }} />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as PoStatus | "")}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none"
          style={{ backgroundColor: "var(--color-bg-input)", borderColor: "var(--color-border-input)", color: "var(--color-text-primary)" }}>
          <option value="">All Statuses</option>
          {(["draft", "confirmed", "in_transit", "delivered", "cancelled"] as PoStatus[]).map((s) => (
            <option key={s} value={s}>{PO_STATUS_LABELS[s]}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="border rounded-xl overflow-hidden"
        style={{ backgroundColor: "var(--color-bg-popup)", borderColor: "var(--color-border)" }}>
        {filtered.length === 0 ? (
          <div className="text-center py-12" style={{ color: "var(--color-text-muted)" }}>
            <ShoppingCart size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">
              {orders.length === 0 ? "No purchase orders yet." : "No orders match your search."}
            </p>
            {orders.length === 0 && (
              <button onClick={() => setShowCreate(true)} className="mt-3 text-sm underline hover:opacity-70">
                Create the first one
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-[6rem_1fr_1fr_5rem_7rem_5rem_2rem] items-center px-5 py-2.5
              text-[11px] font-medium uppercase tracking-wider"
              style={{ color: "var(--color-text-muted)", borderBottom: "1px solid var(--color-border)" }}>
              <span>PO #</span><span>Products</span><span>Vendor</span>
              <span className="text-center">Items</span><span className="text-right">Total</span>
              <span>Status</span><span />
            </div>
            {filtered.map((po, idx) => (
              <Link key={po.id} href={`/procurement/purchase-orders/${po.id}`}
                className="grid grid-cols-[6rem_1fr_1fr_5rem_7rem_5rem_2rem] items-center px-5 py-3.5 gap-x-3
                  hover:opacity-80 transition-opacity"
                style={{ borderTop: idx > 0 ? "1px solid var(--color-border)" : undefined }}>
                <span className="text-xs font-mono font-medium"
                  style={{ color: "var(--color-text-secondary)" }}>{po.poNumber}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--color-text-primary)" }}>
                    {po.items[0]?.productName ?? "—"}
                  </p>
                  {po.itemCount > 1 && (
                    <p className="text-[10px] mt-0.5 flex items-center gap-1" style={{ color: "var(--color-text-muted)" }}>
                      <Package size={10} /> +{po.itemCount - 1} more item{po.itemCount - 1 > 1 ? "s" : ""}
                    </p>
                  )}
                </div>
                <span className="text-sm truncate" style={{ color: "var(--color-text-secondary)" }}>
                  {po.vendorName ?? <span style={{ color: "var(--color-text-muted)" }}>—</span>}
                </span>
                <span className="text-sm text-center font-mono" style={{ color: "var(--color-text-secondary)" }}>
                  {po.itemCount}
                </span>
                <span className="text-sm text-right font-mono tabular-nums"
                  style={{ color: "var(--color-text-secondary)" }}>
                  {formatCurrency(po.totalAmount)}
                </span>
                <StatusBadge status={po.status} />
                <ChevronRight size={14} style={{ color: "var(--color-text-muted)" }} />
              </Link>
            ))}
          </>
        )}
      </div>

      {showCreate && (
        <CreatePoModal products={products} vendors={vendors}
          onCreated={handleCreated} onClose={() => setShowCreate(false)} />
      )}
    </div>
  );
}
