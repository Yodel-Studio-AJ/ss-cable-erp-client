"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Users, MapPin, Building2, Hash, FileText, Calendar } from "lucide-react";
import CustomerFormModal from "@/components/customers/CustomerFormModal";
import CustomerContactsModal from "@/components/customers/CustomerContactsModal";
import { useCustomerStore } from "@/store/customerStore";
import { getCustomer } from "@/api/customers";
import type { CustomerWithContacts } from "@/types/customer";

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-3" style={{ borderTop: "1px solid var(--color-border)" }}>
      <div style={{ color: "var(--color-text-muted)" }} className="mt-0.5 shrink-0">{icon}</div>
      <div>
        <p style={{ color: "var(--color-text-muted)" }} className="text-xs mb-0.5">{label}</p>
        <p style={{ color: "var(--color-text-primary)" }} className="text-sm">{value}</p>
      </div>
    </div>
  );
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const storeUpdate = useCustomerStore((s) => s.update);

  const [customer, setCustomer] = useState<CustomerWithContacts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [showContacts, setShowContacts] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getCustomer(id)
      .then((data) => { if (!cancelled) setCustomer(data); })
      .catch(() => { if (!cancelled) setError("Customer not found."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  function handleEditClose() {
    setShowEdit(false);
    // Refresh customer data after edit
    getCustomer(id).then((data) => {
      setCustomer(data);
      storeUpdate(data);
    }).catch(() => {});
  }

  if (loading) {
    return (
      <div className="space-y-5 max-w-2xl animate-pulse">
        <div className="flex items-center gap-3">
          <div className="h-4 rounded w-16" style={{ backgroundColor: "var(--color-border)" }} />
        </div>
        <div style={{ backgroundColor: "var(--color-bg-popup)", borderColor: "var(--color-border)" }}
          className="border rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full" style={{ backgroundColor: "var(--color-border)" }} />
            <div className="space-y-2">
              <div className="h-4 rounded w-48" style={{ backgroundColor: "var(--color-border)" }} />
              <div className="h-3 rounded w-24" style={{ backgroundColor: "var(--color-border)" }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="space-y-4">
        <button onClick={() => router.back()} style={{ color: "var(--color-text-secondary)" }}
          className="flex items-center gap-1.5 text-sm hover:opacity-70 transition-opacity">
          <ArrowLeft size={15} /> Back
        </button>
        <p className="text-red-500 text-sm">{error ?? "Customer not found."}</p>
      </div>
    );
  }

  const location = [customer.address, customer.city, customer.state, customer.pincode].filter(Boolean).join(", ");

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={() => router.back()} style={{ color: "var(--color-text-secondary)" }}
          className="flex items-center gap-1.5 text-sm hover:opacity-70 transition-opacity">
          <ArrowLeft size={15} /> Back
        </button>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowContacts(true)}
            style={{ borderColor: "var(--color-border)", color: "var(--color-text-secondary)" }}
            className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm hover:opacity-70 transition-opacity">
            <Users size={14} /> Contacts ({customer.contacts.length})
          </button>
          <button onClick={() => setShowEdit(true)}
            style={{ backgroundColor: "var(--color-btn-bg)", color: "var(--color-btn-text)" }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium hover:opacity-80 transition-opacity">
            <Pencil size={13} /> Edit
          </button>
        </div>
      </div>

      {/* Identity card */}
      <div style={{ backgroundColor: "var(--color-bg-popup)", borderColor: "var(--color-border)" }}
        className="border rounded-lg p-6">
        <div className="flex items-center gap-4 mb-4">
          <div style={{ backgroundColor: "var(--color-bg-initials)", color: "var(--color-text-initials)" }}
            className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold shrink-0">
            {customer.companyName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 style={{ color: "var(--color-text-primary)" }} className="text-xl font-bold">{customer.companyName}</h1>
            {customer.industry && (
              <p style={{ color: "var(--color-text-muted)" }} className="text-sm mt-0.5">{customer.industry}</p>
            )}
          </div>
        </div>

        <InfoRow icon={<Hash size={15} />} label="GSTIN" value={customer.gstin} />
        <InfoRow icon={<MapPin size={15} />} label="Location" value={location || null} />
        <InfoRow icon={<Calendar size={15} />} label="Added On" value={fmt(customer.createdAt)} />
        <InfoRow icon={<Calendar size={15} />} label="Last Updated" value={fmt(customer.updatedAt)} />
        {customer.notes && <InfoRow icon={<FileText size={15} />} label="Notes" value={customer.notes} />}
      </div>

      {/* Contacts preview */}
      {customer.contacts.length > 0 && (
        <div style={{ backgroundColor: "var(--color-bg-popup)", borderColor: "var(--color-border)" }}
          className="border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: `1px solid var(--color-border)` }}>
            <p style={{ color: "var(--color-text-primary)" }} className="text-sm font-medium">Contacts</p>
            <button onClick={() => setShowContacts(true)}
              style={{ color: "var(--color-text-muted)" }} className="text-xs underline hover:opacity-70">
              Manage
            </button>
          </div>
          {customer.contacts.map((c, i) => (
            <div key={c.id}
              style={{ borderTop: i > 0 ? `1px solid var(--color-border)` : undefined, backgroundColor: "var(--color-bg-page)" }}
              className="flex items-center gap-3 px-4 py-3">
              <div style={{ backgroundColor: "var(--color-bg-initials)", color: "var(--color-text-initials)" }}
                className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-semibold">
                {c.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span style={{ color: "var(--color-text-primary)" }} className="text-sm font-medium">{c.name}</span>
                  {c.isPrimary && (
                    <span className="text-[11px] text-amber-600">Primary</span>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  {c.designation && <span style={{ color: "var(--color-text-muted)" }} className="text-xs">{c.designation}</span>}
                  {c.phone && <span style={{ color: "var(--color-text-secondary)" }} className="text-xs">{c.phone}</span>}
                  {c.email && <span style={{ color: "var(--color-text-secondary)" }} className="text-xs">{c.email}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showEdit && <CustomerFormModal customer={customer} onClose={handleEditClose} />}
      {showContacts && (
        <CustomerContactsModal
          customer={customer}
          initialContacts={customer.contacts}
          onClose={() => setShowContacts(false)}
        />
      )}
    </div>
  );
}
