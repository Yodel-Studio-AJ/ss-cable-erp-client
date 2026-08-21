"use client";

import { useEffect, useState } from "react";
import { FileText, Plus, X, Calculator } from "lucide-react";
import { listQuotes, addQuoteItem } from "@/api-client/quotes";
import { getCustomers } from "@/api-client/customers";
import type { Quote } from "@/types/quote";
import type { Customer } from "@/types/customer";
import { CreateQuoteModal } from "./CreateQuoteModal";
import type { ProductWithGroup } from "@/api-client/products";

function formatCurrency(n: number) {
  if (!n) return "—";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);
}

/**
 * Add a product (with a quantity and a display name) straight from anywhere in the app —
 * used from the BOM calculator to push a produced item onto a quote for a customer,
 * either onto an existing draft quote or into a brand new one.
 */
export function AddToQuoteModal({
  productId, productName, defaultQty, products, onDone, onClose,
  rawMaterialCost, rawMaterialCostPartial,
}: {
  productId: string;
  productName: string;
  defaultQty?: number;
  products: ProductWithGroup[];
  onDone: (quote: Quote) => void;
  onClose: () => void;
  /** Total raw-material cost for `defaultQty` units, from the BOM calculator — powers the margin-based pricing helper. */
  rawMaterialCost?: number;
  /** True if some raw materials in the BOM have no unit price set, so the cost above is incomplete. */
  rawMaterialCostPartial?: boolean;
}) {
  const [draftQuotes, setDraftQuotes] = useState<Quote[]>([]);
  const [customers, setCustomers]     = useState<Customer[]>([]);
  const [loading, setLoading]         = useState(true);
  const [selectedQuoteId, setSelectedQuoteId] = useState("");
  const [displayName, setDisplayName] = useState(productName);
  const [qty, setQty]                 = useState(defaultQty ? String(defaultQty) : "");
  const [unitPrice, setUnitPrice]     = useState("");
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [showCreateNew, setShowCreateNew] = useState(false);

  // ─── cost-based pricing helper: raw material cost + margin % → unit price ───
  const [marginPct, setMarginPct] = useState("");
  const hasCostBasis  = rawMaterialCost != null && !!defaultQty && defaultQty > 0;
  const costPerUnit   = hasCostBasis ? rawMaterialCost! / defaultQty! : null;
  const marginNum     = parseFloat(marginPct);
  const calculatedUnitPrice = hasCostBasis && marginPct.trim() !== "" && !isNaN(marginNum)
    ? costPerUnit! * (1 + marginNum / 100)
    : null;
  const qtyNum = parseFloat(qty);
  const calculatedTotal = calculatedUnitPrice != null && !isNaN(qtyNum) ? calculatedUnitPrice * qtyNum : null;

  // Margin % changed → recompute and apply the unit price straight onto the form
  function handleMarginChange(val: string) {
    setMarginPct(val);
    if (!hasCostBasis) return;
    const num = parseFloat(val);
    if (val.trim() === "" || isNaN(num)) return;
    setUnitPrice((costPerUnit! * (1 + num / 100)).toFixed(2));
  }

  useEffect(() => {
    Promise.all([listQuotes(), getCustomers()])
      .then(([qs, custs]) => { setDraftQuotes(qs.filter((q) => q.status === "draft")); setCustomers(custs); })
      .finally(() => setLoading(false));
  }, []);

  async function handleAdd() {
    if (!selectedQuoteId || !qty) { setError("Pick a quote and enter a quantity."); return; }
    setSaving(true);
    setError(null);
    try {
      const quote = await addQuoteItem(selectedQuoteId, {
        productId,
        displayName: displayName || undefined,
        quantity:    parseFloat(qty),
        unitPrice:   unitPrice ? parseFloat(unitPrice) : null,
      });
      onDone(quote);
    } catch {
      setError("Failed to add to quote.");
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

  if (showCreateNew) {
    return (
      <CreateQuoteModal
        products={products}
        customers={customers}
        prefilledProductId={productId}
        prefilledQty={defaultQty}
        prefilledDisplayName={productName}
        prefilledRawMaterialCost={rawMaterialCost}
        prefilledRawMaterialCostPartial={rawMaterialCostPartial}
        onCreated={onDone}
        onClose={onClose}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
      <div className="w-full max-w-md rounded-xl shadow-xl overflow-hidden"
        style={{ backgroundColor: "var(--color-bg-popup)", border: "1px solid var(--color-border)" }}>
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--color-border)" }}>
          <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--color-text-primary)" }}>
            <FileText size={16} /> Add to Quote
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:opacity-70" style={{ color: "var(--color-text-muted)" }}>
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {error && (
            <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          {loading ? (
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Loading…</p>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2"
                  style={{ color: "var(--color-text-muted)" }}>Quote</label>
                {draftQuotes.length === 0 ? (
                  <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                    No draft quotes yet.
                  </p>
                ) : (
                  <select value={selectedQuoteId} onChange={(e) => setSelectedQuoteId(e.target.value)}
                    className={inputCls} style={inputStyle}>
                    <option value="">Select a draft quote…</option>
                    {draftQuotes.map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.quoteNumber}{q.customerName ? ` — ${q.customerName}` : ""}
                      </option>
                    ))}
                  </select>
                )}
                <button type="button" onClick={() => setShowCreateNew(true)}
                  className="mt-2 flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border hover:opacity-70 transition-opacity"
                  style={{ borderColor: "var(--color-border)", color: "var(--color-text-secondary)" }}>
                  <Plus size={11} /> New Quote instead
                </button>
              </div>

              <div>
                <label className="block text-xs mb-1" style={{ color: "var(--color-text-muted)" }}>Display Name</label>
                <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                  className={inputCls} style={inputStyle} placeholder="Defaults to product name" />
              </div>

              {hasCostBasis && (
                <div className="rounded-lg border p-2.5 space-y-2"
                  style={{ borderColor: "color-mix(in srgb, #f59e0b 30%, transparent)", backgroundColor: "color-mix(in srgb, #f59e0b 6%, transparent)" }}>
                  <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "#d97706" }}>
                    <Calculator size={11} /> Cost-based pricing
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span style={{ color: "#d97706", opacity: 0.85 }}>
                      Raw material cost{rawMaterialCostPartial ? " (partial — some prices missing)" : ""}
                    </span>
                    <span className="font-mono font-semibold" style={{ color: "#d97706" }}>
                      {formatCurrency(rawMaterialCost!)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs shrink-0" style={{ color: "var(--color-text-muted)" }}>Margin over cost</label>
                    <input type="number" min="0" step="any" value={marginPct}
                      onChange={(e) => handleMarginChange(e.target.value)}
                      className="flex-1 border rounded-lg px-2 py-1.5 text-sm focus:outline-none"
                      style={inputStyle} placeholder="e.g. 20" />
                    <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>%</span>
                  </div>
                  {calculatedUnitPrice != null && (
                    <div className="pt-1.5 space-y-0.5" style={{ borderTop: "1px solid color-mix(in srgb, #f59e0b 20%, transparent)" }}>
                      <div className="flex items-center justify-between text-xs">
                        <span style={{ color: "var(--color-text-muted)" }}>Calculated unit price</span>
                        <span className="font-mono font-semibold" style={{ color: "var(--color-text-primary)" }}>
                          {formatCurrency(calculatedUnitPrice)}
                        </span>
                      </div>
                      {calculatedTotal != null && (
                        <div className="flex items-center justify-between text-xs">
                          <span style={{ color: "var(--color-text-muted)" }}>Total quote amount</span>
                          <span className="font-mono font-semibold" style={{ color: "var(--color-text-primary)" }}>
                            {formatCurrency(calculatedTotal)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs mb-1" style={{ color: "var(--color-text-muted)" }}>Quantity</label>
                  <input type="number" min="0.01" step="any" value={qty} onChange={(e) => setQty(e.target.value)}
                    className={inputCls} style={inputStyle} placeholder="Qty" />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: "var(--color-text-muted)" }}>Unit Price (₹)</label>
                  <input type="number" min="0.01" step="any" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)}
                    className={inputCls} style={inputStyle} placeholder="Optional" />
                </div>
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm"
              style={{ backgroundColor: "var(--color-bg-subtle)", color: "var(--color-text-secondary)" }}>
              Cancel
            </button>
            <button type="button" onClick={handleAdd} disabled={saving || !selectedQuoteId || draftQuotes.length === 0}
              className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              style={{ backgroundColor: "var(--color-btn-bg)", color: "var(--color-btn-text)" }}>
              {saving ? "Adding…" : "Add to Quote"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
