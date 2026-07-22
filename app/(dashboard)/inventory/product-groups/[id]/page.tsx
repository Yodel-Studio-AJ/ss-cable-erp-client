"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Edit, Tag, Calendar, Plus, Pencil, Trash2,
  FlaskConical, Star, ChevronUp, ChevronDown, GitMerge,
} from "lucide-react";
import Modal from "@/components/ui/Modal";
import { getProductGroup, getProductGroups } from "@/api/productGroups";
import {
  createAttribute, getGroupAttributes,
  addGroupAttribute, updateGroupAttribute, removeGroupAttribute, reorderGroupAttributes,
} from "@/api/attributes";
import {
  getGroupInputs, addGroupInput, updateGroupInput, removeGroupInput,
} from "@/api/productGroupInputs";
import type { ProductGroup, ProductGroupType, MaterialType } from "@/types/productGroup";
import type { GroupAttribute, AttrFormulaVar, AttrFormulaVars } from "@/types/attribute";
import type { GroupInput, FormulaVar, FormulaVars } from "@/types/productGroupInput";
import { effectiveAlias } from "@/types/attribute";
import { PRODUCT_GROUP_TYPE_LABELS, MATERIAL_TYPE_LABELS } from "@/types/productGroup";
import type { AxiosError } from "axios";

// ─── style helpers ────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<ProductGroupType, string> = {
  raw_material:      "bg-amber-50 border-amber-300 text-amber-700",
  intermediate:      "bg-blue-50 border-blue-300 text-blue-700",
  finished_goods:    "bg-green-50 border-green-300 text-green-700",
  processed_product: "bg-purple-50 border-purple-300 text-purple-700",
};
const MATERIAL_COLORS: Record<MaterialType, string> = {
  metal: "bg-slate-100 text-slate-600",
  pvc:   "bg-orange-100 text-orange-600",
  mixed: "bg-teal-100 text-teal-600",
};

const inputCls = "w-full border rounded-lg px-3 py-2 text-sm focus:outline-none transition-colors";
const inputStyle: React.CSSProperties = {
  backgroundColor: "var(--color-bg-input)",
  borderColor: "var(--color-border-input)",
  color: "var(--color-text-primary)",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ borderColor: "var(--color-border)" }}
      className="flex items-start justify-between py-3 border-b last:border-b-0">
      <span style={{ color: "var(--color-text-muted)" }} className="text-sm w-36 shrink-0">{label}</span>
      <div className="flex-1 text-sm" style={{ color: "var(--color-text-primary)" }}>{children}</div>
    </div>
  );
}

// ─── attribute modal ──────────────────────────────────────────────────────────

type ModalMode = { type: "add" } | { type: "edit"; ga: GroupAttribute };

interface AttrModalProps {
  mode:           ModalMode;
  productGroupId: string;
  existingAttrs:  GroupAttribute[];
  bomInputs:      GroupInput[];
  onSaved:        (ga: GroupAttribute) => void;
  onClose:        () => void;
}

function AttributeModal({ mode, productGroupId, existingAttrs, bomInputs, onSaved, onClose }: AttrModalProps) {
  const isEdit = mode.type === "edit";
  const ga     = isEdit ? mode.ga : null;

  const [name, setName]         = useState("");
  const [unit, setUnit]         = useState("");
  const [dataType, setDataType] = useState<"string" | "number">("number");

  type AttrKind = "simple" | "qty_basis" | "calculated" | "from_input";
  function detectKind(g: GroupAttribute | null): AttrKind {
    if (!g) return "simple";
    if (g.isFromInput)     return "from_input";
    if (g.isCalculated)    return "calculated";
    if (g.isQuantityBasis) return "qty_basis";
    return "simple";
  }

  const [kind,         setKind]         = useState<AttrKind>(detectKind(ga));
  const [formulaAlias, setFormulaAlias] = useState(ga?.formulaAlias ?? "");
  const [formula,      setFormula]      = useState(ga?.formula ?? "");
  const [attrFVars,    setAttrFVars]    = useState<AttrFormulaVars>(ga?.formulaVars ?? {});
  const [sortOrder,    setSortOrder]    = useState(ga?.sortOrder ?? existingAttrs.length);

  // input group attrs for "from_input" formula builder — keyed by groupId
  const [inputGroupAttrMap, setInputGroupAttrMap] = useState<Record<string, { groupName: string; attrs: GroupAttribute[] }>>({});
  const [loadingInputAttrs, setLoadingInputAttrs] = useState(false);

  useEffect(() => {
    if (kind !== "from_input" || bomInputs.length === 0) { setInputGroupAttrMap({}); return; }
    let cancelled = false;
    setLoadingInputAttrs(true);
    Promise.all(
      bomInputs.map((bi) =>
        getGroupAttributes(bi.inputGroupId).then((attrs) => ({
          groupId:   bi.inputGroupId,
          groupName: bi.inputGroup.name,
          attrs,
        }))
      )
    ).then((results) => {
      if (cancelled) return;
      const map: Record<string, { groupName: string; attrs: GroupAttribute[] }> = {};
      for (const r of results) map[r.groupId] = { groupName: r.groupName, attrs: r.attrs };
      setInputGroupAttrMap(map);
      setLoadingInputAttrs(false);
    }).catch(() => { if (!cancelled) setLoadingInputAttrs(false); });
    return () => { cancelled = true; };
  }, [kind, bomInputs]);

  const isCalculated    = kind === "calculated";
  const isQuantityBasis = kind === "qty_basis";
  const isFromInput     = kind === "from_input";

  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  // shared textarea ref for both Calculated and From Input formula builders
  const formulaTextareaRef = useRef<HTMLTextAreaElement>(null);
  const formulaCursorRef   = useRef({ start: (ga?.formula ?? "").length, end: (ga?.formula ?? "").length });

  const siblingAttrs = isEdit ? existingAttrs.filter((e) => e.id !== ga!.id) : existingAttrs;

  function saveFormulaCursor() {
    const el = formulaTextareaRef.current;
    if (el) formulaCursorRef.current = { start: el.selectionStart, end: el.selectionEnd };
  }

  function insertAtFormulaCursor(text: string) {
    const { start, end } = formulaCursorRef.current;
    const next = formula.slice(0, start) + text + formula.slice(end);
    setFormula(next);
    const pos = start + text.length;
    formulaCursorRef.current = { start: pos, end: pos };
    requestAnimationFrame(() => {
      const el = formulaTextareaRef.current;
      if (el) { el.focus(); el.setSelectionRange(pos, pos); }
    });
  }

  function clickSiblingChip(ga_: GroupAttribute) {
    const token = pgaToken(ga_.id);
    insertAtFormulaCursor(token);
    setAttrFVars((prev) => ({
      ...prev,
      [token]: { pgaId: ga_.id, groupId: productGroupId, groupName: "This group", attrName: ga_.attribute.name, alias: effectiveAlias(ga_) },
    }));
  }

  function clickInputAttrChip(a: GroupAttribute, groupId: string, groupName: string) {
    const token = pgaToken(a.id);
    insertAtFormulaCursor(token);
    setAttrFVars((prev) => ({
      ...prev,
      [token]: { pgaId: a.id, groupId, groupName, attrName: a.attribute.name, alias: effectiveAlias(a) },
    }));
  }

  const FORMULA_OPS = ["+", "−", "×", "÷", "(", ")", "^"] as const;
  const FORMULA_OP_MAP: Record<string, string> = { "+": "+", "−": "-", "×": "*", "÷": "/", "(": "(", ")": ")", "^": "**" };

  async function handleSave() {
    if ((isCalculated || isFromInput) && !formula.trim()) {
      setError("Formula is required."); return;
    }
    setSaving(true); setError(null);
    const hasFormula = isCalculated || isFromInput;
    const fv = Object.keys(attrFVars).length > 0 ? attrFVars : null;
    try {
      if (isEdit) {
        const updated = await updateGroupAttribute(productGroupId, ga!.id, {
          formulaAlias:    formulaAlias.trim() || null,
          isCalculated,
          formula:         hasFormula ? (formula.trim() || null) : null,
          isQuantityBasis,
          isFromInput,
          formulaVars:     hasFormula ? fv : null,
          sortOrder,
        });
        onSaved(updated);
      } else {
        if (!name.trim()) { setError("Attribute name is required."); setSaving(false); return; }
        const created = await createAttribute({ name: name.trim(), unit: unit.trim() || undefined, dataType });
        const added = await addGroupAttribute(productGroupId, {
          attributeId:     created.id,
          formulaAlias:    formulaAlias.trim() || undefined,
          isCalculated,
          formula:         hasFormula ? (formula.trim() || undefined) : undefined,
          isQuantityBasis,
          isFromInput,
          formulaVars:     hasFormula && fv ? fv : undefined,
          sortOrder,
        });
        onSaved(added);
      }
      onClose();
    } catch (err) {
      const e = err as AxiosError<{ message?: string }>;
      setError(e.response?.data?.message ?? "Failed to save.");
      setSaving(false);
    }
  }

  return (
    <Modal title={isEdit ? `Edit — ${ga!.attribute.name}` : "New Attribute"} onClose={onClose} width="max-w-xl">
      <div className="space-y-4">
        {error && (
          <p className="text-red-500 text-xs bg-red-500/10 border border-red-500/20 rounded px-3 py-2">{error}</p>
        )}

        {/* Attribute definition */}
        {isEdit ? (
          <div style={{ backgroundColor: "var(--color-bg-input)", borderColor: "var(--color-border)" }}
            className="border rounded-lg px-3 py-2 flex items-center gap-2">
            <Tag size={13} style={{ color: "var(--color-text-muted)" }} />
            <span style={{ color: "var(--color-text-primary)" }} className="text-sm font-medium">{ga!.attribute.name}</span>
            {ga!.attribute.unit && <span style={{ color: "var(--color-text-muted)" }} className="text-xs">({ga!.attribute.unit})</span>}
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label style={{ color: "var(--color-text-muted)" }} className="block text-xs mb-1">Name *</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Density" style={inputStyle} className={inputCls} autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={{ color: "var(--color-text-muted)" }} className="block text-xs mb-1">Unit</label>
                <input type="text" value={unit} onChange={(e) => setUnit(e.target.value)}
                  placeholder="kg/m³" style={inputStyle} className={inputCls} />
              </div>
              <div>
                <label style={{ color: "var(--color-text-muted)" }} className="block text-xs mb-1">Value type</label>
                <select value={dataType} onChange={(e) => setDataType(e.target.value as "string" | "number")}
                  style={inputStyle} className={inputCls}>
                  <option value="number">Number</option>
                  <option value="string">Text</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Formula alias + sort order */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label style={{ color: "var(--color-text-muted)" }} className="block text-xs mb-1">
              Formula Alias <span className="opacity-60">(short var name)</span>
            </label>
            <input type="text" value={formulaAlias} onChange={(e) => setFormulaAlias(e.target.value)}
              placeholder={isEdit ? effectiveAlias(ga!) : (name ? name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') : "e.g. density")}
              style={inputStyle} className={inputCls} />
          </div>
          <div>
            <label style={{ color: "var(--color-text-muted)" }} className="block text-xs mb-1">Sort Order</label>
            <input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))}
              min={0} style={inputStyle} className={inputCls} />
          </div>
        </div>

        {/* Attribute kind */}
        <div>
          <label style={{ color: "var(--color-text-muted)" }} className="block text-xs mb-2">Attribute Kind</label>
          <div className="space-y-2">
            {([
              { value: "simple"     as const, label: "Simple",              desc: "A fixed value entered per product — e.g. cross-section area." },
              { value: "qty_basis"  as const, label: "Quantity Basis",      desc: "The ONE unit used to stock, procure or consume products in this group." },
              { value: "calculated" as const, label: "Calculated",          desc: "Formula using sibling attributes of this group only." },
              { value: "from_input" as const, label: "From Input Material", desc: "Formula that can reference attributes from input material groups (e.g. density from Copper Rod)." },
            ] as const).map(({ value, label, desc }) => (
              <label key={value} onClick={() => setKind(value)}
                style={{
                  borderColor:     kind === value ? "var(--color-btn-bg)" : "var(--color-border)",
                  backgroundColor: kind === value ? "color-mix(in srgb, var(--color-btn-bg) 8%, transparent)" : "var(--color-bg-page)",
                  cursor: "pointer",
                }}
                className="flex items-start gap-3 border rounded-lg px-3 py-2.5 transition-colors">
                <input type="radio" name="attr-kind" value={value} checked={kind === value}
                  onChange={() => setKind(value)} className="mt-0.5 cursor-pointer shrink-0" />
                <div>
                  <span style={{ color: "var(--color-text-primary)" }} className="text-sm font-medium">{label}</span>
                  <p style={{ color: "var(--color-text-muted)" }} className="text-xs mt-0.5">{desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Shared formula builder — Calculated (siblings only) or From Input (siblings + input groups) */}
        {(isCalculated || isFromInput) && (
          <div className="space-y-2">
            <label style={{ color: "var(--color-text-muted)" }} className="block text-xs">
              {isFromInput
                ? <>Formula <span className="opacity-60">— can reference this group's attrs AND input material attrs</span></>
                : "Formula"}
            </label>

            {isFromInput && bomInputs.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                Add at least one Input Material (BOM) to this group first.
              </p>
            ) : isFromInput && loadingInputAttrs ? (
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Loading attributes…</p>
            ) : (
              <>
                {/* Sibling chips — indigo */}
                {siblingAttrs.length > 0 && (
                  <div className="rounded-lg p-2.5" style={{ backgroundColor: "color-mix(in srgb, #6366f1 6%, transparent)", border: "1px solid color-mix(in srgb, #6366f1 25%, transparent)" }}>
                    <p className="text-[11px] mb-1.5 font-semibold" style={{ color: "#6366f1" }}>
                      This group <span className="font-normal opacity-70">(siblings)</span>
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {siblingAttrs.map((s) => (
                        <button key={s.id}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => clickSiblingChip(s)}
                          className="px-2 py-0.5 rounded border text-xs font-mono hover:opacity-70 transition-opacity select-none"
                          style={{ backgroundColor: "color-mix(in srgb, #6366f1 15%, transparent)", borderColor: "#6366f1", color: "#6366f1" }}>
                          {effectiveAlias(s)}
                          {s.attribute.unit && <span className="ml-1 font-sans opacity-70">({s.attribute.unit})</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Input group chips — emerald, only for From Input kind */}
                {isFromInput && Object.entries(inputGroupAttrMap).map(([groupId, { groupName, attrs }]) => (
                  <div key={groupId} className="rounded-lg p-2.5" style={{ backgroundColor: "color-mix(in srgb, #10b981 6%, transparent)", border: "1px solid color-mix(in srgb, #10b981 25%, transparent)" }}>
                    <p className="text-[11px] mb-1.5 font-semibold" style={{ color: "#10b981" }}>
                      {groupName} <span className="font-normal opacity-70">(input)</span>
                    </p>
                    {attrs.length === 0 ? (
                      <p className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>No attributes.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {attrs.map((a) => (
                          <button key={a.id}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => clickInputAttrChip(a, groupId, groupName)}
                            className="px-2 py-0.5 rounded border text-xs font-mono hover:opacity-70 transition-opacity select-none"
                            style={{ backgroundColor: "color-mix(in srgb, #10b981 15%, transparent)", borderColor: "#10b981", color: "#10b981" }}>
                            {effectiveAlias(a)}
                            {a.attribute.unit && <span className="ml-1 font-sans opacity-70">({a.attribute.unit})</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {/* Operators */}
                <div className="flex flex-wrap gap-1">
                  {FORMULA_OPS.map((op) => (
                    <button key={op} onMouseDown={(e) => e.preventDefault()} onClick={() => insertAtFormulaCursor(FORMULA_OP_MAP[op])}
                      style={{ borderColor: "var(--color-border)", color: "var(--color-text-secondary)", backgroundColor: "var(--color-bg-input)" }}
                      className="w-8 h-7 flex items-center justify-center border rounded text-sm font-mono hover:opacity-70 transition-opacity">
                      {op}
                    </button>
                  ))}
                  <button onMouseDown={(e) => e.preventDefault()} onClick={() => insertAtFormulaCursor(" ")}
                    style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)", backgroundColor: "var(--color-bg-input)" }}
                    className="px-2 h-7 border rounded text-[11px] hover:opacity-70 transition-opacity">
                    space
                  </button>
                </div>

                {/* Formula textarea */}
                <textarea
                  ref={formulaTextareaRef}
                  value={formula}
                  onChange={(e) => { setFormula(e.target.value); saveFormulaCursor(); }}
                  onSelect={saveFormulaCursor} onKeyUp={saveFormulaCursor} onClick={saveFormulaCursor} onBlur={saveFormulaCursor}
                  placeholder="Click chips above to build the formula"
                  rows={2}
                  style={{ backgroundColor: "var(--color-bg-input)", borderColor: "var(--color-border-input)", color: "var(--color-text-primary)" }}
                  className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none resize-none"
                />

                {/* Preview */}
                {formula.trim() && (
                  <div className="rounded-lg px-3 py-2 space-y-1.5"
                    style={{ backgroundColor: "var(--color-bg-nav-active)", border: "1px solid var(--color-border)" }}>
                    <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Preview</p>
                    <FormulaDisplay formula={formula} formulaVars={attrFVars as unknown as FormulaVars} outputGroupId={productGroupId} />
                    {Object.keys(attrFVars).length > 0 && (
                      <div className="mt-1 space-y-0.5">
                        {Object.entries(attrFVars).map(([token, fv]) => {
                          const isOwn = fv.groupId === productGroupId;
                          return (
                            <div key={token} className="flex items-center gap-1.5 text-[11px]">
                              <span className="font-mono px-1 rounded" style={{
                                backgroundColor: isOwn ? "color-mix(in srgb, #6366f1 14%, transparent)" : "color-mix(in srgb, #10b981 14%, transparent)",
                                color: isOwn ? "#6366f1" : "#10b981",
                              }}>{fv.alias}</span>
                              <span style={{ color: "var(--color-text-muted)" }}>← {fv.groupName} · {fv.attrName}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose}
            style={{ borderColor: "var(--color-border)", color: "var(--color-text-secondary)" }}
            className="flex-1 border rounded-lg py-2 text-sm hover:opacity-70 transition-opacity">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            style={{ backgroundColor: "var(--color-btn-bg)", color: "var(--color-btn-text)" }}
            className="flex-1 rounded-lg py-2 text-sm font-medium hover:opacity-80 transition-opacity disabled:opacity-40">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── formula display ─────────────────────────────────────────────────────────

// Convert a pgaId UUID to a safe formula token: pga_ + uuid with hyphens → underscores
function pgaToken(pgaId: string): string {
  return `pga_${pgaId.replace(/-/g, "_")}`;
}

// Match pga_ tokens (pga_ + 32 hex chars + 4 underscores = 36 chars total)
const PGA_TOKEN_RE = /\bpga_[0-9a-f]{8}_[0-9a-f]{4}_[0-9a-f]{4}_[0-9a-f]{4}_[0-9a-f]{12}\b/g;

function tokenizeFormula(
  formula: string,
): Array<{ type: "pga"; token: string } | { type: "other"; text: string }> {
  const parts: Array<{ type: "pga"; token: string } | { type: "other"; text: string }> = [];
  let last = 0;
  PGA_TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = PGA_TOKEN_RE.exec(formula)) !== null) {
    if (m.index > last) parts.push({ type: "other", text: formula.slice(last, m.index) });
    parts.push({ type: "pga", token: m[0] });
    last = m.index + m[0].length;
  }
  if (last < formula.length) parts.push({ type: "other", text: formula.slice(last) });
  return parts;
}

function FormulaDisplay({
  formula,
  formulaVars,
  outputGroupId,
}: {
  formula:       string;
  formulaVars:   FormulaVars | null;
  outputGroupId: string;
}) {
  const tokens = tokenizeFormula(formula);
  return (
    <span className="text-xs font-mono break-all">
      {tokens.map((t, i) => {
        if (t.type === "pga") {
          const fv       = formulaVars?.[t.token];
          const label    = fv ? fv.alias : t.token;
          const isOutput = fv ? fv.groupId === outputGroupId : false;
          return (
            <span
              key={i}
              title={fv ? `${fv.attrName} · from ${fv.groupName}` : t.token}
              className="rounded px-0.5 mx-px"
              style={{
                backgroundColor: fv
                  ? isOutput
                    ? "color-mix(in srgb, #6366f1 14%, transparent)"
                    : "color-mix(in srgb, #10b981 14%, transparent)"
                  : "color-mix(in srgb, #ef4444 14%, transparent)",
                color: fv ? (isOutput ? "#6366f1" : "#10b981") : "#ef4444",
              }}
            >
              {label}
            </span>
          );
        }
        return (
          <span key={i} style={{ color: "var(--color-text-secondary)" }}>{t.text}</span>
        );
      })}
    </span>
  );
}

// ─── BOM input modal ──────────────────────────────────────────────────────────

type BomMode =
  | { type: "add"; outputAttrs: GroupAttribute[]; outputGroupName: string }
  | { type: "edit"; item: GroupInput; outputAttrs: GroupAttribute[]; outputGroupName: string };

interface BomInputModalProps {
  mode:           BomMode;
  productGroupId: string;
  allGroups:      ProductGroup[];
  onSaved:        (gi: GroupInput) => void;
  onClose:        () => void;
}

function BomInputModal({ mode, productGroupId, allGroups, onSaved, onClose }: BomInputModalProps) {
  const isEdit = mode.type === "edit";
  const item   = isEdit ? mode.item : null;

  const outputAttrs      = mode.outputAttrs;
  const outputGroupName  = mode.outputGroupName;

  const [inputGroupId,    setInputGroupId]   = useState(item?.inputGroupId ?? "");
  const [qtyFormula,      setQtyFormula]     = useState(item?.qtyFormula ?? "");
  const [formulaVars,     setFormulaVars]    = useState<FormulaVars>(item?.formulaVars ?? {});
  const [yieldFactor,     setYieldFactor]    = useState(String(item?.yieldFactor ?? "1"));
  const [label,           setLabel]          = useState(item?.label ?? "");
  const [notes,           setNotes]          = useState(item?.notes ?? "");
  const [saving,          setSaving]         = useState(false);
  const [error,           setError]          = useState<string | null>(null);
  const [inputGroupAttrs, setInputGroupAttrs] = useState<GroupAttribute[]>([]);
  const [loadingAttrs,    setLoadingAttrs]   = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cursorRef   = useRef({ start: (item?.qtyFormula ?? "").length, end: (item?.qtyFormula ?? "").length });

  const chosenGroup = allGroups.find((g) => g.id === inputGroupId);

  useEffect(() => {
    if (!inputGroupId) { setInputGroupAttrs([]); return; }
    let cancelled = false;
    setLoadingAttrs(true);
    getGroupAttributes(inputGroupId)
      .then((attrs) => { if (!cancelled) { setInputGroupAttrs(attrs); setLoadingAttrs(false); } })
      .catch(() => { if (!cancelled) setLoadingAttrs(false); });
    return () => { cancelled = true; };
  }, [inputGroupId]);

  function saveCursor() {
    const el = textareaRef.current;
    if (el) cursorRef.current = { start: el.selectionStart, end: el.selectionEnd };
  }

  function insertAtCursor(text: string) {
    const { start, end } = cursorRef.current;
    const next = qtyFormula.slice(0, start) + text + qtyFormula.slice(end);
    setQtyFormula(next);
    const pos = start + text.length;
    cursorRef.current = { start: pos, end: pos };
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) { el.focus(); el.setSelectionRange(pos, pos); }
    });
  }

  function clickOutputChip(ga: GroupAttribute) {
    const token = pgaToken(ga.id);
    insertAtCursor(token);
    setFormulaVars((prev) => ({
      ...prev,
      [token]: {
        pgaId:     ga.id,
        groupId:   productGroupId,
        groupName: outputGroupName,
        attrName:  ga.attribute.name,
        alias:     effectiveAlias(ga),
      },
    }));
  }

  function clickInputChip(ga: GroupAttribute) {
    if (!chosenGroup) return;
    const token = pgaToken(ga.id);
    insertAtCursor(token);
    setFormulaVars((prev) => ({
      ...prev,
      [token]: {
        pgaId:     ga.id,
        groupId:   chosenGroup.id,
        groupName: chosenGroup.name,
        attrName:  ga.attribute.name,
        alias:     effectiveAlias(ga),
      },
    }));
  }

  const OPERATORS = ["+", "−", "×", "÷", "(", ")", "^"] as const;
  const OP_MAP: Record<string, string> = {
    "+": "+", "−": "-", "×": "*", "÷": "/", "(": "(", ")": ")", "^": "**",
  };

  async function handleSave() {
    if (!inputGroupId) { setError("Select an input product group."); return; }
    if (!qtyFormula.trim()) { setError("Formula is required."); return; }
    const yf = parseFloat(yieldFactor);
    if (isNaN(yf) || yf <= 0 || yf > 1) { setError("Yield factor must be between 0 and 1."); return; }
    setSaving(true); setError(null);
    const fv = Object.keys(formulaVars).length > 0 ? formulaVars : null;
    try {
      if (isEdit) {
        const updated = await updateGroupInput(productGroupId, item!.id, {
          qtyFormula:  qtyFormula.trim(),
          formulaVars: fv,
          yieldFactor: yf,
          label:       label.trim() || null,
          notes:       notes.trim() || null,
        });
        onSaved(updated);
      } else {
        const created = await addGroupInput(productGroupId, {
          inputGroupId,
          qtyFormula:  qtyFormula.trim(),
          formulaVars: fv ?? undefined,
          yieldFactor: yf,
          label:       label.trim() || undefined,
          notes:       notes.trim() || undefined,
        });
        onSaved(created);
      }
      onClose();
    } catch (err) {
      const e = err as AxiosError<{ message?: string }>;
      setError(e.response?.data?.message ?? "Failed to save.");
      setSaving(false);
    }
  }

  return (
    <Modal
      title={isEdit ? `Edit Input — ${item!.inputGroup.name}` : "Add Input Material"}
      onClose={onClose}
      width="max-w-xl"
    >
      <div className="space-y-4">
        {error && (
          <p className="text-red-500 text-xs bg-red-500/10 border border-red-500/20 rounded px-3 py-2">{error}</p>
        )}

        {/* Input group selector */}
        {isEdit ? (
          <div style={{ backgroundColor: "var(--color-bg-input)", borderColor: "var(--color-border)" }}
            className="border rounded-lg px-3 py-2 flex items-center gap-2">
            <GitMerge size={13} style={{ color: "var(--color-text-muted)" }} />
            <span style={{ color: "var(--color-text-primary)" }} className="text-sm font-medium">
              {item!.inputGroup.name}
            </span>
            <span style={{ color: "var(--color-text-muted)" }} className="text-xs ml-1">
              ({PRODUCT_GROUP_TYPE_LABELS[item!.inputGroup.type]})
            </span>
          </div>
        ) : (
          <div>
            <label style={{ color: "var(--color-text-muted)" }} className="block text-xs mb-1">
              Input Product Group *
            </label>
            <select
              value={inputGroupId}
              onChange={(e) => setInputGroupId(e.target.value)}
              style={{ backgroundColor: "var(--color-bg-input)", borderColor: "var(--color-border-input)", color: "var(--color-text-primary)" }}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none"
            >
              <option value="">Select a product group…</option>
              {allGroups
                .filter((g) => g.id !== productGroupId)
                .map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
            </select>
          </div>
        )}

        {/* Label + yield factor */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label style={{ color: "var(--color-text-muted)" }} className="block text-xs mb-1">
              Label <span className="opacity-60">(if multiple inputs from same group)</span>
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. 4sq mm wire"
              style={{ backgroundColor: "var(--color-bg-input)", borderColor: "var(--color-border-input)", color: "var(--color-text-primary)" }}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none"
            />
          </div>
          <div>
            <label style={{ color: "var(--color-text-muted)" }} className="block text-xs mb-1">
              Yield Factor <span className="opacity-60">(0–1, losses)</span>
            </label>
            <input
              type="number"
              value={yieldFactor}
              onChange={(e) => setYieldFactor(e.target.value)}
              min={0.01} max={1} step={0.01}
              placeholder="0.97"
              style={{ backgroundColor: "var(--color-bg-input)", borderColor: "var(--color-border-input)", color: "var(--color-text-primary)" }}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none"
            />
          </div>
        </div>

        {/* Formula builder */}
        <div>
          <label style={{ color: "var(--color-text-muted)" }} className="block text-xs mb-2">
            Quantity Formula *
            <span className="ml-1 opacity-60">— result = qty of input needed (in input group's stock unit)</span>
          </label>

          {/* Output group chips — indigo */}
          {outputAttrs.length > 0 && (
            <div className="mb-3 rounded-lg p-2.5" style={{ backgroundColor: "color-mix(in srgb, #6366f1 6%, transparent)", border: "1px solid color-mix(in srgb, #6366f1 25%, transparent)" }}>
              <p className="text-[11px] mb-1.5 font-semibold" style={{ color: "#6366f1" }}>
                {outputGroupName} <span className="font-normal opacity-70">(output)</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {outputAttrs.map((a) => {
                  const alias = effectiveAlias(a);
                  return (
                    <button
                      key={a.id}
                      draggable
                      onDragStart={(e) => { e.dataTransfer.setData("text/plain", alias); e.dataTransfer.effectAllowed = "copy"; }}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => clickOutputChip(a)}
                      title={`${a.attribute.name}${a.attribute.unit ? ` (${a.attribute.unit})` : ""}\nSource: ${outputGroupName}`}
                      className="px-2 py-0.5 rounded text-xs font-mono hover:opacity-70 transition-opacity select-none border"
                      style={{ backgroundColor: "color-mix(in srgb, #6366f1 15%, transparent)", borderColor: "#6366f1", color: "#6366f1" }}
                    >
                      {alias}
                      {a.attribute.unit && <span className="ml-1 font-sans" style={{ opacity: 0.7 }}>({a.attribute.unit})</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Input group chips — emerald */}
          {inputGroupId && (
            <div className="mb-3 rounded-lg p-2.5" style={{ backgroundColor: "color-mix(in srgb, #10b981 6%, transparent)", border: "1px solid color-mix(in srgb, #10b981 25%, transparent)" }}>
              {loadingAttrs ? (
                <p className="text-[11px]" style={{ color: "#10b981" }}>Loading…</p>
              ) : (
                <>
                  <p className="text-[11px] mb-1.5 font-semibold" style={{ color: "#10b981" }}>
                    {chosenGroup?.name ?? "Input group"} <span className="font-normal opacity-70">(input)</span>
                  </p>
                  {inputGroupAttrs.length === 0 ? (
                    <p className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                      No attributes defined for this group.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {inputGroupAttrs.map((a) => {
                        const alias = effectiveAlias(a);
                        return (
                          <button
                            key={a.id}
                            draggable
                            onDragStart={(e) => { e.dataTransfer.setData("text/plain", alias); e.dataTransfer.effectAllowed = "copy"; }}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => clickInputChip(a)}
                            title={`${a.attribute.name}${a.attribute.unit ? ` (${a.attribute.unit})` : ""}\nSource: ${chosenGroup?.name}`}
                            className="px-2 py-0.5 rounded text-xs font-mono hover:opacity-70 transition-opacity select-none border"
                            style={{ backgroundColor: "color-mix(in srgb, #10b981 15%, transparent)", borderColor: "#10b981", color: "#10b981" }}
                          >
                            {alias}
                            {a.attribute.unit && <span className="ml-1 font-sans" style={{ opacity: 0.7 }}>({a.attribute.unit})</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Operator buttons */}
          <div className="flex flex-wrap gap-1 mb-2">
            {OPERATORS.map((op) => (
              <button
                key={op}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insertAtCursor(OP_MAP[op])}
                style={{ borderColor: "var(--color-border)", color: "var(--color-text-secondary)", backgroundColor: "var(--color-bg-input)" }}
                className="w-8 h-7 flex items-center justify-center border rounded text-sm font-mono hover:opacity-70 transition-opacity"
              >
                {op}
              </button>
            ))}
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insertAtCursor(" ")}
              style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)", backgroundColor: "var(--color-bg-input)" }}
              className="px-2 h-7 border rounded text-[11px] hover:opacity-70 transition-opacity"
            >
              space
            </button>
          </div>

          <textarea
            ref={textareaRef}
            value={qtyFormula}
            onChange={(e) => { setQtyFormula(e.target.value); saveCursor(); }}
            onSelect={saveCursor} onKeyUp={saveCursor} onClick={saveCursor} onBlur={saveCursor}
            placeholder="Click chips above to build the formula"
            rows={3}
            style={{ backgroundColor: "var(--color-bg-input)", borderColor: "var(--color-border-input)", color: "var(--color-text-primary)" }}
            className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none resize-none"
          />

          {/* Human-readable preview + variable source table */}
          {qtyFormula.trim() && (
            <div className="mt-2 rounded-lg px-3 py-2 space-y-2"
              style={{ backgroundColor: "var(--color-bg-nav-active)", border: "1px solid var(--color-border)" }}>
              <div>
                <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Preview</span>
                <div className="mt-0.5">
                  <FormulaDisplay formula={qtyFormula} formulaVars={formulaVars} outputGroupId={productGroupId} />
                </div>
              </div>
              {Object.keys(formulaVars).length > 0 && (
                <div>
                  <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Variable sources</span>
                  <div className="mt-1 space-y-0.5">
                    {Object.entries(formulaVars).map(([token, fv]) => {
                      const isOutput = fv.groupId === productGroupId;
                      return (
                        <div key={token} className="flex items-center gap-1.5 text-[11px]">
                          <span className="font-mono px-1 rounded" style={{
                            backgroundColor: isOutput ? "color-mix(in srgb, #6366f1 14%, transparent)" : "color-mix(in srgb, #10b981 14%, transparent)",
                            color: isOutput ? "#6366f1" : "#10b981",
                          }}>{fv.alias}</span>
                          <span style={{ color: "var(--color-text-muted)" }}>←</span>
                          <span style={{ color: "var(--color-text-muted)" }}>{fv.groupName} · {fv.attrName}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <label style={{ color: "var(--color-text-muted)" }} className="block text-xs mb-1">Notes</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Drawing process, 3% loss"
            style={{ backgroundColor: "var(--color-bg-input)", borderColor: "var(--color-border-input)", color: "var(--color-text-primary)" }}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none"
          />
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose}
            style={{ borderColor: "var(--color-border)", color: "var(--color-text-secondary)" }}
            className="flex-1 border rounded-lg py-2 text-sm hover:opacity-70 transition-opacity">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            style={{ backgroundColor: "var(--color-btn-bg)", color: "var(--color-btn-text)" }}
            className="flex-1 rounded-lg py-2 text-sm font-medium hover:opacity-80 transition-opacity disabled:opacity-40">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function ProductGroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [group, setGroup]       = useState<ProductGroup | null>(null);
  const [attrs, setAttrs]       = useState<GroupAttribute[]>([]);
  const [inputs, setInputs]     = useState<GroupInput[]>([]);
  const [allGroups, setAllGroups] = useState<ProductGroup[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [modal, setModal]       = useState<ModalMode | null>(null);
  const [bomModal, setBomModal] = useState<BomMode | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [g, allGrps, inp] = await Promise.all([
          getProductGroup(id),
          getProductGroups(),
          getGroupInputs(id),
        ]);
        if (!cancelled) {
          setGroup(g);
          setAttrs(g.attributes ?? []);
          setAllGroups(allGrps);
          setInputs(inp);
        }
      } catch {
        if (!cancelled) setError("Failed to load product group.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [id]);

  function handleAttrSaved(ga: GroupAttribute) {
    setAttrs((prev) => {
      const idx = prev.findIndex((e) => e.id === ga.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = ga;
        return next;
      }
      return [...prev, ga];
    });
    // If this became the quantity basis, clear it on others
    if (ga.isQuantityBasis) {
      setAttrs((prev) =>
        prev.map((e) => e.id === ga.id ? ga : { ...e, isQuantityBasis: false })
      );
    }
  }

  async function handleRemoveAttr(pgaId: string) {
    if (!confirm("Remove this attribute from the group?")) return;
    try {
      await removeGroupAttribute(id, pgaId);
      setAttrs((prev) => prev.filter((a) => a.id !== pgaId));
    } catch {
      setError("Failed to remove attribute.");
    }
  }

  function handleBomSaved(gi: GroupInput) {
    setInputs((prev) => {
      const idx = prev.findIndex((e) => e.id === gi.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = gi; return next; }
      return [...prev, gi];
    });
  }

  async function handleRemoveBomInput(inputId: string) {
    if (!confirm("Remove this input material from the BOM?")) return;
    try {
      await removeGroupInput(id, inputId);
      setInputs((prev) => prev.filter((i) => i.id !== inputId));
    } catch {
      setError("Failed to remove BOM input.");
    }
  }

  async function handleMove(pgaId: string, direction: "up" | "down") {
    const idx = attrs.findIndex((a) => a.id === pgaId);
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === attrs.length - 1) return;

    const next = [...attrs];
    const swap = direction === "up" ? idx - 1 : idx + 1;
    [next[idx], next[swap]] = [next[swap], next[idx]];

    setAttrs(next);
    try {
      const reordered = await reorderGroupAttributes(id, next.map((a) => a.id));
      setAttrs(reordered);
    } catch {
      setError("Failed to reorder attributes.");
    }
  }

  if (loading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="h-4 rounded w-20" style={{ backgroundColor: "var(--color-border)" }} />
        <div className="h-40 rounded-lg" style={{ backgroundColor: "var(--color-border)" }} />
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="space-y-4">
        <button onClick={() => router.back()} style={{ color: "var(--color-text-secondary)" }}
          className="flex items-center gap-1.5 text-sm hover:opacity-70 transition-opacity">
          <ArrowLeft size={15} /> Back
        </button>
        <p className="text-red-500 text-sm">{error ?? "Product group not found."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={() => router.back()} style={{ color: "var(--color-text-secondary)" }}
          className="flex items-center gap-1.5 text-sm hover:opacity-70 transition-opacity">
          <ArrowLeft size={15} /> Back
        </button>
        <Link href={`/inventory/product-groups/${id}/edit`}
          style={{ backgroundColor: "var(--color-btn-bg)", color: "var(--color-btn-text)" }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium hover:opacity-80 transition-opacity">
          <Edit size={14} /> Edit
        </Link>
      </div>

      {error && (
        <p className="text-red-500 text-sm bg-red-500/10 border border-red-500/20 rounded px-4 py-2">{error}</p>
      )}

      {/* Group info card */}
      <div style={{ backgroundColor: "var(--color-bg-popup)", borderColor: "var(--color-border)" }}
        className="border rounded-lg overflow-hidden">
        <div style={{ backgroundColor: "var(--color-btn-bg)", color: "var(--color-btn-text)" }}
          className="flex items-center gap-3 px-5 py-4">
          <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
            <Tag size={16} />
          </div>
          <div>
            <h1 className="text-base font-semibold">{group.name}</h1>
            <p className="text-xs opacity-70 mt-0.5">Product Group</p>
          </div>
        </div>
        <div className="px-5 py-1">
          <Field label="Type">
            <span className={`text-[11px] font-medium border rounded-full px-2 py-0.5 ${TYPE_COLORS[group.type]}`}>
              {PRODUCT_GROUP_TYPE_LABELS[group.type]}
            </span>
          </Field>
          <Field label="Material">
            <span className={`text-[11px] font-medium rounded-full px-2 py-0.5 ${MATERIAL_COLORS[group.materialType]}`}>
              {MATERIAL_TYPE_LABELS[group.materialType]}
            </span>
          </Field>
          <Field label="Procured Externally">
            <span className={`text-sm font-medium ${group.isProcured ? "text-green-600" : ""}`}
              style={group.isProcured ? undefined : { color: "var(--color-text-muted)" }}>
              {group.isProcured ? "Yes" : "No"}
            </span>
          </Field>
          <Field label="Created">
            <span className="flex items-center gap-1.5">
              <Calendar size={13} style={{ color: "var(--color-text-muted)" }} />
              {formatDate(group.createdAt)}
            </span>
          </Field>
          <Field label="Last Updated">
            <span className="flex items-center gap-1.5">
              <Calendar size={13} style={{ color: "var(--color-text-muted)" }} />
              {formatDate(group.updatedAt)}
            </span>
          </Field>
        </div>
      </div>

      {/* Attributes section */}
      <div style={{ backgroundColor: "var(--color-bg-popup)", borderColor: "var(--color-border)" }}
        className="border rounded-lg overflow-hidden">
        {/* Section header */}
        <div className="flex items-center justify-between px-5 py-3"
          style={{ borderBottom: "1px solid var(--color-border)" }}>
          <div className="flex items-center gap-2">
            <FlaskConical size={14} style={{ color: "var(--color-text-muted)" }} />
            <p style={{ color: "var(--color-text-primary)" }} className="text-sm font-semibold">Attributes</p>
            <span style={{ color: "var(--color-text-muted)" }} className="text-xs">({attrs.length})</span>
          </div>
          <button onClick={() => setModal({ type: "add" })}
            style={{ backgroundColor: "var(--color-btn-bg)", color: "var(--color-btn-text)" }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-80 transition-opacity">
            <Plus size={12} /> Add Attribute
          </button>
        </div>

        {attrs.length === 0 ? (
          <div style={{ color: "var(--color-text-muted)" }} className="text-sm text-center py-10">
            No attributes yet.{" "}
            <button onClick={() => setModal({ type: "add" })} className="underline hover:opacity-70">
              Add one.
            </button>
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="grid grid-cols-[2rem_1fr_6rem_7rem_1rem_auto] items-center px-4 py-2 text-[11px] font-medium uppercase tracking-wider"
              style={{ color: "var(--color-text-muted)", borderBottom: "1px solid var(--color-border)" }}>
              <span>#</span>
              <span>Attribute</span>
              <span>Alias</span>
              <span>Kind</span>
              <span />
              <span />
            </div>

            {attrs.map((ga, idx) => {
              const alias = effectiveAlias(ga);
              return (
                <div key={ga.id}
                  style={{ borderTop: idx > 0 ? "1px solid var(--color-border)" : undefined }}
                  className="grid grid-cols-[2rem_1fr_6rem_7rem_1rem_auto] items-start px-4 py-3 gap-x-3">
                  {/* Order */}
                  <span style={{ color: "var(--color-text-muted)" }} className="text-xs pt-0.5">{idx + 1}</span>

                  {/* Attribute name + formula preview */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span style={{ color: "var(--color-text-primary)" }} className="text-sm font-medium">
                        {ga.attribute.name}
                      </span>
                      {ga.attribute.unit && (
                        <span style={{ color: "var(--color-text-muted)" }} className="text-xs">
                          ({ga.attribute.unit})
                        </span>
                      )}
                    </div>
                    {(ga.isCalculated || ga.isFromInput) && ga.formula && (
                      <div className="mt-1 flex items-start gap-1">
                        <span style={{ color: "var(--color-text-muted)" }} className="text-xs mt-0.5 shrink-0">=</span>
                        <FormulaDisplay
                          formula={ga.formula}
                          formulaVars={ga.formulaVars as unknown as FormulaVars}
                          outputGroupId={ga.productGroupId}
                        />
                      </div>
                    )}
                  </div>

                  {/* Alias */}
                  <span style={{ color: "var(--color-text-secondary)" }} className="text-xs font-mono pt-0.5 break-all">
                    {alias}
                  </span>

                  {/* Kind badge */}
                  <div className="pt-0.5">
                    {ga.isFromInput ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: "color-mix(in srgb, #10b981 12%, transparent)", color: "#10b981" }}>
                        <GitMerge size={10} /> From Input
                      </span>
                    ) : ga.isCalculated ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: "color-mix(in srgb, #a855f7 12%, transparent)", color: "#a855f7" }}>
                        <FlaskConical size={10} /> Calculated
                      </span>
                    ) : ga.isQuantityBasis ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: "color-mix(in srgb, #f59e0b 12%, transparent)", color: "#f59e0b" }}>
                        <Star size={10} fill="currentColor" /> Qty Basis
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: "var(--color-bg-nav-active)", color: "var(--color-text-secondary)" }}>
                        Simple
                      </span>
                    )}
                  </div>

                  {/* Quantity Basis column (keep for layout, now empty — badge moved above) */}
                  <div />

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 justify-end">
                    <button onClick={() => handleMove(ga.id, "up")} disabled={idx === 0}
                      style={{ color: "var(--color-text-muted)" }}
                      className="p-1 rounded hover:opacity-70 disabled:opacity-20 transition-opacity">
                      <ChevronUp size={13} />
                    </button>
                    <button onClick={() => handleMove(ga.id, "down")} disabled={idx === attrs.length - 1}
                      style={{ color: "var(--color-text-muted)" }}
                      className="p-1 rounded hover:opacity-70 disabled:opacity-20 transition-opacity">
                      <ChevronDown size={13} />
                    </button>
                    <button onClick={() => setModal({ type: "edit", ga })}
                      style={{ color: "var(--color-text-muted)" }}
                      className="p-1.5 rounded hover:opacity-70 transition-opacity">
                      <Pencil size={12} />
                    </button>
                    <button onClick={() => handleRemoveAttr(ga.id)}
                      className="p-1.5 rounded text-red-400 hover:opacity-70 transition-opacity">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* BOM Inputs section */}
      <div style={{ backgroundColor: "var(--color-bg-popup)", borderColor: "var(--color-border)" }}
        className="border rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3"
          style={{ borderBottom: "1px solid var(--color-border)" }}>
          <div className="flex items-center gap-2">
            <GitMerge size={14} style={{ color: "var(--color-text-muted)" }} />
            <p style={{ color: "var(--color-text-primary)" }} className="text-sm font-semibold">Input Materials</p>
            <span style={{ color: "var(--color-text-muted)" }} className="text-xs">({inputs.length})</span>
            <span style={{ color: "var(--color-text-muted)" }} className="text-[11px]">— consumed to produce this group</span>
          </div>
          <button
            onClick={() => setBomModal({ type: "add", outputAttrs: attrs, outputGroupName: group.name })}
            style={{ backgroundColor: "var(--color-btn-bg)", color: "var(--color-btn-text)" }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-80 transition-opacity"
          >
            <Plus size={12} /> Add Input
          </button>
        </div>

        {inputs.length === 0 ? (
          <div style={{ color: "var(--color-text-muted)" }} className="text-sm text-center py-8">
            {group.isProcured
              ? "This group is procured externally — no inputs needed."
              : <>No input materials yet.{" "}
                  <button onClick={() => setBomModal({ type: "add", outputAttrs: attrs, outputGroupName: group.name })} className="underline hover:opacity-70">Add one.</button>
                </>
            }
          </div>
        ) : (
          <>
            <div className="grid grid-cols-[1fr_auto_6rem_auto] items-center px-4 py-2 text-[11px] font-medium uppercase tracking-wider"
              style={{ color: "var(--color-text-muted)", borderBottom: "1px solid var(--color-border)" }}>
              <span>Input Group</span>
              <span className="pr-8">Formula</span>
              <span>Yield</span>
              <span />
            </div>

            {inputs.map((gi, idx) => (
              <div key={gi.id}
                style={{ borderTop: idx > 0 ? "1px solid var(--color-border)" : undefined }}
                className="grid grid-cols-[1fr_auto_6rem_auto] items-start px-4 py-3 gap-x-4">

                {/* Input group + label */}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span style={{ color: "var(--color-text-primary)" }} className="text-sm font-medium">
                      {gi.inputGroup.name}
                    </span>
                    {gi.label && (
                      <span style={{ backgroundColor: "var(--color-bg-nav-active)", color: "var(--color-text-secondary)" }}
                        className="text-[11px] px-1.5 py-0.5 rounded font-medium">
                        {gi.label}
                      </span>
                    )}
                    <span style={{ color: "var(--color-text-muted)" }} className="text-[11px]">
                      ({PRODUCT_GROUP_TYPE_LABELS[gi.inputGroup.type]})
                    </span>
                  </div>
                  {gi.notes && (
                    <p style={{ color: "var(--color-text-muted)" }} className="text-xs mt-0.5">{gi.notes}</p>
                  )}
                </div>

                {/* Formula */}
                <div className="min-w-0 max-w-xs px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: "var(--color-bg-input)" }}>
                  <FormulaDisplay
                    formula={gi.qtyFormula}
                    formulaVars={gi.formulaVars}
                    outputGroupId={id}
                  />
                </div>

                {/* Yield */}
                <div>
                  <span style={{ color: parseFloat(gi.yieldFactor) < 1 ? undefined : "var(--color-text-muted)" }}
                    className={`text-xs font-medium ${parseFloat(gi.yieldFactor) < 1 ? "text-amber-600" : ""}`}>
                    {parseFloat(gi.yieldFactor) === 1
                      ? "100%"
                      : `${(parseFloat(gi.yieldFactor) * 100).toFixed(1)}%`
                    }
                  </span>
                  {parseFloat(gi.yieldFactor) < 1 && (
                    <p style={{ color: "var(--color-text-muted)" }} className="text-[10px]">
                      {((1 - parseFloat(gi.yieldFactor)) * 100).toFixed(1)}% loss
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => setBomModal({ type: "edit", item: gi, outputAttrs: attrs, outputGroupName: group.name })}
                    style={{ color: "var(--color-text-muted)" }}
                    className="p-1.5 rounded hover:opacity-70 transition-opacity">
                    <Pencil size={12} />
                  </button>
                  <button
                    onClick={() => handleRemoveBomInput(gi.id)}
                    className="p-1.5 rounded text-red-400 hover:opacity-70 transition-opacity">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {modal && (
        <AttributeModal
          mode={modal}
          productGroupId={id}
          existingAttrs={attrs}
          bomInputs={inputs}
          onSaved={handleAttrSaved}
          onClose={() => setModal(null)}
        />
      )}

      {bomModal && (
        <BomInputModal
          mode={bomModal}
          productGroupId={id}
          allGroups={allGroups}
          onSaved={handleBomSaved}
          onClose={() => setBomModal(null)}
        />
      )}
    </div>
  );
}
