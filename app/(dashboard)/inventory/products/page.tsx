"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Search, Package, ChevronRight, CheckCircle, XCircle, Star, ShoppingCart, X,
} from "lucide-react";
import { listAllProducts, type ProductWithGroup } from "@/api/products";
import { getVendors } from "@/api/vendors";
import { createPurchaseOrder } from "@/api/purchaseOrders";
import type { Vendor } from "@/types/vendor";
import type { CreatePoPayload } from "@/types/purchaseOrder";

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatValue(v: { numericValue: number | null; textValue: string | null }) {
  if (v.numericValue != null)
    return v.numericValue.toLocaleString("en-IN", { maximumFractionDigits: 4 });
  return v.textValue ?? "—";
}

// ─── quick PO modal ───────────────────────────────────────────────────────────

function QuickPoModal({
  product,
  vendors,
  onDone,
  onClose,
}: {
  product: ProductWithGroup;
  vendors: Vendor[];
  onDone: () => void;
  onClose: () => void;
}) {
  const preferred = vendors.filter((v) => v.productGroupIds?.includes(product.productGroupId));
  const others    = vendors.filter((v) => !v.productGroupIds?.includes(product.productGroupId));

  const [vendorId, setVendorId]   = useState("");
  const [qty, setQty]             = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const total = qty && unitPrice ? parseFloat(qty) * parseFloat(unitPrice) : null;

  function formatCurrency(n: number) {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!qty) { setError("Quantity is required."); return; }
    setSaving(true);
    setError(null);
    try {
      const payload: CreatePoPayload = {
        vendorId: vendorId || null,
        items: [{
          productId:       product.id,
          quantityOrdered: parseFloat(qty),
          unitPrice:       unitPrice ? parseFloat(unitPrice) : null,
        }],
      };
      await createPurchaseOrder(payload);
      onDone();
    } catch {
      setError("Failed to create purchase order.");
      setSaving(false);
    }
  }

  const inputCls = "w-full border rounded-lg px-3 py-2 text-sm focus:outline-none";
  const iStyle: React.CSSProperties = {
    backgroundColor: "var(--color-bg-input)",
    borderColor:     "var(--color-border-input)",
    color:           "var(--color-text-primary)",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md rounded-xl shadow-2xl overflow-hidden"
        style={{ backgroundColor: "var(--color-bg-popup)", border: "1px solid var(--color-border)" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid var(--color-border)" }}>
          <div>
            <p className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>New Purchase Order</p>
            <p className="text-sm font-semibold mt-0.5" style={{ color: "var(--color-text-primary)" }}>
              {product.groupName} — {product.name}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:opacity-70"
            style={{ color: "var(--color-text-muted)" }}>
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {error && (
            <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          {/* Vendor */}
          <div className="space-y-2">
            <label className="block text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
              Vendor
            </label>
            {preferred.length > 0 && (
              <>
                <p className="text-[10px] uppercase tracking-wider font-semibold"
                  style={{ color: "#8b5cf6" }}>
                  ★ Preferred for {product.groupName}
                </p>
                <div className="flex flex-wrap gap-2">
                  {preferred.map((v) => (
                    <button key={v.id} type="button"
                      onClick={() => setVendorId(vendorId === v.id ? "" : v.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-all"
                      style={{
                        borderColor: vendorId === v.id ? "#8b5cf6" : "color-mix(in srgb, #8b5cf6 35%, var(--color-border))",
                        backgroundColor: vendorId === v.id
                          ? "color-mix(in srgb, #8b5cf6 12%, transparent)"
                          : "color-mix(in srgb, #8b5cf6 4%, transparent)",
                        color: vendorId === v.id ? "#8b5cf6" : "var(--color-text-primary)",
                        fontWeight: vendorId === v.id ? 600 : undefined,
                      }}>
                      {v.companyName}
                      {vendorId === v.id && <span>✓</span>}
                    </button>
                  ))}
                </div>
              </>
            )}
            <select value={preferred.some(v => v.id === vendorId) ? "" : vendorId}
              onChange={(e) => setVendorId(e.target.value)}
              className={inputCls} style={iStyle}>
              <option value="">{preferred.length > 0 ? "Other vendor…" : "No vendor / TBD"}</option>
              {others.map((v) => <option key={v.id} value={v.id}>{v.companyName}</option>)}
            </select>
          </div>

          {/* Qty + Price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--color-text-muted)" }}>
                Quantity *
              </label>
              <input type="number" min="0.01" step="any" value={qty}
                onChange={(e) => setQty(e.target.value)}
                className={inputCls} style={iStyle} placeholder="0" required />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--color-text-muted)" }}>
                Unit Price (₹)
              </label>
              <input type="number" min="0.01" step="any" value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                className={inputCls} style={iStyle} placeholder="0.00" />
            </div>
          </div>

          {total != null && (
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              Total: <span className="font-semibold" style={{ color: "var(--color-text-primary)" }}>
                {formatCurrency(total)}
              </span>
            </p>
          )}

          <div className="flex items-center justify-between pt-1">
            <Link href="/procurement/purchase-orders"
              className="text-xs hover:underline flex items-center gap-1"
              style={{ color: "var(--color-text-muted)" }}>
              All purchase orders <ChevronRight size={10} />
            </Link>
            <div className="flex gap-2">
              <button type="button" onClick={onClose}
                className="px-3 py-1.5 rounded-lg text-sm"
                style={{ backgroundColor: "var(--color-bg-subtle)", color: "var(--color-text-secondary)" }}>
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className="px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50"
                style={{ backgroundColor: "var(--color-btn-bg)", color: "var(--color-btn-text)" }}>
                {saving ? "Creating…" : "Create PO"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function ProductVariantsPage() {
  const [products, setProducts] = useState<ProductWithGroup[]>([]);
  const [vendors, setVendors]   = useState<Vendor[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [search, setSearch]     = useState("");
  const [groupFilter, setGroup] = useState("");
  const [poTarget, setPoTarget] = useState<ProductWithGroup | null>(null);
  const [poSuccess, setPoSuccess] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listAllProducts(), getVendors()])
      .then(([data, vends]) => {
        if (!cancelled) { setProducts(data); setVendors(vends); setLoading(false); }
      })
      .catch(() => { if (!cancelled) { setError("Failed to load products."); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  const groups = useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of products) seen.set(p.productGroupId, p.groupName);
    return Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [products]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return products.filter((p) => {
      if (groupFilter && p.productGroupId !== groupFilter) return false;
      if (q && !p.name.toLowerCase().includes(q) && !(p.sku ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [products, search, groupFilter]);

  const byGroup = useMemo(() => {
    const map = new Map<string, { groupName: string; groupId: string; items: ProductWithGroup[] }>();
    for (const p of filtered) {
      if (!map.has(p.productGroupId))
        map.set(p.productGroupId, { groupName: p.groupName, groupId: p.productGroupId, items: [] });
      map.get(p.productGroupId)!.items.push(p);
    }
    return Array.from(map.values()).sort((a, b) => a.groupName.localeCompare(b.groupName));
  }, [filtered]);

  function handlePoCreated() {
    setPoSuccess(`PO created for ${poTarget?.name}`);
    setPoTarget(null);
    setTimeout(() => setPoSuccess(null), 4000);
  }

  // Column widths: name + one per attr + sku + status + po-btn + chevron
  function colTemplate(attrCount: number) {
    return `minmax(12rem, 1fr) ${Array(attrCount).fill("minmax(0, 8rem)").join(" ")} 7rem 5.5rem 2.5rem 2rem`;
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--color-text-primary)" }}>
            Product Variants
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--color-text-muted)" }}>
            All product variants across groups
          </p>
        </div>
        <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          {filtered.length} variant{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Success toast */}
      {poSuccess && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm border"
          style={{
            backgroundColor: "color-mix(in srgb, #22c55e 10%, transparent)",
            borderColor: "color-mix(in srgb, #22c55e 30%, transparent)",
            color: "#16a34a",
          }}>
          <CheckCircle size={14} /> {poSuccess}
          <Link href="/procurement/purchase-orders" className="ml-auto text-xs underline hover:opacity-70">
            View POs
          </Link>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--color-text-muted)" }} />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or SKU…"
            className="w-full border rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none"
            style={{ backgroundColor: "var(--color-bg-input)", borderColor: "var(--color-border-input)", color: "var(--color-text-primary)" }}
          />
        </div>
        <select value={groupFilter} onChange={(e) => setGroup(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none"
          style={{ backgroundColor: "var(--color-bg-input)", borderColor: "var(--color-border-input)", color: "var(--color-text-primary)" }}>
          <option value="">All groups</option>
          {groups.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-lg" style={{ backgroundColor: "var(--color-border)" }} />
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-red-500">{error}</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16" style={{ color: "var(--color-text-muted)" }}>
          <Package size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">
            {search || groupFilter
              ? "No variants match your filters."
              : "No product variants yet. Create them from a product group."}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {byGroup.map(({ groupName, groupId, items }) => {
            const sampleAttrs = items[0]?.attributeValues ?? [];
            const cols = colTemplate(sampleAttrs.length);

            return (
              <div key={groupId} className="border rounded-xl overflow-hidden"
                style={{ backgroundColor: "var(--color-bg-popup)", borderColor: "var(--color-border)" }}>

                {/* Group header */}
                <div className="flex items-center justify-between px-5 py-3"
                  style={{ borderBottom: "1px solid var(--color-border)", backgroundColor: "var(--color-bg-subtle)" }}>
                  <div className="flex items-center gap-2">
                    <Package size={13} style={{ color: "var(--color-text-muted)" }} />
                    <span className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                      {groupName}
                    </span>
                    <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                      {items.length} variant{items.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <Link href={`/inventory/product-groups/${groupId}`}
                    className="flex items-center gap-1 text-xs hover:opacity-70 transition-opacity"
                    style={{ color: "var(--color-text-muted)" }}>
                    Group page <ChevronRight size={12} />
                  </Link>
                </div>

                {/* Table header */}
                <div className="grid items-end px-5 py-2.5 gap-x-3"
                  style={{
                    gridTemplateColumns: cols,
                    borderBottom: "1px solid var(--color-border)",
                  }}>
                  <span className="text-[11px] font-medium uppercase tracking-wider"
                    style={{ color: "var(--color-text-muted)" }}>
                    Name
                  </span>

                  {sampleAttrs.map((av) => (
                    <div key={av.productGroupAttributeId}
                      className="flex flex-col items-end text-right overflow-hidden">
                      {/* Attr name — truncated, with full text in title */}
                      <span
                        className="text-[11px] font-medium uppercase tracking-wide leading-tight"
                        style={{
                          color: av.isQuantityBasis ? "#8b5cf6" : "var(--color-text-muted)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          maxWidth: "100%",
                          display: "flex",
                          alignItems: "center",
                          gap: "3px",
                        }}
                        title={av.attrName ?? ""}
                      >
                        {av.isQuantityBasis && <Star size={8} style={{ flexShrink: 0, color: "#8b5cf6" }} />}
                        {av.attrName ?? "Attr"}
                      </span>
                      {/* Unit on second line */}
                      {av.attrUnit && (
                        <span className="text-[10px] mt-0.5 leading-tight"
                          style={{ color: "var(--color-text-muted)", opacity: 0.7 }}>
                          ({av.attrUnit})
                        </span>
                      )}
                    </div>
                  ))}

                  <span className="text-[11px] font-medium uppercase tracking-wider"
                    style={{ color: "var(--color-text-muted)" }}>
                    SKU
                  </span>
                  <span className="text-[11px] font-medium uppercase tracking-wider"
                    style={{ color: "var(--color-text-muted)" }}>
                    Status
                  </span>
                  {/* PO button col */}
                  <span />
                  {/* Chevron col */}
                  <span />
                </div>

                {/* Rows */}
                {items.map((p, idx) => (
                  <div
                    key={p.id}
                    className="grid items-center px-5 py-3 gap-x-3 group"
                    style={{
                      gridTemplateColumns: cols,
                      borderTop: idx > 0 ? "1px solid var(--color-border)" : undefined,
                    }}
                  >
                    {/* Name — clickable link */}
                    <Link href={`/inventory/products/${p.id}`} className="min-w-0">
                      <p className="text-sm font-medium truncate group-hover:underline underline-offset-2"
                        style={{ color: "var(--color-text-primary)" }}>
                        {p.name}
                      </p>
                      {p.sku && (
                        <p className="text-xs font-mono mt-0.5 truncate"
                          style={{ color: "var(--color-text-muted)" }}>
                          {p.sku}
                        </p>
                      )}
                    </Link>

                    {/* Attribute value columns */}
                    {sampleAttrs.map((schemaAv) => {
                      const actual = p.attributeValues.find(
                        (v) => v.productGroupAttributeId === schemaAv.productGroupAttributeId
                      );
                      return (
                        <span
                          key={schemaAv.productGroupAttributeId}
                          className="text-right font-mono text-sm tabular-nums"
                          style={{
                            color: schemaAv.isQuantityBasis ? "#8b5cf6" : "var(--color-text-secondary)",
                            fontWeight: schemaAv.isQuantityBasis ? 600 : undefined,
                          }}
                        >
                          {actual
                            ? formatValue(actual)
                            : <span style={{ color: "var(--color-text-muted)" }}>—</span>}
                        </span>
                      );
                    })}

                    {/* SKU — already shown under name, keep here for alignment */}
                    <span className="text-xs font-mono truncate" style={{ color: "var(--color-text-muted)" }}>
                      {p.sku ?? "—"}
                    </span>

                    {/* Status */}
                    <span className="flex items-center gap-1 text-xs">
                      {p.isActive
                        ? <><CheckCircle size={11} className="text-green-500" /><span className="text-green-600">Active</span></>
                        : <><XCircle size={11} className="text-red-400" /><span className="text-red-500">Inactive</span></>}
                    </span>

                    {/* New PO button */}
                    <button
                      onClick={() => setPoTarget(p)}
                      className="flex items-center justify-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium
                        border transition-all hover:opacity-90"
                      style={{
                        borderColor: "color-mix(in srgb, #8b5cf6 35%, var(--color-border))",
                        backgroundColor: "color-mix(in srgb, #8b5cf6 6%, transparent)",
                        color: "#8b5cf6",
                      }}
                      title="Create Purchase Order"
                    >
                      <ShoppingCart size={11} /> PO
                    </button>

                    {/* Detail chevron */}
                    <Link href={`/inventory/products/${p.id}`}
                      style={{ color: "var(--color-text-muted)" }}
                      className="flex items-center justify-center hover:opacity-70">
                      <ChevronRight size={14} />
                    </Link>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Quick PO modal */}
      {poTarget && (
        <QuickPoModal
          product={poTarget}
          vendors={vendors}
          onDone={handlePoCreated}
          onClose={() => setPoTarget(null)}
        />
      )}
    </div>
  );
}
