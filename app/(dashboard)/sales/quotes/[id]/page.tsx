"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Building2, Calendar, CheckCircle, FileText,
  Package, Printer, XCircle, Send, Clock, AlertTriangle, Trash2,
} from "lucide-react";
import { getQuote, updateQuote, removeQuoteItem } from "@/api-client/quotes";
import type { Quote, QuoteStatus } from "@/types/quote";
import { QUOTE_STATUS_LABELS, QUOTE_NEXT_STATUS } from "@/types/quote";

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

const STATUS_ICON: Record<QuoteStatus, React.ReactNode> = {
  draft:    <FileText size={14} />,
  sent:     <Send size={14} />,
  accepted: <CheckCircle size={14} />,
  rejected: <XCircle size={14} />,
  expired:  <Clock size={14} />,
};

const STATUS_COLOR: Record<QuoteStatus, string> = {
  draft:    "#6b7280",
  sent:     "#3b82f6",
  accepted: "#22c55e",
  rejected: "#ef4444",
  expired:  "#f59e0b",
};

const STATUS_STEPS: QuoteStatus[] = ["draft", "sent", "accepted"];

function StatusBadge({ status }: { status: QuoteStatus }) {
  const color = STATUS_COLOR[status];
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium"
      style={{ color, backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${color} 25%, transparent)` }}>
      {STATUS_ICON[status]} {QUOTE_STATUS_LABELS[status]}
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

function StatusStepper({ current }: { current: QuoteStatus }) {
  return (
    <div className="flex items-center gap-0">
      {STATUS_STEPS.map((step, i) => {
        const stepIdx    = STATUS_STEPS.indexOf(step);
        const currentIdx = STATUS_STEPS.indexOf(current as any);
        const done   = stepIdx < currentIdx;
        const active = step === current && current !== "rejected" && current !== "expired";
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
                {QUOTE_STATUS_LABELS[step]}
              </span>
            </div>
            {i < STATUS_STEPS.length - 1 && (
              <div className="w-12 h-0.5 mb-4 mx-1"
                style={{ backgroundColor: done ? STATUS_COLOR[STATUS_STEPS[i + 1]] : "var(--color-border)" }} />
            )}
          </div>
        );
      })}
      {(current === "rejected" || current === "expired") && (
        <div className="flex items-center gap-1 ml-4">
          {current === "rejected" ? <XCircle size={16} className="text-red-400" /> : <Clock size={16} className="text-amber-400" />}
          <span className="text-xs font-medium" style={{ color: STATUS_COLOR[current] }}>{QUOTE_STATUS_LABELS[current]}</span>
        </div>
      )}
    </div>
  );
}

// ─── items table ──────────────────────────────────────────────────────────────

function ItemsTable({
  quote, onRemoveItem, busy,
}: {
  quote: Quote;
  onRemoveItem: (itemId: string) => void;
  busy: string | null;
}) {
  const canEdit = quote.status === "draft";
  return (
    <div className="border rounded-xl overflow-hidden"
      style={{ backgroundColor: "var(--color-bg-popup)", borderColor: "var(--color-border)" }}>
      <div className="flex items-center justify-between px-5 py-3"
        style={{ borderBottom: "1px solid var(--color-border)" }}>
        <div className="flex items-center gap-2">
          <Package size={14} style={{ color: "var(--color-text-muted)" }} />
          <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
            Items ({quote.itemCount})
          </p>
        </div>
      </div>

      {/* Header */}
      <div className="grid grid-cols-[1fr_7rem_7rem_7rem_auto] px-5 py-2
        text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: "var(--color-text-muted)", borderBottom: "1px solid var(--color-border)" }}>
        <span>Product</span>
        <span className="text-right">Quantity</span>
        <span className="text-right">Unit Price</span>
        <span className="text-right">Total</span>
        {canEdit && <span className="text-center">Action</span>}
      </div>

      {quote.items.map((item, idx) => (
        <div key={item.id}
          className="grid grid-cols-[1fr_7rem_7rem_7rem_auto] items-center px-5 py-3 gap-x-2"
          style={{ borderTop: idx > 0 ? "1px solid var(--color-border)" : undefined }}>
          <div className="min-w-0">
            <Link href={`/inventory/products/${item.productId}`}
              className="font-medium text-sm hover:underline truncate block"
              style={{ color: "var(--color-text-primary)" }}>
              {item.displayName}
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
            {item.quantity.toLocaleString("en-IN")}
          </span>
          <span className="text-sm text-right font-mono tabular-nums"
            style={{ color: "var(--color-text-secondary)" }}>
            {fmtCurrency(item.unitPrice)}
          </span>
          <span className="text-sm text-right font-mono tabular-nums font-semibold"
            style={{ color: "var(--color-text-primary)" }}>
            {fmtCurrency(item.totalAmount)}
          </span>
          {canEdit && (
            <div className="text-center print:hidden">
              <button onClick={() => onRemoveItem(item.id)} disabled={busy === item.id}
                className="p-1.5 rounded-lg hover:opacity-70 disabled:opacity-40 transition-opacity"
                style={{ color: "#ef4444" }}>
                <Trash2 size={13} />
              </button>
            </div>
          )}
        </div>
      ))}

      {/* Total row */}
      <div className="grid grid-cols-[1fr_7rem_7rem_7rem_auto] px-5 py-3 border-t"
        style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-bg-subtle)" }}>
        <span className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>Total</span>
        <span />
        <span />
        <span className="text-sm text-right font-bold font-mono tabular-nums"
          style={{ color: "var(--color-text-primary)" }}>
          {fmtCurrency(quote.totalAmount)}
        </span>
        {canEdit && <span />}
      </div>
    </div>
  );
}

// ─── print styles ─────────────────────────────────────────────────────────────

const PRINT_STYLE = `
@media print {
  body * { visibility: hidden; }
  #quote-printable, #quote-printable * { visibility: visible; }
  #quote-printable { position: fixed; top: 0; left: 0; width: 100%; padding: 2rem; background: white; color: #111; }
  .print\\:hidden { display: none !important; }
  #quote-printable table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
  #quote-printable th { background: #f3f4f6; padding: 0.5rem; text-align: left; font-size: 11px; text-transform: uppercase; }
  #quote-printable td { padding: 0.5rem; border-top: 1px solid #e5e7eb; font-size: 13px; }
  #quote-printable .quote-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; }
  #quote-printable .quote-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 0.25rem 2rem; margin-bottom: 1.5rem; font-size: 13px; }
  #quote-printable .quote-meta dt { color: #6b7280; }
  #quote-printable .quote-meta dd { font-weight: 500; }
  #quote-printable .quote-total { text-align: right; font-size: 15px; font-weight: 700; margin-top: 1rem; }
}
`;

function PrintableQuote({ quote }: { quote: Quote }) {
  return (
    <div id="quote-printable" style={{ display: "none" }}>
      <div className="quote-header">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Quotation</h1>
          <p style={{ fontSize: 16, fontWeight: 600, color: "#374151" }}>{quote.quoteNumber}</p>
        </div>
        <div style={{ textAlign: "right", fontSize: 12, color: "#6b7280" }}>
          <p>SS Cable ERP</p>
          <p>Created: {fmtDate(quote.createdAt)}</p>
          <p>Status: <strong style={{ color: STATUS_COLOR[quote.status] }}>{QUOTE_STATUS_LABELS[quote.status]}</strong></p>
        </div>
      </div>
      <dl className="quote-meta">
        <dt>Customer</dt>
        <dd>{quote.customerName ?? "Not specified"}</dd>
        {quote.validUntil && <>
          <dt>Valid Until</dt>
          <dd>{fmtDateShort(quote.validUntil)}</dd>
        </>}
        {quote.notes && <>
          <dt>Notes</dt>
          <dd>{quote.notes}</dd>
        </>}
      </dl>
      <table>
        <thead>
          <tr>
            <th style={{ width: "40%" }}>Product</th>
            <th style={{ textAlign: "right" }}>Quantity</th>
            <th style={{ textAlign: "right" }}>Unit Price</th>
            <th style={{ textAlign: "right" }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {quote.items.map((item) => (
            <tr key={item.id}>
              <td>
                {item.displayName}
                {item.productSku && <span style={{ color: "#6b7280", fontSize: 11 }}> ({item.productSku})</span>}
                {item.notes && <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{item.notes}</div>}
              </td>
              <td style={{ textAlign: "right", fontFamily: "monospace" }}>
                {item.quantity.toLocaleString("en-IN")}
              </td>
              <td style={{ textAlign: "right", fontFamily: "monospace" }}>{fmtCurrency(item.unitPrice)}</td>
              <td style={{ textAlign: "right", fontFamily: "monospace", fontWeight: 600 }}>{fmtCurrency(item.totalAmount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="quote-total">Grand Total: {fmtCurrency(quote.totalAmount)}</div>
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

export default function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [quote, setQuote]   = useState<Quote | null>(null);
  const [error, setError]   = useState<string | null>(null);
  const [busy, setBusy]     = useState<string | null>(null); // "advance" | "reject" | itemId
  const [showConfirm, setShowConfirm] = useState<{ action: "advance" | "reject" } | null>(null);
  const [removeItemId, setRemoveItemId] = useState<string | null>(null);

  useEffect(() => {
    if (id) getQuote(id).then(setQuote).catch(() => setError("Quote not found."));
  }, [id]);

  async function advanceStatus() {
    if (!quote) return;
    const next = QUOTE_NEXT_STATUS[quote.status];
    if (!next) return;
    setBusy("advance");
    try {
      const updated = await updateQuote(quote.id, { status: next });
      setQuote(updated);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Failed to update status.");
    } finally { setBusy(null); setShowConfirm(null); }
  }

  async function handleReject() {
    if (!quote) return;
    setBusy("reject");
    try {
      const updated = await updateQuote(quote.id, { status: "rejected" });
      setQuote(updated);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Failed to update status.");
    } finally { setBusy(null); setShowConfirm(null); }
  }

  async function handleRemoveItem(itemId: string) {
    if (!quote) return;
    setBusy(itemId);
    try {
      const updated = await removeQuoteItem(quote.id, itemId);
      setQuote(updated);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Failed to remove item.");
    } finally { setBusy(null); setRemoveItemId(null); }
  }

  function handlePrint() { window.print(); }

  if (error && !quote) {
    return <div className="p-8 text-center text-sm" style={{ color: "var(--color-text-muted)" }}>{error}</div>;
  }
  if (!quote) {
    return <div className="p-8 text-center text-sm" style={{ color: "var(--color-text-muted)" }}>Loading…</div>;
  }

  const nextStatus = QUOTE_NEXT_STATUS[quote.status];
  const canAdvance = !!nextStatus && quote.status !== "accepted" && quote.status !== "rejected" && quote.status !== "expired";
  const canReject  = quote.status === "draft" || quote.status === "sent";

  const nextLabel: Record<QuoteStatus, string> = {
    draft: "Send to Customer", sent: "Mark Accepted", accepted: "", rejected: "", expired: "",
  };
  const nextColor: Record<QuoteStatus, string> = {
    draft: "#3b82f6", sent: "#22c55e", accepted: "#22c55e", rejected: "#22c55e", expired: "#22c55e",
  };

  const itemPendingRemoval = removeItemId ? quote.items.find((i) => i.id === removeItemId) : null;

  return (
    <>
      <style>{PRINT_STYLE}</style>
      <PrintableQuote quote={quote} />

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6 print:hidden">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm" style={{ color: "var(--color-text-muted)" }}>
          <Link href="/sales/quotes" className="hover:underline">Quotes</Link>
          <span>/</span>
          <span style={{ color: "var(--color-text-primary)" }}>{quote.quoteNumber}</span>
        </nav>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Link href="/sales/quotes"
              className="p-2 rounded-lg hover:opacity-70 transition-opacity"
              style={{ backgroundColor: "var(--color-bg-subtle)", color: "var(--color-text-secondary)" }}>
              <ArrowLeft size={16} />
            </Link>
            <div>
              <h1 className="text-xl font-semibold" style={{ color: "var(--color-text-primary)" }}>{quote.quoteNumber}</h1>
              <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                Created {fmtDate(quote.createdAt)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm hover:opacity-70 transition-opacity"
              style={{ borderColor: "var(--color-border)", color: "var(--color-text-secondary)" }}>
              <Printer size={13} /> Print / PDF
            </button>
            <StatusBadge status={quote.status} />
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
            style={{ color: "var(--color-text-muted)" }}>Quote Progress</p>
          <StatusStepper current={quote.status} />
          {(canAdvance || canReject) && (
            <div className="flex items-center gap-2 mt-5 pt-4" style={{ borderTop: "1px solid var(--color-border)" }}>
              {canAdvance && (
                <button onClick={() => setShowConfirm({ action: "advance" })} disabled={!!busy}
                  className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 hover:opacity-80 transition-opacity"
                  style={{
                    backgroundColor: `color-mix(in srgb, ${nextColor[quote.status]} 15%, transparent)`,
                    color: nextColor[quote.status],
                    border: `1px solid color-mix(in srgb, ${nextColor[quote.status]} 30%, transparent)`,
                  }}>
                  {nextLabel[quote.status]}
                </button>
              )}
              {canReject && (
                <button onClick={() => setShowConfirm({ action: "reject" })} disabled={!!busy}
                  className="px-4 py-2 rounded-lg text-sm text-red-500 disabled:opacity-50 hover:opacity-70 transition-opacity"
                  style={{ backgroundColor: "color-mix(in srgb, #ef4444 10%, transparent)", border: "1px solid color-mix(in srgb, #ef4444 25%, transparent)" }}>
                  Reject
                </button>
              )}
            </div>
          )}
        </div>

        {/* Items table */}
        <ItemsTable quote={quote} onRemoveItem={(itemId) => setRemoveItemId(itemId)} busy={busy} />

        {/* Quote details */}
        <div className="border rounded-xl overflow-hidden"
          style={{ backgroundColor: "var(--color-bg-popup)", borderColor: "var(--color-border)" }}>
          <div className="flex items-center gap-2 px-5 py-3" style={{ borderBottom: "1px solid var(--color-border)" }}>
            <Building2 size={13} style={{ color: "var(--color-text-muted)" }} />
            <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>Quote Details</p>
          </div>
          <div className="px-5">
            <InfoRow label="Customer">
              {quote.customerName
                ? <span className="flex items-center gap-1"><Building2 size={12} />{quote.customerName}</span>
                : <span style={{ color: "var(--color-text-muted)" }}>Not specified</span>}
            </InfoRow>
            {quote.validUntil && (
              <InfoRow label="Valid Until">
                <span className="flex items-center gap-1"><Calendar size={12} />{fmtDateShort(quote.validUntil)}</span>
              </InfoRow>
            )}
            {quote.notes && <InfoRow label="Notes">{quote.notes}</InfoRow>}
          </div>
        </div>
      </div>

      {/* Advance status confirm */}
      {showConfirm?.action === "advance" && (
        <ConfirmDialog
          title={nextLabel[quote.status]}
          message={`This will move the quote to '${QUOTE_STATUS_LABELS[nextStatus!]}' status.`}
          confirmLabel={nextLabel[quote.status]}
          busy={busy === "advance"}
          onConfirm={advanceStatus}
          onClose={() => setShowConfirm(null)}
        />
      )}

      {/* Reject confirm */}
      {showConfirm?.action === "reject" && (
        <ConfirmDialog
          title="Reject this quote?"
          message="This will mark the quote as rejected. This cannot be undone."
          confirmLabel="Yes, Reject"
          danger
          busy={busy === "reject"}
          onConfirm={handleReject}
          onClose={() => setShowConfirm(null)}
        />
      )}

      {/* Remove item confirm */}
      {removeItemId && itemPendingRemoval && (
        <ConfirmDialog
          title={`Remove "${itemPendingRemoval.displayName}"?`}
          message="This line will be removed from the quote."
          confirmLabel="Remove"
          danger
          busy={busy === removeItemId}
          onConfirm={() => handleRemoveItem(removeItemId)}
          onClose={() => setRemoveItemId(null)}
        />
      )}
    </>
  );
}
