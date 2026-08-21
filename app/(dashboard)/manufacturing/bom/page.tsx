"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import {
  Search, ChevronDown, FlaskConical, Package, AlertCircle,
  ArrowRight, Calculator, X, Star, Hash, ChevronRight,
  Layers, Minus, Plus, GitCompare, FileText,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { listAllProducts, type ProductWithGroup } from "@/api-client/products";
import { getBomInputs, calculateBom, type BomInput, type BomResult, type BomInputResult, type BomAttrValue } from "@/api-client/bom";
import { getGroupAttributes } from "@/api-client/attributes";
import { BOM_SANDBOX_KEY } from "@/lib/bom-sandbox";
import { AddToQuoteModal } from "@/components/quotes/AddToQuoteModal";
import type { Quote } from "@/types/quote";

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 4) {
  return n.toLocaleString("en-IN", { maximumFractionDigits: decimals, minimumFractionDigits: 0 });
}

// Multiply all requiredQty / baseQty in a BOM subtree by factor
function scaleBom(bom: BomResult, factor: number): BomResult {
  return {
    ...bom,
    inputResults: bom.inputResults.map((r) => ({
      ...r,
      baseQty:     r.baseQty     != null ? r.baseQty     * factor : null,
      requiredQty: r.requiredQty != null ? r.requiredQty * factor : null,
      inputProduct: {
        ...r.inputProduct,
        attributeValues: r.inputProduct.attributeValues.map((av) => {
          const val = av.computedValue ?? av.numericValue;
          if (val == null || av.isQuantityBasis) return av;
          return { ...av, computedValue: val * factor, numericValue: av.numericValue != null ? av.numericValue * factor : null };
        }),
      },
      subBom: r.subBom ? scaleBom(r.subBom, factor) : null,
    })),
  };
}

// Collect leaf-level (raw material) requirements from a full BOM tree
type RawReq = {
  productId: string; name: string; groupName: string;
  unit: string | null; totalQty: number;
  unitPrice: number | null; pricingMethod: string | null;
  otherAttrs: { name: string; unit: string | null; totalVal: number }[];
};

function collectRaw(bom: BomResult, acc = new Map<string, RawReq>()): Map<string, RawReq> {
  for (const r of bom.inputResults) {
    if (!r.subBom || r.subBom.inputResults.length === 0) {
      const qty = r.requiredQty ?? 0;
      const id  = r.inputProduct.id;
      if (acc.has(id)) {
        const existing = acc.get(id)!;
        existing.totalQty += qty;
        for (const av of r.inputProduct.attributeValues) {
          if (av.isQuantityBasis) continue;
          const val = av.computedValue ?? av.numericValue;
          if (val == null) continue;
          const found = existing.otherAttrs.find((a) => a.name === av.attrName);
          if (found) found.totalVal += val;
          else existing.otherAttrs.push({ name: av.attrName ?? "", unit: av.attrUnit ?? null, totalVal: val });
        }
      } else {
        const otherAttrs: { name: string; unit: string | null; totalVal: number }[] = [];
        for (const av of r.inputProduct.attributeValues) {
          if (av.isQuantityBasis) continue;
          const val = av.computedValue ?? av.numericValue;
          if (val != null) otherAttrs.push({ name: av.attrName ?? "", unit: av.attrUnit ?? null, totalVal: val });
        }
        acc.set(id, {
          productId: id, name: r.inputProduct.name, groupName: r.inputProduct.groupName,
          unit: r.inputProduct.qtyBasisAttr?.attrUnit ?? null, totalQty: qty,
          unitPrice: r.inputProduct.unitPrice ?? null,
          pricingMethod: r.inputProduct.pricingMethod ?? null,
          otherAttrs,
        });
      }
    } else {
      collectRaw(r.subBom, acc);
    }
  }
  return acc;
}

// Group BOM results by inputProduct.id (identical materials → one card with × N)
type GroupedResult = {
  inputProductId: string;
  count:          number;
  results:        BomInputResult[];
  totalQty:       number | null;
  representative: BomInputResult;
};

function groupResults(results: BomInputResult[]): GroupedResult[] {
  const map = new Map<string, GroupedResult>();
  for (const r of results) {
    const key = r.inputProduct.id;
    if (!map.has(key)) {
      map.set(key, { inputProductId: key, count: 0, results: [], totalQty: 0, representative: r });
    }
    const g = map.get(key)!;
    g.count++;
    g.results.push(r);
    if (r.requiredQty != null) g.totalQty = (g.totalQty ?? 0) + r.requiredQty;
    else g.totalQty = null;
  }
  return [...map.values()];
}

// ─── attribute row ────────────────────────────────────────────────────────────

function AttrRow({ av }: { av: BomAttrValue }) {
  const val        = av.computedValue ?? av.numericValue;
  const displayVal = val != null ? val.toLocaleString("en-IN", { maximumFractionDigits: 6 }) : av.textValue ?? "—";
  const color      = av.isQuantityBasis ? "#8b5cf6" : av.isCalculated ? "#6366f1" : "var(--color-text-muted)";
  const Icon       = av.isQuantityBasis ? Star : av.isFromInput ? FlaskConical : Hash;
  return (
    <div className="flex items-center justify-between py-2 border-b last:border-b-0" style={{ borderColor: "var(--color-border)" }}>
      <div className="flex items-center gap-2 min-w-0">
        <Icon size={11} style={{ color, flexShrink: 0 }} />
        <span className="text-sm truncate" style={{ color: "var(--color-text-secondary)" }}>{av.attrName ?? "—"}</span>
        {av.isFromInput && (
          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "color-mix(in srgb, #6366f1 10%, transparent)", color: "#6366f1" }}>from input</span>
        )}
      </div>
      <div className="flex items-center gap-2 ml-4 shrink-0">
        <span className="text-sm font-mono font-medium tabular-nums" style={{ color: av.isQuantityBasis ? "#8b5cf6" : "var(--color-text-primary)" }}>{displayVal}</span>
        {av.attrUnit && <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>{av.attrUnit}</span>}
      </div>
    </div>
  );
}

// ─── product picker ───────────────────────────────────────────────────────────

function ProductPicker({ products, selected, onSelect, placeholder, onClear }: {
  products: ProductWithGroup[]; selected: ProductWithGroup | null;
  onSelect: (p: ProductWithGroup) => void; placeholder: string; onClear?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen]   = useState(false);
  const wrapRef           = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) { setOpen(false); setQuery(""); }
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const list = useMemo(() => {
    if (!query.trim()) return products;
    const q = query.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.groupName.toLowerCase().includes(q) || (p.sku ?? "").toLowerCase().includes(q));
  }, [products, query]);

  return (
    <div ref={wrapRef} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm text-left transition-colors"
        style={{ backgroundColor: "var(--color-bg-input)", borderColor: open ? "#6366f1" : "var(--color-border-input)", color: selected ? "var(--color-text-primary)" : "var(--color-text-muted)" }}>
        <span className="flex items-center gap-2 min-w-0">
          {selected ? (<><Package size={13} style={{ color: "var(--color-text-muted)", flexShrink: 0 }} /><span className="font-medium truncate">{selected.name}</span><span className="text-xs shrink-0" style={{ color: "var(--color-text-muted)" }}>· {selected.groupName}</span></>) : (<><Search size={13} style={{ flexShrink: 0 }} /><span>{placeholder}</span></>)}
        </span>
        <div className="flex items-center gap-1 ml-2 shrink-0">
          {selected && onClear && (<span role="button" onClick={(e) => { e.stopPropagation(); onClear(); }} className="p-0.5 rounded hover:opacity-70" style={{ color: "var(--color-text-muted)" }}><X size={12} /></span>)}
          <ChevronDown size={14} style={{ color: "var(--color-text-muted)", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
        </div>
      </button>
      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1 rounded-xl border shadow-2xl overflow-hidden" style={{ backgroundColor: "var(--color-bg-popup)", borderColor: "var(--color-border)", top: "100%" }}>
          <div className="p-2" style={{ borderBottom: "1px solid var(--color-border)" }}>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--color-text-muted)" }} />
              <input autoFocus type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, group or SKU…"
                className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border focus:outline-none"
                style={{ backgroundColor: "var(--color-bg-input)", borderColor: "var(--color-border-input)", color: "var(--color-text-primary)" }} />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto">
            {list.length === 0 ? (
              <p className="text-sm text-center py-5" style={{ color: "var(--color-text-muted)" }}>No products found</p>
            ) : list.map((p, idx) => {
              const qb = p.attributeValues.find((av) => av.isQuantityBasis);
              return (
                <button key={p.id} type="button" onClick={() => { onSelect(p); setOpen(false); setQuery(""); }}
                  className="w-full text-left px-4 py-2.5 text-sm flex items-center justify-between gap-3 hover:opacity-80 transition-opacity"
                  style={{ borderTop: idx > 0 ? "1px solid var(--color-border)" : undefined, backgroundColor: selected?.id === p.id ? "color-mix(in srgb, #6366f1 8%, transparent)" : undefined, color: "var(--color-text-primary)" }}>
                  <div className="min-w-0">
                    <span className="font-medium">{p.name}</span>
                    {p.sku && <span className="ml-2 text-xs font-mono" style={{ color: "var(--color-text-muted)" }}>{p.sku}</span>}
                    <span className="ml-2 text-xs" style={{ color: "var(--color-text-muted)" }}>{p.groupName}</span>
                  </div>
                  {qb && (<span className="text-xs whitespace-nowrap shrink-0 px-2 py-0.5 rounded-full" style={{ backgroundColor: "color-mix(in srgb, #8b5cf6 10%, transparent)", color: "#8b5cf6", border: "1px solid color-mix(in srgb, #8b5cf6 20%, transparent)" }}>{qb.attrUnit ?? qb.attrName}</span>)}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── single BOM input card ────────────────────────────────────────────────────

function SingleBomCard({ result, depth, label }: { result: BomInputResult; depth: number; label?: string }) {
  const [expanded, setExpanded] = useState(true);
  const yf          = result.yieldFactor;
  const hasYield    = yf < 1;
  const displayName = label ?? result.label ?? result.inputGroupName;
  const isRaw       = !result.subBom || result.subBom.inputResults.length === 0;
  const accentColor = depth === 0 ? "#6366f1" : depth === 1 ? "#f59e0b" : "#22c55e";

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--color-border)" }}>
      <div className="px-4 py-2.5 flex items-center gap-2"
        style={{ backgroundColor: "var(--color-bg-subtle)", borderBottom: "1px solid var(--color-border)" }}>
        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: accentColor }} />
        <Package size={12} style={{ color: "var(--color-text-muted)" }} />
        <span className="text-sm font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>{result.inputProduct.name}</span>
        {displayName && <span className="text-xs shrink-0" style={{ color: "var(--color-text-muted)" }}>· {displayName}</span>}
        {isRaw && <span className="text-[10px] px-1.5 py-0.5 rounded ml-1" style={{ backgroundColor: "color-mix(in srgb, #22c55e 12%, transparent)", color: "#16a34a" }}>raw</span>}
        {hasYield && <span className="ml-auto text-xs px-1.5 py-0.5 rounded-full shrink-0" style={{ backgroundColor: "color-mix(in srgb, #f59e0b 12%, transparent)", color: "#d97706" }}>{(yf * 100).toFixed(0)}% yield</span>}
        <Link href={`/inventory/product-groups/${result.inputGroupId}`}
          className="ml-auto text-[11px] px-1.5 py-0.5 rounded hover:opacity-70 transition-opacity shrink-0"
          style={{ color: "var(--color-text-muted)", border: "1px solid var(--color-border)" }}>
          Edit
        </Link>
        {result.subBom && result.subBom.inputResults.length > 0 && (
          <button onClick={() => setExpanded((v) => !v)} className="p-0.5 rounded hover:opacity-70" style={{ color: "var(--color-text-muted)" }}>
            <ChevronRight size={13} style={{ transform: expanded ? "rotate(90deg)" : "none", transition: "transform 0.15s" }} />
          </button>
        )}
      </div>
      <div className="p-3 space-y-2.5">
        {/* Formula */}
        <div className="flex items-center flex-wrap gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono"
          style={{ backgroundColor: "var(--color-bg-subtle)", color: "var(--color-text-muted)" }}>
          <FlaskConical size={10} style={{ flexShrink: 0 }} />
          <span className="font-semibold" style={{ color: "var(--color-text-secondary)" }}>{result.humanFormula ?? result.qtyFormula}</span>
          {hasYield && <><ArrowRight size={9} /><span>÷ {yf}</span></>}
          {result.notes && <span className="ml-auto font-sans">{result.notes}</span>}
        </div>

        {/* Required */}
        {result.requiredQty != null && (
          <div className="rounded-lg overflow-hidden" style={{ border: `1px solid color-mix(in srgb, ${accentColor} 25%, transparent)` }}>
            <div className="px-3.5 py-2.5" style={{ backgroundColor: `color-mix(in srgb, ${accentColor} 8%, transparent)` }}>
              <p className="text-[11px] font-medium mb-0.5" style={{ color: accentColor }}>Required</p>
              <p className="text-xl font-bold tabular-nums" style={{ color: accentColor }}>
                {fmt(result.requiredQty)}
                <span className="text-sm font-normal ml-1.5">{result.inputProduct.qtyBasisAttr?.attrUnit ?? "units"}</span>
              </p>
              {hasYield && result.baseQty != null && (
                <p className="text-[11px] mt-0.5" style={{ color: accentColor, opacity: 0.7 }}>Net: {fmt(result.baseQty)} ÷ {yf} = <strong>{fmt(result.requiredQty)}</strong></p>
              )}
            </div>
            {(() => {
              const extras = result.inputProduct.attributeValues.filter((av) => !av.isQuantityBasis && (av.computedValue != null || av.numericValue != null));
              if (extras.length === 0) return null;
              return (
                <div style={{ borderTop: `1px solid color-mix(in srgb, ${accentColor} 15%, transparent)`, backgroundColor: `color-mix(in srgb, ${accentColor} 4%, transparent)` }}>
                  {extras.map((av) => {
                    const val = av.computedValue ?? av.numericValue!;
                    return (
                      <div key={av.id} className="flex items-center justify-between px-3.5 py-1.5 border-b last:border-b-0" style={{ borderColor: `color-mix(in srgb, ${accentColor} 10%, transparent)` }}>
                        <span className="text-[11px]" style={{ color: accentColor, opacity: 0.75 }}>{av.attrName}</span>
                        <span className="text-xs font-mono font-semibold tabular-nums" style={{ color: accentColor }}>
                          {val.toLocaleString("en-IN", { maximumFractionDigits: 4 })}{av.attrUnit && <span className="ml-1 text-[10px] font-normal opacity-70">{av.attrUnit}</span>}
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {result.error && (
          <div className="flex items-start gap-2 text-xs rounded-lg px-2.5 py-2" style={{ backgroundColor: "color-mix(in srgb, #ef4444 8%, transparent)", color: "#dc2626", border: "1px solid color-mix(in srgb, #ef4444 20%, transparent)" }}>
            <AlertCircle size={11} style={{ flexShrink: 0, marginTop: 1 }} />{result.error}
          </div>
        )}

        {/* Sub-BOM */}
        {result.subBom && result.subBom.inputResults.length > 0 && expanded && (
          <div>
            <div className="flex items-center gap-2 my-1.5">
              <div className="flex-1 h-px" style={{ backgroundColor: "var(--color-border)" }} />
              <span className="text-[10px] font-medium uppercase tracking-wider px-1.5" style={{ color: "var(--color-text-muted)" }}>
                {result.inputProduct.name} BOM
              </span>
              <div className="flex-1 h-px" style={{ backgroundColor: "var(--color-border)" }} />
            </div>
            <BomLevelView bom={result.subBom} depth={depth + 1} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── grouped BOM card (same material × N) ─────────────────────────────────────

function GroupedBomCard({ group, depth }: { group: GroupedResult; depth: number }) {
  const [expanded, setExpanded]       = useState(false); // strands collapsed by default
  const [subExpanded, setSubExpanded] = useState(true);  // sub-BOM expanded by default
  const accentColor = depth === 0 ? "#6366f1" : depth === 1 ? "#f59e0b" : "#22c55e";
  const rep         = group.representative;
  const yf          = rep.yieldFactor;
  const hasYield    = yf < 1;
  const isRaw       = !rep.subBom || rep.subBom.inputResults.length === 0;
  const perQty      = rep.requiredQty;
  const unit        = rep.inputProduct.qtyBasisAttr?.attrUnit ?? "units";

  // The aggregated sub-BOM = one representative sub-BOM × count
  const aggregatedSubBom = rep.subBom && rep.subBom.inputResults.length > 0
    ? scaleBom(rep.subBom, group.count)
    : null;

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--color-border)" }}>
      {/* Header */}
      <div className="px-4 py-2.5 flex items-center gap-2"
        style={{ backgroundColor: "var(--color-bg-subtle)", borderBottom: "1px solid var(--color-border)" }}>
        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: accentColor }} />
        <Package size={12} style={{ color: "var(--color-text-muted)" }} />
        <span className="text-sm font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>{rep.inputProduct.name}</span>
        {/* × N badge */}
        <span className="text-xs font-bold px-2 py-0.5 rounded shrink-0"
          style={{ backgroundColor: `color-mix(in srgb, ${accentColor} 15%, transparent)`, color: accentColor }}>
          × {group.count}
        </span>
        {isRaw && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "color-mix(in srgb, #22c55e 12%, transparent)", color: "#16a34a" }}>raw</span>}
        {hasYield && <span className="text-xs px-1.5 py-0.5 rounded-full shrink-0" style={{ backgroundColor: "color-mix(in srgb, #f59e0b 12%, transparent)", color: "#d97706" }}>{(yf * 100).toFixed(0)}% yield</span>}
        <Link href={`/inventory/product-groups/${rep.inputGroupId}`}
          className="ml-auto text-[11px] px-1.5 py-0.5 rounded hover:opacity-70 shrink-0"
          style={{ color: "var(--color-text-muted)", border: "1px solid var(--color-border)" }}>
          Edit
        </Link>
        {/* Expand/collapse strands */}
        <button onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded hover:opacity-70 shrink-0"
          style={{ color: "var(--color-text-muted)", border: "1px solid var(--color-border)" }}>
          {expanded ? <Minus size={10} /> : <Plus size={10} />}
          {expanded ? "collapse" : `${group.count} strands`}
        </button>
      </div>

      <div className="p-3 space-y-2.5">
        {/* Formula */}
        <div className="flex items-center flex-wrap gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono"
          style={{ backgroundColor: "var(--color-bg-subtle)", color: "var(--color-text-muted)" }}>
          <FlaskConical size={10} style={{ flexShrink: 0 }} />
          <span className="font-semibold" style={{ color: "var(--color-text-secondary)" }}>{rep.humanFormula ?? rep.qtyFormula}</span>
          <span style={{ color: accentColor }}>× {group.count} strands</span>
        </div>

        {/* Aggregated Required */}
        {group.totalQty != null && (
          <div className="rounded-lg overflow-hidden" style={{ border: `1px solid color-mix(in srgb, ${accentColor} 25%, transparent)` }}>
            <div className="px-3.5 py-2.5" style={{ backgroundColor: `color-mix(in srgb, ${accentColor} 8%, transparent)` }}>
              <p className="text-[11px] font-medium mb-0.5" style={{ color: accentColor }}>
                Required — {group.count} × {perQty != null ? fmt(perQty) : "?"} {unit}
              </p>
              <p className="text-2xl font-bold tabular-nums" style={{ color: accentColor }}>
                {fmt(group.totalQty)}
                <span className="text-sm font-normal ml-1.5">{unit}</span>
              </p>
            </div>
            {/* Per-strand other attrs (same for all, just show once) */}
            {(() => {
              const extras = rep.inputProduct.attributeValues.filter((av) => !av.isQuantityBasis && (av.computedValue != null || av.numericValue != null));
              if (extras.length === 0) return null;
              return (
                <div style={{ borderTop: `1px solid color-mix(in srgb, ${accentColor} 15%, transparent)`, backgroundColor: `color-mix(in srgb, ${accentColor} 4%, transparent)` }}>
                  {extras.map((av) => {
                    const val = av.computedValue ?? av.numericValue!;
                    return (
                      <div key={av.id} className="flex items-center justify-between px-3.5 py-1.5 border-b last:border-b-0" style={{ borderColor: `color-mix(in srgb, ${accentColor} 10%, transparent)` }}>
                        <span className="text-[11px]" style={{ color: accentColor, opacity: 0.75 }}>{av.attrName} <span style={{ opacity: 0.5 }}>(per strand)</span></span>
                        <span className="text-xs font-mono font-semibold" style={{ color: accentColor }}>
                          {val.toLocaleString("en-IN", { maximumFractionDigits: 4 })}{av.attrUnit && <span className="ml-0.5 text-[10px] font-normal opacity-70">{av.attrUnit}</span>}
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {rep.error && (
          <div className="flex items-start gap-2 text-xs rounded-lg px-2.5 py-2"
            style={{ backgroundColor: "color-mix(in srgb, #ef4444 8%, transparent)", color: "#dc2626", border: "1px solid color-mix(in srgb, #ef4444 20%, transparent)" }}>
            <AlertCircle size={11} style={{ flexShrink: 0, marginTop: 1 }} />{rep.error}
          </div>
        )}

        {/* Individual strand cards (expanded) */}
        {expanded && (
          <div className="space-y-2 pt-1">
            <p className="text-[11px] font-medium uppercase tracking-wider px-1" style={{ color: "var(--color-text-muted)" }}>
              Individual strands
            </p>
            {group.results.map((r) => (
              <SingleBomCard key={r.bomInputId} result={r} depth={depth} label={r.label ?? undefined} />
            ))}
          </div>
        )}

        {/* Aggregated sub-BOM (collapsed strands → show aggregate) */}
        {!expanded && aggregatedSubBom && (
          <div>
            <div className="flex items-center gap-2 my-1.5">
              <div className="flex-1 h-px" style={{ backgroundColor: "var(--color-border)" }} />
              <button onClick={() => setSubExpanded((v) => !v)}
                className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded hover:opacity-70"
                style={{ color: "var(--color-text-muted)", border: "1px solid var(--color-border)" }}>
                <ChevronRight size={10} style={{ transform: subExpanded ? "rotate(90deg)" : "none", transition: "transform 0.15s" }} />
                {rep.inputProduct.name} BOM (× {group.count})
              </button>
              <div className="flex-1 h-px" style={{ backgroundColor: "var(--color-border)" }} />
            </div>
            {subExpanded && <BomLevelView bom={aggregatedSubBom} depth={depth + 1} />}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── BOM level view (groups identical materials) ──────────────────────────────

function BomLevelView({ bom, depth = 0 }: { bom: BomResult; depth?: number }) {
  const groups = useMemo(() => groupResults(bom.inputResults), [bom.inputResults]);
  return (
    <div className="space-y-3" style={{ marginLeft: depth * 12 }}>
      {groups.map((g) =>
        g.count === 1
          ? <SingleBomCard key={g.results[0].bomInputId} result={g.results[0]} depth={depth} />
          : <GroupedBomCard key={g.inputProductId} group={g} depth={depth} />
      )}
    </div>
  );
}

// ─── raw materials summary panel ──────────────────────────────────────────────

function RawMaterialsSummary({ bom }: { bom: BomResult }) {
  const raws = useMemo(() => [...collectRaw(bom).values()], [bom]);
  if (raws.length === 0) return null;
  return (
    <div className="rounded-xl border overflow-hidden sticky top-6" style={{ borderColor: "var(--color-border)" }}>
      <div className="px-4 py-3 flex items-center gap-2" style={{ backgroundColor: "var(--color-bg-subtle)", borderBottom: "1px solid var(--color-border)" }}>
        <Layers size={13} style={{ color: "var(--color-text-muted)" }} />
        <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>Raw Materials</p>
        <span className="ml-auto text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: "color-mix(in srgb, #22c55e 12%, transparent)", color: "#16a34a" }}>
          {raws.length} type{raws.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="divide-y" style={{ borderColor: "var(--color-border)" }}>
        {raws.map((r) => {
          const totalCost = r.unitPrice != null ? r.unitPrice * r.totalQty : null;
          return (
            <div key={r.productId} className="px-4 py-3">
              <p className="text-xs font-semibold" style={{ color: "var(--color-text-primary)" }}>{r.name}</p>
              <p className="text-[11px] mb-1.5" style={{ color: "var(--color-text-muted)" }}>{r.groupName}</p>

              {/* Primary qty */}
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-bold tabular-nums" style={{ color: "#22c55e" }}>{fmt(r.totalQty)}</span>
                <span className="text-xs" style={{ color: "#22c55e", opacity: 0.75 }}>{r.unit ?? "units"}</span>
              </div>

              {/* Price row */}
              <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t"
                style={{ borderColor: "var(--color-border)" }}>
                <span className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>Unit price</span>
                {r.unitPrice != null ? (
                  <span className="text-xs font-mono font-semibold" style={{ color: "var(--color-text-primary)" }}>
                    ₹{r.unitPrice.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                    {r.unit && <span className="font-normal opacity-60">/{r.unit}</span>}
                  </span>
                ) : (
                  <span className="text-[11px] italic" style={{ color: "var(--color-text-muted)" }}>not set</span>
                )}
              </div>
              {totalCost != null && (
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>Est. total cost</span>
                  <span className="text-xs font-mono font-semibold" style={{ color: "#f59e0b" }}>
                    ₹{totalCost.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}
              {r.unitPrice != null && r.pricingMethod && (
                <p className="text-[10px] mt-0.5" style={{ color: "var(--color-text-muted)", opacity: 0.6 }}>
                  {r.pricingMethod.replace(/_/g, " ")}
                </p>
              )}

              {/* Other derived attrs (e.g. length) */}
              {r.otherAttrs.map((a) => (
                <div key={a.name} className="flex items-center justify-between mt-1">
                  <span className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>{a.name}</span>
                  <span className="text-xs font-mono" style={{ color: "var(--color-text-secondary)" }}>
                    {a.totalVal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}{a.unit && ` ${a.unit}`}
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

// BOM fetch result — one object so we update state once (async, in .then)
type BomFetchState = {
  productId:    string;
  inputs:       BomInput[];
  qtyBasisInfo: { attrName: string | null; attrUnit: string | null } | null;
};

export default function BomCalculatorPage() {
  const router = useRouter();
  const [allProducts, setAllProducts]   = useState<ProductWithGroup[]>([]);
  const [loading, setLoading]           = useState(true);
  const [outputProduct, setOutputProduct] = useState<ProductWithGroup | null>(null);
  const [outputQtyStr, setOutputQtyStr] = useState("");
  const [bomFetch, setBomFetch]         = useState<BomFetchState | null>(null);
  const [result, setResult]             = useState<BomResult | null>(null);
  const [calculating, setCalc]          = useState(false);
  const [showAddToQuote, setShowAddToQuote] = useState(false);
  const [quoteToast, setQuoteToast]     = useState<Quote | null>(null);

  useEffect(() => { listAllProducts().then(setAllProducts).finally(() => setLoading(false)); }, []);

  // Fetch BOM inputs + qty-basis info — single async setState, no synchronous setState in effect
  useEffect(() => {
    if (!outputProduct) return;
    const id = outputProduct.id;
    Promise.all([getBomInputs(id), getGroupAttributes(outputProduct.productGroupId)])
      .then(([inputs, groupAttrs]) => {
        const qb = groupAttrs.find((a) => a.isQuantityBasis);
        setBomFetch({
          productId:    id,
          inputs,
          qtyBasisInfo: qb ? { attrName: qb.attribute.name, attrUnit: qb.attribute.unit ?? null } : null,
        });
      });
  }, [outputProduct]);

  // Handler: selecting / clearing a product — resets all derived state in one shot
  const selectProduct = useCallback((p: ProductWithGroup | null) => {
    setOutputProduct(p);
    setOutputQtyStr("");
    setBomFetch(null);
    setResult(null);
  }, []);

  const outputQty = outputQtyStr.trim() !== "" ? parseFloat(outputQtyStr) : null;

  // Total raw-material cost across the whole BOM tree — feeds the "Add to Quote" margin-based pricing helper
  const rawCostInfo = useMemo(() => {
    if (!result) return null;
    const raws = [...collectRaw(result).values()];
    if (raws.length === 0) return null;
    const total     = raws.reduce((s, r) => s + (r.unitPrice != null ? r.unitPrice * r.totalQty : 0), 0);
    const allPriced = raws.every((r) => r.unitPrice != null);
    return { total, allPriced };
  }, [result]);

  const calculate = useCallback(async (product: ProductWithGroup, qty: number) => {
    setCalc(true);
    try {
      const res = await calculateBom({ outputProductId: product.id, outputQty: qty, inputs: [] });
      setResult(res);
    } catch { setResult(null); } finally { setCalc(false); }
  }, []);

  const openComparison = useCallback((product: ProductWithGroup, qty: number, bom: BomResult) => {
    const sandbox = {
      productId:      product.id,
      productName:    product.name,
      productGroupId: product.productGroupId,
      outputQty:      qty,
      realBom:        bom,
      editTree:       null,      // built by compare page on first load
      attrOverrides:  {},
      sessionVariants: [],
      savedAt:        Date.now(),
    };
    localStorage.setItem(BOM_SANDBOX_KEY, JSON.stringify(sandbox));
    router.push("/manufacturing/bom/compare");
  }, [router]);

  // Re-calculate (debounced) whenever product or qty changes
  useEffect(() => {
    if (!outputProduct || !outputQty || outputQty <= 0) return;
    const timer = setTimeout(() => calculate(outputProduct, outputQty), 300);
    return () => clearTimeout(timer);
  }, [outputProduct, outputQty, calculate]);

  // Derived state
  const bomInputs     = (bomFetch && bomFetch.productId === outputProduct?.id) ? bomFetch.inputs       : [];
  const qtyBasisInfo  = (bomFetch && bomFetch.productId === outputProduct?.id) ? bomFetch.qtyBasisInfo : null;
  // Loading while fetch is in-flight for current product
  const loadingBom    = outputProduct != null && (bomFetch == null || bomFetch.productId !== outputProduct.id);
  // Show result only when valid qty is entered
  const showResult    = result && outputProduct && outputQty && outputQty > 0;

  const qtyBasisAv   = outputProduct?.attributeValues.find((av) => av.isQuantityBasis);
  const qtyBasisName = qtyBasisAv?.attrName ?? qtyBasisInfo?.attrName ?? null;
  const qtyBasisUnit = qtyBasisAv?.attrUnit ?? qtyBasisInfo?.attrUnit ?? null;
  const hasBom       = bomInputs.length > 0;

  return (
    <div className="px-6 py-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold flex items-center gap-2.5" style={{ color: "var(--color-text-primary)" }}>
          <Calculator size={20} /> BOM Calculator
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
          Select a product, enter quantity, and trace all the way to raw materials.
        </p>
      </div>

      <div className="grid gap-6" style={{ gridTemplateColumns: showResult ? "1fr 300px" : "1fr" }}>
        {/* ── Left column ── */}
        <div className="space-y-5 min-w-0">

          {/* Step 1 */}
          <section className="rounded-xl border" style={{ borderColor: "var(--color-border)" }}>
            <div className="px-5 py-3 rounded-t-xl" style={{ backgroundColor: "var(--color-bg-subtle)", borderBottom: "1px solid var(--color-border)" }}>
              <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>Step 1 — Output Product</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>What do you want to produce?</p>
            </div>
            <div className="p-5 space-y-4">
              {loading ? <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Loading…</p> : (
                <ProductPicker products={allProducts} selected={outputProduct}
                  onSelect={selectProduct}
                  onClear={() => selectProduct(null)}
                  placeholder="Search and select the product you want to make…" />
              )}
              {outputProduct && (
                <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--color-border)" }}>
                  <p className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider"
                    style={{ color: "var(--color-text-muted)", borderBottom: "1px solid var(--color-border)", backgroundColor: "var(--color-bg-subtle)" }}>
                    {outputProduct.name} — Attributes
                  </p>
                  <div className="px-3">
                    {(result?.outputProduct.attributeValues ?? outputProduct.attributeValues).map((av) => <AttrRow key={av.id} av={av as BomAttrValue} />)}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Step 2 */}
          {outputProduct && (
            <section className="rounded-xl border" style={{ borderColor: "var(--color-border)" }}>
              <div className="px-5 py-3 rounded-t-xl" style={{ backgroundColor: "var(--color-bg-subtle)", borderBottom: "1px solid var(--color-border)" }}>
                <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>Step 2 — Quantity</p>
                {qtyBasisName && <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>Measured in <strong>{qtyBasisName}</strong>{qtyBasisUnit && <> ({qtyBasisUnit})</>}</p>}
              </div>
              <div className="p-5">
                <div className="flex items-center gap-2">
                  <input type="number" min="0" step="any" value={outputQtyStr} onChange={(e) => setOutputQtyStr(e.target.value)} placeholder="e.g. 1000"
                    className="flex-1 border rounded-lg px-4 py-2.5 text-lg font-mono focus:outline-none"
                    style={{ backgroundColor: "var(--color-bg-input)", borderColor: "var(--color-border-input)", color: "var(--color-text-primary)" }} />
                  {qtyBasisUnit && <span className="text-base font-semibold px-4 py-2.5 rounded-lg border shrink-0" style={{ backgroundColor: "var(--color-bg-subtle)", borderColor: "var(--color-border)", color: "var(--color-text-secondary)" }}>{qtyBasisUnit}</span>}
                  {outputQtyStr && <button onClick={() => { setOutputQtyStr(""); setResult(null); }} className="p-2.5 rounded-lg border hover:opacity-70 shrink-0" style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}><X size={16} /></button>}
                </div>
              </div>
            </section>
          )}

          {/* Step 3 — Material requirements */}
          {outputProduct && !loadingBom && (
            <>
              {!hasBom ? (
                <div className="flex items-start gap-3 rounded-xl px-5 py-4 border"
                  style={{ backgroundColor: "color-mix(in srgb, #f59e0b 6%, transparent)", borderColor: "color-mix(in srgb, #f59e0b 25%, transparent)" }}>
                  <AlertCircle size={16} style={{ color: "#d97706", flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <p className="text-sm font-medium" style={{ color: "#d97706" }}>No BOM inputs defined</p>
                    <p className="text-xs mt-0.5" style={{ color: "#d97706", opacity: 0.8 }}>
                      The <strong>{outputProduct.groupName}</strong> group has no input materials.{" "}
                      <Link href={`/inventory/product-groups/${outputProduct.productGroupId}`} className="underline underline-offset-2">Configure group</Link>
                    </p>
                  </div>
                </div>
              ) : showResult ? (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <FlaskConical size={14} style={{ color: "var(--color-text-muted)" }} />
                    <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>Material Requirements</p>
                    <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>({result!.inputResults.length} input{result!.inputResults.length !== 1 ? "s" : ""})</span>
                    {calculating && <span className="ml-2 text-xs" style={{ color: "var(--color-text-muted)" }}>Calculating…</span>}
                    <button
                      onClick={() => setShowAddToQuote(true)}
                      className="ml-auto flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-opacity hover:opacity-70"
                      style={{ borderColor: "#22c55e", color: "#22c55e", backgroundColor: "color-mix(in srgb, #22c55e 8%, transparent)" }}>
                      <FileText size={12} /> Add to Quote
                    </button>
                    <button
                      onClick={() => openComparison(outputProduct!, outputQty!, result!)}
                      className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-opacity hover:opacity-70"
                      style={{ borderColor: "#6366f1", color: "#6366f1", backgroundColor: "color-mix(in srgb, #6366f1 8%, transparent)" }}>
                      <GitCompare size={12} /> Compare / New BOM
                    </button>
                  </div>
                  <BomLevelView bom={result!} depth={0} />
                </section>
              ) : outputQty != null && outputQty > 0 ? (
                <div className="text-center py-10 text-sm rounded-xl border border-dashed" style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}>
                  {calculating ? "Calculating…" : (
                    <>No saved variant inputs.{" "}
                      <Link href={`/inventory/product-groups/${outputProduct.productGroupId}`} className="underline underline-offset-2">
                        Edit the variant
                      </Link>{" "}to assign input materials.</>
                  )}
                </div>
              ) : null}
            </>
          )}

          {loadingBom && <p className="text-sm text-center" style={{ color: "var(--color-text-muted)" }}>Loading BOM…</p>}

          {!loading && !outputProduct && (
            <div className="text-center py-20 rounded-xl border border-dashed" style={{ borderColor: "var(--color-border)" }}>
              <Calculator size={36} className="mx-auto mb-3 opacity-30" style={{ color: "var(--color-text-muted)" }} />
              <p className="text-sm font-medium" style={{ color: "var(--color-text-secondary)" }}>Select a product above to begin</p>
              <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>Then enter the quantity you want to produce</p>
            </div>
          )}
        </div>

        {/* ── Right column: Raw Materials Summary ── */}
        {showResult && (
          <div>
            <RawMaterialsSummary bom={result!} />
          </div>
        )}
      </div>

      {showAddToQuote && outputProduct && (
        <AddToQuoteModal
          productId={outputProduct.id}
          productName={outputProduct.name}
          defaultQty={outputQty ?? undefined}
          products={allProducts}
          rawMaterialCost={rawCostInfo?.total}
          rawMaterialCostPartial={rawCostInfo ? !rawCostInfo.allPriced : undefined}
          onDone={(quote) => { setShowAddToQuote(false); setQuoteToast(quote); }}
          onClose={() => setShowAddToQuote(false)}
        />
      )}

      {quoteToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl border px-4 py-3 shadow-2xl"
          style={{ backgroundColor: "var(--color-bg-popup)", borderColor: "var(--color-border)" }}>
          <FileText size={16} style={{ color: "#22c55e" }} />
          <p className="text-sm" style={{ color: "var(--color-text-primary)" }}>
            Added to <Link href={`/sales/quotes/${quoteToast.id}`} className="font-semibold underline underline-offset-2">{quoteToast.quoteNumber}</Link>
          </p>
          <button onClick={() => setQuoteToast(null)} className="p-1 rounded hover:opacity-70" style={{ color: "var(--color-text-muted)" }}>
            <X size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
