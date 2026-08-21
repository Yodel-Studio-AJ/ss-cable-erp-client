"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Package, Tag, Calendar, CheckCircle, XCircle,
  Hash, FlaskConical, GitMerge, Star, AlertTriangle, ShoppingCart,
  TrendingUp, Layers, ChevronRight, Edit2, IndianRupee,
} from "lucide-react";
import { getProduct, type ProductWithGroup } from "@/api-client/products";
import {
  getStock, setLowStockThreshold, getStockBatches,
  getProductPricing, updatePricingConfig,
} from "@/api-client/purchaseOrders";
import { listPurchaseOrders } from "@/api-client/purchaseOrders";
import type {
  StockInfo, StockBatch, ProductPricingData, PricingMethod,
  PurchaseOrder, PoStatus,
} from "@/types/purchaseOrder";
import {
  PRICING_METHODS, PRICING_METHOD_LABELS, PO_STATUS_LABELS,
} from "@/types/purchaseOrder";

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { dateStyle: "medium" });
}

function formatCurrency(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);
}

type AttributeKind = "qty_basis" | "calculated" | "from_input" | "simple";

function attrKind(av: {
  isQuantityBasis: boolean | null;
  isCalculated: boolean | null;
  isFromInput: boolean | null;
}): AttributeKind {
  if (av.isQuantityBasis) return "qty_basis";
  if (av.isCalculated)    return "calculated";
  if (av.isFromInput)     return "from_input";
  return "simple";
}

const KIND_LABEL: Record<AttributeKind, string> = {
  qty_basis:  "Qty Basis",
  calculated: "Calculated",
  from_input: "From Input",
  simple:     "Simple",
};

const KIND_ICON: Record<AttributeKind, React.ReactNode> = {
  qty_basis:  <Star size={10} />,
  calculated: <FlaskConical size={10} />,
  from_input: <GitMerge size={10} />,
  simple:     <Hash size={10} />,
};

const KIND_COLOR: Record<AttributeKind, string> = {
  qty_basis:  "#8b5cf6",
  calculated: "#6366f1",
  from_input: "#0ea5e9",
  simple:     "#6b7280",
};

const PO_STATUS_COLOR: Record<PoStatus, string> = {
  draft:      "#6b7280",
  confirmed:  "#3b82f6",
  in_transit: "#f59e0b",
  delivered:  "#22c55e",
  cancelled:  "#ef4444",
};

function KindBadge({ kind }: { kind: AttributeKind }) {
  const color = KIND_COLOR[kind];
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
      style={{
        color,
        backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
      }}>
      {KIND_ICON[kind]}
      {KIND_LABEL[kind]}
    </span>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 py-3 border-b last:border-b-0"
      style={{ borderColor: "var(--color-border)" }}>
      <span className="text-sm w-32 shrink-0" style={{ color: "var(--color-text-muted)" }}>{label}</span>
      <div className="text-sm flex-1" style={{ color: "var(--color-text-primary)" }}>{children}</div>
    </div>
  );
}

type DetailAV = {
  id: string;
  productGroupAttributeId: string;
  numericValue: number | null;
  textValue: string | null;
  attrName: string | null;
  attrUnit: string | null;
  isQuantityBasis: boolean | null;
  isCalculated: boolean | null;
  isFromInput: boolean | null;
  formulaAlias?: string | null;
  computedValue?: number | null;
};

type DetailProduct = Omit<ProductWithGroup, "attributeValues"> & {
  attributeValues: DetailAV[];
};

// ─── stock card ───────────────────────────────────────────────────────────────

function StockCard({ productId }: { productId: string }) {
  const [stock, setStock]       = useState<StockInfo | null>(null);
  const [batches, setBatches]   = useState<StockBatch[]>([]);
  const [editThreshold, setEditThreshold] = useState(false);
  const [thresholdInput, setThresholdInput] = useState("");
  const [saving, setSaving]     = useState(false);

  const load = useCallback(async () => {
    const [s, b] = await Promise.all([getStock(productId), getStockBatches(productId)]);
    setStock(s);
    setBatches(b);
    setThresholdInput(s.lowStockThreshold != null ? String(s.lowStockThreshold) : "");
  }, [productId]);

  useEffect(() => { load(); }, [load]);

  async function saveThreshold() {
    if (!stock) return;
    setSaving(true);
    try {
      const val = thresholdInput.trim() === "" ? null : parseFloat(thresholdInput);
      const updated = await setLowStockThreshold(productId, val);
      setStock(updated);
      setEditThreshold(false);
    } finally {
      setSaving(false);
    }
  }

  if (!stock) return null;

  const qty = stock.quantityOnHand ?? 0;
  const threshold = stock.lowStockThreshold;
  const isLowStock = threshold != null && qty <= threshold;

  return (
    <div className="border rounded-xl overflow-hidden"
      style={{
        backgroundColor: "var(--color-bg-popup)",
        borderColor: isLowStock ? "#ef4444" : "var(--color-border)",
        boxShadow: isLowStock ? "0 0 0 1px color-mix(in srgb, #ef4444 30%, transparent)" : undefined,
      }}>
      <div className="flex items-center justify-between gap-2 px-5 py-3"
        style={{ borderBottom: "1px solid var(--color-border)" }}>
        <div className="flex items-center gap-2">
          <Layers size={13} style={{ color: "var(--color-text-muted)" }} />
          <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>Inventory</p>
          {isLowStock && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
              style={{ color: "#ef4444", backgroundColor: "color-mix(in srgb, #ef4444 12%, transparent)", border: "1px solid color-mix(in srgb, #ef4444 25%, transparent)" }}>
              <AlertTriangle size={9} /> Low Stock
            </span>
          )}
        </div>
        <button onClick={() => setEditThreshold((v) => !v)}
          className="flex items-center gap-1 text-xs hover:opacity-70"
          style={{ color: "var(--color-text-muted)" }}>
          <Edit2 size={11} /> Alert threshold
        </button>
      </div>

      {/* Stock on hand */}
      <div className="px-5 py-4 flex items-end gap-6">
        <div>
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>On Hand</p>
          <p className="text-3xl font-bold tabular-nums mt-0.5" style={{
            color: isLowStock ? "#ef4444" : "var(--color-text-primary)",
          }}>
            {qty.toLocaleString("en-IN", { maximumFractionDigits: 4 })}
          </p>
        </div>
        {threshold != null && (
          <div className="pb-1">
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Alert Below</p>
            <p className="text-lg font-semibold tabular-nums" style={{ color: "#f59e0b" }}>
              {threshold.toLocaleString("en-IN")}
            </p>
          </div>
        )}
      </div>

      {/* Threshold editor */}
      {editThreshold && (
        <div className="px-5 pb-4 flex items-center gap-2">
          <input
            type="number" min="0" step="any"
            value={thresholdInput}
            onChange={(e) => setThresholdInput(e.target.value)}
            placeholder="No threshold"
            className="border rounded-lg px-3 py-1.5 text-sm w-36 focus:outline-none"
            style={{
              backgroundColor: "var(--color-bg-input)",
              borderColor: "var(--color-border-input)",
              color: "var(--color-text-primary)",
            }}
          />
          <button onClick={saveThreshold} disabled={saving}
            className="px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
            style={{ backgroundColor: "var(--color-btn-bg)", color: "var(--color-btn-text)" }}>
            {saving ? "Saving…" : "Save"}
          </button>
          <button onClick={() => setEditThreshold(false)}
            className="px-3 py-1.5 rounded-lg text-xs"
            style={{ backgroundColor: "var(--color-bg-subtle)", color: "var(--color-text-secondary)" }}>
            Cancel
          </button>
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            Leave blank to remove alert
          </p>
        </div>
      )}

      {/* Batch log */}
      {batches.length > 0 && (
        <div style={{ borderTop: "1px solid var(--color-border)" }}>
          <p className="px-5 py-2 text-[11px] font-medium uppercase tracking-wider"
            style={{ color: "var(--color-text-muted)" }}>
            Stock Batches ({batches.length})
          </p>
          <div className="grid grid-cols-[1fr_5rem_6rem_6rem] text-[11px] font-medium uppercase tracking-wider px-5 pb-2"
            style={{ color: "var(--color-text-muted)" }}>
            <span>Lot</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Unit Cost</span>
            <span>Received</span>
          </div>
          {batches.slice(0, 8).map((b, idx) => (
            <div key={b.id}
              className="grid grid-cols-[1fr_5rem_6rem_6rem] items-center px-5 py-2 text-xs gap-x-2"
              style={{ borderTop: "1px solid var(--color-border)", color: "var(--color-text-secondary)" }}>
              <span className="font-mono truncate" style={{ color: "var(--color-text-primary)" }}>
                {b.lotNumber ?? <span style={{ color: "var(--color-text-muted)" }}>—</span>}
              </span>
              <span className="text-right font-mono tabular-nums">
                {b.quantity.toLocaleString("en-IN", { maximumFractionDigits: 4 })}
              </span>
              <span className="text-right font-mono tabular-nums">
                {formatCurrency(b.unitCost)}
              </span>
              <span style={{ color: "var(--color-text-muted)" }}>
                {formatDateShort(b.receivedAt)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── pricing card ─────────────────────────────────────────────────────────────

function PricingCard({ productId }: { productId: string }) {
  const [data, setData]         = useState<ProductPricingData | null>(null);
  const [editMethod, setEditMethod] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<PricingMethod>("weighted_average");
  const [manualPrice, setManualPrice] = useState("");
  const [saving, setSaving]     = useState(false);

  const load = useCallback(async () => {
    const d = await getProductPricing(productId);
    setData(d);
    if (d.config) setSelectedMethod(d.config.pricingMethod);
  }, [productId]);

  useEffect(() => { load(); }, [load]);

  async function saveMethod() {
    setSaving(true);
    try {
      await updatePricingConfig(
        productId,
        selectedMethod,
        selectedMethod === "manual" && manualPrice ? parseFloat(manualPrice) : null,
      );
      await load();
      setEditMethod(false);
    } finally {
      setSaving(false);
    }
  }

  if (!data) return null;

  const currentPrice = data.config?.currentPrice;
  const method = data.config?.pricingMethod ?? "weighted_average";

  return (
    <div className="border rounded-xl overflow-hidden"
      style={{ backgroundColor: "var(--color-bg-popup)", borderColor: "var(--color-border)" }}>
      <div className="flex items-center justify-between gap-2 px-5 py-3"
        style={{ borderBottom: "1px solid var(--color-border)" }}>
        <div className="flex items-center gap-2">
          <IndianRupee size={13} style={{ color: "var(--color-text-muted)" }} />
          <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>Pricing</p>
          <span className="text-xs px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: "color-mix(in srgb, #6366f1 12%, transparent)",
              color: "#6366f1",
              border: "1px solid color-mix(in srgb, #6366f1 25%, transparent)",
            }}>
            {PRICING_METHOD_LABELS[method]}
          </span>
        </div>
        <button onClick={() => setEditMethod((v) => !v)}
          className="flex items-center gap-1 text-xs hover:opacity-70"
          style={{ color: "var(--color-text-muted)" }}>
          <Edit2 size={11} /> Change method
        </button>
      </div>

      {/* Current price */}
      <div className="px-5 py-4">
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Current Price</p>
        <p className="text-3xl font-bold mt-0.5" style={{ color: "var(--color-text-primary)" }}>
          {formatCurrency(currentPrice)}
        </p>
        <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
          Auto-recalculated on each delivery using <strong>{PRICING_METHOD_LABELS[method]}</strong>
        </p>
      </div>

      {/* Method editor */}
      {editMethod && (
        <div className="px-5 pb-4 space-y-3" style={{ borderTop: "1px solid var(--color-border)" }}>
          <p className="text-xs font-medium pt-3" style={{ color: "var(--color-text-muted)" }}>
            Pricing Method
          </p>
          <div className="space-y-2">
            {PRICING_METHODS.map((m) => (
              <label key={m} className="flex items-start gap-2.5 cursor-pointer">
                <input type="radio" name="pricingMethod" value={m}
                  checked={selectedMethod === m}
                  onChange={() => setSelectedMethod(m)}
                  className="mt-0.5" />
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                    {PRICING_METHOD_LABELS[m]}
                  </p>
                  <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {m === "weighted_average" && "Σ(qty × unit cost) / Σ(qty) — reflects true holding cost"}
                    {m === "average_all"      && "Simple mean of all lot unit costs"}
                    {m === "latest_lot"       && "Unit cost of the most recently received lot"}
                    {m === "oldest_lot"       && "Unit cost of the earliest lot received"}
                    {m === "manual"           && "Set a fixed price manually, not recalculated on delivery"}
                  </p>
                </div>
              </label>
            ))}
          </div>
          {selectedMethod === "manual" && (
            <input type="number" min="0.01" step="any"
              value={manualPrice} onChange={(e) => setManualPrice(e.target.value)}
              placeholder="Enter price (₹)"
              className="border rounded-lg px-3 py-1.5 text-sm w-40 focus:outline-none"
              style={{
                backgroundColor: "var(--color-bg-input)",
                borderColor: "var(--color-border-input)",
                color: "var(--color-text-primary)",
              }}
            />
          )}
          <div className="flex gap-2">
            <button onClick={saveMethod} disabled={saving}
              className="px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
              style={{ backgroundColor: "var(--color-btn-bg)", color: "var(--color-btn-text)" }}>
              {saving ? "Saving…" : "Apply"}
            </button>
            <button onClick={() => setEditMethod(false)}
              className="px-3 py-1.5 rounded-lg text-xs"
              style={{ backgroundColor: "var(--color-bg-subtle)", color: "var(--color-text-secondary)" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Price history */}
      {data.history.length > 0 && (
        <div style={{ borderTop: "1px solid var(--color-border)" }}>
          <p className="px-5 py-2 text-[11px] font-medium uppercase tracking-wider"
            style={{ color: "var(--color-text-muted)" }}>
            Price History
          </p>
          <div className="grid grid-cols-[1fr_7rem_8rem] text-[11px] font-medium uppercase tracking-wider px-5 pb-1"
            style={{ color: "var(--color-text-muted)" }}>
            <span>Date</span>
            <span className="text-right">Price</span>
            <span className="text-right">Lot Cost</span>
          </div>
          {data.history.slice(0, 8).map((h) => (
            <div key={h.id}
              className="grid grid-cols-[1fr_7rem_8rem] items-center px-5 py-2 text-xs gap-x-2"
              style={{ borderTop: "1px solid var(--color-border)" }}>
              <div>
                <p style={{ color: "var(--color-text-secondary)" }}>{formatDateShort(h.createdAt)}</p>
                <p className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                  {PRICING_METHOD_LABELS[h.pricingMethod as PricingMethod] ?? h.pricingMethod}
                </p>
              </div>
              <span className="text-right font-mono tabular-nums font-semibold"
                style={{ color: "var(--color-text-primary)" }}>
                {formatCurrency(h.price)}
              </span>
              <span className="text-right font-mono tabular-nums"
                style={{ color: "var(--color-text-muted)" }}>
                {formatCurrency(h.lotUnitCost)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── recent purchase orders card ──────────────────────────────────────────────

function RecentPOsCard({ productId }: { productId: string }) {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);

  useEffect(() => {
    listPurchaseOrders(productId).then((pos) => setOrders(pos.slice(0, 5)));
  }, [productId]);

  if (orders.length === 0) return null;

  return (
    <div className="border rounded-xl overflow-hidden"
      style={{ backgroundColor: "var(--color-bg-popup)", borderColor: "var(--color-border)" }}>
      <div className="flex items-center justify-between gap-2 px-5 py-3"
        style={{ borderBottom: "1px solid var(--color-border)" }}>
        <div className="flex items-center gap-2">
          <ShoppingCart size={13} style={{ color: "var(--color-text-muted)" }} />
          <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
            Recent Purchase Orders
          </p>
        </div>
        <Link href="/procurement/purchase-orders"
          className="text-xs hover:underline flex items-center gap-1"
          style={{ color: "var(--color-text-muted)" }}>
          View all <ChevronRight size={11} />
        </Link>
      </div>
      {orders.map((po, idx) => {
        const color = PO_STATUS_COLOR[po.status];
        return (
          <Link key={po.id} href={`/procurement/purchase-orders/${po.id}`}
            className="flex items-center justify-between px-5 py-2.5 gap-3 hover:opacity-80 transition-opacity"
            style={{ borderTop: idx > 0 ? "1px solid var(--color-border)" : undefined }}>
            <div>
              <p className="text-sm font-mono font-medium" style={{ color: "var(--color-text-primary)" }}>
                {po.poNumber}
              </p>
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                {po.itemCount} {po.itemCount === 1 ? "item" : "items"} · {formatCurrency(po.totalAmount)}
              </p>
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap"
              style={{
                color,
                backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
                border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
              }}>
              {PO_STATUS_LABELS[po.status]}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function ProductVariantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<DetailProduct | null>(null);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getProduct(id)
      .then((p) => setProduct(p as DetailProduct))
      .catch(() => setError("Failed to load product variant."));
  }, [id]);

  if (error) {
    return <div className="p-8 text-center" style={{ color: "var(--color-text-muted)" }}>{error}</div>;
  }

  if (!product) {
    return <div className="p-8 text-center text-sm" style={{ color: "var(--color-text-muted)" }}>Loading…</div>;
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm" style={{ color: "var(--color-text-muted)" }}>
        <Link href="/inventory/products" className="hover:underline">Product Variants</Link>
        <span>/</span>
        <Link href={`/inventory/product-groups/${product.productGroupId}`} className="hover:underline">
          {product.groupName}
        </Link>
        <span>/</span>
        <span style={{ color: "var(--color-text-primary)" }}>{product.name}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href={`/inventory/product-groups/${product.productGroupId}`}
            className="p-2 rounded-lg hover:opacity-70 transition-opacity"
            style={{ backgroundColor: "var(--color-bg-subtle)", color: "var(--color-text-secondary)" }}>
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-xl font-semibold" style={{ color: "var(--color-text-primary)" }}>
              {product.name}
            </h1>
            {product.sku && (
              <p className="text-xs font-mono mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                SKU: {product.sku}
              </p>
            )}
          </div>
        </div>
        <span
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
          style={
            product.isActive
              ? { backgroundColor: "color-mix(in srgb, #22c55e 12%, transparent)", color: "#16a34a", border: "1px solid color-mix(in srgb, #22c55e 25%, transparent)" }
              : { backgroundColor: "color-mix(in srgb, #ef4444 12%, transparent)", color: "#dc2626", border: "1px solid color-mix(in srgb, #ef4444 25%, transparent)" }
          }
        >
          {product.isActive ? <CheckCircle size={11} /> : <XCircle size={11} />}
          {product.isActive ? "Active" : "Inactive"}
        </span>
      </div>

      {/* Stock card */}
      <StockCard productId={product.id} />

      {/* Pricing card */}
      <PricingCard productId={product.id} />

      {/* Recent POs */}
      <RecentPOsCard productId={product.id} />

      {/* Overview */}
      <div className="border rounded-xl overflow-hidden"
        style={{ backgroundColor: "var(--color-bg-popup)", borderColor: "var(--color-border)" }}>
        <div className="flex items-center gap-2 px-5 py-3"
          style={{ borderBottom: "1px solid var(--color-border)" }}>
          <Package size={13} style={{ color: "var(--color-text-muted)" }} />
          <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>Overview</p>
        </div>
        <div className="px-5">
          <InfoRow label="Product Group">
            <Link href={`/inventory/product-groups/${product.productGroupId}`}
              className="hover:underline font-medium">
              {product.groupName}
            </Link>
          </InfoRow>
          {product.sku && <InfoRow label="SKU"><span className="font-mono">{product.sku}</span></InfoRow>}
          {product.description && <InfoRow label="Description">{product.description}</InfoRow>}
          <InfoRow label="Created">
            <span className="flex items-center gap-1.5"><Calendar size={12} />{formatDate(product.createdAt)}</span>
          </InfoRow>
          <InfoRow label="Last Updated">
            <span className="flex items-center gap-1.5"><Calendar size={12} />{formatDate(product.updatedAt)}</span>
          </InfoRow>
        </div>
      </div>

      {/* Attribute values */}
      <div className="border rounded-xl overflow-hidden"
        style={{ backgroundColor: "var(--color-bg-popup)", borderColor: "var(--color-border)" }}>
        <div className="flex items-center gap-2 px-5 py-3"
          style={{ borderBottom: "1px solid var(--color-border)" }}>
          <Tag size={13} style={{ color: "var(--color-text-muted)" }} />
          <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
            Attribute Values
          </p>
          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            ({product.attributeValues.length})
          </span>
        </div>
        {product.attributeValues.length === 0 ? (
          <p className="text-sm text-center py-6" style={{ color: "var(--color-text-muted)" }}>
            No attribute values recorded.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-[1fr_6rem_9rem_7rem] items-center px-5 py-2 text-[11px] font-medium uppercase tracking-wider"
              style={{ color: "var(--color-text-muted)", borderBottom: "1px solid var(--color-border)" }}>
              <span>Attribute</span>
              <span className="text-right">Value</span>
              <span className="text-center">Unit</span>
              <span className="text-center">Kind</span>
            </div>
            {product.attributeValues.map((av, idx) => {
              const kind = attrKind(av);
              const displayNum = av.computedValue ?? av.numericValue;
              const displayValue =
                displayNum != null
                  ? displayNum.toLocaleString("en-IN", { maximumFractionDigits: 6 })
                  : av.textValue ?? "—";
              return (
                <div key={av.id}
                  className="grid grid-cols-[1fr_6rem_9rem_7rem] items-center px-5 py-3 gap-x-2"
                  style={{
                    borderTop: idx > 0 ? "1px solid var(--color-border)" : undefined,
                    backgroundColor: av.isQuantityBasis
                      ? "color-mix(in srgb, #8b5cf6 4%, transparent)"
                      : undefined,
                  }}>
                  <div className="flex items-center gap-2 min-w-0">
                    {av.isQuantityBasis && <Star size={10} style={{ color: "#8b5cf6", flexShrink: 0 }} />}
                    <span className="text-sm font-medium truncate" style={{ color: "var(--color-text-primary)" }}>
                      {av.attrName ?? "Unknown"}
                    </span>
                  </div>
                  <span className="text-sm font-mono text-right tabular-nums"
                    style={{ color: "var(--color-text-secondary)" }}>
                    {displayValue}
                  </span>
                  <span className="text-xs text-center" style={{ color: "var(--color-text-muted)" }}>
                    {av.attrUnit ?? "—"}
                  </span>
                  <div className="flex justify-center">
                    <KindBadge kind={kind} />
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
