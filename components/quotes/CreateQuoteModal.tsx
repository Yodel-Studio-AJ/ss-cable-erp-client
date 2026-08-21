"use client";

import { useState } from "react";
import { Plus, Trash2, Calculator } from "lucide-react";
import { createQuote } from "@/api-client/quotes";
import type { Quote, CreateQuotePayload, QuoteItemInput } from "@/types/quote";
import type { ProductWithGroup } from "@/api-client/products";
import type { Customer } from "@/types/customer";

function formatCurrency(n: number) {
  if (!n) return "—";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);
}

interface DraftItem { productId: string; displayName: string; qty: string; unitPrice: string; notes: string }

const EMPTY_ITEM = (): DraftItem => ({ productId: "", displayName: "", qty: "", unitPrice: "", notes: "" });

export function CreateQuoteModal({
  products, customers, onCreated, onClose, prefilledProductId, prefilledQty, prefilledDisplayName,
  prefilledRawMaterialCost, prefilledRawMaterialCostPartial,
}: {
  products: ProductWithGroup[];
  customers: Customer[];
  onCreated: (q: Quote) => void;
  onClose: () => void;
  /** Pre-fill the first line — used when adding a product straight from the BOM calculator. */
  prefilledProductId?: string;
  prefilledQty?: number;
  prefilledDisplayName?: string;
  /** Total raw-material cost for `prefilledQty` units, from the BOM calculator — powers the margin-based pricing helper on line 1. */
  prefilledRawMaterialCost?: number;
  /** True if some raw materials in the BOM have no unit price set, so the cost above is incomplete. */
  prefilledRawMaterialCostPartial?: boolean;
}) {
  const [customerId, setCustomerId] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes]           = useState("");
  const [items, setItems]           = useState<DraftItem[]>(
    prefilledProductId
      ? [{ ...EMPTY_ITEM(), productId: prefilledProductId, qty: prefilledQty ? String(prefilledQty) : "", displayName: prefilledDisplayName ?? "" }]
      : [EMPTY_ITEM()]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  // ─── cost-based pricing helper for line 1 (raw material cost + margin % → unit price) ───
  const [marginPct, setMarginPct] = useState("");
  const hasCostBasis  = prefilledRawMaterialCost != null && !!prefilledQty && prefilledQty > 0;
  const costPerUnit   = hasCostBasis ? prefilledRawMaterialCost! / prefilledQty! : null;
  const marginNum     = parseFloat(marginPct);
  const calculatedUnitPrice = hasCostBasis && marginPct.trim() !== "" && !isNaN(marginNum)
    ? costPerUnit! * (1 + marginNum / 100)
    : null;
  const calculatedTotal = calculatedUnitPrice != null && prefilledQty ? calculatedUnitPrice * prefilledQty : null;

  // Margin % changed → recompute and apply the unit price straight onto line 1
  function handleMarginChange(val: string) {
    setMarginPct(val);
    if (!hasCostBasis) return;
    const num = parseFloat(val);
    if (val.trim() === "" || isNaN(num)) return;
    const price = costPerUnit! * (1 + num / 100);
    setItem(0, "unitPrice", price.toFixed(2));
  }

  function setItem(idx: number, field: keyof DraftItem, val: string) {
    setItems((prev) => prev.map((it, i) => {
      if (i !== idx) return it;
      const next = { ...it, [field]: val };
      // Auto-fill display name from the chosen product unless the user already edited it
      if (field === "productId" && !it.displayName) {
        const p = products.find((p) => p.id === val);
        if (p) next.displayName = p.name;
      }
      return next;
    }));
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
      if (!it.productId || !it.qty) { setError("Each line needs a product and quantity."); return; }
    }
    setSaving(true);
    setError(null);
    try {
      const payload: CreateQuotePayload = {
        customerId: customerId || null,
        validUntil: validUntil || null,
        notes:      notes || null,
        items:      items.map((it) => ({
          productId:   it.productId,
          displayName: it.displayName || undefined,
          quantity:    parseFloat(it.qty),
          unitPrice:   it.unitPrice ? parseFloat(it.unitPrice) : null,
          notes:       it.notes || null,
        } as QuoteItemInput)),
      };
      const quote = await createQuote(payload);
      onCreated(quote);
    } catch {
      setError("Failed to create quote.");
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
          <h2 className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>New Quote</h2>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {error && (
            <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          {/* Customer */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2"
              style={{ color: "var(--color-text-muted)" }}>Customer</label>
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}
              className={inputCls} style={inputStyle}>
              <option value="">No customer / TBD</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.companyName}{c.city ? ` — ${c.city}` : ""}</option>
              ))}
            </select>
          </div>

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
                    <input type="text" value={it.displayName}
                      onChange={(e) => setItem(idx, "displayName", e.target.value)}
                      className={inputCls} style={inputStyle}
                      placeholder="Display name on the quote (defaults to product name)" />

                    {idx === 0 && hasCostBasis && (
                      <div className="rounded-lg border p-2.5 space-y-2"
                        style={{ borderColor: "color-mix(in srgb, #f59e0b 30%, transparent)", backgroundColor: "color-mix(in srgb, #f59e0b 6%, transparent)" }}>
                        <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "#d97706" }}>
                          <Calculator size={11} /> Cost-based pricing
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span style={{ color: "#d97706", opacity: 0.85 }}>
                            Raw material cost{prefilledRawMaterialCostPartial ? " (partial — some prices missing)" : ""}
                          </span>
                          <span className="font-mono font-semibold" style={{ color: "#d97706" }}>
                            {formatCurrency(prefilledRawMaterialCost!)}
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
                            <div className="flex items-center justify-between text-xs">
                              <span style={{ color: "var(--color-text-muted)" }}>Total quote amount</span>
                              <span className="font-mono font-semibold" style={{ color: "var(--color-text-primary)" }}>
                                {formatCurrency(calculatedTotal!)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

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

          {/* Valid until + notes */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--color-text-muted)" }}>Valid Until</label>
              <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)}
                className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--color-text-muted)" }}>Quote Notes</label>
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
              {saving ? "Creating…" : "Create Quote"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
