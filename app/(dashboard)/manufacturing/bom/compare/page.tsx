"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, GitCompare, Package, ChevronRight, RefreshCw,
  Trash2, Check, X, FlaskConical, Layers, ArrowRight, Loader2,
  AlertCircle, Plus, Minus, Star, Pencil, CheckCircle2,
} from "lucide-react";
import {
  BOM_SANDBOX_KEY, bomResultToEditTree, countChanges, childrenChanged,
  updateNodeInTree, readSandbox, writeSandbox, clearSandbox,
  type BomSandbox, type EditNode, type SessionVariant,
} from "@/lib/bom-sandbox";
import type { BomResult, BomInputResult, BomAttrValue } from "@/api-client/bom";
import { listGroupProducts, createGroupProduct } from "@/api-client/products";
import { calculateBom } from "@/api-client/bom";
import type { Product } from "@/types/product";

// ─── fmt ──────────────────────────────────────────────────────────────────────

function fmt(n: number, d = 4) {
  return n.toLocaleString("en-IN", { maximumFractionDigits: d, minimumFractionDigits: 0 });
}

// ─── types ────────────────────────────────────────────────────────────────────

type VariantStep = {
  /** Stable id for React keys */
  id: string;
  /** "sub" = create intermediate variant (e.g. new Core); "top" = create output product variant */
  kind: "sub" | "top";
  groupId: string;
  groupName: string;
  originalProductId: string;
  originalProductName: string;
  proposedName: string;
  /** Attribute values to copy from original (editable in wizard for numeric ones). */
  attrValues: { pgaId: string; name: string; unit: string | null; value: number | string | null; editable: boolean }[];
  /** Variant inputs to set on the new product. */
  variantInputs: { productGroupInputId: string; inputProductId: string }[];
  /**
   * For "sub" steps: which bomInputId in the PARENT node this variant replaces.
   * After this step creates a variant, that parent slot must point to the new ID.
   */
  parentBomInputId: string | null;
  status: "pending" | "creating" | "done" | "failed";
  createdId: string | null;
};

// ─── helpers to diff editTree vs realBom ─────────────────────────────────────

/** Find a BomInputResult by bomInputId anywhere in a BomResult tree. */
function findBomResult(bom: BomResult, bomInputId: string): BomInputResult | null {
  for (const r of bom.inputResults) {
    if (r.bomInputId === bomInputId) return r;
    if (r.subBom) {
      const found = findBomResult(r.subBom, bomInputId);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Build variant steps bottom-up.
 * For each top-level node whose children have changed → plan a new sub-level variant.
 * Then for the top level (output product) if any top-level node changed → plan a new output variant.
 */
function buildVariantPlan(
  sandbox: BomSandbox,
  editTree: EditNode[],
): VariantStep[] {
  const steps: VariantStep[] = [];
  // map: bomInputId → newly-planned step (for wiring parent slots)
  const planned = new Map<string, VariantStep>();

  // Pass 1: sub-level changes (e.g. DCW slots within Core)
  for (const topNode of editTree) {
    if (!childrenChanged(topNode)) continue;

    // Find the real BOM result for this top-level node to extract its attributes
    const realResult = findBomResult(sandbox.realBom, topNode.bomInputId);
    const attrs = realResult?.inputProduct.attributeValues ?? [];

    const step: VariantStep = {
      id: `sub-${topNode.bomInputId}`,
      kind: "sub",
      groupId: topNode.inputGroupId,
      groupName: topNode.inputGroupName,
      originalProductId: topNode.currentProductId,
      originalProductName: topNode.currentProductName,
      proposedName: `${topNode.currentProductName} (variant)`,
      attrValues: attrs
        .filter((av) => !av.isQuantityBasis && !av.isCalculated && !av.isFromInput)
        .map((av) => ({
          pgaId:    av.productGroupAttributeId,
          name:     av.attrName ?? av.productGroupAttributeId,
          unit:     av.attrUnit ?? null,
          value:    av.numericValue ?? av.textValue ?? null,
          editable: typeof (av.numericValue ?? av.textValue) === "number",
        })),
      variantInputs: topNode.children.map((c) => ({
        productGroupInputId: c.bomInputId,
        inputProductId:      c.currentProductId,
      })),
      parentBomInputId: topNode.bomInputId,
      status: "pending",
      createdId: null,
    };
    steps.push(step);
    planned.set(topNode.bomInputId, step);
  }

  // Pass 2: top-level output product variant (if anything changed at any level)
  const anyTopChanged = editTree.some(
    (n) => n.currentProductId !== n.originalProductId || childrenChanged(n) || n.manualQty !== null,
  );
  const attrOverrideEntries = Object.entries(sandbox.attrOverrides);

  if (anyTopChanged || attrOverrideEntries.length > 0) {
    // Find original output product attrs from the realBom outputProduct
    const outAttrs = sandbox.realBom.outputProduct.attributeValues ?? [];

    const step: VariantStep = {
      id: "top",
      kind: "top",
      groupId: sandbox.productGroupId,
      groupName: sandbox.realBom.outputProduct.groupName,
      originalProductId: sandbox.productId,
      originalProductName: sandbox.productName,
      proposedName: `${sandbox.productName} (variant)`,
      attrValues: outAttrs
        .filter((av) => !av.isQuantityBasis && !av.isCalculated && !av.isFromInput)
        .map((av) => {
          const override = sandbox.attrOverrides[av.productGroupAttributeId];
          const base = av.numericValue ?? av.textValue ?? null;
          const val = override !== undefined ? override : base;
          return {
            pgaId:    av.productGroupAttributeId,
            name:     av.attrName ?? av.productGroupAttributeId,
            unit:     av.attrUnit ?? null,
            value:    val,
            editable: av.numericValue != null || typeof override === "number",
          };
        }),
      // Variant inputs for the new output variant:
      // Use currentProductId (or the ID from any planned sub step)
      variantInputs: editTree.map((n) => ({
        productGroupInputId: n.bomInputId,
        // If a sub step was planned for this node, its created ID will fill in later
        inputProductId: n.currentProductId,
      })),
      parentBomInputId: null,
      status: "pending",
      createdId: null,
    };
    steps.push(step);
    planned.set("top", step);
  }

  return steps;
}

// ─── swap dropdown ────────────────────────────────────────────────────────────

function SwapDropdown({
  groupId, groupName, currentId,
  onSelect, onClose, triggerEl,
}: {
  groupId: string; groupName: string; currentId: string;
  onSelect: (id: string, name: string) => void; onClose: () => void;
  triggerEl: HTMLElement | null;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery]       = useState("");
  const [loading, setLoading]   = useState(true);
  const dropRef = useRef<HTMLDivElement>(null);

  // Compute fixed position from trigger element
  const pos = useMemo(() => {
    if (!triggerEl) return { top: 0, left: 0, width: 240 };
    const r = triggerEl.getBoundingClientRect();
    return { top: r.bottom + 6, left: r.left, width: Math.max(r.width, 240) };
  }, [triggerEl]);

  useEffect(() => {
    listGroupProducts(groupId).then(setProducts).finally(() => setLoading(false));
  }, [groupId]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      const target = e.target as Node;
      if (
        dropRef.current && !dropRef.current.contains(target) &&
        !(triggerEl && triggerEl.contains(target))
      ) onClose();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose, triggerEl]);

  const filtered = useMemo(() => {
    if (!query.trim()) return products;
    const q = query.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, query]);

  return createPortal(
    <div ref={dropRef}
      className="rounded-xl border shadow-2xl overflow-hidden"
      style={{
        position: "fixed",
        top:    pos.top,
        left:   pos.left,
        width:  pos.width,
        zIndex: 9999,
        backgroundColor: "var(--color-bg-popup)",
        borderColor:     "var(--color-border)",
      }}>
      <div className="px-3 py-2 border-b text-[11px] font-semibold uppercase tracking-wide"
        style={{ color: "var(--color-text-muted)", borderColor: "var(--color-border)" }}>
        {groupName}
      </div>
      <div className="p-2 border-b" style={{ borderColor: "var(--color-border)" }}>
        <input autoFocus type="text" value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Search product…"
          className="w-full px-2.5 py-1.5 text-xs rounded-lg border focus:outline-none"
          style={{ backgroundColor: "var(--color-bg-input)", borderColor: "var(--color-border-input)", color: "var(--color-text-primary)" }} />
      </div>
      <div className="max-h-56 overflow-y-auto">
        {loading ? (
          <p className="text-xs text-center py-4" style={{ color: "var(--color-text-muted)" }}>Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-center py-4" style={{ color: "var(--color-text-muted)" }}>None found</p>
        ) : filtered.map((p) => (
          <button key={p.id} type="button"
            onClick={() => { onSelect(p.id, p.name); onClose(); }}
            className="w-full text-left px-3 py-2.5 text-xs hover:opacity-80 flex items-center justify-between gap-2"
            style={{
              color:           "var(--color-text-primary)",
              backgroundColor: p.id === currentId ? "color-mix(in srgb, #6366f1 10%, transparent)" : undefined,
              borderBottom:    "1px solid var(--color-border)",
            }}>
            <span className="truncate">{p.name}</span>
            {p.id === currentId && <Check size={10} style={{ color: "#6366f1", flexShrink: 0 }} />}
          </button>
        ))}
      </div>
    </div>,
    document.body,
  );
}

// ─── editable node ────────────────────────────────────────────────────────────

function EditableNode({
  node, depth, realResult,
  onSwap, onQtyChange,
}: {
  node: EditNode;
  depth: number;
  realResult: BomInputResult | null;
  onSwap: (bomInputId: string, newId: string, newName: string) => void;
  onQtyChange: (bomInputId: string, qty: number | null) => void;
}) {
  const [expanded,    setExpanded]    = useState(depth < 2);
  const [swapOpen,    setSwapOpen]    = useState(false);
  const [editQty,     setEditQty]     = useState(false);
  const [qtyStr,      setQtyStr]      = useState("");
  const swapBtnRef = useRef<HTMLButtonElement>(null);

  const changed     = node.currentProductId !== node.originalProductId;
  const subChanged  = childrenChanged(node);
  const displayQty  = node.manualQty ?? node.originalQty;
  const hasChildren = node.children.length > 0;

  const accent = depth === 0 ? "#6366f1" : depth === 1 ? "#f59e0b" : "#22c55e";
  const qtyBasisAttr = realResult?.inputProduct.qtyBasisAttr;

  function commitQty() {
    const n = parseFloat(qtyStr);
    onQtyChange(node.bomInputId, isNaN(n) ? null : n);
    setEditQty(false);
  }

  return (
    <div className="rounded-xl border overflow-hidden"
      style={{
        borderColor: changed || subChanged
          ? "color-mix(in srgb, #f59e0b 50%, transparent)"
          : "var(--color-border)",
      }}>
      {/* Header */}
      <div className="px-3 py-2 flex items-center gap-2"
        style={{
          backgroundColor: changed || subChanged
            ? "color-mix(in srgb, #f59e0b 6%, transparent)"
            : "var(--color-bg-subtle)",
          borderBottom: "1px solid var(--color-border)",
        }}>
        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: accent }} />
        <Package size={11} style={{ color: "var(--color-text-muted)", flexShrink: 0 }} />

        {/* Product name / swap button */}
        <div className="flex-1 min-w-0">
          <button ref={swapBtnRef} type="button" onClick={() => setSwapOpen((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-semibold text-left hover:opacity-70 transition-opacity truncate max-w-full"
            style={{ color: changed ? "#d97706" : "var(--color-text-primary)" }}>
            {node.currentProductName}
            <Pencil size={9} style={{ color: "var(--color-text-muted)", flexShrink: 0 }} />
          </button>
          {swapOpen && (
            <SwapDropdown
              groupId={node.inputGroupId}
              groupName={node.inputGroupName}
              currentId={node.currentProductId}
              onSelect={(id, name) => { onSwap(node.bomInputId, id, name); setSwapOpen(false); }}
              onClose={() => setSwapOpen(false)}
              triggerEl={swapBtnRef.current}
            />
          )}
        </div>

        {/* Badges */}
        {node.label && <span className="text-[10px] shrink-0" style={{ color: "var(--color-text-muted)" }}>· {node.label}</span>}
        {changed && (
          <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0 font-medium"
            style={{ backgroundColor: "color-mix(in srgb, #f59e0b 15%, transparent)", color: "#d97706" }}>
            swapped
          </span>
        )}
        {!changed && subChanged && (
          <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0 font-medium"
            style={{ backgroundColor: "color-mix(in srgb, #f59e0b 15%, transparent)", color: "#d97706" }}>
            sub-BOM changed
          </span>
        )}
        {hasChildren && (
          <button onClick={() => setExpanded((v) => !v)} className="p-0.5 rounded hover:opacity-70" style={{ color: "var(--color-text-muted)" }}>
            <ChevronRight size={12} style={{ transform: expanded ? "rotate(90deg)" : "none", transition: "transform 0.15s" }} />
          </button>
        )}
      </div>

      {/* Body */}
      <div className="px-3 py-2.5 space-y-2">
        {/* Changed-from indicator */}
        {changed && (
          <div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--color-text-muted)" }}>
            <span className="line-through">{node.originalProductName}</span>
            <ArrowRight size={10} />
            <span style={{ color: "#d97706", fontWeight: 600 }}>{node.currentProductName}</span>
          </div>
        )}

        {/* Qty row */}
        <div className="flex items-center gap-2">
          {editQty ? (
            <div className="flex items-center gap-1.5 flex-1">
              <input autoFocus type="number" value={qtyStr} onChange={(e) => setQtyStr(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") commitQty(); if (e.key === "Escape") setEditQty(false); }}
                className="w-28 border rounded px-2 py-0.5 text-xs font-mono focus:outline-none"
                style={{ backgroundColor: "var(--color-bg-input)", borderColor: "#6366f1", color: "var(--color-text-primary)" }} />
              <button onClick={commitQty} className="p-0.5 rounded hover:opacity-70" style={{ color: "#22c55e" }}><Check size={12} /></button>
              <button onClick={() => setEditQty(false)} className="p-0.5 rounded hover:opacity-70" style={{ color: "#ef4444" }}><X size={12} /></button>
            </div>
          ) : (
            <button onClick={() => { setQtyStr(String(displayQty ?? "")); setEditQty(true); }}
              className="flex items-center gap-1.5 group"
              title="Click to override quantity">
              <span className="text-base font-bold tabular-nums font-mono" style={{ color: node.manualQty !== null ? "#f59e0b" : accent }}>
                {displayQty != null ? fmt(displayQty) : "—"}
              </span>
              <span className="text-xs" style={{ color: accent, opacity: 0.7 }}>{qtyBasisAttr?.attrUnit ?? "units"}</span>
              <Pencil size={9} className="opacity-0 group-hover:opacity-60 transition-opacity" style={{ color: "var(--color-text-muted)" }} />
            </button>
          )}
          {node.manualQty !== null && (
            <button onClick={() => onQtyChange(node.bomInputId, null)}
              className="text-[10px] underline opacity-60 hover:opacity-100"
              style={{ color: "var(--color-text-muted)" }}>
              reset
            </button>
          )}
        </div>

        {/* Sub-BOM children */}
        {hasChildren && expanded && (
          <div className="mt-2 space-y-2" style={{ marginLeft: 12 }}>
            {node.children.map((child) => (
              <EditableNode
                key={child.bomInputId}
                node={child}
                depth={depth + 1}
                realResult={null}
                onSwap={onSwap}
                onQtyChange={onQtyChange}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── real BOM node (read-only) ────────────────────────────────────────────────

function RealNode({ result, depth }: { result: BomInputResult; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const accent = depth === 0 ? "#6366f1" : depth === 1 ? "#f59e0b" : "#22c55e";
  const hasChildren = result.subBom && result.subBom.inputResults.length > 0;

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--color-border)" }}>
      <div className="px-3 py-2 flex items-center gap-2"
        style={{ backgroundColor: "var(--color-bg-subtle)", borderBottom: "1px solid var(--color-border)" }}>
        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: accent }} />
        <Package size={11} style={{ color: "var(--color-text-muted)", flexShrink: 0 }} />
        <span className="text-xs font-semibold truncate flex-1" style={{ color: "var(--color-text-primary)" }}>
          {result.inputProduct.name}
        </span>
        {result.label && <span className="text-[10px] shrink-0" style={{ color: "var(--color-text-muted)" }}>· {result.label}</span>}
        {hasChildren && (
          <button onClick={() => setExpanded((v) => !v)} className="p-0.5 rounded hover:opacity-70" style={{ color: "var(--color-text-muted)" }}>
            <ChevronRight size={12} style={{ transform: expanded ? "rotate(90deg)" : "none", transition: "transform 0.15s" }} />
          </button>
        )}
      </div>
      <div className="px-3 py-2 space-y-1.5">
        <div className="flex items-baseline gap-1.5">
          <span className="text-base font-bold tabular-nums font-mono" style={{ color: accent }}>
            {result.requiredQty != null ? fmt(result.requiredQty) : "—"}
          </span>
          <span className="text-xs" style={{ color: accent, opacity: 0.7 }}>
            {result.inputProduct.qtyBasisAttr?.attrUnit ?? "units"}
          </span>
        </div>
        {hasChildren && expanded && (
          <div className="space-y-1.5 mt-1" style={{ marginLeft: 12 }}>
            {result.subBom!.inputResults.map((r) => (
              <RealNode key={r.bomInputId} result={r} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ratio editor ─────────────────────────────────────────────────────────────

function RatioEditor({
  attrOverrides, realBom, onOverride,
}: {
  attrOverrides: Record<string, number | string>;
  realBom: BomResult;
  onOverride: (pgaId: string, value: number) => void;
}) {
  // Find ratio attributes on the output product (PGAs whose name contains "ratio" or "mix")
  const ratioAttrs = (realBom.outputProduct.attributeValues as BomAttrValue[]).filter(
    (av) => !av.isQuantityBasis && !av.isCalculated && !av.isFromInput && av.numericValue != null &&
      (av.attrName?.toLowerCase().includes("ratio") || av.attrName?.toLowerCase().includes("mix")),
  );

  if (ratioAttrs.length === 0) return null;

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--color-border)" }}>
      <div className="px-4 py-2.5 flex items-center gap-2"
        style={{ backgroundColor: "var(--color-bg-subtle)", borderBottom: "1px solid var(--color-border)" }}>
        <FlaskConical size={12} style={{ color: "var(--color-text-muted)" }} />
        <p className="text-xs font-semibold" style={{ color: "var(--color-text-primary)" }}>Output Product Attributes</p>
        <span className="text-[10px] ml-auto px-1.5 py-0.5 rounded"
          style={{ backgroundColor: "color-mix(in srgb, #6366f1 10%, transparent)", color: "#6366f1" }}>
          editable
        </span>
      </div>
      <div className="p-3 space-y-2">
        {ratioAttrs.map((av) => {
          const currentVal = attrOverrides[av.productGroupAttributeId] ?? av.numericValue;
          const isChanged = av.productGroupAttributeId in attrOverrides;
          return (
            <div key={av.productGroupAttributeId} className="flex items-center gap-3">
              <span className="text-xs flex-1 truncate" style={{ color: "var(--color-text-secondary)" }}>
                {av.attrName}
              </span>
              <input
                type="number" min="0" max="1" step="0.01"
                value={String(currentVal ?? "")}
                onChange={(e) => onOverride(av.productGroupAttributeId, parseFloat(e.target.value))}
                className="w-20 border rounded px-2 py-0.5 text-xs font-mono text-right focus:outline-none"
                style={{
                  backgroundColor: "var(--color-bg-input)",
                  borderColor: isChanged ? "#f59e0b" : "var(--color-border-input)",
                  color: isChanged ? "#d97706" : "var(--color-text-primary)",
                }} />
              {av.attrUnit && <span className="text-[10px] w-8 shrink-0" style={{ color: "var(--color-text-muted)" }}>{av.attrUnit}</span>}
            </div>
          );
        })}
        <p className="text-[10px] pt-1" style={{ color: "var(--color-text-muted)" }}>
          Changes here create a new output product variant with these ratios.
        </p>
      </div>
    </div>
  );
}

// ─── variant wizard ───────────────────────────────────────────────────────────

function VariantWizard({
  steps: initialSteps, sandbox, onDone, onClose,
}: {
  steps: VariantStep[];
  sandbox: BomSandbox;
  onDone: (createdVariants: SessionVariant[]) => void;
  onClose: () => void;
}) {
  const [steps, setSteps] = useState<VariantStep[]>(initialSteps);
  const [currentIdx, setCurrentIdx] = useState(0);
  const currentStep = steps[currentIdx];

  function updateStep(idx: number, patch: Partial<VariantStep>) {
    setSteps((prev) => prev.map((s, i) => i === idx ? { ...s, ...patch } : s));
  }

  function updateAttrValue(stepIdx: number, pgaId: string, value: number | string) {
    setSteps((prev) => prev.map((s, i) => {
      if (i !== stepIdx) return s;
      return {
        ...s,
        attrValues: s.attrValues.map((av) => av.pgaId === pgaId ? { ...av, value } : av),
      };
    }));
  }

  async function createCurrent() {
    if (!currentStep) return;
    updateStep(currentIdx, { status: "creating" });

    // Build the variantInputs, substituting IDs from completed sub steps
    const resolvedVarInputs = currentStep.variantInputs.map((vi) => {
      // If a previously-created sub step maps to this bomInputId, use its new ID
      const subStep = steps.find(
        (s) => s.kind === "sub" && s.parentBomInputId === vi.productGroupInputId && s.createdId,
      );
      return {
        productGroupInputId: vi.productGroupInputId,
        inputProductId:      subStep?.createdId ?? vi.inputProductId,
      };
    });

    // Build attribute values payload
    const attrPayload = currentStep.attrValues
      .filter((av) => av.value != null)
      .map((av) => ({
        productGroupAttributeId: av.pgaId,
        ...(typeof av.value === "number"
          ? { numericValue: av.value }
          : { textValue: String(av.value) }),
      }));

    try {
      const created = await createGroupProduct(currentStep.groupId, {
        name:            currentStep.proposedName,
        attributeValues: attrPayload,
        variantInputs:   resolvedVarInputs,
      });
      updateStep(currentIdx, { status: "done", createdId: created.id });

      // Advance
      if (currentIdx < steps.length - 1) {
        setCurrentIdx((i) => i + 1);
      } else {
        // All done
        const created2: SessionVariant[] = steps
          .filter((s) => s.createdId)
          .map((s) => ({
            originalId: s.originalProductId,
            newId:      s.createdId!,
            newName:    s.proposedName,
            groupId:    s.groupId,
            groupName:  s.groupName,
          }));
        onDone(created2);
      }
    } catch (err) {
      console.error(err);
      updateStep(currentIdx, { status: "failed" });
    }
  }

  const allDone = steps.every((s) => s.status === "done");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
      <div className="w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden"
        style={{ backgroundColor: "var(--color-bg-elevated)", borderColor: "var(--color-border)" }}>

        {/* Title bar */}
        <div className="px-5 py-4 flex items-center justify-between border-b"
          style={{ borderColor: "var(--color-border)" }}>
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
              Create Variants
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
              {steps.length} variant{steps.length !== 1 ? "s" : ""} to create — bottom-up
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:opacity-70" style={{ color: "var(--color-text-muted)" }}>
            <X size={16} />
          </button>
        </div>

        {/* Step tabs */}
        <div className="flex border-b" style={{ borderColor: "var(--color-border)" }}>
          {steps.map((s, i) => (
            <button key={s.id} onClick={() => setCurrentIdx(i)}
              className="flex-1 py-2.5 text-[11px] font-medium truncate px-2 transition-colors"
              style={{
                color: i === currentIdx ? "#6366f1" : "var(--color-text-muted)",
                borderBottom: i === currentIdx ? "2px solid #6366f1" : "2px solid transparent",
                backgroundColor: s.status === "done" ? "color-mix(in srgb, #22c55e 6%, transparent)" : undefined,
              }}>
              {s.status === "done" ? <CheckCircle2 size={11} className="inline mr-1" style={{ color: "#22c55e" }} /> : null}
              Step {i + 1}
              <span className="block text-[10px] font-normal opacity-70 truncate">{s.groupName}</span>
            </button>
          ))}
        </div>

        {/* Step content */}
        {currentStep && (
          <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: "var(--color-text-muted)" }}>
                {currentStep.kind === "sub" ? "New Intermediate Variant" : "New Output Variant"}
              </p>
              <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                Based on: <strong style={{ color: "var(--color-text-primary)" }}>{currentStep.originalProductName}</strong>
              </p>
            </div>

            {/* Name */}
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: "var(--color-text-secondary)" }}>
                Variant Name
              </label>
              <input
                type="text" value={currentStep.proposedName}
                onChange={(e) => updateStep(currentIdx, { proposedName: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none"
                style={{
                  backgroundColor: "var(--color-bg-input)",
                  borderColor: "var(--color-border-input)",
                  color: "var(--color-text-primary)",
                }} />
            </div>

            {/* Variant inputs summary */}
            <div>
              <p className="text-xs font-medium mb-1.5" style={{ color: "var(--color-text-secondary)" }}>
                BOM Inputs (Variant Assignments)
              </p>
              <div className="rounded-lg border divide-y text-xs"
                style={{ borderColor: "var(--color-border)", color: "var(--color-text-secondary)" }}>
                {currentStep.variantInputs.map((vi, i) => {
                  // Find name from sandbox's editTree or session variants
                  const node = sandbox.editTree?.find((n) => n.bomInputId === vi.productGroupInputId) ||
                    sandbox.editTree?.flatMap((n) => n.children).find((c) => c.bomInputId === vi.productGroupInputId);
                  const subStep = steps.find(
                    (s) => s.kind === "sub" && s.parentBomInputId === vi.productGroupInputId,
                  );
                  const displayName = subStep
                    ? `${subStep.proposedName} (creating…)`
                    : (node?.currentProductName ?? vi.inputProductId);
                  return (
                    <div key={i} className="px-3 py-2 flex items-center gap-2">
                      <Package size={10} style={{ color: "var(--color-text-muted)", flexShrink: 0 }} />
                      <span className="truncate">{displayName}</span>
                      {subStep?.status === "done" && (
                        <CheckCircle2 size={10} style={{ color: "#22c55e", flexShrink: 0 }} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Editable attribute values */}
            {currentStep.attrValues.filter((av) => av.editable).length > 0 && (
              <div>
                <p className="text-xs font-medium mb-1.5" style={{ color: "var(--color-text-secondary)" }}>
                  Attributes
                </p>
                <div className="rounded-lg border divide-y"
                  style={{ borderColor: "var(--color-border)" }}>
                  {currentStep.attrValues.filter((av) => av.editable).map((av) => (
                    <div key={av.pgaId} className="px-3 py-2 flex items-center gap-3">
                      <span className="text-xs flex-1 truncate" style={{ color: "var(--color-text-secondary)" }}>
                        {av.name}
                      </span>
                      <input
                        type="number" step="any"
                        value={String(av.value ?? "")}
                        onChange={(e) => updateAttrValue(currentIdx, av.pgaId, parseFloat(e.target.value))}
                        className="w-24 border rounded px-2 py-1 text-xs font-mono text-right focus:outline-none"
                        style={{
                          backgroundColor: "var(--color-bg-input)",
                          borderColor: "var(--color-border-input)",
                          color: "var(--color-text-primary)",
                        }} />
                      {av.unit && <span className="text-[10px] w-8 shrink-0" style={{ color: "var(--color-text-muted)" }}>{av.unit}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Error */}
            {currentStep.status === "failed" && (
              <div className="flex items-center gap-2 text-xs rounded-lg px-3 py-2"
                style={{ backgroundColor: "color-mix(in srgb, #ef4444 8%, transparent)", color: "#dc2626", border: "1px solid color-mix(in srgb, #ef4444 20%, transparent)" }}>
                <AlertCircle size={12} /> Failed to create variant. Check console.
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-4 border-t flex items-center justify-between"
          style={{ borderColor: "var(--color-border)" }}>
          <button onClick={onClose} className="text-sm px-3 py-1.5 rounded-lg border hover:opacity-70"
            style={{ borderColor: "var(--color-border)", color: "var(--color-text-secondary)" }}>
            Cancel
          </button>
          {allDone ? (
            <button onClick={() => onDone(steps.filter((s) => s.createdId).map((s) => ({
              originalId: s.originalProductId, newId: s.createdId!, newName: s.proposedName,
              groupId: s.groupId, groupName: s.groupName,
            })))}
              className="flex items-center gap-2 text-sm px-4 py-1.5 rounded-lg font-medium"
              style={{ backgroundColor: "#22c55e", color: "#fff" }}>
              <CheckCircle2 size={14} /> Done
            </button>
          ) : (
            <button
              onClick={createCurrent}
              disabled={currentStep?.status === "creating"}
              className="flex items-center gap-2 text-sm px-4 py-1.5 rounded-lg font-medium disabled:opacity-50"
              style={{ backgroundColor: "#6366f1", color: "#fff" }}>
              {currentStep?.status === "creating"
                ? <><Loader2 size={13} className="animate-spin" /> Creating…</>
                : <><Check size={13} /> Create Step {currentIdx + 1}</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── raw material diff ────────────────────────────────────────────────────────

type RawChange = {
  slot:            string;
  originalProduct: string;
  newProduct:      string;
  qty:             number | null;
  unit:            string | null;
};

/** Collect leaf nodes (no children = raw material) that changed vs original */
function collectRawChanges(nodes: EditNode[]): RawChange[] {
  const out: RawChange[] = [];
  function walk(ns: EditNode[]) {
    for (const n of ns) {
      if (n.children.length === 0) {
        // leaf = raw material
        if (n.currentProductId !== n.originalProductId) {
          out.push({
            slot:            n.label ?? n.inputGroupName,
            originalProduct: n.originalProductName,
            newProduct:      n.currentProductName,
            qty:             n.originalQty,
            unit:            null, // unit not stored in EditNode; just show qty
          });
        }
      } else {
        walk(n.children);
      }
    }
  }
  walk(nodes);
  return out;
}

function RawMaterialDiff({ editTree }: { editTree: EditNode[] }) {
  const changes = useMemo(() => collectRawChanges(editTree), [editTree]);
  if (changes.length === 0) return null;
  return (
    <div className="mt-4 rounded-xl border overflow-hidden"
      style={{ borderColor: "color-mix(in srgb, #6366f1 25%, transparent)" }}>
      <div className="px-4 py-2.5 flex items-center gap-2"
        style={{ backgroundColor: "color-mix(in srgb, #6366f1 6%, transparent)", borderBottom: "1px solid color-mix(in srgb, #6366f1 15%, transparent)" }}>
        <Layers size={12} style={{ color: "#6366f1" }} />
        <p className="text-xs font-semibold" style={{ color: "#6366f1" }}>
          Raw Material Changes ({changes.length} material{changes.length !== 1 ? "s" : ""} affected)
        </p>
      </div>
      <div className="divide-y" style={{ borderColor: "var(--color-border)" }}>
        {changes.map((c, i) => (
          <div key={i} className="px-4 py-3 text-xs space-y-1">
            <p className="font-medium" style={{ color: "var(--color-text-primary)" }}>
              {c.slot}
            </p>
            <div className="flex items-center gap-2" style={{ color: "var(--color-text-muted)" }}>
              <span className="line-through opacity-70">{c.originalProduct}</span>
              <ArrowRight size={10} />
              <span style={{ color: "#d97706", fontWeight: 600 }}>{c.newProduct}</span>
            </div>
            {c.qty != null && (
              <p style={{ color: "var(--color-text-muted)", opacity: 0.7 }}>
                Qty (from real BOM): {fmt(c.qty)} — will be recalculated after variant is created
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── raw materials comparison ─────────────────────────────────────────────────

type RawMaterialRow = {
  key:         string;   // bomInputId path (used as React key + for matching)
  name:        string;
  qty:         number | null;
  unit:        string | null;
  groupName:   string;
};

/** Recursively collect leaf nodes from a BomResult tree (leaves = raw materials). */
function collectRealRaw(results: BomInputResult[], path = ""): RawMaterialRow[] {
  const out: RawMaterialRow[] = [];
  for (const r of results) {
    const key = path ? `${path}/${r.bomInputId}` : r.bomInputId;
    if (r.subBom && r.subBom.inputResults.length > 0) {
      out.push(...collectRealRaw(r.subBom.inputResults, key));
    } else {
      out.push({
        key,
        name:      r.inputProduct.name,
        qty:       r.requiredQty,
        unit:      r.inputProduct.qtyBasisAttr?.attrUnit ?? null,
        groupName: r.inputGroupName,
      });
    }
  }
  return out;
}

/** Recursively collect leaf EditNodes from the parallel BOM tree. */
function collectParallelRaw(nodes: EditNode[], path = ""): RawMaterialRow[] {
  const out: RawMaterialRow[] = [];
  for (const n of nodes) {
    const key = path ? `${path}/${n.bomInputId}` : n.bomInputId;
    if (n.children.length > 0) {
      out.push(...collectParallelRaw(n.children, key));
    } else {
      out.push({
        key,
        name:      n.currentProductName,
        qty:       n.manualQty ?? n.originalQty,
        unit:      null,
        groupName: n.inputGroupName,
      });
    }
  }
  return out;
}

function RawMaterialsComparison({
  realBom, editTree, parallelBomResult, parallelLoading,
}: {
  realBom: BomResult;
  editTree: EditNode[];
  parallelBomResult: BomResult | null;
  parallelLoading: boolean;
}) {
  const realRaw = useMemo(() => collectRealRaw(realBom.inputResults), [realBom]);
  // Use live recalculated result when available, otherwise fall back to editTree leaf quantities
  const parallelRaw = useMemo(
    () => parallelBomResult
      ? collectRealRaw(parallelBomResult.inputResults)
      : collectParallelRaw(editTree),
    [parallelBomResult, editTree],
  );

  // Build a merged list keyed by bomInputId path
  const parallelMap = useMemo(() => {
    const m = new Map<string, RawMaterialRow>();
    for (const r of parallelRaw) m.set(r.key, r);
    return m;
  }, [parallelRaw]);

  // All unique keys from both sides
  const allKeys = useMemo(() => {
    const set = new Set<string>();
    realRaw.forEach((r)     => set.add(r.key));
    parallelRaw.forEach((r) => set.add(r.key));
    return Array.from(set);
  }, [realRaw, parallelRaw]);

  const realMap = useMemo(() => {
    const m = new Map<string, RawMaterialRow>();
    for (const r of realRaw) m.set(r.key, r);
    return m;
  }, [realRaw]);

  return (
    <div className="mt-8 rounded-xl border overflow-hidden"
      style={{ borderColor: "color-mix(in srgb, #6366f1 25%, transparent)" }}>
      <div className="px-4 py-3 flex items-center gap-2"
        style={{
          backgroundColor: "color-mix(in srgb, #6366f1 6%, transparent)",
          borderBottom:    "1px solid color-mix(in srgb, #6366f1 15%, transparent)",
        }}>
        <Layers size={13} style={{ color: "#6366f1" }} />
        <p className="text-sm font-semibold" style={{ color: "#6366f1" }}>
          Raw Materials Comparison
        </p>
        {parallelLoading
          ? <Loader2 size={12} className="animate-spin ml-auto" style={{ color: "#6366f1" }} />
          : (
            <span className="text-[10px] ml-auto px-2 py-0.5 rounded"
              style={{ backgroundColor: "color-mix(in srgb, #6366f1 12%, transparent)", color: "#6366f1" }}>
              {allKeys.length} material{allKeys.length !== 1 ? "s" : ""}
            </span>
          )}
      </div>

      {/* Column headers */}
      <div className="grid px-4 py-2 text-[10px] font-semibold uppercase tracking-wide"
        style={{
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          color:           "var(--color-text-muted)",
          borderBottom:    "1px solid var(--color-border)",
          backgroundColor: "var(--color-bg-subtle)",
        }}>
        <span>Real BOM</span>
        <span>Parallel BOM</span>
      </div>

      <div className="divide-y" style={{ borderColor: "var(--color-border)" }}>
        {allKeys.map((key) => {
          const real     = realMap.get(key);
          const parallel = parallelMap.get(key);
          const nameChanged = real?.name !== parallel?.name;
          const qtyChanged  = real?.qty  !== parallel?.qty;
          const anyChange   = nameChanged || qtyChanged;

          return (
            <div key={key}
              className="grid px-4 py-3"
              style={{
                gridTemplateColumns: "1fr 1fr",
                gap:             16,
                backgroundColor: anyChange
                  ? "color-mix(in srgb, #f59e0b 4%, transparent)"
                  : undefined,
              }}>
              {/* Real side */}
              <div className="space-y-0.5">
                {real ? (
                  <>
                    <p className="text-xs font-medium leading-tight" style={{ color: "var(--color-text-primary)" }}>
                      {real.name}
                    </p>
                    <p className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                      {real.groupName}
                    </p>
                    <p className="text-xs font-mono font-bold" style={{ color: "#6366f1" }}>
                      {real.qty != null ? fmt(real.qty) : "—"}
                      {real.unit ? <span className="text-[10px] font-normal ml-1 opacity-70">{real.unit}</span> : null}
                    </p>
                  </>
                ) : (
                  <p className="text-xs italic" style={{ color: "var(--color-text-muted)" }}>—</p>
                )}
              </div>

              {/* Parallel side */}
              <div className="space-y-0.5">
                {parallel ? (
                  <>
                    <p className="text-xs font-medium leading-tight"
                      style={{ color: nameChanged ? "#d97706" : "var(--color-text-primary)" }}>
                      {parallel.name}
                      {nameChanged && (
                        <span className="ml-1.5 text-[10px] px-1 py-0.5 rounded font-normal"
                          style={{ backgroundColor: "color-mix(in srgb, #f59e0b 15%, transparent)", color: "#d97706" }}>
                          swapped
                        </span>
                      )}
                    </p>
                    <p className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                      {parallel.groupName}
                    </p>
                    <div className="flex items-baseline gap-1.5">
                      <p className="text-xs font-mono font-bold"
                        style={{ color: qtyChanged ? "#f59e0b" : "#6366f1" }}>
                        {parallel.qty != null ? fmt(parallel.qty) : "—"}
                      </p>
                      {parallel.unit && (
                        <span className="text-[10px] opacity-70" style={{ color: "var(--color-text-muted)" }}>
                          {parallel.unit}
                        </span>
                      )}
                      {qtyChanged && real?.qty != null && parallel.qty != null && (
                        <span className="text-[10px] px-1 py-0.5 rounded"
                          style={{
                            backgroundColor: "color-mix(in srgb, #f59e0b 12%, transparent)",
                            color: "#d97706",
                          }}>
                          {parallel.qty > real.qty ? "+" : ""}
                          {fmt(parallel.qty - real.qty)}
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-xs italic" style={{ color: "var(--color-text-muted)" }}>—</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {allKeys.length === 0 && (
        <p className="px-4 py-6 text-xs text-center" style={{ color: "var(--color-text-muted)" }}>
          No raw materials found in this BOM.
        </p>
      )}
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

/** Flatten top-level EditNode selections (depth-0 only — server handles sub-BOM recursion). */
function topLevelSelections(nodes: EditNode[]) {
  return nodes.map((n) => ({ bomInputId: n.bomInputId, inputProductId: n.currentProductId }));
}

export default function BomComparePage() {
  const router = useRouter();
  const [sandbox,           setSandbox]           = useState<BomSandbox | null>(null);
  const [wizardOpen,        setWizardOpen]         = useState(false);
  const [variantSteps,      setVariantSteps]       = useState<VariantStep[]>([]);
  const [successMsg,        setSuccessMsg]         = useState<string | null>(null);
  const [parallelBomResult, setParallelBomResult]  = useState<BomResult | null>(null);
  const [parallelLoading,   setParallelLoading]    = useState(false);

  // Load sandbox from localStorage on mount
  useEffect(() => {
    const s = readSandbox();
    if (!s) { router.replace("/manufacturing/bom"); return; }
    // Init editTree from realBom if not yet built
    if (!s.editTree) {
      s.editTree = bomResultToEditTree(s.realBom.inputResults);
      writeSandbox(s);
    }
    setSandbox(s);
  }, [router]);

  // Re-calculate the parallel BOM whenever editTree or attrOverrides changes.
  // Debounced 450ms so rapid edits don't spam the server.
  useEffect(() => {
    if (!sandbox) return;
    setParallelLoading(true);
    const timer = setTimeout(async () => {
      try {
        const result = await calculateBom({
          outputProductId: sandbox.productId,
          outputQty:       sandbox.outputQty,
          inputs:          topLevelSelections(sandbox.editTree ?? []),
          attrOverrides:   sandbox.attrOverrides,
        });
        setParallelBomResult(result);
      } catch (err) {
        console.error("Parallel BOM recalc failed", err);
      } finally {
        setParallelLoading(false);
      }
    }, 450);
    return () => clearTimeout(timer);
  // We intentionally depend on the whole sandbox so changes to editTree OR attrOverrides trigger recalc.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sandbox?.editTree, sandbox?.attrOverrides]);

  // Persist sandbox whenever it changes
  const save = useCallback((patch: Partial<BomSandbox>) => {
    setSandbox((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      writeSandbox(next);
      return next;
    });
  }, []);

  // Swap input product on a node
  const handleSwap = useCallback((bomInputId: string, newId: string, newName: string) => {
    setSandbox((prev) => {
      if (!prev || !prev.editTree) return prev;
      const next = {
        ...prev,
        editTree: updateNodeInTree(prev.editTree, bomInputId, (n) => ({
          ...n,
          currentProductId:   newId,
          currentProductName: newName,
        })),
      };
      writeSandbox(next);
      return next;
    });
  }, []);

  // Override qty on a node
  const handleQtyChange = useCallback((bomInputId: string, qty: number | null) => {
    setSandbox((prev) => {
      if (!prev || !prev.editTree) return prev;
      const next = {
        ...prev,
        editTree: updateNodeInTree(prev.editTree, bomInputId, (n) => ({ ...n, manualQty: qty })),
      };
      writeSandbox(next);
      return next;
    });
  }, []);

  // Override a ratio / output attribute
  const handleAttrOverride = useCallback((pgaId: string, value: number) => {
    setSandbox((prev) => {
      if (!prev) return prev;
      const next = { ...prev, attrOverrides: { ...prev.attrOverrides, [pgaId]: value } };
      writeSandbox(next);
      return next;
    });
  }, []);

  // Open variant wizard
  function openWizard() {
    if (!sandbox || !sandbox.editTree) return;
    const steps = buildVariantPlan(sandbox, sandbox.editTree);
    if (steps.length === 0) return;
    setVariantSteps(steps);
    setWizardOpen(true);
  }

  // After wizard completes — reset editTree so "N changes" clears
  function onVariantsCreated(created: SessionVariant[]) {
    const freshTree = sandbox ? bomResultToEditTree(sandbox.realBom.inputResults) : null;
    save({
      sessionVariants: [...(sandbox?.sessionVariants ?? []), ...created],
      editTree:        freshTree,   // reset all edits — they're now baked into the new variants
      attrOverrides:   {},
    });
    setWizardOpen(false);
    setSuccessMsg(
      `${created.length} variant${created.length !== 1 ? "s" : ""} created successfully! Sandbox reset — start a new edit round if needed.`,
    );
  }

  // Clear sandbox
  function handleClear() {
    clearSandbox();
    router.replace("/manufacturing/bom");
  }

  // Derived state — computed unconditionally (hooks must not appear after early returns)
  const editTree     = sandbox?.editTree ?? [];
  const totalChanges = sandbox
    ? countChanges(editTree) + Object.keys(sandbox.attrOverrides).length
    : 0;
  const variantStepCount = useMemo(
    () => (sandbox && totalChanges > 0 ? buildVariantPlan(sandbox, editTree).length : 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editTree, sandbox?.attrOverrides, totalChanges],
  );

  if (!sandbox) {
    return (
      <div className="flex items-center justify-center h-60" style={{ color: "var(--color-text-muted)" }}>
        <Loader2 size={20} className="animate-spin mr-2" /> Loading sandbox…
      </div>
    );
  }

  return (
    <div className="px-6 py-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/manufacturing/bom"
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border hover:opacity-70 transition-opacity"
          style={{ borderColor: "var(--color-border)", color: "var(--color-text-secondary)" }}>
          <ArrowLeft size={13} /> Back to BOM
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold flex items-center gap-2" style={{ color: "var(--color-text-primary)" }}>
            <GitCompare size={17} />
            Parallel BOM — {sandbox.productName}
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
            Qty: {fmt(sandbox.outputQty)} · Sandbox edits stay local until you create variants.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={handleClear}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border hover:opacity-70"
            style={{ borderColor: "#ef4444", color: "#ef4444", backgroundColor: "color-mix(in srgb, #ef4444 6%, transparent)" }}>
            <Trash2 size={12} /> Clear Sandbox
          </button>
          {variantStepCount > 0 && (
            <button onClick={openWizard}
              className="flex items-center gap-2 text-sm px-4 py-1.5 rounded-lg font-medium"
              style={{ backgroundColor: "#6366f1", color: "#fff" }}>
              <RefreshCw size={13} />
              Create Variants ({variantStepCount})
            </button>
          )}
        </div>
      </div>

      {/* Success banner */}
      {successMsg && (
        <div className="mb-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm"
          style={{ backgroundColor: "color-mix(in srgb, #22c55e 10%, transparent)", border: "1px solid color-mix(in srgb, #22c55e 30%, transparent)", color: "#16a34a" }}>
          <CheckCircle2 size={14} /> {successMsg}
          <button onClick={() => setSuccessMsg(null)} className="ml-auto hover:opacity-70"><X size={12} /></button>
        </div>
      )}

      {/* Session variants created */}
      {sandbox.sessionVariants.length > 0 && (
        <div className="mb-4 rounded-xl border p-3 space-y-1.5"
          style={{ borderColor: "color-mix(in srgb, #22c55e 30%, transparent)", backgroundColor: "color-mix(in srgb, #22c55e 5%, transparent)" }}>
          <p className="text-xs font-semibold" style={{ color: "#16a34a" }}>Variants created this session:</p>
          {sandbox.sessionVariants.map((v) => (
            <div key={v.newId} className="flex items-center gap-2 text-xs">
              <CheckCircle2 size={11} style={{ color: "#22c55e" }} />
              <span style={{ color: "var(--color-text-primary)" }}>{v.newName}</span>
              <span style={{ color: "var(--color-text-muted)" }}>({v.groupName})</span>
              <Link href={`/inventory/product-groups/${v.groupId}`}
                className="ml-auto text-[11px] underline hover:opacity-70" style={{ color: "#6366f1" }}>
                View group
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Two-panel compare layout */}
      <div className="grid gap-6" style={{ gridTemplateColumns: "1fr 1fr" }}>

        {/* Left — Real BOM */}
        <div className="space-y-4 min-w-0">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "#6366f1" }} />
            <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>Real BOM</p>
            <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: "color-mix(in srgb, #6366f1 10%, transparent)", color: "#6366f1" }}>
              reference
            </span>
          </div>
          {/* Output product summary */}
          <div className="rounded-xl border px-4 py-3 text-xs"
            style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}>
            <span className="font-semibold" style={{ color: "var(--color-text-primary)" }}>{sandbox.productName}</span>
            <span className="ml-2">@ {fmt(sandbox.outputQty)} {sandbox.realBom.outputProduct.qtyBasisAttr?.attrUnit ?? "units"}</span>
          </div>
          <div className="space-y-3">
            {sandbox.realBom.inputResults.map((r) => (
              <RealNode key={r.bomInputId} result={r} depth={0} />
            ))}
          </div>
        </div>

        {/* Right — Parallel BOM (editable) */}
        <div className="space-y-4 min-w-0">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "#f59e0b" }} />
            <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>Parallel BOM</p>
            <span className="text-xs px-1.5 py-0.5 rounded font-medium"
              style={{ backgroundColor: "color-mix(in srgb, #f59e0b 12%, transparent)", color: "#d97706" }}>
              {totalChanges > 0 ? `${totalChanges} change${totalChanges !== 1 ? "s" : ""}` : "editable"}
            </span>
          </div>

          {/* Output product summary + ratio editor */}
          <div className="rounded-xl border px-4 py-3 text-xs"
            style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}>
            <span className="font-semibold" style={{ color: "var(--color-text-primary)" }}>{sandbox.productName}</span>
            <span className="ml-2">@ {fmt(sandbox.outputQty)} {sandbox.realBom.outputProduct.qtyBasisAttr?.attrUnit ?? "units"}</span>
          </div>

          {/* Ratio / attribute overrides */}
          <RatioEditor
            attrOverrides={sandbox.attrOverrides}
            realBom={sandbox.realBom}
            onOverride={handleAttrOverride}
          />

          {/* Editable BOM nodes */}
          <div className="space-y-3">
            {editTree.map((node) => {
              const realResult = sandbox.realBom.inputResults.find((r) => r.bomInputId === node.bomInputId) ?? null;
              return (
                <EditableNode
                  key={node.bomInputId}
                  node={node}
                  depth={0}
                  realResult={realResult}
                  onSwap={handleSwap}
                  onQtyChange={handleQtyChange}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Raw materials side-by-side comparison (always visible) */}
      <RawMaterialsComparison
        realBom={sandbox.realBom}
        editTree={editTree}
        parallelBomResult={parallelBomResult}
        parallelLoading={parallelLoading}
      />

      {/* Diff summary footer */}
      {totalChanges > 0 && (
        <div className="mt-8 rounded-xl border p-4"
          style={{ borderColor: "color-mix(in srgb, #f59e0b 40%, transparent)", backgroundColor: "color-mix(in srgb, #f59e0b 4%, transparent)" }}>
          <p className="text-sm font-semibold mb-3" style={{ color: "#d97706" }}>
            Summary of Changes — {totalChanges} edit{totalChanges !== 1 ? "s" : ""}
          </p>
          <div className="space-y-1.5 text-xs" style={{ color: "var(--color-text-secondary)" }}>
            {editTree.map((node) => {
              if (node.currentProductId !== node.originalProductId) {
                return (
                  <div key={node.bomInputId} className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: "#f59e0b" }} />
                    <span>{node.label ?? node.inputGroupName}:</span>
                    <span className="line-through opacity-60">{node.originalProductName}</span>
                    <ArrowRight size={10} />
                    <span style={{ fontWeight: 600 }}>{node.currentProductName}</span>
                  </div>
                );
              }
              if (childrenChanged(node)) {
                const changedChildren = node.children.filter((c) => c.currentProductId !== c.originalProductId);
                return (
                  <div key={node.bomInputId}>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: "#f59e0b" }} />
                      <span>{node.currentProductName} sub-BOM changed:</span>
                    </div>
                    {changedChildren.map((c) => (
                      <div key={c.bomInputId} className="flex items-center gap-2 ml-6 mt-0.5">
                        <span className="opacity-60">{c.label ?? c.inputGroupName}:</span>
                        <span className="line-through opacity-50">{c.originalProductName}</span>
                        <ArrowRight size={10} />
                        <span style={{ fontWeight: 600 }}>{c.currentProductName}</span>
                      </div>
                    ))}
                  </div>
                );
              }
              if (node.manualQty !== null) {
                return (
                  <div key={node.bomInputId} className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: "#6366f1" }} />
                    <span>{node.label ?? node.inputGroupName}: qty overridden to {fmt(node.manualQty)}</span>
                  </div>
                );
              }
              return null;
            })}
            {Object.keys(sandbox.attrOverrides).length > 0 && (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: "#6366f1" }} />
                <span>{Object.keys(sandbox.attrOverrides).length} output attribute(s) overridden (e.g. ratios)</span>
              </div>
            )}
          </div>
          <RawMaterialDiff editTree={editTree} />

          <button onClick={openWizard}
            className="mt-4 flex items-center gap-2 text-sm px-5 py-2 rounded-lg font-medium"
            style={{ backgroundColor: "#6366f1", color: "#fff" }}>
            <RefreshCw size={13} /> Create {variantStepCount} Variant{variantStepCount !== 1 ? "s" : ""} from Changes
          </button>
        </div>
      )}

      {/* Wizard modal */}
      {wizardOpen && (
        <VariantWizard
          steps={variantSteps}
          sandbox={sandbox}
          onDone={onVariantsCreated}
          onClose={() => setWizardOpen(false)}
        />
      )}
    </div>
  );
}
