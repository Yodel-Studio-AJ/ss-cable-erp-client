"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Plus, Search, LayoutList, LayoutGrid, Eye, Trash2, RefreshCw,
  ChevronDown, Tag,
} from "lucide-react";
import Modal from "@/components/ui/Modal";
import { useViewStore } from "@/store/viewStore";
import {
  getProductGroups,
  createProductGroup,
  deleteProductGroup,
} from "@/api/productGroups";
import type { ProductGroup, ProductGroupType, MaterialType, CreateProductGroupPayload } from "@/types/productGroup";
import {
  PRODUCT_GROUP_TYPE_LABELS,
  MATERIAL_TYPE_LABELS,
} from "@/types/productGroup";

const PAGE_KEY = "product-groups";

const TYPE_COLORS: Record<ProductGroupType, string> = {
  raw_material: "bg-amber-50 border-amber-300 text-amber-700",
  intermediate: "bg-blue-50 border-blue-300 text-blue-700",
  finished_goods: "bg-green-50 border-green-300 text-green-700",
  processed_product: "bg-purple-50 border-purple-300 text-purple-700",
};

const MATERIAL_COLORS: Record<MaterialType, string> = {
  metal: "bg-slate-100 text-slate-600",
  pvc: "bg-orange-100 text-orange-600",
  mixed: "bg-teal-100 text-teal-600",
};

function TypeBadge({ type }: { type: ProductGroupType }) {
  return (
    <span className={`text-[11px] font-medium border rounded-sm px-2 py-0.5 ${TYPE_COLORS[type]}`}>
      {PRODUCT_GROUP_TYPE_LABELS[type]}
    </span>
  );
}

function MaterialBadge({ material }: { material: MaterialType }) {
  return (
    <span className={`text-[11px] font-medium rounded-sm px-2 py-0.5 ${MATERIAL_COLORS[material]}`}>
      {MATERIAL_TYPE_LABELS[material]}
    </span>
  );
}

const inputCls = "w-full border rounded-lg px-3 py-2 text-sm focus:outline-none transition-colors";
const inputStyle: React.CSSProperties = {
  backgroundColor: "var(--color-bg-input)",
  borderColor: "var(--color-border-input)",
  color: "var(--color-text-primary)",
};

const EMPTY_FORM: CreateProductGroupPayload = {
  name: "",
  type: "raw_material",
  isProcured: false,
  materialType: "metal",
};

export default function ProductGroupsPage() {
  const [groups, setGroups] = useState<ProductGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<ProductGroupType | "">("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState<CreateProductGroupPayload>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [refreshKey, setRefreshKey] = useState(0);

  const viewMode = useViewStore((s) => s.getView(PAGE_KEY));
  const setView = useViewStore((s) => s.setView);

  const load = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    async function fetchGroups() {
      setLoading(true);
      setError(null);
      try {
        const data = await getProductGroups();
        if (!cancelled) setGroups(data);
      } catch {
        if (!cancelled) setError("Failed to load product groups.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchGroups();
    return () => { cancelled = true; };
  }, [refreshKey]);

  const filtered = useMemo(() => {
    let list = groups;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((g) => g.name.toLowerCase().includes(q));
    }
    if (typeFilter) list = list.filter((g) => g.type === typeFilter);
    return list;
  }, [groups, search, typeFilter]);

  const allOnPageSelected = filtered.length > 0 && filtered.every((g) => selectedIds.has(g.id));

  function toggleAllOnPage() {
    if (allOnPageSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filtered.forEach((g) => next.delete(g.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filtered.forEach((g) => next.add(g.id));
        return next;
      });
    }
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCreate() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const created = await createProductGroup(form);
      setGroups((p) => [created, ...p]);
      setShowCreateModal(false);
      setForm(EMPTY_FORM);
    } catch {
      setError("Failed to create product group.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this product group?")) return;
    try {
      await deleteProductGroup(id);
      setGroups((p) => p.filter((g) => g.id !== id));
      setSelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    } catch {
      setError("Failed to delete.");
    }
  }

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 style={{ color: "var(--color-text-primary)" }} className="text-xl font-bold">
            Product Groups
          </h1>
          <p style={{ color: "var(--color-text-muted)" }} className="text-sm mt-0.5">
            {filtered.length} {filtered.length === 1 ? "group" : "groups"}
            {selectedIds.size > 0 && (
              <span className="ml-2 text-xs" style={{ color: "var(--color-text-secondary)" }}>
                · {selectedIds.size} selected
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            style={{ borderColor: "var(--color-border)", color: "var(--color-text-secondary)" }}
            className="flex items-center gap-1.5 border rounded-lg px-3 py-2 text-sm hover:opacity-70 transition-opacity">
            <RefreshCw size={14} />
            Refresh
          </button>
          <button
            onClick={() => { setForm(EMPTY_FORM); setShowCreateModal(true); }}
            style={{ backgroundColor: "var(--color-btn-bg)", color: "var(--color-btn-text)" }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium hover:opacity-80 transition-opacity">
            <Plus size={15} />
            New Product Group
          </button>
        </div>
      </div>

      {error && (
        <p className="text-red-500 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">
          {error}
        </p>
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--color-text-muted)" }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search product groups…"
            style={inputStyle}
            className="w-full border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none transition-colors"
          />
        </div>

        <div className="relative">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as ProductGroupType | "")}
            style={inputStyle}
            className="border rounded-lg pl-3 pr-8 py-2 text-sm focus:outline-none appearance-none cursor-pointer">
            <option value="">All types</option>
            {(Object.entries(PRODUCT_GROUP_TYPE_LABELS) as [ProductGroupType, string][]).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--color-text-muted)" }} />
        </div>

        <div
          style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-bg-input)" }}
          className="ml-auto flex items-center border rounded-lg overflow-hidden">
          <button
            onClick={() => setView(PAGE_KEY, "list")}
            style={
              viewMode === "list"
                ? { backgroundColor: "var(--color-btn-bg)", color: "var(--color-btn-text)" }
                : { color: "var(--color-text-muted)" }
            }
            className="p-2 transition-colors">
            <LayoutList size={16} />
          </button>
          <button
            onClick={() => setView(PAGE_KEY, "grid")}
            style={
              viewMode === "grid"
                ? { backgroundColor: "var(--color-btn-bg)", color: "var(--color-btn-text)" }
                : { color: "var(--color-text-muted)" }
            }
            className="p-2 transition-colors">
            <LayoutGrid size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      {viewMode === "list" ? (
        /* ── TABLE VIEW ── */
        <div
          style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-bg-popup)" }}
          className="border rounded-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: "var(--color-btn-bg)" }}>
                  <th className="w-10 px-3 py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={allOnPageSelected}
                      onChange={toggleAllOnPage}
                      className="cursor-pointer"
                      aria-label="Select all on page"
                    />
                  </th>
                  {(["Name", "Type", "Material", "Procured", "Actions"] as const).map((h, i) => (
                    <th
                      key={h}
                      style={{ color: "var(--color-btn-text)" }}
                      className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider whitespace-nowrap ${i === 4 ? "text-right" : "text-left"}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && groups.length === 0 ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr
                      key={i}
                      className="animate-pulse"
                      style={{ borderTop: i > 0 ? `1px solid var(--color-border)` : undefined }}>
                      <td className="px-3 py-3.5 text-center">
                        <div className="h-3.5 w-3.5 rounded mx-auto" style={{ backgroundColor: "var(--color-border)" }} />
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="h-3.5 w-3.5 rounded shrink-0" style={{ backgroundColor: "var(--color-border)" }} />
                          <div className="h-3 rounded w-36" style={{ backgroundColor: "var(--color-border)" }} />
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="h-5 rounded-sm w-24" style={{ backgroundColor: "var(--color-border)" }} />
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="h-5 rounded-sm w-16" style={{ backgroundColor: "var(--color-border)" }} />
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="h-3 rounded w-8" style={{ backgroundColor: "var(--color-border)" }} />
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex justify-end gap-1">
                          <div className="w-14 h-6 rounded" style={{ backgroundColor: "var(--color-border)" }} />
                          <div className="w-6 h-6 rounded" style={{ backgroundColor: "var(--color-border)" }} />
                        </div>
                      </td>
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-14 text-center text-sm"
                      style={{ color: "var(--color-text-muted)" }}>
                      <Tag size={24} className="mx-auto mb-2 opacity-30" />
                      {groups.length === 0 ? (
                        <>No product groups yet.{" "}<button onClick={() => setShowCreateModal(true)} className="underline">Create one.</button></>
                      ) : (
                        "No groups match your filters."
                      )}
                    </td>
                  </tr>
                ) : (
                  filtered.map((g, i) => {
                    const isSelected = selectedIds.has(g.id);
                    return (
                      <tr
                        key={g.id}
                        onClick={() => toggleOne(g.id)}
                        className="cursor-pointer transition-colors"
                        style={{
                          borderTop: i > 0 ? `1px solid var(--color-border)` : undefined,
                          backgroundColor: isSelected
                            ? "color-mix(in srgb, var(--color-btn-bg) 6%, transparent)"
                            : undefined,
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected)
                            (e.currentTarget as HTMLElement).style.backgroundColor = "var(--color-bg-nav-hover)";
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected)
                            (e.currentTarget as HTMLElement).style.backgroundColor = "";
                        }}>
                        <td
                          className="relative px-3 py-3.5 text-center"
                          onClick={(ev) => ev.stopPropagation()}>
                          {isSelected && (
                            <span
                              className="absolute inset-y-0 left-0 w-0.5"
                              style={{ backgroundColor: "var(--color-btn-bg)" }}
                            />
                          )}
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleOne(g.id)}
                            className="h-4 w-4 cursor-pointer rounded"
                            aria-label={`Select ${g.name}`}
                          />
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Tag size={13} style={{ color: "var(--color-text-muted)" }} className="shrink-0" />
                            <span style={{ color: "var(--color-text-primary)" }} className="text-sm font-medium">
                              {g.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <TypeBadge type={g.type} />
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <MaterialBadge material={g.materialType} />
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span
                            className={`text-xs font-medium ${g.isProcured ? "text-green-600" : ""}`}
                            style={g.isProcured ? undefined : { color: "var(--color-text-muted)" }}>
                            {g.isProcured ? "Yes" : "No"}
                          </span>
                        </td>
                        <td
                          className="px-4 py-3.5"
                          onClick={(ev) => ev.stopPropagation()}>
                          <div className="flex items-center justify-end gap-0.5">
                            <Link
                              href={`/inventory/product-groups/${g.id}`}
                              style={{ color: "var(--color-text-secondary)" }}
                              className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors hover:opacity-70">
                              <Eye size={12} /> View
                            </Link>
                            <button
                              onClick={() => handleDelete(g.id)}
                              style={{ color: "var(--color-text-muted)" }}
                              className="inline-flex items-center justify-center rounded p-1 transition-colors hover:text-red-500">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ── GRID VIEW ── */
        <>
          {loading && groups.length === 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-bg-popup)" }}
                  className="border rounded-xl p-4 animate-pulse space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: "var(--color-border)" }} />
                    <div className="h-3.5 rounded w-28" style={{ backgroundColor: "var(--color-border)" }} />
                  </div>
                  <div className="flex gap-1.5">
                    <div className="h-5 rounded-sm w-20" style={{ backgroundColor: "var(--color-border)" }} />
                    <div className="h-5 rounded-sm w-14" style={{ backgroundColor: "var(--color-border)" }} />
                  </div>
                  <div
                    className="pt-2 border-t flex justify-end gap-1"
                    style={{ borderColor: "var(--color-border)" }}>
                    <div className="h-6 w-14 rounded" style={{ backgroundColor: "var(--color-border)" }} />
                    <div className="h-6 w-6 rounded" style={{ backgroundColor: "var(--color-border)" }} />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div
              style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}
              className="border-2 border-dashed rounded-xl py-16 text-center text-sm">
              {groups.length === 0 ? (
                <>No product groups yet.{" "}<button onClick={() => setShowCreateModal(true)} className="underline">Create one.</button></>
              ) : (
                "No groups match your filters."
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((g) => (
                <div
                  key={g.id}
                  style={{ backgroundColor: "var(--color-bg-popup)", borderColor: "var(--color-border)" }}
                  className="border rounded-xl p-4 flex flex-col gap-3 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        style={{ backgroundColor: "var(--color-bg-nav-active)" }}
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0">
                        <Tag size={14} style={{ color: "var(--color-text-primary)" }} />
                      </div>
                      <p style={{ color: "var(--color-text-primary)" }} className="text-sm font-semibold truncate">
                        {g.name}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <TypeBadge type={g.type} />
                    <MaterialBadge material={g.materialType} />
                    {g.isProcured && (
                      <span className="text-[11px] font-medium bg-green-50 border border-green-300 text-green-700 rounded-sm px-2 py-0.5">
                        Procured
                      </span>
                    )}
                  </div>
                  <div
                    style={{ borderTopColor: "var(--color-border)" }}
                    className="border-t pt-2.5 flex items-center justify-end gap-1">
                    <Link
                      href={`/inventory/product-groups/${g.id}`}
                      style={{ color: "var(--color-text-secondary)" }}
                      className="flex items-center gap-1.5 px-2 py-1 rounded text-xs hover:opacity-70 transition-opacity">
                      <Eye size={13} /> View
                    </Link>
                    <button
                      onClick={() => handleDelete(g.id)}
                      className="p-1.5 rounded text-red-400 hover:opacity-70 transition-opacity">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Create modal */}
      {showCreateModal && (
        <Modal title="New Product Group" onClose={() => setShowCreateModal(false)}>
          <div className="space-y-3">
            <div>
              <label style={{ color: "var(--color-text-muted)" }} className="block text-xs mb-1">Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Copper Wire"
                style={inputStyle}
                className={inputCls}
              />
            </div>
            <div>
              <label style={{ color: "var(--color-text-muted)" }} className="block text-xs mb-1">Type *</label>
              <select
                value={form.type}
                onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as ProductGroupType }))}
                style={inputStyle}
                className={inputCls}>
                {(Object.entries(PRODUCT_GROUP_TYPE_LABELS) as [ProductGroupType, string][]).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ color: "var(--color-text-muted)" }} className="block text-xs mb-1">Material *</label>
              <select
                value={form.materialType}
                onChange={(e) => setForm((p) => ({ ...p, materialType: e.target.value as MaterialType }))}
                style={inputStyle}
                className={inputCls}>
                {(Object.entries(MATERIAL_TYPE_LABELS) as [MaterialType, string][]).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isProcured}
                onChange={(e) => setForm((p) => ({ ...p, isProcured: e.target.checked }))}
                className="rounded"
              />
              <span style={{ color: "var(--color-text-secondary)" }} className="text-sm">Procured externally</span>
            </label>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowCreateModal(false)}
                style={{ borderColor: "var(--color-border)", color: "var(--color-text-secondary)" }}
                className="flex-1 border rounded-lg py-2 text-sm hover:opacity-70 transition-opacity">
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={saving || !form.name.trim()}
                style={{ backgroundColor: "var(--color-btn-bg)", color: "var(--color-btn-text)" }}
                className="flex-1 rounded-lg py-2 text-sm font-medium hover:opacity-80 transition-opacity disabled:opacity-40">
                {saving ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
