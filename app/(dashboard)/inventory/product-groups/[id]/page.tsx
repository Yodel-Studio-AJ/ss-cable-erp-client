"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Edit, Tag, Calendar } from "lucide-react";
import { getProductGroup } from "@/api/productGroups";
import type { ProductGroup, ProductGroupType, MaterialType } from "@/types/productGroup";
import {
  PRODUCT_GROUP_TYPE_LABELS,
  MATERIAL_TYPE_LABELS,
} from "@/types/productGroup";

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      style={{ borderColor: "var(--color-border)" }}
      className="flex items-start justify-between py-3 border-b last:border-b-0">
      <span style={{ color: "var(--color-text-muted)" }} className="text-sm w-36 shrink-0">
        {label}
      </span>
      <div className="flex-1 text-sm" style={{ color: "var(--color-text-primary)" }}>
        {children}
      </div>
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function ProductGroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [group, setGroup] = useState<ProductGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setGroup(await getProductGroup(id));
      } catch {
        setError("Failed to load product group.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Back + actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          style={{ color: "var(--color-text-secondary)" }}
          className="flex items-center gap-1.5 text-sm hover:opacity-70 transition-opacity">
          <ArrowLeft size={15} />
          Back
        </button>
        {group && (
          <Link
            href={`/inventory/product-groups/${id}/edit`}
            style={{ backgroundColor: "var(--color-btn-bg)", color: "var(--color-btn-text)" }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium hover:opacity-80 transition-opacity">
            <Edit size={14} />
            Edit
          </Link>
        )}
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
      ) : group ? (
        <div
          style={{
            backgroundColor: "var(--color-bg-popup)",
            borderColor: "var(--color-border)",
          }}
          className="border rounded-xl overflow-hidden">
          {/* Header */}
          <div
            style={{ backgroundColor: "var(--color-btn-bg)", color: "var(--color-btn-text)" }}
            className="flex items-center gap-3 px-5 py-4">
            <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
              <Tag size={16} />
            </div>
            <div>
              <h1 className="text-base font-semibold">{group.name}</h1>
              <p className="text-xs opacity-70 mt-0.5">Product Group · {group.id}</p>
            </div>
          </div>

          {/* Fields */}
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
      ) : null}
    </div>
  );
}
