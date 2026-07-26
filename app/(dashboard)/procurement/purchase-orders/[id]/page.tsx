"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Building2, Calendar, CheckCircle, Clock, FileText,
  Package, Printer, Truck, XCircle, AlertTriangle,
} from "lucide-react";
import {
  getPurchaseOrder, updatePurchaseOrder, cancelPurchaseOrder, deliverPurchaseOrderItem,
} from "@/api/purchaseOrders";
import type { PurchaseOrder, PurchaseOrderItem, PoStatus } from "@/types/purchaseOrder";
import { PO_STATUS_LABELS, PO_NEXT_STATUS } from "@/types/purchaseOrder";

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}
function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { dateStyle: "medium" });
}
function fmtCurrency(n: number | null) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);
}

const STATUS_ICON: Record<PoStatus, React.ReactNode> = {
  draft:      <FileText size={14} />,
  confirmed:  <CheckCircle size={14} />,
  in_transit: <Truck size={14} />,
  delivered:  <CheckCircle size={14} />,
  cancelled:  <XCircle size={14} />,
};

const STATUS_COLOR: Record<PoStatus, string> = {
  draft:      "#6b7280",
  confirmed:  "#3b82f6",
  in_transit: "#f59e0b",
  delivered:  "#22c55e",
  cancelled:  "#ef4444",
};

const STATUS_STEPS: PoStatus[] = ["draft", "confirmed", "in_transit", "delivered"];

function StatusBadge({ status }: { status: PoStatus }) {
  const color = STATUS_COLOR[status];
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium"
      style={{ color, backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${color} 25%, transparent)` }}>
      {STATUS_ICON[status]} {PO_STATUS_LABELS[status]}
    </span>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 py-2.5 border-b last:border-b-0" style={{ borderColor: "var(--color-border)" }}>
      <span className="text-sm w-36 shrink-0" style={{ color: "var(--color-text-muted)" }}>{label}</span>
      <div className="text-sm flex-1" style={{ color: "var(--color-text-primary)" }}>{children}</div>
    </div>
  );
}

// ─── status stepper ───────────────────────────────────────────────────────────

function StatusStepper({ current }: { current: PoStatus }) {
  return (
    <div className="flex items-center gap-0">
      {STATUS_STEPS.map((step, i) => {
        const stepIdx    = STATUS_STEPS.indexOf(step);
        const currentIdx = STATUS_STEPS.indexOf(current as any);
        const done   = stepIdx < currentIdx;
        const active = step === current && current !== "cancelled";
        const color  = done || active ? STATUS_COLOR[step] : undefined;
        return (
          <div key={step} className="flex items-center gap-0">
            <div className="flex flex-col items-center gap-1">
              <div className="w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all"
                style={{
                  borderColor: color ?? "var(--color-border)",
                  backgroundColor: active || done ? `color-mix(in srgb, ${color} 15%, transparent)` : "transparent",
                  color: color ?? "var(--color-text-muted)",
                }}>
                {STATUS_ICON[step]}
              </div>
              <span className="text-[10px] whitespace-nowrap" style={{ color: color ?? "var(--color-text-muted)" }}>
                {PO_STATUS_LABELS[step]}
              </span>
            </div>
            {i < STATUS_STEPS.length - 1 && (
              <div className="w-12 h-0.5 mb-4 mx-1"
                style={{ backgroundColor: done ? STATUS_COLOR[STATUS_STEPS[i + 1]] : "var(--color-border)" }} />
            )}
          </div>
        );
      })}
      {current === "cancelled" && (
        <div className="flex items-center gap-1 ml-4">
          <XCircle size={16} className="text-red-400" />
          <span className="text-xs text-red-500 font-medium">Cancelled</span>
        </div>
      )}
    </div>
  );
}

// ─── items table ──────────────────────────────────────────────────────────────

function ItemsTable({
  po, onDeliverItem, busy,
}: {
  po: PurchaseOrder;
  onDeliverItem: (itemId: string) => void;
  busy: string | null;
}) {
  const canDeliver = po.status !== "cancelled" && po.status !== "draft";
  return (
    <div className="border rounded-xl overflow-hidden no-print:mt-0"
      style={{ backgroundColor: "var(--color-bg-popup)", borderColor: "var(--color-border)" }}>
      <div className="flex items-center justify-between px-5 py-3"
        style={{ borderBottom: "1px solid var(--color-border)" }}>
        <div className="flex items-center gap-2">
          <Package size={14} style={{ color: "var(--color-text-muted)" }} />
          <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
            Items ({po.itemCount})
          </p>
        </div>
        {po.allDelivered && (
          <span className="text-xs flex items-center gap-1 text-green-500">
            <CheckCircle size={11} /> All delivered
          </span>
        )}
      </div>

      {/* Header */}
      <div className="grid grid-cols-[1fr_7rem_7rem_7rem_7rem_auto] px-5 py-2
        text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: "var(--color-text-muted)", borderBottom: "1px solid var(--color-border)" }}>
        <span>Product</span>
        <span className="text-right">Qty Ordered</span>
        <span className="text-right">Unit Price</span>
        <span className="text-right">Total</span>
        <span className="text-center">Status</span>
        {canDeliver && <span className="text-center">Action</span>}
      </div>

      {po.items.map((item, idx) => {
        const delivered = !!item.deliveredAt;
        return (
          <div key={item.id}
            className="grid grid-cols-[1fr_7rem_7rem_7rem_7rem_auto] items-center px-5 py-3 gap-x-2"
            style={{
              borderTop: idx > 0 ? "1px solid var(--color-border)" : undefined,
              backgroundColor: delivered ? "color-mix(in srgb, #22c55e 4%, transparent)" : undefined,
            }}>
            <div className="min-w-0">
              <Link href={`/inventory/products/${item.productId}`}
                className="font-medium text-sm hover:underline truncate block"
                style={{ color: "var(--color-text-primary)" }}>
                {item.productName}
              </Link>
              {item.productSku && (
                <span className="text-[10px] font-mono" style={{ color: "var(--color-text-muted)" }}>
                  {item.productSku}
                </span>
              )}
              {item.notes && (
                <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>{item.notes}</p>
              )}
            </div>
            <span className="text-sm text-right font-mono tabular-nums"
              style={{ color: "var(--color-text-primary)" }}>
              {item.quantityOrdered.toLocaleString("en-IN")}
            </span>
            <span className="text-sm text-right font-mono tabular-nums"
              style={{ color: "var(--color-text-secondary)" }}>
              {fmtCurrency(item.unitPrice)}
            </span>
            <span className="text-sm text-right font-mono tabular-nums font-semibold"
              style={{ color: "var(--color-text-primary)" }}>
              {fmtCurrency(item.totalAmount)}
            </span>
            <div className="text-center">
              {delivered ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-green-500 font-medium">
                  <CheckCircle size={11} /> Done
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium"
                  style={{ color: "var(--color-text-muted)" }}>
                  <Clock size={11} /> Pending
                </span>
              )}
            </div>
            {canDeliver && (
              <div className="text-center print:hidden">
                {!delivered ? (
                  <button onClick={() => onDeliverItem(item.id)}
                    disabled={busy === item.id}
                    className="text-xs px-2.5 py-1 rounded-lg border font-medium disabled:opacity-40 hover:opacity-80 transition-opacity"
                    style={{
                      borderColor: "color-mix(in srgb, #22c55e 40%, transparent)",
                      backgroundColor: "color-mix(in srgb, #22c55e 8%, transparent)",
                      color: "#22c55e",
                    }}>
                    {busy === item.id ? "…" : "Deliver"}
                  </button>
                ) : (
                  <span className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                    {item.deliveredAt ? fmtDateShort(item.deliveredAt) : ""}
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Total row */}
      <div className="grid grid-cols-[1fr_7rem_7rem_7rem_7rem_auto] px-5 py-3 border-t"
        style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-bg-subtle)" }}>
        <span className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>Total</span>
        <span />
        <span />
        <span className="text-sm text-right font-bold font-mono tabular-nums"
          style={{ color: "var(--color-text-primary)" }}>
          {fmtCurrency(po.totalAmount)}
        </span>
        <span /><span />
      </div>
    </div>
  );
}

// ─── print styles ─────────────────────────────────────────────────────────────

const PRINT_STYLE = `
@media print {
  body * { visibility: hidden; }
  #po-printable, #po-printable * { visibility: visible; }
  #po-printable { position: fixed; top: 0; left: 0; width: 100%; padding: 2rem; background: white; color: #111; }
  .print\\:hidden { display: none !important; }
  #po-printable table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
  #po-printable th { background: #f3f4f6; padding: 0.5rem; text-align: left; font-size: 11px; text-transform: uppercase; }
  #po-printable td { padding: 0.5rem; border-top: 1px solid #e5e7eb; font-size: 13px; }
  #po-printable .po-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; }
  #po-printable .po-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 0.25rem 2rem; margin-bottom: 1.5rem; font-size: 13px; }
  #po-printable .po-meta dt { color: #6b7280; }
  #po-printable .po-meta dd { font-weight: 500; }
  #po-printable .po-total { text-align: right; font-size: 15px; font-weight: 700; margin-top: 1rem; }
}
`;

// ─── printable PO ─────────────────────────────────────────────────────────────

function PrintablePo({ po }: { po: PurchaseOrder }) {
  return (
    <div id="po-printable" style={{ display: "none" }}>
      <div className="po-header">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Purchase Order</h1>
          <p style={{ fontSize: 16, fontWeight: 600, color: "#374151" }}>{po.poNumber}</p>
        </div>
        <div style={{ textAlign: "right", fontSize: 12, color: "#6b7280" }}>
          <p>SS Cable ERP</p>
          <p>Created: {fmtDate(po.createdAt)}</p>
          <p>Status: <strong style={{ color: STATUS_COLOR[po.status] }}>{PO_STATUS_LABELS[po.status]}</strong></p>
        </div>
      </div>
      <dl className="po-meta">
        <dt>Vendor</dt>
        <dd>{po.vendorName ?? "Not specified"}</dd>
        {po.expectedDeliveryDate && <>
          <dt>Expected Delivery</dt>
          <dd>{fmtDateShort(po.expectedDeliveryDate)}</dd>
        </>}
        {po.deliveredAt && <>
          <dt>Delivered On</dt>
          <dd>{fmtDate(po.deliveredAt)}</dd>
        </>}
        {po.notes && <>
          <dt>Notes</dt>
          <dd>{po.notes}</dd>
        </>}
      </dl>
      <table>
        <thead>
          <tr>
            <th style={{ width: "40%" }}>Product</th>
            <th style={{ textAlign: "right" }}>Qty Ordered</th>
            <th style={{ textAlign: "right" }}>Unit Price</th>
            <th style={{ textAlign: "right" }}>Total</th>
            <th style={{ textAlign: "center" }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {po.items.map((item) => (
            <tr key={item.id}>
              <td>
                {item.productName}
                {item.productSku && <span style={{ color: "#6b7280", fontSize: 11 }}> ({item.productSku})</span>}
                {item.notes && <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{item.notes}</div>}
              </td>
              <td style={{ textAlign: "right", fontFamily: "monospace" }}>
                {item.quantityOrdered.toLocaleString("en-IN")}
              </td>
              <td style={{ textAlign: "right", fontFamily: "monospace" }}>{fmtCurrency(item.unitPrice)}</td>
              <td style={{ textAlign: "right", fontFamily: "monospace", fontWeight: 600 }}>{fmtCurrency(item.totalAmount)}</td>
              <td style={{ textAlign: "center" }}>{item.deliveredAt ? "Delivered" : "Pending"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="po-total">Grand Total: {fmtCurrency(po.totalAmount)}</div>
    </div>
  );
}

// ─── confirm dialog ───────────────────────────────────────────────────────────

function ConfirmDialog({
  title, message, confirmLabel, danger, busy, onConfirm, onClose,
}: {
  title: string; message: string; confirmLabel: string;
  danger?: boolean; busy: boolean;
  onConfirm: () => void; onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
      <div className="w-full max-w-sm rounded-xl p-6 shadow-xl"
        style={{ backgroundColor: "var(--color-bg-popup)", border: "1px solid var(--color-border)" }}>
        <h3 className="text-base font-semibold mb-2" style={{ color: "var(--color-text-primary)" }}>{title}</h3>
        <p className="text-sm mb-5" style={{ color: "var(--color-text-muted)" }}>{message}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} disabled={busy}
            className="px-4 py-2 rounded-lg text-sm"
            style={{ backgroundColor: "var(--color-bg-subtle)", color: "var(--color-text-secondary)" }}>
            Back
          </button>
          <button onClick={onConfirm} disabled={busy}
            className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
            style={danger
              ? { backgroundColor: "#ef4444", color: "#fff" }
              : { backgroundColor: "#22c55e", color: "#fff" }}>
            {busy ? "Please wait…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function PurchaseOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [po, setPo]         = useState<PurchaseOrder | null>(null);
  const [error, setError]   = useState<string | null>(null);
  const [busy, setBusy]     = useState<string | null>(null); // "advance" | "cancel" | itemId
  const [showConfirm, setShowConfirm] = useState<{ action: "advance" | "cancel" } | null>(null);
  const [deliverItemId, setDeliverItemId] = useState<string | null>(null); // item to confirm delivery

  useEffect(() => {
    if (id) getPurchaseOrder(id).then(setPo).catch(() => setError("Purchase order not found."));
  }, [id]);

  async function advanceStatus() {
    if (!po) return;
    const next = PO_NEXT_STATUS[po.status];
    if (!next) return;
    setBusy("advance");
    try {
      const updated = await updatePurchaseOrder(po.id, { status: next });
      setPo(updated);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Failed to update status.");
    } finally { setBusy(null); setShowConfirm(null); }
  }

  async function handleCancel() {
    if (!po) return;
    setBusy("cancel");
    try {
      const updated = await cancelPurchaseOrder(po.id);
      setPo(updated);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Failed to cancel.");
    } finally { setBusy(null); setShowConfirm(null); }
  }

  async function handleDeliverItem(itemId: string) {
    if (!po) return;
    setBusy(itemId);
    try {
      const updated = await deliverPurchaseOrderItem(po.id, itemId);
      setPo(updated);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Failed to mark item as delivered.");
    } finally { setBusy(null); setDeliverItemId(null); }
  }

  function handlePrint() { window.print(); }

  if (error && !po) {
    return <div className="p-8 text-center text-sm" style={{ color: "var(--color-text-muted)" }}>{error}</div>;
  }
  if (!po) {
    return <div className="p-8 text-center text-sm" style={{ color: "var(--color-text-muted)" }}>Loading…</div>;
  }

  const nextStatus = PO_NEXT_STATUS[po.status];
  const canAdvance = !!nextStatus && po.status !== "delivered" && po.status !== "cancelled";
  const canCancel  = po.status !== "delivered" && po.status !== "cancelled";

  const nextLabel: Record<PoStatus, string> = {
    draft: "Confirm Order", confirmed: "Mark In Transit",
    in_transit: "Mark All as Delivered", delivered: "", cancelled: "",
  };
  const nextColor: Record<PoStatus, string> = {
    draft: "#3b82f6", confirmed: "#f59e0b", in_transit: "#22c55e", delivered: "#22c55e", cancelled: "#22c55e",
  };

  const pendingItem = deliverItemId ? po.items.find((i) => i.id === deliverItemId) : null;

  return (
    <>
      <style>{PRINT_STYLE}</style>
      <PrintablePo po={po} />

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6 print:hidden">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm" style={{ color: "var(--color-text-muted)" }}>
          <Link href="/procurement/purchase-orders" className="hover:underline">Purchase Orders</Link>
          <span>/</span>
          <span style={{ color: "var(--color-text-primary)" }}>{po.poNumber}</span>
        </nav>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Link href="/procurement/purchase-orders"
              className="p-2 rounded-lg hover:opacity-70 transition-opacity"
              style={{ backgroundColor: "var(--color-bg-subtle)", color: "var(--color-text-secondary)" }}>
              <ArrowLeft size={16} />
            </Link>
            <div>
              <h1 className="text-xl font-semibold" style={{ color: "var(--color-text-primary)" }}>{po.poNumber}</h1>
              <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                Created {fmtDate(po.createdAt)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm hover:opacity-70 transition-opacity"
              style={{ borderColor: "var(--color-border)", color: "var(--color-text-secondary)" }}>
              <Printer size={13} /> Print / PDF
            </button>
            <StatusBadge status={po.status} />
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg text-sm text-red-600"
            style={{ backgroundColor: "color-mix(in srgb, #ef4444 8%, transparent)", border: "1px solid color-mix(in srgb, #ef4444 25%, transparent)" }}>
            <AlertTriangle size={14} /> {error}
          </div>
        )}

        {/* Progress */}
        <div className="border rounded-xl p-5"
          style={{ backgroundColor: "var(--color-bg-popup)", borderColor: "var(--color-border)" }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-4"
            style={{ color: "var(--color-text-muted)" }}>Order Progress</p>
          <StatusStepper current={po.status} />
          {(canAdvance || canCancel) && (
            <div className="flex items-center gap-2 mt-5 pt-4" style={{ borderTop: "1px solid var(--color-border)" }}>
              {canAdvance && (
                <button onClick={() => setShowConfirm({ action: "advance" })} disabled={!!busy}
                  className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 hover:opacity-80 transition-opacity"
                  style={{
                    backgroundColor: `color-mix(in srgb, ${nextColor[po.status]} 15%, transparent)`,
                    color: nextColor[po.status],
                    border: `1px solid color-mix(in srgb, ${nextColor[po.status]} 30%, transparent)`,
                  }}>
                  {nextLabel[po.status]}
                </button>
              )}
              {canCancel && (
                <button onClick={() => setShowConfirm({ action: "cancel" })} disabled={!!busy}
                  className="px-4 py-2 rounded-lg text-sm text-red-500 disabled:opacity-50 hover:opacity-70 transition-opacity"
                  style={{ backgroundColor: "color-mix(in srgb, #ef4444 10%, transparent)", border: "1px solid color-mix(in srgb, #ef4444 25%, transparent)" }}>
                  Cancel Order
                </button>
              )}
            </div>
          )}
          {po.deliveredAt && (
            <p className="mt-4 text-xs flex items-center gap-1.5" style={{ color: "var(--color-text-muted)" }}>
              <CheckCircle size={12} className="text-green-500" />
              Fully delivered on {fmtDate(po.deliveredAt)}. All stock updated automatically.
            </p>
          )}
        </div>

        {/* Items table */}
        <ItemsTable po={po} onDeliverItem={(itemId) => setDeliverItemId(itemId)} busy={busy} />

        {/* PO details */}
        <div className="border rounded-xl overflow-hidden"
          style={{ backgroundColor: "var(--color-bg-popup)", borderColor: "var(--color-border)" }}>
          <div className="flex items-center gap-2 px-5 py-3" style={{ borderBottom: "1px solid var(--color-border)" }}>
            <Building2 size={13} style={{ color: "var(--color-text-muted)" }} />
            <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>Order Details</p>
          </div>
          <div className="px-5">
            <InfoRow label="Vendor">
              {po.vendorName
                ? <span className="flex items-center gap-1"><Building2 size={12} />{po.vendorName}</span>
                : <span style={{ color: "var(--color-text-muted)" }}>Not specified</span>}
            </InfoRow>
            {po.expectedDeliveryDate && (
              <InfoRow label="Expected Delivery">
                <span className="flex items-center gap-1"><Calendar size={12} />{fmtDateShort(po.expectedDeliveryDate)}</span>
              </InfoRow>
            )}
            {po.deliveredAt && (
              <InfoRow label="Actual Delivery">
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle size={12} />{fmtDate(po.deliveredAt)}
                </span>
              </InfoRow>
            )}
            {po.notes && <InfoRow label="Notes">{po.notes}</InfoRow>}
          </div>
        </div>
      </div>

      {/* Advance status confirm */}
      {showConfirm?.action === "advance" && (
        <ConfirmDialog
          title={nextLabel[po.status]}
          message={
            po.status === "in_transit"
              ? "This will mark ALL pending items as delivered and add their quantities to inventory. Per-item pricing will be recalculated."
              : `This will move the order to '${PO_STATUS_LABELS[nextStatus!]}' status.`
          }
          confirmLabel={nextLabel[po.status]}
          busy={busy === "advance"}
          onConfirm={advanceStatus}
          onClose={() => setShowConfirm(null)}
        />
      )}

      {/* Cancel confirm */}
      {showConfirm?.action === "cancel" && (
        <ConfirmDialog
          title="Cancel this order?"
          message="This will mark the PO as cancelled. This cannot be undone."
          confirmLabel="Yes, Cancel"
          danger
          busy={busy === "cancel"}
          onConfirm={handleCancel}
          onClose={() => setShowConfirm(null)}
        />
      )}

      {/* Individual item delivery confirm */}
      {deliverItemId && pendingItem && (
        <ConfirmDialog
          title={`Deliver "${pendingItem.productName}"?`}
          message={`This will add ${pendingItem.quantityOrdered.toLocaleString("en-IN")} units to inventory and recalculate its pricing.`}
          confirmLabel="Confirm Delivery"
          busy={busy === deliverItemId}
          onConfirm={() => handleDeliverItem(deliverItemId)}
          onClose={() => setDeliverItemId(null)}
        />
      )}
    </>
  );
}
