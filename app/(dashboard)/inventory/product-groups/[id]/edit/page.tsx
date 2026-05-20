"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import { getProductGroup, updateProductGroup } from "@/api/productGroups";
import type { ProductGroupType, MaterialType, UpdateProductGroupPayload } from "@/types/productGroup";
import {
  PRODUCT_GROUP_TYPE_LABELS,
  MATERIAL_TYPE_LABELS,
} from "@/types/productGroup";

const inputCls = "w-full border rounded-lg px-3 py-2 text-sm focus:outline-none transition-colors";
const inputStyle: React.CSSProperties = {
  backgroundColor: "var(--color-bg-input)",
  borderColor: "var(--color-border-input)",
  color: "var(--color-text-primary)",
};

export default function ProductGroupEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [form, setForm] = useState<UpdateProductGroupPayload>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const g = await getProductGroup(id);
        setForm({
          name: g.name,
          type: g.type,
          materialType: g.materialType,
          isProcured: g.isProcured,
        });
      } catch {
        setError("Failed to load product group.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  async function handleSave() {
    if (!form.name?.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await updateProductGroup(id, form);
      router.replace(`/inventory/product-groups/${id}`);
    } catch {
      setError("Failed to save changes.");
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5 max-w-lg">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          style={{ color: "var(--color-text-secondary)" }}
          className="flex items-center gap-1.5 text-sm hover:opacity-70 transition-opacity">
          <ArrowLeft size={15} />
          Back
        </button>
        <h1 style={{ color: "var(--color-text-primary)" }} className="text-base font-semibold">
          Edit Product Group
        </h1>
        <div className="w-16" />
      </div>

      {error && (
        <p className="text-red-500 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">
          {error}
        </p>
      )}

      {loading ? (
        <div style={{ color: "var(--color-text-muted)" }} className="text-sm text-center py-16">
          Loading…
        </div>
      ) : (
        <div
          style={{
            backgroundColor: "var(--color-bg-popup)",
            borderColor: "var(--color-border)",
          }}
          className="border rounded-xl p-5 space-y-4">
          <div>
            <label style={{ color: "var(--color-text-muted)" }} className="block text-xs mb-1">
              Name *
            </label>
            <input
              type="text"
              value={form.name ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Copper Wire"
              style={inputStyle}
              className={inputCls}
            />
          </div>

          <div>
            <label style={{ color: "var(--color-text-muted)" }} className="block text-xs mb-1">
              Type *
            </label>
            <select
              value={form.type ?? "raw_material"}
              onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as ProductGroupType }))}
              style={inputStyle}
              className={inputCls}>
              {(Object.entries(PRODUCT_GROUP_TYPE_LABELS) as [ProductGroupType, string][]).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ color: "var(--color-text-muted)" }} className="block text-xs mb-1">
              Material *
            </label>
            <select
              value={form.materialType ?? "metal"}
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
              checked={form.isProcured ?? false}
              onChange={(e) => setForm((p) => ({ ...p, isProcured: e.target.checked }))}
              className="rounded"
            />
            <span style={{ color: "var(--color-text-secondary)" }} className="text-sm">
              Procured externally
            </span>
          </label>

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => router.back()}
              style={{ borderColor: "var(--color-border)", color: "var(--color-text-secondary)" }}
              className="flex-1 border rounded-lg py-2 text-sm hover:opacity-70 transition-opacity">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !form.name?.trim()}
              style={{ backgroundColor: "var(--color-btn-bg)", color: "var(--color-btn-text)" }}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium hover:opacity-80 transition-opacity disabled:opacity-40">
              <Save size={14} />
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
