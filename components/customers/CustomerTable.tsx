"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { useCustomerStore } from "@/store/customerStore";
import type { Customer } from "@/types/customer";

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function IndustryBadge({ label }: { label: string }) {
  return (
    <span style={{ borderColor: "var(--color-border)", color: "var(--color-text-secondary)" }}
      className="inline-block border rounded px-2 py-0.5 text-[11px] font-medium whitespace-nowrap">
      {label}
    </span>
  );
}

function RowMenu({ onEdit, onContacts, onDelete }: { onEdit: () => void; onContacts: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative flex justify-end">
      <button onClick={(e) => { e.stopPropagation(); setOpen((p) => !p); }}
        style={{ color: "var(--color-text-muted)" }}
        className="p-1.5 rounded hover:opacity-70 transition-opacity">
        <MoreHorizontal size={15} />
      </button>
      {open && (
        <div style={{ backgroundColor: "var(--color-bg-popup)", borderColor: "var(--color-border)" }}
          className="absolute right-0 top-7 z-20 border rounded-lg shadow-lg py-1 min-w-32.5">
          {[
            { label: "View Details", action: onEdit },
            { label: "Contacts", action: onContacts },
            { label: "Delete", action: onDelete, danger: true },
          ].map(({ label, action, danger }) => (
            <button key={label}
              onClick={(e) => { e.stopPropagation(); action(); setOpen(false); }}
              style={{ color: danger ? undefined : "var(--color-text-secondary)" }}
              className={`w-full text-left px-3 py-1.5 text-sm hover:opacity-70 transition-opacity ${danger ? "text-red-500" : ""}`}>
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface Props {
  filtered: Customer[];
  onEdit: (c: Customer) => void;
  onContacts: (c: Customer) => void;
}

export default function CustomerTable({ filtered, onEdit, onContacts }: Props) {
  const router = useRouter();
  const remove = useCustomerStore((s) => s.remove);
  const customers = useCustomerStore((s) => s.customers);
  const loading = useCustomerStore((s) => s.loading);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const allSelected = filtered.length > 0 && filtered.every((c) => selectedIds.has(c.id));

  function toggleAll() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) filtered.forEach((c) => next.delete(c.id));
      else filtered.forEach((c) => next.add(c.id));
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this customer? All contacts will also be removed.")) return;
    await remove(id);
    setSelectedIds((p) => { const n = new Set(p); n.delete(id); return n; });
  }

  if (loading) {
    return (
      <div style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-bg-popup)" }}
        className="border rounded overflow-hidden">
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: `1px solid var(--color-border)` }}>
              <th className="px-4 py-3 w-10" />
              {["Company", "Phone", "Location", "Industry", "GSTIN", "Added On", ""].map((h, i) => (
                <th key={i} style={{ color: "var(--color-text-muted)" }}
                  className={`px-4 py-3 text-xs font-medium ${i === 6 ? "w-10" : "text-left"}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="animate-pulse" style={{ borderTop: `1px solid var(--color-border)` }}>
                <td className="px-4 py-3.5 w-10"><div className="h-4 w-4 rounded" style={{ backgroundColor: "var(--color-border)" }} /></td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full shrink-0" style={{ backgroundColor: "var(--color-border)" }} />
                    <div className="h-3 rounded w-32" style={{ backgroundColor: "var(--color-border)" }} />
                  </div>
                </td>
                <td className="px-4 py-3.5"><div className="h-3 rounded w-28" style={{ backgroundColor: "var(--color-border)" }} /></td>
                <td className="px-4 py-3.5"><div className="h-3 rounded w-24" style={{ backgroundColor: "var(--color-border)" }} /></td>
                <td className="px-4 py-3.5"><div className="h-5 rounded w-20" style={{ backgroundColor: "var(--color-border)" }} /></td>
                <td className="px-4 py-3.5"><div className="h-3 rounded w-28" style={{ backgroundColor: "var(--color-border)" }} /></td>
                <td className="px-4 py-3.5"><div className="h-3 rounded w-20" style={{ backgroundColor: "var(--color-border)" }} /></td>
                <td className="px-4 py-3.5 w-10" />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (customers.length === 0) return null;

  if (filtered.length === 0) return null;

  return (
    <div style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-bg-popup)" }}
      className="border rounded overflow-hidden">
      {selectedIds.size > 0 && (
        <div style={{ backgroundColor: "var(--color-bg-nav-active)", borderColor: "var(--color-border)" }}
          className="flex items-center gap-3 px-4 py-2 border-b">
          <span style={{ color: "var(--color-text-secondary)" }} className="text-sm">
            {selectedIds.size} selected
          </span>
          <button onClick={() => setSelectedIds(new Set())}
            style={{ color: "var(--color-text-muted)" }} className="text-xs underline hover:opacity-70">
            Clear
          </button>
        </div>
      )}
      <table className="w-full">
        <thead>
          <tr style={{ borderBottom: `1px solid var(--color-border)` }}>
            <th className="px-4 py-3 w-10">
              <input type="checkbox" checked={allSelected} onChange={toggleAll}
                className="h-4 w-4 rounded cursor-pointer" />
            </th>
            {["Company", "Phone", "Location", "Industry", "GSTIN", "Added On", ""].map((h, i) => (
              <th key={i} style={{ color: "var(--color-text-muted)" }}
                className={`px-4 py-3 text-xs font-medium whitespace-nowrap ${i === 6 ? "text-right w-10" : "text-left"}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filtered.map((c) => {
            const selected = selectedIds.has(c.id);
            const hovered = hoveredId === c.id;
            return (
              <tr key={c.id}
                onClick={() => router.push(`/parties/customers/${c.id}`)}
                onMouseEnter={() => setHoveredId(c.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  borderTop: `1px solid var(--color-border)`,
                  backgroundColor: selected
                    ? "var(--color-bg-nav-active)"
                    : hovered ? "var(--color-bg-input)"
                    : "var(--color-bg-page)",
                  borderLeft: selected ? "2px solid var(--color-btn-bg)" : "2px solid transparent",
                  cursor: "pointer",
                }}>
                <td className="px-4 py-3 w-10">
                  <input type="checkbox" checked={selected}
                    onChange={(e) => { e.stopPropagation(); toggleOne(c.id); }}
                    onClick={(e) => e.stopPropagation()}
                    className="h-4 w-4 rounded cursor-pointer" />
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex items-center gap-2.5">
                    <div style={{ backgroundColor: "var(--color-bg-initials)", color: "var(--color-text-initials)" }}
                      className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-semibold">
                      {c.companyName.charAt(0).toUpperCase()}
                    </div>
                    <span style={{ color: "var(--color-text-primary)" }} className="text-sm font-medium">{c.companyName}</span>
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span style={{ color: "var(--color-text-muted)" }} className="text-sm">—</span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {(c.city || c.state)
                    ? <span style={{ color: "var(--color-text-secondary)" }} className="text-sm">{[c.city, c.state].filter(Boolean).join(", ")}</span>
                    : <span style={{ color: "var(--color-text-muted)" }} className="text-sm">—</span>}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {c.industry ? <IndustryBadge label={c.industry} /> : <span style={{ color: "var(--color-text-muted)" }} className="text-sm">—</span>}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span style={{ color: "var(--color-text-secondary)" }} className="text-xs font-mono">
                    {c.gstin || <span style={{ color: "var(--color-text-muted)" }}>—</span>}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span style={{ color: "var(--color-text-muted)" }} className="text-xs">{fmt(c.createdAt)}</span>
                </td>
                <td className="px-4 py-3 w-10">
                  <RowMenu
                    onEdit={() => onEdit(c)}
                    onContacts={() => onContacts(c)}
                    onDelete={() => handleDelete(c.id)}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
