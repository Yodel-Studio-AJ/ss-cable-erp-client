"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Package, Tag, Calendar, CheckCircle, XCircle,
  Hash, FlaskConical, GitMerge, Star,
} from "lucide-react";
import { getProduct, type ProductWithGroup } from "@/api/products";

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

type AttributeKind = "qty_basis" | "calculated" | "from_input" | "simple";

function attrKind(av: {
  isQuantityBasis: boolean | null;
  isCalculated: boolean | null;
  isFromInput: boolean | null;
}): AttributeKind {
  if (av.isQuantityBasis) return "qty_basis";
  if (av.isCalculated)    return "calculated";
  if (av.isFromInput)     return "from_input";
  return "simple";
}

const KIND_LABEL: Record<AttributeKind, string> = {
  qty_basis:  "Qty Basis",
  calculated: "Calculated",
  from_input: "From Input",
  simple:     "Simple",
};

const KIND_ICON: Record<AttributeKind, React.ReactNode> = {
  qty_basis:  <Star size={10} />,
  calculated: <FlaskConical size={10} />,
  from_input: <GitMerge size={10} />,
  simple:     <Hash size={10} />,
};

const KIND_COLOR: Record<AttributeKind, string> = {
  qty_basis:  "#8b5cf6",
  calculated: "#6366f1",
  from_input: "#0ea5e9",
  simple:     "#6b7280",
};

function KindBadge({ kind }: { kind: AttributeKind }) {
  const color = KIND_COLOR[kind];
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
      style={{
        color,
        backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
      }}
    >
      {KIND_ICON[kind]}
      {KIND_LABEL[kind]}
    </span>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      className="flex items-start gap-4 py-3 border-b last:border-b-0"
      style={{ borderColor: "var(--color-border)" }}
    >
      <span className="text-sm w-32 shrink-0" style={{ color: "var(--color-text-muted)" }}>{label}</span>
      <div className="text-sm flex-1" style={{ color: "var(--color-text-primary)" }}>{children}</div>
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

type DetailAV = {
  id: string;
  productGroupAttributeId: string;
  numericValue: number | null;
  textValue: string | null;
  attrName: string | null;
  attrUnit: string | null;
  isQuantityBasis: boolean | null;
  isCalculated: boolean | null;
  isFromInput: boolean | null;
};

type DetailProduct = Omit<ProductWithGroup, "attributeValues"> & {
  attributeValues: DetailAV[];
};

export default function ProductVariantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<DetailProduct | null>(null);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getProduct(id)
      .then((p) => setProduct(p as DetailProduct))
      .catch(() => setError("Failed to load product variant."));
  }, [id]);

  if (error) {
    return (
      <div className="p-8 text-center" style={{ color: "var(--color-text-muted)" }}>
        {error}
      </div>
    );
  }

  if (!product) {
    return (
      <div className="p-8 text-center text-sm" style={{ color: "var(--color-text-muted)" }}>
        Loading…
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm" style={{ color: "var(--color-text-muted)" }}>
        <Link href="/inventory/products" className="hover:underline">Product Variants</Link>
        <span>/</span>
        <Link
          href={`/inventory/product-groups/${product.productGroupId}`}
          className="hover:underline"
        >
          {product.groupName}
        </Link>
        <span>/</span>
        <span style={{ color: "var(--color-text-primary)" }}>{product.name}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/inventory/product-groups/${product.productGroupId}`}
            className="p-2 rounded-lg hover:opacity-70 transition-opacity"
            style={{ backgroundColor: "var(--color-bg-subtle)", color: "var(--color-text-secondary)" }}
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-xl font-semibold" style={{ color: "var(--color-text-primary)" }}>
              {product.name}
            </h1>
            {product.sku && (
              <p className="text-xs font-mono mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                SKU: {product.sku}
              </p>
            )}
          </div>
        </div>
        <span
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
          style={
            product.isActive
              ? { backgroundColor: "color-mix(in srgb, #22c55e 12%, transparent)", color: "#16a34a", border: "1px solid color-mix(in srgb, #22c55e 25%, transparent)" }
              : { backgroundColor: "color-mix(in srgb, #ef4444 12%, transparent)", color: "#dc2626", border: "1px solid color-mix(in srgb, #ef4444 25%, transparent)" }
          }
        >
          {product.isActive ? <CheckCircle size={11} /> : <XCircle size={11} />}
          {product.isActive ? "Active" : "Inactive"}
        </span>
      </div>

      {/* Info card */}
      <div
        className="border rounded-xl overflow-hidden"
        style={{ backgroundColor: "var(--color-bg-popup)", borderColor: "var(--color-border)" }}
      >
        <div
          className="flex items-center gap-2 px-5 py-3"
          style={{ borderBottom: "1px solid var(--color-border)" }}
        >
          <Package size={13} style={{ color: "var(--color-text-muted)" }} />
          <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
            Overview
          </p>
        </div>
        <div className="px-5">
          <InfoRow label="Product Group">
            <Link
              href={`/inventory/product-groups/${product.productGroupId}`}
              className="hover:underline font-medium"
            >
              {product.groupName}
            </Link>
          </InfoRow>
          {product.sku && (
            <InfoRow label="SKU">
              <span className="font-mono">{product.sku}</span>
            </InfoRow>
          )}
          {product.description && (
            <InfoRow label="Description">{product.description}</InfoRow>
          )}
          <InfoRow label="Created">
            <span className="flex items-center gap-1.5">
              <Calendar size={12} />
              {formatDate(product.createdAt)}
            </span>
          </InfoRow>
          <InfoRow label="Last Updated">
            <span className="flex items-center gap-1.5">
              <Calendar size={12} />
              {formatDate(product.updatedAt)}
            </span>
          </InfoRow>
        </div>
      </div>

      {/* Attribute values table */}
      <div
        className="border rounded-xl overflow-hidden"
        style={{ backgroundColor: "var(--color-bg-popup)", borderColor: "var(--color-border)" }}
      >
        <div
          className="flex items-center gap-2 px-5 py-3"
          style={{ borderBottom: "1px solid var(--color-border)" }}
        >
          <Tag size={13} style={{ color: "var(--color-text-muted)" }} />
          <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
            Attribute Values
          </p>
          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            ({product.attributeValues.length})
          </span>
        </div>

        {product.attributeValues.length === 0 ? (
          <p className="text-sm text-center py-6" style={{ color: "var(--color-text-muted)" }}>
            No attribute values recorded.
          </p>
        ) : (
          <>
            {/* Table header */}
            <div
              className="grid grid-cols-[1fr_6rem_9rem_7rem] items-center px-5 py-2 text-[11px] font-medium uppercase tracking-wider"
              style={{ color: "var(--color-text-muted)", borderBottom: "1px solid var(--color-border)" }}
            >
              <span>Attribute</span>
              <span className="text-right">Value</span>
              <span className="text-center">Unit</span>
              <span className="text-center">Kind</span>
            </div>

            {product.attributeValues.map((av, idx) => {
              const kind = attrKind(av);
              const displayValue =
                av.numericValue != null
                  ? av.numericValue.toLocaleString("en-IN", { maximumFractionDigits: 6 })
                  : av.textValue ?? "—";

              return (
                <div
                  key={av.id}
                  className="grid grid-cols-[1fr_6rem_9rem_7rem] items-center px-5 py-3 gap-x-2"
                  style={{
                    borderTop: idx > 0 ? "1px solid var(--color-border)" : undefined,
                    backgroundColor: av.isQuantityBasis
                      ? "color-mix(in srgb, #8b5cf6 4%, transparent)"
                      : undefined,
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {av.isQuantityBasis && (
                      <Star size={10} style={{ color: "#8b5cf6", flexShrink: 0 }} />
                    )}
                    <span
                      className="text-sm font-medium truncate"
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      {av.attrName ?? "Unknown"}
                    </span>
                  </div>
                  <span
                    className="text-sm font-mono text-right tabular-nums"
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    {displayValue}
                  </span>
                  <span
                    className="text-xs text-center"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {av.attrUnit ?? "—"}
                  </span>
                  <div className="flex justify-center">
                    <KindBadge kind={kind} />
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
