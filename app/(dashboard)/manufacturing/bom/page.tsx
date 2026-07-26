"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import {
  Search, ChevronDown, FlaskConical, Package, AlertCircle,
  ArrowRight, Calculator, X, Star, Hash,
} from "lucide-react";
import { listAllProducts, type ProductWithGroup } from "@/api/products";
import { getGroupInputs } from "@/api/productGroupInputs";
import type { GroupInput } from "@/types/productGroupInput";
import type { ProductAttributeValue } from "@/types/product";

// ─── formula evaluator ────────────────────────────────────────────────────────

function deriveAlias(formulaAlias: string | null | undefined, attrName: string | null | undefined): string {
  if (formulaAlias) return formulaAlias;
  return (attrName ?? "").toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

function evalExpr(formula: string, vars: Record<string, number>): number | null {
  try {
    let expr = formula;
    const sorted = Object.entries(vars).sort((a, b) => b[0].length - a[0].length);
    for (const [name, val] of sorted) {
      expr = expr.replace(new RegExp(`\\b${name}\\b`, "g"), String(val));
    }
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${expr})`)();
    return typeof result === "number" && isFinite(result) ? result : null;
  } catch {
    return null;
  }
}

function calcRequired(
  bomInput: GroupInput,
  outputProduct: ProductWithGroup,
  inputProduct: ProductWithGroup,
  outputQty: number,
): { qty: number | null; baseQty: number | null } {
  // The qtyFormula uses pga_<uuid_with_underscores> tokens as variable names.
  // formulaVars maps each token → { pgaId, groupId, ... } telling us which
  // product's attribute supplies the value.

  // Build pgaId → value map from both products
  const pgaValues: Record<string, number> = {};
  for (const av of outputProduct.attributeValues) {
    // For the qty-basis attr of the output product, use the user-entered qty
    const val = av.isQuantityBasis ? outputQty : (av.computedValue ?? av.numericValue);
    if (val != null) pgaValues[av.productGroupAttributeId] = val;
  }
  for (const av of inputProduct.attributeValues) {
    const val = av.computedValue ?? av.numericValue;
    if (val != null) pgaValues[av.productGroupAttributeId] = val;
  }

  // Build token → value substitution using formulaVars
  const vars: Record<string, number> = {};
  if (bomInput.formulaVars) {
    for (const [token, fv] of Object.entries(bomInput.formulaVars)) {
      const val = pgaValues[fv.pgaId];
      if (val != null) vars[token] = val;
    }
  }

  const baseQty = evalExpr(bomInput.qtyFormula, vars);
  if (baseQty == null) return { qty: null, baseQty: null };
  const yf = parseFloat(bomInput.yieldFactor);
  const qty = yf > 0 ? baseQty / yf : baseQty;
  return { qty, baseQty };
}

// Build human-readable formula string by replacing pga_ tokens with attr names
function humanFormula(formula: string, formulaVars: GroupInput["formulaVars"]): string {
  if (!formulaVars) return formula;
  let result = formula;
  // Sort by token length desc to avoid partial replacements
  const entries = Object.entries(formulaVars).sort((a, b) => b[0].length - a[0].length);
  for (const [token, fv] of entries) {
    const alias = deriveAlias(null, fv.attrName);
    result = result.replace(new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), alias);
  }
  return result;
}

function fmt(n: number, decimals = 4) {
  return n.toLocaleString("en-IN", { maximumFractionDigits: decimals, minimumFractionDigits: 0 });
}

// ─── attribute row ────────────────────────────────────────────────────────────

function AttrRow({ av }: { av: ProductAttributeValue }) {
  const val        = av.computedValue ?? av.numericValue;
  const displayVal = val != null
    ? val.toLocaleString("en-IN", { maximumFractionDigits: 6 })
    : av.textValue ?? "—";

  const isQty  = av.isQuantityBasis;
  const isCalc = av.isCalculated;
  const color  = isQty ? "#8b5cf6" : isCalc ? "#6366f1" : "var(--color-text-muted)";
  const Icon   = isQty ? Star : isCalc ? FlaskConical : Hash;

  return (
    <div className="flex items-center justify-between py-2 border-b last:border-b-0"
      style={{ borderColor: "var(--color-border)" }}>
      <div className="flex items-center gap-2 min-w-0">
        <Icon size={11} style={{ color, flexShrink: 0 }} />
        <span className="text-sm truncate" style={{ color: "var(--color-text-secondary)" }}>
          {av.attrName ?? "—"}
        </span>
      </div>
      <div className="flex items-center gap-2 ml-4 shrink-0">
        <span className="text-sm font-mono font-medium tabular-nums"
          style={{ color: isQty ? "#8b5cf6" : "var(--color-text-primary)" }}>
          {displayVal}
        </span>
        {av.attrUnit && (
          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>{av.attrUnit}</span>
        )}
      </div>
    </div>
  );
}

// ─── product picker ───────────────────────────────────────────────────────────

function ProductPicker({
  products,
  selected,
  onSelect,
  placeholder,
  filterGroupId,
  onClear,
}: {
  products: ProductWithGroup[];
  selected: ProductWithGroup | null;
  onSelect: (p: ProductWithGroup) => void;
  placeholder: string;
  filterGroupId?: string;
  onClear?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen]   = useState(false);
  const wrapRef           = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const list = useMemo(() => {
    const base = filterGroupId ? products.filter((p) => p.productGroupId === filterGroupId) : products;
    if (!query.trim()) return base;
    const q = query.toLowerCase();
    return base.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.groupName.toLowerCase().includes(q) ||
        (p.sku ?? "").toLowerCase().includes(q),
    );
  }, [products, query, filterGroupId]);

  return (
    <div ref={wrapRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm text-left transition-colors"
        style={{
          backgroundColor: "var(--color-bg-input)",
          borderColor: open ? "var(--color-accent, #6366f1)" : "var(--color-border-input)",
          color: selected ? "var(--color-text-primary)" : "var(--color-text-muted)",
        }}>
        <span className="flex items-center gap-2 min-w-0">
          {selected ? (
            <>
              <Package size={13} style={{ color: "var(--color-text-muted)", flexShrink: 0 }} />
              <span className="font-medium truncate">{selected.name}</span>
              <span className="text-xs shrink-0" style={{ color: "var(--color-text-muted)" }}>
                · {selected.groupName}
              </span>
            </>
          ) : (
            <>
              <Search size={13} style={{ flexShrink: 0 }} />
              <span>{placeholder}</span>
            </>
          )}
        </span>
        <div className="flex items-center gap-1 ml-2 shrink-0">
          {selected && onClear && (
            <span
              role="button"
              onClick={(e) => { e.stopPropagation(); onClear(); }}
              className="p-0.5 rounded hover:opacity-70"
              style={{ color: "var(--color-text-muted)" }}>
              <X size={12} />
            </span>
          )}
          <ChevronDown size={14} style={{
            color: "var(--color-text-muted)",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.15s",
          }} />
        </div>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute z-50 left-0 right-0 mt-1 rounded-xl border shadow-2xl overflow-hidden"
          style={{ backgroundColor: "var(--color-bg-popup)", borderColor: "var(--color-border)", top: "100%" }}>
          {/* Search */}
          <div className="p-2" style={{ borderBottom: "1px solid var(--color-border)" }}>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--color-text-muted)" }} />
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, group or SKU…"
                className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border focus:outline-none"
                style={{
                  backgroundColor: "var(--color-bg-input)",
                  borderColor: "var(--color-border-input)",
                  color: "var(--color-text-primary)",
                }}
              />
            </div>
          </div>

          {/* Items */}
          <div className="max-h-56 overflow-y-auto">
            {list.length === 0 ? (
              <p className="text-sm text-center py-5" style={{ color: "var(--color-text-muted)" }}>
                No products found
              </p>
            ) : (
              list.map((p, idx) => {
                const qb = p.attributeValues.find((av) => av.isQuantityBasis);
                const isActive = selected?.id === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => { onSelect(p); setOpen(false); setQuery(""); }}
                    className="w-full text-left px-4 py-2.5 text-sm flex items-center justify-between gap-3 transition-colors hover:opacity-80"
                    style={{
                      borderTop: idx > 0 ? "1px solid var(--color-border)" : undefined,
                      backgroundColor: isActive ? "color-mix(in srgb, #6366f1 8%, transparent)" : undefined,
                      color: "var(--color-text-primary)",
                    }}>
                    <div className="min-w-0">
                      <span className="font-medium">{p.name}</span>
                      {p.sku && (
                        <span className="ml-2 text-xs font-mono" style={{ color: "var(--color-text-muted)" }}>
                          {p.sku}
                        </span>
                      )}
                      <span className="ml-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
                        {p.groupName}
                      </span>
                    </div>
                    {qb && (
                      <span className="text-xs whitespace-nowrap shrink-0 px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: "color-mix(in srgb, #8b5cf6 10%, transparent)",
                          color: "#8b5cf6",
                          border: "1px solid color-mix(in srgb, #8b5cf6 20%, transparent)",
                        }}>
                        {qb.attrUnit ?? qb.attrName}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── bom input row ────────────────────────────────────────────────────────────

function BomRow({
  bomInput,
  outputProduct,
  outputQty,
  allProducts,
}: {
  bomInput: GroupInput;
  outputProduct: ProductWithGroup;
  outputQty: number | null;
  allProducts: ProductWithGroup[];
}) {
  const [selectedInput, setSelectedInput] = useState<ProductWithGroup | null>(null);

  const inputGroupProducts = useMemo(
    () => allProducts.filter((p) => p.productGroupId === bomInput.inputGroupId),
    [allProducts, bomInput.inputGroupId],
  );

  useEffect(() => {
    if (inputGroupProducts.length === 1 && !selectedInput) {
      setSelectedInput(inputGroupProducts[0]);
    }
  }, [inputGroupProducts, selectedInput]);

  const result = useMemo(() => {
    if (!selectedInput || outputQty == null || outputQty <= 0) return null;
    return calcRequired(bomInput, outputProduct, selectedInput, outputQty);
  }, [bomInput, outputProduct, selectedInput, outputQty]);

  const inputQbAv   = selectedInput?.attributeValues.find((av) => av.isQuantityBasis);
  const yf          = parseFloat(bomInput.yieldFactor);
  const hasYieldLoss = yf < 1;

  return (
    <div className="rounded-xl border" style={{ borderColor: "var(--color-border)" }}>
      {/* Input header */}
      <div className="px-5 py-3 flex items-center gap-2 rounded-t-xl"
        style={{ backgroundColor: "var(--color-bg-subtle)", borderBottom: "1px solid var(--color-border)" }}>
        <Package size={13} style={{ color: "var(--color-text-muted)" }} />
        <span className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
          {bomInput.label ?? bomInput.inputGroup.name}
        </span>
        {bomInput.label && (
          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            ({bomInput.inputGroup.name})
          </span>
        )}
        {hasYieldLoss && (
          <span className="ml-auto text-xs px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: "color-mix(in srgb, #f59e0b 12%, transparent)",
              color: "#d97706",
              border: "1px solid color-mix(in srgb, #f59e0b 25%, transparent)",
            }}>
            {(yf * 100).toFixed(0)}% yield · {(100 - yf * 100).toFixed(0)}% loss
          </span>
        )}
      </div>

      <div className="p-5 space-y-4">
        {/* Picker */}
        {inputGroupProducts.length === 0 ? (
          <div className="flex items-center gap-2 text-sm rounded-lg px-3 py-2.5"
            style={{ backgroundColor: "color-mix(in srgb, #f59e0b 8%, transparent)", color: "#d97706", border: "1px solid color-mix(in srgb, #f59e0b 20%, transparent)" }}>
            <AlertCircle size={13} />
            No variants exist for {bomInput.inputGroup.name}. Create a variant first.
          </div>
        ) : (
          <>
            <div>
              <p className="text-xs font-medium mb-1.5" style={{ color: "var(--color-text-muted)" }}>
                Select {bomInput.inputGroup.name} variant
              </p>
              <ProductPicker
                products={allProducts}
                selected={selectedInput}
                onSelect={setSelectedInput}
                onClear={() => setSelectedInput(null)}
                placeholder={`Choose a ${bomInput.inputGroup.name} variant…`}
                filterGroupId={bomInput.inputGroupId}
              />
            </div>

            {/* Selected input attrs */}
            {selectedInput && (
              <div className="rounded-lg border overflow-hidden"
                style={{ borderColor: "var(--color-border)" }}>
                <p className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider"
                  style={{ color: "var(--color-text-muted)", borderBottom: "1px solid var(--color-border)", backgroundColor: "var(--color-bg-subtle)" }}>
                  {selectedInput.name} — Attributes
                </p>
                <div className="px-3">
                  {selectedInput.attributeValues.map((av) => <AttrRow key={av.id} av={av} />)}
                </div>
              </div>
            )}
          </>
        )}

        {/* Formula */}
        <div className="flex items-center flex-wrap gap-2 px-3 py-2 rounded-lg text-xs font-mono"
          style={{ backgroundColor: "var(--color-bg-subtle)", color: "var(--color-text-muted)" }}>
          <FlaskConical size={11} style={{ flexShrink: 0 }} />
          <span className="font-semibold" style={{ color: "var(--color-text-secondary)" }}>
            {humanFormula(bomInput.qtyFormula, bomInput.formulaVars)}
          </span>
          {hasYieldLoss && (
            <>
              <ArrowRight size={10} style={{ flexShrink: 0 }} />
              <span>÷ {fmt(yf, 4)} (yield)</span>
            </>
          )}
          {bomInput.notes && (
            <span className="ml-auto" style={{ fontFamily: "inherit", fontWeight: "normal" }}>
              {bomInput.notes}
            </span>
          )}
        </div>

        {/* Result */}
        {result?.qty != null && (
          <div className="rounded-lg px-5 py-4"
            style={{
              backgroundColor: "color-mix(in srgb, #22c55e 8%, transparent)",
              border: "1px solid color-mix(in srgb, #22c55e 20%, transparent)",
            }}>
            <p className="text-xs font-medium mb-1" style={{ color: "#16a34a" }}>
              Required — {selectedInput?.name}
            </p>
            <p className="text-3xl font-bold tabular-nums" style={{ color: "#16a34a" }}>
              {fmt(result.qty, 4)}
              <span className="text-base font-normal ml-2">
                {inputQbAv?.attrUnit ?? "units"}
              </span>
            </p>
            {hasYieldLoss && result.baseQty != null && (
              <p className="text-xs mt-2" style={{ color: "#16a34a", opacity: 0.75 }}>
                Net formula: {fmt(result.baseQty, 4)} → ÷ {fmt(yf, 4)} =&nbsp;
                <strong>{fmt(result.qty, 4)} {inputQbAv?.attrUnit}</strong>
              </p>
            )}
          </div>
        )}

        {result != null && result.qty == null && (
          <div className="flex items-center gap-2 text-sm rounded-lg px-3 py-2.5"
            style={{ backgroundColor: "color-mix(in srgb, #ef4444 8%, transparent)", color: "#dc2626", border: "1px solid color-mix(in srgb, #ef4444 20%, transparent)" }}>
            <AlertCircle size={13} />
            Formula could not be evaluated — check that all attribute values are set and aliases match.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function BomCalculatorPage() {
  const [allProducts, setAllProducts]     = useState<ProductWithGroup[]>([]);
  const [loading, setLoading]             = useState(true);
  const [outputProduct, setOutputProduct] = useState<ProductWithGroup | null>(null);
  const [bomInputs, setBomInputs]         = useState<GroupInput[]>([]);
  const [outputQtyStr, setOutputQtyStr]   = useState("");
  const [loadingBom, setLoadingBom]       = useState(false);

  useEffect(() => {
    listAllProducts().then(setAllProducts).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!outputProduct) { setBomInputs([]); return; }
    setLoadingBom(true);
    getGroupInputs(outputProduct.productGroupId)
      .then(setBomInputs)
      .finally(() => setLoadingBom(false));
  }, [outputProduct]);

  const outputQty  = outputQtyStr.trim() !== "" ? parseFloat(outputQtyStr) : null;
  const qtyBasisAv = outputProduct?.attributeValues.find((av) => av.isQuantityBasis);
  const hasBom     = bomInputs.length > 0;

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">

      {/* Page title */}
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2.5"
          style={{ color: "var(--color-text-primary)" }}>
          <Calculator size={20} />
          BOM Calculator
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
          Select an output product, enter the quantity you want to produce, and see the required raw materials.
        </p>
      </div>

      {/* ── Step 1: Output product ── */}
      <section className="rounded-xl border" style={{ borderColor: "var(--color-border)" }}>
        <div className="px-5 py-3 rounded-t-xl"
          style={{ backgroundColor: "var(--color-bg-subtle)", borderBottom: "1px solid var(--color-border)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
            Step 1 — Output Product
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
            What do you want to produce?
          </p>
        </div>

        <div className="p-5 space-y-4">
          {loading ? (
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Loading products…</p>
          ) : (
            <ProductPicker
              products={allProducts}
              selected={outputProduct}
              onSelect={(p) => { setOutputProduct(p); setOutputQtyStr(""); }}
              onClear={() => { setOutputProduct(null); setOutputQtyStr(""); setBomInputs([]); }}
              placeholder="Search and select the product you want to make…"
            />
          )}

          {/* Output attrs */}
          {outputProduct && (
            <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--color-border)" }}>
              <p className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider"
                style={{ color: "var(--color-text-muted)", borderBottom: "1px solid var(--color-border)", backgroundColor: "var(--color-bg-subtle)" }}>
                {outputProduct.name} — Attributes
              </p>
              <div className="px-3">
                {outputProduct.attributeValues.length === 0 ? (
                  <p className="text-sm py-3" style={{ color: "var(--color-text-muted)" }}>No attributes</p>
                ) : (
                  outputProduct.attributeValues.map((av) => <AttrRow key={av.id} av={av} />)
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Step 2: Quantity ── */}
      {outputProduct && (
        <section className="rounded-xl border" style={{ borderColor: "var(--color-border)" }}>
          <div className="px-5 py-3 rounded-t-xl"
            style={{ backgroundColor: "var(--color-bg-subtle)", borderBottom: "1px solid var(--color-border)" }}>
            <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
              Step 2 — Quantity to Produce
            </p>
            {qtyBasisAv && (
              <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                Measured in <strong>{qtyBasisAv.attrName}</strong>
                {qtyBasisAv.attrUnit && <> ({qtyBasisAv.attrUnit})</>}
              </p>
            )}
          </div>

          <div className="p-5">
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                step="any"
                value={outputQtyStr}
                onChange={(e) => setOutputQtyStr(e.target.value)}
                placeholder="e.g. 1000"
                className="flex-1 border rounded-lg px-4 py-2.5 text-lg font-mono focus:outline-none transition-colors"
                style={{
                  backgroundColor: "var(--color-bg-input)",
                  borderColor: "var(--color-border-input)",
                  color: "var(--color-text-primary)",
                }}
              />
              {qtyBasisAv?.attrUnit && (
                <span className="text-base font-semibold px-4 py-2.5 rounded-lg border shrink-0"
                  style={{
                    backgroundColor: "var(--color-bg-subtle)",
                    borderColor: "var(--color-border)",
                    color: "var(--color-text-secondary)",
                  }}>
                  {qtyBasisAv.attrUnit}
                </span>
              )}
              {outputQtyStr && (
                <button onClick={() => setOutputQtyStr("")}
                  className="p-2.5 rounded-lg border hover:opacity-70 transition-opacity shrink-0"
                  style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}>
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── Step 3: Input materials ── */}
      {outputProduct && !loadingBom && (
        <>
          {!hasBom ? (
            <div className="flex items-start gap-3 rounded-xl px-5 py-4 border"
              style={{
                backgroundColor: "color-mix(in srgb, #f59e0b 6%, transparent)",
                borderColor: "color-mix(in srgb, #f59e0b 25%, transparent)",
              }}>
              <AlertCircle size={16} style={{ color: "#d97706", flexShrink: 0, marginTop: 1 }} />
              <div>
                <p className="text-sm font-medium" style={{ color: "#d97706" }}>No BOM inputs defined</p>
                <p className="text-xs mt-0.5" style={{ color: "#d97706", opacity: 0.8 }}>
                  The <strong>{outputProduct.groupName}</strong> group has no input materials configured.
                  Add them from the Product Group page.
                </p>
              </div>
            </div>
          ) : (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <FlaskConical size={14} style={{ color: "var(--color-text-muted)" }} />
                <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                  Step 3 — Input Materials
                </p>
                <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                  ({bomInputs.length})
                </span>
              </div>

              <div className="space-y-4">
                {bomInputs.map((bi) => (
                  <BomRow
                    key={bi.id}
                    bomInput={bi}
                    outputProduct={outputProduct}
                    outputQty={outputQty}
                    allProducts={allProducts}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {loadingBom && (
        <p className="text-sm text-center" style={{ color: "var(--color-text-muted)" }}>
          Loading BOM…
        </p>
      )}

      {/* Empty state */}
      {!loading && !outputProduct && (
        <div className="text-center py-20 rounded-xl border border-dashed"
          style={{ borderColor: "var(--color-border)" }}>
          <Calculator size={36} className="mx-auto mb-3 opacity-30" style={{ color: "var(--color-text-muted)" }} />
          <p className="text-sm font-medium" style={{ color: "var(--color-text-secondary)" }}>
            Select a product above to begin
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
            Then enter the quantity you want to produce
          </p>
        </div>
      )}
    </div>
  );
}
