"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Package, Search, MapPin, Phone, Mail, Building2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import PermissionDenied from "@/components/ui/PermissionDenied";
import { getVendors, deleteVendor, setVendorProductGroups, setVendorBranches } from "@/api/vendors";
import { getProductGroups } from "@/api/productGroups";
import { getSubCompanies } from "@/api/subCompanies";
import type { Vendor, VendorType } from "@/types/vendor";
import type { ProductGroup } from "@/types/productGroup";
import type { SubCompany } from "@/types/subCompany";
import type { AxiosError } from "axios";

const inputStyle: React.CSSProperties = {
  backgroundColor: "var(--color-bg-input)",
  borderColor: "var(--color-border-input)",
  color: "var(--color-text-primary)",
};

const VENDOR_TYPE_LABELS: Record<VendorType, string> = {
  manufacturer: "Manufacturer",
  distributor:  "Distributor",
  wholesaler:   "Wholesaler",
  trader:       "Trader",
};

const VENDOR_TYPE_CHIP: Record<VendorType, string> = {
  manufacturer: "bg-blue-100 text-blue-700",
  distributor:  "bg-purple-100 text-purple-700",
  wholesaler:   "bg-amber-100 text-amber-700",
  trader:       "bg-gray-100 text-gray-600",
};

export default function VendorsPage() {
  const router = useRouter();

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [productGroups, setProductGroups] = useState<ProductGroup[]>([]);
  const [branches, setBranches] = useState<SubCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const [search, setSearch] = useState("");

  // Product groups modal
  const [pgTarget, setPgTarget] = useState<Vendor | null>(null);
  const [pgSelection, setPgSelection] = useState<Set<string>>(new Set());
  const [savingPg, setSavingPg] = useState(false);

  // Branches modal
  const [branchTarget, setBranchTarget] = useState<Vendor | null>(null);
  const [branchSelection, setBranchSelection] = useState<Set<string>>(new Set());
  const [savingBranch, setSavingBranch] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [v, pg, br] = await Promise.all([getVendors(), getProductGroups(), getSubCompanies()]);
        if (!cancelled) { setVendors(v); setProductGroups(pg); setBranches(br); }
      } catch (err) {
        if (!cancelled) {
          const status = (err as AxiosError).response?.status;
          if (status === 403) setPermissionDenied(true);
          else setError("Failed to load vendors.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return vendors;
    const q = search.toLowerCase();
    return vendors.filter(
      (v) =>
        v.companyName.toLowerCase().includes(q) ||
        (v.city ?? "").toLowerCase().includes(q) ||
        (v.specialization ?? "").toLowerCase().includes(q) ||
        (v.gstin ?? "").toLowerCase().includes(q) ||
        v.contactName.toLowerCase().includes(q),
    );
  }, [vendors, search]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this vendor? This cannot be undone.")) return;
    try {
      await deleteVendor(id);
      setVendors((p) => p.filter((v) => v.id !== id));
    } catch {
      setError("Failed to delete vendor.");
    }
  }

  function openProductGroups(v: Vendor) {
    setPgTarget(v);
    setPgSelection(new Set(v.productGroupIds ?? []));
  }

  async function handleSavePg() {
    if (!pgTarget) return;
    setSavingPg(true);
    try {
      await setVendorProductGroups(pgTarget.id, [...pgSelection]);
      setVendors((p) =>
        p.map((v) => (v.id === pgTarget.id ? { ...v, productGroupIds: [...pgSelection] } : v))
      );
      setPgTarget(null);
    } catch (err) {
      const e = err as AxiosError<{ message?: string }>;
      setError(e.response?.data?.message ?? "Failed to update product groups.");
    } finally {
      setSavingPg(false);
    }
  }

  function openBranches(v: Vendor) {
    setBranchTarget(v);
    setBranchSelection(new Set(v.branchIds ?? []));
  }

  async function handleSaveBranches() {
    if (!branchTarget) return;
    setSavingBranch(true);
    try {
      await setVendorBranches(branchTarget.id, [...branchSelection]);
      setVendors((p) =>
        p.map((v) => (v.id === branchTarget.id ? { ...v, branchIds: [...branchSelection] } : v))
      );
      setBranchTarget(null);
    } catch (err) {
      const e = err as AxiosError<{ message?: string }>;
      setError(e.response?.data?.message ?? "Failed to update branches.");
    } finally {
      setSavingBranch(false);
    }
  }

  const HEADERS = ["Company", "Type", "Contact", "Location", "Products", "Branches", "Actions"];

  if (permissionDenied) return <PermissionDenied />;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 style={{ color: "var(--color-text-primary)" }} className="text-xl font-bold">Vendors</h1>
          <p style={{ color: "var(--color-text-muted)" }} className="text-sm mt-0.5">
            {search ? `${filtered.length} of ${vendors.length}` : vendors.length}{" "}
            {vendors.length === 1 ? "vendor" : "vendors"}
          </p>
        </div>
        <button
          onClick={() => router.push("/parties/vendors/add")}
          style={{ backgroundColor: "var(--color-btn-bg)", color: "var(--color-btn-text)" }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium hover:opacity-80 transition-opacity">
          <Plus size={14} /> New Vendor
        </button>
      </div>

      {error && (
        <p className="text-red-500 text-sm bg-red-500/10 border border-red-500/20 rounded px-4 py-2">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline text-xs">dismiss</button>
        </p>
      )}

      {/* Search */}
      <div className="relative max-w-xs">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--color-text-muted)" }} />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search vendors…" style={inputStyle}
          className="w-full border rounded-lg pl-8 pr-3 py-1.5 text-sm focus:outline-none transition-colors" />
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-bg-popup)" }}
          className="border rounded overflow-hidden">
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: "var(--color-btn-bg)" }}>
                {HEADERS.map((h, i) => (
                  <th key={h} style={{ color: "var(--color-btn-text)" }}
                    className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider ${i === HEADERS.length - 1 ? "text-right" : "text-left"}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse" style={{ borderTop: i > 0 ? `1px solid var(--color-border)` : undefined }}>
                  <td className="px-4 py-3.5"><div className="h-3 rounded w-36" style={{ backgroundColor: "var(--color-border)" }} /></td>
                  <td className="px-4 py-3.5"><div className="h-5 rounded-full w-20" style={{ backgroundColor: "var(--color-border)" }} /></td>
                  <td className="px-4 py-3.5"><div className="h-3 rounded w-28" style={{ backgroundColor: "var(--color-border)" }} /></td>
                  <td className="px-4 py-3.5"><div className="h-3 rounded w-20" style={{ backgroundColor: "var(--color-border)" }} /></td>
                  <td className="px-4 py-3.5"><div className="h-3 rounded w-16" style={{ backgroundColor: "var(--color-border)" }} /></td>
                  <td className="px-4 py-3.5"><div className="h-3 rounded w-16" style={{ backgroundColor: "var(--color-border)" }} /></td>
                  <td className="px-4 py-3.5"><div className="flex justify-end gap-1"><div className="w-6 h-6 rounded" style={{ backgroundColor: "var(--color-border)" }} /></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : vendors.length === 0 ? (
        <div style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}
          className="border-2 border-dashed rounded py-16 text-center text-sm">
          No vendors yet.{" "}
          <button onClick={() => router.push("/parties/vendors/add")} className="underline hover:opacity-70">
            Add your first vendor.
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}
          className="border-2 border-dashed rounded py-16 text-center text-sm">
          No vendors match your search.{" "}
          <button onClick={() => setSearch("")} className="underline hover:opacity-70">Clear search</button>
        </div>
      ) : (
        <div style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-bg-popup)" }}
          className="border rounded overflow-hidden">
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: "var(--color-btn-bg)" }}>
                {HEADERS.map((h, i) => (
                  <th key={h} style={{ color: "var(--color-btn-text)" }}
                    className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider whitespace-nowrap ${i === HEADERS.length - 1 ? "text-right" : "text-left"}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((v, i) => {
                const assignedPgs = productGroups.filter((pg) => (v.productGroupIds ?? []).includes(pg.id));
                const assignedBranches = branches.filter((b) => (v.branchIds ?? []).includes(b.id));
                return (
                  <tr key={v.id}
                    style={{
                      borderTop: i > 0 ? `1px solid var(--color-border)` : undefined,
                      backgroundColor: "var(--color-bg-page)",
                    }}>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div>
                        <span style={{ color: "var(--color-text-primary)" }} className="text-sm font-medium">{v.companyName}</span>
                        {v.specialization && (
                          <p style={{ color: "var(--color-text-muted)" }} className="text-xs mt-0.5">{v.specialization}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${VENDOR_TYPE_CHIP[v.vendorType]}`}>
                        {VENDOR_TYPE_LABELS[v.vendorType]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <span style={{ color: "var(--color-text-secondary)" }} className="text-sm">{v.contactName}</span>
                        {v.contactDesignation && (
                          <p style={{ color: "var(--color-text-muted)" }} className="text-xs">{v.contactDesignation}</p>
                        )}
                        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                          {v.contactPhone && (
                            <span style={{ color: "var(--color-text-muted)" }} className="text-xs flex items-center gap-1">
                              <Phone size={10} />{v.contactPhone}
                            </span>
                          )}
                          {v.contactEmail && (
                            <span style={{ color: "var(--color-text-muted)" }} className="text-xs flex items-center gap-1">
                              <Mail size={10} />{v.contactEmail}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {(v.city || v.state)
                        ? <span style={{ color: "var(--color-text-secondary)" }} className="text-sm flex items-center gap-1.5"><MapPin size={12} className="shrink-0" />{[v.city, v.state].filter(Boolean).join(", ")}</span>
                        : <span style={{ color: "var(--color-text-muted)" }} className="text-sm">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {assignedPgs.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {assignedPgs.map((pg) => (
                            <span key={pg.id}
                              style={{ backgroundColor: "var(--color-bg-nav-active)", color: "var(--color-text-secondary)" }}
                              className="text-[11px] rounded px-1.5 py-0.5 font-medium whitespace-nowrap">
                              {pg.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: "var(--color-text-muted)" }} className="text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {assignedBranches.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {assignedBranches.map((b) => (
                            <span key={b.id}
                              style={{ backgroundColor: "var(--color-bg-nav-active)", color: "var(--color-text-secondary)" }}
                              className="text-[11px] rounded px-1.5 py-0.5 font-medium whitespace-nowrap">
                              {b.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: "var(--color-text-muted)" }} className="text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-0.5 justify-end">
                        <button onClick={() => openProductGroups(v)} title="Manage product groups"
                          style={{ color: "var(--color-text-secondary)" }}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium hover:opacity-70 transition-opacity">
                          <Package size={12} /> Products
                        </button>
                        <button onClick={() => openBranches(v)} title="Manage branches"
                          style={{ color: "var(--color-text-secondary)" }}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium hover:opacity-70 transition-opacity">
                          <Building2 size={12} /> Branches
                        </button>
                        <button onClick={() => router.push(`/parties/vendors/${v.id}/edit`)} title="Edit"
                          style={{ color: "var(--color-text-muted)" }}
                          className="p-1.5 rounded hover:opacity-70 transition-opacity">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => handleDelete(v.id)} title="Delete"
                          className="p-1.5 rounded text-red-400 hover:opacity-70 transition-opacity">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Product groups modal */}
      {pgTarget && (
        <Modal title={`${pgTarget.companyName} — Product Groups`} onClose={() => setPgTarget(null)}>
          <div className="space-y-3">
            {productGroups.length === 0 ? (
              <p style={{ color: "var(--color-text-muted)" }} className="text-sm text-center py-6">No product groups exist yet.</p>
            ) : (
              <div style={{ borderColor: "var(--color-border)" }} className="border rounded divide-y max-h-72 overflow-y-auto">
                {productGroups.map((pg) => (
                  <label key={pg.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:opacity-80 transition-opacity"
                    style={{ backgroundColor: "var(--color-bg-page)" }}>
                    <input type="checkbox"
                      checked={pgSelection.has(pg.id)}
                      onChange={() => setPgSelection((prev) => {
                        const next = new Set(prev);
                        if (next.has(pg.id)) next.delete(pg.id); else next.add(pg.id);
                        return next;
                      })}
                      className="h-4 w-4 rounded cursor-pointer" />
                    <div className="flex-1 min-w-0">
                      <span style={{ color: "var(--color-text-primary)" }} className="text-sm font-medium">{pg.name}</span>
                      <span style={{ color: "var(--color-text-muted)" }} className="text-xs ml-2">{pg.type.replace(/_/g, " ")}</span>
                    </div>
                  </label>
                ))}
              </div>
            )}
            <p style={{ color: "var(--color-text-muted)" }} className="text-xs">
              {pgSelection.size} product group{pgSelection.size !== 1 ? "s" : ""} selected
            </p>
            <div className="flex gap-2">
              <button onClick={() => setPgTarget(null)}
                style={{ borderColor: "var(--color-border)", color: "var(--color-text-secondary)" }}
                className="flex-1 border rounded-lg py-2 text-sm hover:opacity-70 transition-opacity">
                Cancel
              </button>
              <button onClick={handleSavePg} disabled={savingPg}
                style={{ backgroundColor: "var(--color-btn-bg)", color: "var(--color-btn-text)" }}
                className="flex-1 rounded-lg py-2 text-sm font-medium hover:opacity-80 transition-opacity disabled:opacity-40">
                {savingPg ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Branches modal */}
      {branchTarget && (
        <Modal title={`${branchTarget.companyName} — Branches`} onClose={() => setBranchTarget(null)}>
          <div className="space-y-3">
            {branches.length === 0 ? (
              <p style={{ color: "var(--color-text-muted)" }} className="text-sm text-center py-6">No branches exist yet.</p>
            ) : (
              <div style={{ borderColor: "var(--color-border)" }} className="border rounded divide-y max-h-72 overflow-y-auto">
                {branches.map((b) => (
                  <label key={b.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:opacity-80 transition-opacity"
                    style={{ backgroundColor: "var(--color-bg-page)" }}>
                    <input type="checkbox"
                      checked={branchSelection.has(b.id)}
                      onChange={() => setBranchSelection((prev) => {
                        const next = new Set(prev);
                        if (next.has(b.id)) next.delete(b.id); else next.add(b.id);
                        return next;
                      })}
                      className="h-4 w-4 rounded cursor-pointer" />
                    <div className="flex-1 min-w-0">
                      <span style={{ color: "var(--color-text-primary)" }} className="text-sm font-medium">{b.name}</span>
                      {b.city && (
                        <span style={{ color: "var(--color-text-muted)" }} className="text-xs ml-2">{b.city}</span>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            )}
            <p style={{ color: "var(--color-text-muted)" }} className="text-xs">
              {branchSelection.size} branch{branchSelection.size !== 1 ? "es" : ""} selected
            </p>
            <div className="flex gap-2">
              <button onClick={() => setBranchTarget(null)}
                style={{ borderColor: "var(--color-border)", color: "var(--color-text-secondary)" }}
                className="flex-1 border rounded-lg py-2 text-sm hover:opacity-70 transition-opacity">
                Cancel
              </button>
              <button onClick={handleSaveBranches} disabled={savingBranch}
                style={{ backgroundColor: "var(--color-btn-bg)", color: "var(--color-btn-text)" }}
                className="flex-1 rounded-lg py-2 text-sm font-medium hover:opacity-80 transition-opacity disabled:opacity-40">
                {savingBranch ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
