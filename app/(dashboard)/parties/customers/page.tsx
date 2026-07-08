"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import PermissionDenied from "@/components/ui/PermissionDenied";
import CustomerTable from "@/components/customers/CustomerTable";
import CustomerFormModal from "@/components/customers/CustomerFormModal";
import CustomerContactsModal from "@/components/customers/CustomerContactsModal";
import { useCustomerStore } from "@/store/customerStore";
import type { Customer } from "@/types/customer";

const inputStyle: React.CSSProperties = {
  backgroundColor: "var(--color-bg-input)",
  borderColor: "var(--color-border-input)",
  color: "var(--color-text-primary)",
};

export default function CustomersPage() {
  const router = useRouter();
  const { customers, loading, error, permissionDenied, fetch, setError } = useCustomerStore();

  const [search, setSearch] = useState("");
  const [editTarget, setEditTarget] = useState<Customer | null>(null);
  const [contactsTarget, setContactsTarget] = useState<Customer | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => { fetch(); }, [fetch]);

  const filtered = useMemo(() => {
    if (!search.trim()) return customers;
    const q = search.toLowerCase();
    return customers.filter(
      (c) =>
        c.companyName.toLowerCase().includes(q) ||
        (c.city ?? "").toLowerCase().includes(q) ||
        (c.industry ?? "").toLowerCase().includes(q) ||
        (c.gstin ?? "").toLowerCase().includes(q),
    );
  }, [customers, search]);

  if (permissionDenied) return <PermissionDenied />;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 style={{ color: "var(--color-text-primary)" }} className="text-xl font-bold">Customers</h1>
          <p style={{ color: "var(--color-text-muted)" }} className="text-sm mt-0.5">
            {search ? `${filtered.length} of ${customers.length}` : customers.length}{" "}
            {customers.length === 1 ? "customer" : "customers"}
          </p>
        </div>
        <button onClick={() => router.push("/parties/customers/add")}
          style={{ backgroundColor: "var(--color-btn-bg)", color: "var(--color-btn-text)" }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium hover:opacity-80 transition-opacity">
          <Plus size={14} /> New Customer
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
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: "var(--color-text-muted)" }} />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search customers…" style={inputStyle}
          className="w-full border rounded-lg pl-8 pr-3 py-1.5 text-sm focus:outline-none transition-colors" />
      </div>

      {/* Empty states */}
      {!loading && customers.length === 0 && (
        <div style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}
          className="border-2 border-dashed rounded py-16 text-center text-sm">
          No customers yet.{" "}
          <button onClick={() => router.push("/parties/customers/add")} className="underline hover:opacity-70">
            Add your first customer.
          </button>
        </div>
      )}
      {!loading && customers.length > 0 && filtered.length === 0 && (
        <div style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}
          className="border-2 border-dashed rounded py-16 text-center text-sm">
          No customers match your search.{" "}
          <button onClick={() => setSearch("")} className="underline hover:opacity-70">Clear search</button>
        </div>
      )}

      <CustomerTable
        filtered={filtered}
        onEdit={(c) => setEditTarget(c)}
        onContacts={(c) => setContactsTarget(c)}
      />

      {showCreate && <CustomerFormModal onClose={() => setShowCreate(false)} />}
      {editTarget && <CustomerFormModal customer={editTarget} onClose={() => setEditTarget(null)} />}
      {contactsTarget && <CustomerContactsModal customer={contactsTarget} onClose={() => setContactsTarget(null)} />}
    </div>
  );
}
