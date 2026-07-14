"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Edit, Tag, Calendar, Plus, Pencil, Trash2,
  FlaskConical, Star, ChevronUp, ChevronDown,
} from "lucide-react";
import Modal from "@/components/ui/Modal";
import { getProductGroup } from "@/api/productGroups";
import {
  createAttribute,
  addGroupAttribute, updateGroupAttribute, removeGroupAttribute, reorderGroupAttributes,
} from "@/api/attributes";
import type { ProductGroup, ProductGroupType, MaterialType } from "@/types/productGroup";
import type { GroupAttribute, AddGroupAttributePayload, UpdateGroupAttributePayload } from "@/types/attribute";
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

// ─── formula builder ──────────────────────────────────────────────────────────

const OPERATORS = ['+', '−', '×', '÷', '(', ')', '^'] as const;
const OP_INSERT: Record<string, string> = {
  '+': '+', '−': '-', '×': '*', '÷': '/', '(': '(', ')': ')', '^': '**',
};

interface SiblingVar {
  alias: string;
  name:  string;
  unit:  string | null;
}

function FormulaBuilder({
  value,
  onChange,
  siblings,
}: {
  value:    string;
  onChange: (v: string) => void;
  siblings: SiblingVar[];
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cursorRef   = useRef({ start: value.length, end: value.length });
  const [dragOver, setDragOver] = useState(false);

  function saveCursor() {
    const el = textareaRef.current;
    if (el) cursorRef.current = { start: el.selectionStart, end: el.selectionEnd };
  }

  function insertAt(text: string) {
    const { start, end } = cursorRef.current;
    const next = value.slice(0, start) + text + value.slice(end);
    onChange(next);
    const pos = start + text.length;
    cursorRef.current = { start: pos, end: pos };
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) { el.focus(); el.setSelectionRange(pos, pos); }
    });
  }

  return (
    <div className="space-y-2">
      {/* Attribute variable chips */}
      {siblings.length > 0 ? (
        <div>
          <p style={{ color: "var(--color-text-muted)" }} className="text-[11px] mb-1.5">
            Attributes — click or drag into formula
          </p>
          <div className="flex flex-wrap gap-1.5">
            {siblings.map((s) => (
              <button
                key={s.alias}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", s.alias);
                  e.dataTransfer.effectAllowed = "copy";
                }}
                onMouseDown={(e) => e.preventDefault()} // keep textarea focus
                onClick={() => insertAt(s.alias)}
                title={`${s.name}${s.unit ? ` (${s.unit})` : ""}`}
                style={{
                  backgroundColor: "var(--color-bg-nav-active)",
                  borderColor:     "var(--color-border)",
                  color:           "var(--color-text-primary)",
                  cursor:          "grab",
                }}
                className="px-2 py-0.5 border rounded text-xs font-mono hover:opacity-70 transition-opacity select-none">
                {s.alias}
                {s.unit && (
                  <span style={{ color: "var(--color-text-muted)" }} className="ml-1 font-sans">
                    ({s.unit})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p style={{ color: "var(--color-text-muted)" }} className="text-[11px]">
          Add other (non-calculated) attributes to this group first to use them in formulas.
        </p>
      )}

      {/* Operator buttons */}
      <div className="flex flex-wrap gap-1">
        {OPERATORS.map((op) => (
          <button
            key={op}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => insertAt(OP_INSERT[op])}
            style={{
              borderColor:     "var(--color-border)",
              color:           "var(--color-text-secondary)",
              backgroundColor: "var(--color-bg-input)",
            }}
            className="w-8 h-7 flex items-center justify-center border rounded text-sm font-mono hover:opacity-70 transition-opacity">
            {op}
          </button>
        ))}
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => insertAt(" ")}
          style={{
            borderColor:     "var(--color-border)",
            color:           "var(--color-text-muted)",
            backgroundColor: "var(--color-bg-input)",
          }}
          className="px-2 h-7 border rounded text-[11px] hover:opacity-70 transition-opacity">
          space
        </button>
      </div>

      {/* Formula textarea — accepts native drag-and-drop of text/plain */}
      <div
        style={{
          borderColor:     dragOver ? "var(--color-btn-bg)" : "var(--color-border-input)",
          backgroundColor: "var(--color-bg-input)",
        }}
        className="border rounded-lg overflow-hidden transition-colors">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => { onChange(e.target.value); saveCursor(); }}
          onSelect={saveCursor}
          onKeyUp={saveCursor}
          onClick={saveCursor}
          onBlur={saveCursor}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={() => { setDragOver(false); }}
          placeholder="e.g. weight / (density * cross_section)"
          rows={3}
          style={{ color: "var(--color-text-primary)", backgroundColor: "transparent" }}
          className="w-full px-3 py-2 text-sm font-mono focus:outline-none resize-none"
        />
      </div>
    </div>
  );
}

// ─── attribute modal ──────────────────────────────────────────────────────────

type ModalMode = { type: "add" } | { type: "edit"; ga: GroupAttribute };

interface AttrModalProps {
  mode: ModalMode;
  productGroupId: string;
  existingAttrs: GroupAttribute[];
  onSaved: (ga: GroupAttribute) => void;
  onClose: () => void;
}

function AttributeModal({ mode, productGroupId, existingAttrs, onSaved, onClose }: AttrModalProps) {
  const isEdit = mode.type === "edit";
  const ga = isEdit ? mode.ga : null;

  // Attribute definition (for add; readonly when editing)
  const [name, setName]     = useState("");
  const [unit, setUnit]     = useState("");
  const [dataType, setDataType] = useState<"string" | "number">("number");

  // Three mutually exclusive kinds
  type AttrKind = "simple" | "qty_basis" | "calculated";
  function detectKind(g: GroupAttribute | null): AttrKind {
    if (!g) return "simple";
    if (g.isCalculated) return "calculated";
    if (g.isQuantityBasis) return "qty_basis";
    return "simple";
  }
  const [kind, setKind]                 = useState<AttrKind>(detectKind(ga));
  const [formulaAlias, setFormulaAlias] = useState(ga?.formulaAlias ?? "");
  const [formula, setFormula]           = useState(ga?.formula ?? "");
  const [sortOrder, setSortOrder]       = useState(ga?.sortOrder ?? existingAttrs.length);

  const isCalculated    = kind === "calculated";
  const isQuantityBasis = kind === "qty_basis";

  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  // siblings available as formula variables (exclude self when editing)
  const siblings = (isEdit
    ? existingAttrs.filter((e) => e.id !== ga!.id)
    : existingAttrs
  ).map((s) => ({
    alias: effectiveAlias(s),
    name:  s.attribute.name,
    unit:  s.attribute.unit,
  }));

  async function handleSave() {
    setSaving(true); setError(null);
    try {
      if (isEdit) {
        const updated = await updateGroupAttribute(productGroupId, ga!.id, {
          formulaAlias:    formulaAlias.trim() || null,
          isCalculated,
          formula:         isCalculated ? (formula.trim() || null) : null,
          isQuantityBasis,
          sortOrder,
        });
        onSaved(updated);
      } else {
        if (!name.trim()) { setError("Attribute name is required."); setSaving(false); return; }
        const created = await createAttribute({
          name:     name.trim(),
          unit:     unit.trim() || undefined,
          dataType,
        });
        const added = await addGroupAttribute(productGroupId, {
          attributeId:     created.id,
          formulaAlias:    formulaAlias.trim() || undefined,
          isCalculated,
          formula:         isCalculated ? (formula.trim() || undefined) : undefined,
          isQuantityBasis,
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
          /* Readonly header when editing */
          <div style={{ backgroundColor: "var(--color-bg-input)", borderColor: "var(--color-border)" }}
            className="border rounded-lg px-3 py-2 flex items-center gap-2">
            <Tag size={13} style={{ color: "var(--color-text-muted)" }} />
            <span style={{ color: "var(--color-text-primary)" }} className="text-sm font-medium">
              {ga!.attribute.name}
            </span>
            {ga!.attribute.unit && (
              <span style={{ color: "var(--color-text-muted)" }} className="text-xs">({ga!.attribute.unit})</span>
            )}
          </div>
        ) : (
          /* Define the attribute inline */
          <div className="space-y-3">
            <div>
              <label style={{ color: "var(--color-text-muted)" }} className="block text-xs mb-1">Name *</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Density of Rod" style={inputStyle} className={inputCls} autoFocus />
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

        {/* Formula alias (shared between add + edit) */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label style={{ color: "var(--color-text-muted)" }} className="block text-xs mb-1">
              Formula Alias
              <span className="ml-1 opacity-60">(short var name)</span>
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

          {/* Attribute kind — mutually exclusive */}
          <div>
            <label style={{ color: "var(--color-text-muted)" }} className="block text-xs mb-2">
              Attribute Kind
            </label>
            <div className="space-y-2">
              {([
                {
                  value: "simple" as const,
                  label: "Simple",
                  desc:  "A value you enter per product — material property (density, cross-section area, etc.)",
                },
                {
                  value: "qty_basis" as const,
                  label: "Quantity Basis",
                  desc:  "The ONE unit used to stock, procure, or consume products in this group (e.g. Weight in kg)",
                },
                {
                  value: "calculated" as const,
                  label: "Calculated",
                  desc:  "Derived automatically from a formula using other attributes (e.g. Length = Weight ÷ Density ÷ Area)",
                },
              ] as const).map(({ value, label, desc }) => (
                <label key={value}
                  onClick={() => setKind(value)}
                  style={{
                    borderColor:     kind === value ? "var(--color-btn-bg)" : "var(--color-border)",
                    backgroundColor: kind === value ? "color-mix(in srgb, var(--color-btn-bg) 8%, transparent)" : "var(--color-bg-page)",
                    cursor: "pointer",
                  }}
                  className="flex items-start gap-3 border rounded-lg px-3 py-2.5 transition-colors">
                  <input type="radio" name="attr-kind" value={value} checked={kind === value}
                    onChange={() => setKind(value)}
                    className="mt-0.5 cursor-pointer shrink-0" />
                  <div>
                    <span style={{ color: "var(--color-text-primary)" }} className="text-sm font-medium">{label}</span>
                    <p style={{ color: "var(--color-text-muted)" }} className="text-xs mt-0.5">{desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {isCalculated && (
            <div>
              <label style={{ color: "var(--color-text-muted)" }} className="block text-xs mb-1.5">
                Formula
              </label>
              <FormulaBuilder value={formula} onChange={setFormula} siblings={siblings} />
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

// ─── main page ────────────────────────────────────────────────────────────────

export default function ProductGroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [group, setGroup]   = useState<ProductGroup | null>(null);
  const [attrs, setAttrs]   = useState<GroupAttribute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);
  const [modal, setModal]   = useState<ModalMode | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const g = await getProductGroup(id);
        if (!cancelled) {
          setGroup(g);
          setAttrs(g.attributes ?? []);
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

                  {/* Attribute name + formula */}
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
                    {ga.isCalculated && ga.formula && (
                      <p style={{ color: "var(--color-text-muted)" }} className="text-xs font-mono mt-0.5 truncate">
                        = {ga.formula}
                      </p>
                    )}
                  </div>

                  {/* Alias */}
                  <span style={{ color: "var(--color-text-secondary)" }} className="text-xs font-mono pt-0.5">
                    {alias}
                  </span>

                  {/* Kind badge */}
                  <div className="pt-0.5">
                    {ga.isCalculated ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">
                        <FlaskConical size={10} /> Calculated
                      </span>
                    ) : ga.isQuantityBasis ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">
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

      {modal && (
        <AttributeModal
          mode={modal}
          productGroupId={id}
          existingAttrs={attrs}
          onSaved={handleAttrSaved}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
