"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Search, Package, ChevronRight, CheckCircle, XCircle } from "lucide-react";
import { listAllProducts, type ProductWithGroup } from "@/api/products";

export default function ProductVariantsPage() {
  const [products, setProducts]   = useState<ProductWithGroup[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [search, setSearch]       = useState("");
  const [groupFilter, setGroup]   = useState("");

  useEffect(() => {
    let cancelled = false;
    listAllProducts()
      .then((data) => { if (!cancelled) { setProducts(data); setLoading(false); } })
      .catch(() => { if (!cancelled) { setError("Failed to load products."); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  const groups = useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of products) seen.set(p.productGroupId, p.groupName);
    return Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [products]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return products.filter((p) => {
      if (groupFilter && p.productGroupId !== groupFilter) return false;
      if (q && !p.name.toLowerCase().includes(q) && !(p.sku ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [products, search, groupFilter]);

  // Group filtered products by their group for display
  const byGroup = useMemo(() => {
    const map = new Map<string, { groupName: string; groupId: string; items: ProductWithGroup[] }>();
    for (const p of filtered) {
      if (!map.has(p.productGroupId)) {
        map.set(p.productGroupId, { groupName: p.groupName, groupId: p.productGroupId, items: [] });
      }
      map.get(p.productGroupId)!.items.push(p);
    }
    return Array.from(map.values()).sort((a, b) => a.groupName.localeCompare(b.groupName));
  }, [filtered]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 style={{ color: "var(--color-text-primary)" }} className="text-xl font-bold">
            Product Variants
          </h1>
          <p style={{ color: "var(--color-text-muted)" }} className="text-sm mt-0.5">
            All product variants across groups
          </p>
        </div>
        <span style={{ color: "var(--color-text-muted)" }} className="text-sm">
          {filtered.length} variant{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--color-text-muted)" }} />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search variants…"
            style={{ backgroundColor: "var(--color-bg-input)", borderColor: "var(--color-border-input)", color: "var(--color-text-primary)" }}
            className="w-full border rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none"
          />
        </div>
        <select
          value={groupFilter} onChange={(e) => setGroup(e.target.value)}
          style={{ backgroundColor: "var(--color-bg-input)", borderColor: "var(--color-border-input)", color: "var(--color-text-primary)" }}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none">
          <option value="">All groups</option>
          {groups.map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-lg" style={{ backgroundColor: "var(--color-border)" }} />
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-red-500">{error}</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16" style={{ color: "var(--color-text-muted)" }}>
          <Package size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">
            {search || groupFilter ? "No variants match your filters." : "No product variants yet. Create them from a product group."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {byGroup.map(({ groupName, groupId, items }) => (
            <div key={groupId} style={{ backgroundColor: "var(--color-bg-popup)", borderColor: "var(--color-border)" }}
              className="border rounded-lg overflow-hidden">
              {/* Group header */}
              <div className="flex items-center justify-between px-4 py-2.5"
                style={{ borderBottom: "1px solid var(--color-border)", backgroundColor: "var(--color-bg-nav-active)" }}>
                <div className="flex items-center gap-2">
                  <Package size={13} style={{ color: "var(--color-text-muted)" }} />
                  <span style={{ color: "var(--color-text-primary)" }} className="text-sm font-semibold">{groupName}</span>
                  <span style={{ color: "var(--color-text-muted)" }} className="text-xs">({items.length})</span>
                </div>
                <Link href={`/inventory/product-groups/${groupId}`}
                  style={{ color: "var(--color-text-muted)" }}
                  className="flex items-center gap-1 text-xs hover:opacity-70 transition-opacity">
                  View group <ChevronRight size={12} />
                </Link>
              </div>

              {/* Variant rows */}
              <div className="divide-y" style={{ borderColor: "var(--color-border)" }}>
                {items.map((p) => (
                  <div key={p.id} className="flex items-center gap-4 px-4 py-3">
                    {/* Name + description */}
                    <div className="flex-1 min-w-0">
                      <p style={{ color: "var(--color-text-primary)" }} className="text-sm font-medium truncate">{p.name}</p>
                      {p.description && (
                        <p style={{ color: "var(--color-text-muted)" }} className="text-xs truncate mt-0.5">{p.description}</p>
                      )}
                    </div>

                    {/* SKU */}
                    <div className="shrink-0 w-28 text-right">
                      {p.sku
                        ? <span style={{ color: "var(--color-text-secondary)" }} className="text-xs font-mono">{p.sku}</span>
                        : <span style={{ color: "var(--color-text-muted)" }} className="text-xs">—</span>}
                    </div>

                    {/* Active badge */}
                    <div className="shrink-0 flex items-center gap-1 text-xs">
                      {p.isActive
                        ? <><CheckCircle size={11} className="text-green-500" /><span className="text-green-600">Active</span></>
                        : <><XCircle size={11} className="text-red-400" /><span className="text-red-500">Inactive</span></>}
                    </div>

                    {/* Link to group page */}
                    <Link href={`/inventory/product-groups/${groupId}`}
                      style={{ color: "var(--color-text-muted)" }}
                      className="shrink-0 p-1.5 rounded hover:opacity-70 transition-opacity">
                      <ChevronRight size={14} />
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
