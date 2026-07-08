"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Star, Phone, Mail } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { getContacts, createContact, updateContact, deleteContact } from "@/api/customers";
import type { Customer, CustomerContact, CreateContactPayload } from "@/types/customer";
import type { AxiosError } from "axios";

const inputCls = "w-full border rounded-lg px-3 py-2 text-sm focus:outline-none transition-colors";
const inputStyle: React.CSSProperties = {
  backgroundColor: "var(--color-bg-input)",
  borderColor: "var(--color-border-input)",
  color: "var(--color-text-primary)",
};

const EMPTY: CreateContactPayload = { name: "", phone: "", email: "", designation: "", isPrimary: false };

interface Props {
  customer: Customer;
  onClose: () => void;
  initialContacts?: CustomerContact[];
}

export default function CustomerContactsModal({ customer, onClose, initialContacts }: Props) {
  const [contacts, setContacts] = useState<CustomerContact[]>(initialContacts ?? []);
  const [loading, setLoading] = useState(!initialContacts);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<CustomerContact | null>(null);
  const [form, setForm] = useState<CreateContactPayload>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialContacts) return;
    let cancelled = false;
    getContacts(customer.id)
      .then((data) => { if (!cancelled) setContacts(data); })
      .catch(() => { if (!cancelled) setError("Failed to load contacts."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [customer.id, initialContacts]);

  function openAdd() {
    setEditTarget(null); setForm(EMPTY); setError(null); setShowForm(true);
  }

  function openEdit(c: CustomerContact) {
    setEditTarget(c);
    setForm({ name: c.name, phone: c.phone ?? "", email: c.email ?? "", designation: c.designation ?? "", isPrimary: c.isPrimary });
    setError(null); setShowForm(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true); setError(null);
    try {
      const payload = {
        name: form.name.trim(), phone: form.phone || undefined,
        email: form.email || undefined, designation: form.designation || undefined,
        isPrimary: form.isPrimary,
      };
      if (editTarget) {
        const updated = await updateContact(customer.id, editTarget.id, payload);
        setContacts((p) => p.map((c) => (c.id === updated.id ? updated : c)));
      } else {
        const created = await createContact(customer.id, payload);
        setContacts((p) => [...p, created]);
      }
      setShowForm(false); setEditTarget(null);
    } catch (err) {
      const e = err as AxiosError<{ message?: string }>;
      setError(e.response?.data?.message ?? "Failed to save contact.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(contactId: string) {
    try {
      await deleteContact(customer.id, contactId);
      setContacts((p) => p.filter((c) => c.id !== contactId));
    } catch {
      setError("Failed to delete contact.");
    }
  }

  return (
    <Modal title={`${customer.companyName} — Contacts`} onClose={onClose} width="max-w-2xl">
      <div className="space-y-4">
        {error && (
          <p className="text-red-500 text-xs bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline">dismiss</button>
          </p>
        )}

        {!showForm && (
          <div className="flex items-center justify-between">
            <p style={{ color: "var(--color-text-muted)" }} className="text-sm">
              {contacts.length} contact{contacts.length !== 1 ? "s" : ""}
            </p>
            <button onClick={openAdd}
              style={{ backgroundColor: "var(--color-btn-bg)", color: "var(--color-btn-text)" }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-80 transition-opacity">
              <Plus size={13} /> Add Contact
            </button>
          </div>
        )}

        {showForm && (
          <div style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-bg-input)" }}
            className="border rounded-lg p-4 space-y-3">
            <p style={{ color: "var(--color-text-primary)" }} className="text-sm font-medium">
              {editTarget ? "Edit Contact" : "New Contact"}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label style={{ color: "var(--color-text-muted)" }} className="block text-xs mb-1">Name *</label>
                <input type="text" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Ravi Kumar" style={inputStyle} className={inputCls} />
              </div>
              <div>
                <label style={{ color: "var(--color-text-muted)" }} className="block text-xs mb-1">Phone</label>
                <input type="tel" value={form.phone ?? ""} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="9876543210" style={inputStyle} className={inputCls} />
              </div>
              <div>
                <label style={{ color: "var(--color-text-muted)" }} className="block text-xs mb-1">Email</label>
                <input type="email" value={form.email ?? ""} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="ravi@example.com" style={inputStyle} className={inputCls} />
              </div>
              <div>
                <label style={{ color: "var(--color-text-muted)" }} className="block text-xs mb-1">Designation</label>
                <input type="text" value={form.designation ?? ""} onChange={(e) => setForm((p) => ({ ...p, designation: e.target.value }))}
                  placeholder="Purchase Manager" style={inputStyle} className={inputCls} />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.isPrimary ?? false}
                    onChange={(e) => setForm((p) => ({ ...p, isPrimary: e.target.checked }))}
                    className="h-4 w-4 rounded cursor-pointer" />
                  <span style={{ color: "var(--color-text-secondary)" }} className="text-sm">Primary contact</span>
                </label>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => { setShowForm(false); setEditTarget(null); }}
                style={{ borderColor: "var(--color-border)", color: "var(--color-text-secondary)" }}
                className="flex-1 border rounded-lg py-1.5 text-sm hover:opacity-70 transition-opacity">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving || !form.name.trim()}
                style={{ backgroundColor: "var(--color-btn-bg)", color: "var(--color-btn-text)" }}
                className="flex-1 rounded-lg py-1.5 text-sm font-medium hover:opacity-80 transition-opacity disabled:opacity-40">
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <p style={{ color: "var(--color-text-muted)" }} className="text-sm text-center py-8">Loading…</p>
        ) : contacts.length === 0 && !showForm ? (
          <p style={{ color: "var(--color-text-muted)" }} className="text-sm text-center py-8">No contacts yet.</p>
        ) : contacts.length > 0 && (
          <div style={{ borderColor: "var(--color-border)" }} className="border rounded overflow-hidden">
            {contacts.map((c, i) => (
              <div key={c.id}
                style={{ borderTopColor: "var(--color-border)", backgroundColor: "var(--color-bg-page)" }}
                className={`flex items-start gap-3 px-4 py-3 ${i > 0 ? "border-t" : ""}`}>
                <div style={{ backgroundColor: "var(--color-bg-initials)", color: "var(--color-text-initials)" }}
                  className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-semibold mt-0.5">
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span style={{ color: "var(--color-text-primary)" }} className="text-sm font-medium">{c.name}</span>
                    {c.isPrimary && (
                      <span className="flex items-center gap-0.5 text-[11px] text-amber-600">
                        <Star size={10} fill="currentColor" /> Primary
                      </span>
                    )}
                    {c.designation && <span style={{ color: "var(--color-text-muted)" }} className="text-xs">{c.designation}</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    {c.phone && <span style={{ color: "var(--color-text-secondary)" }} className="text-xs flex items-center gap-1"><Phone size={10} />{c.phone}</span>}
                    {c.email && <span style={{ color: "var(--color-text-secondary)" }} className="text-xs flex items-center gap-1"><Mail size={10} />{c.email}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEdit(c)} style={{ color: "var(--color-text-muted)" }}
                    className="p-1.5 rounded hover:opacity-70 transition-opacity">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => handleDelete(c.id)}
                    className="p-1.5 rounded text-red-400 hover:opacity-70 transition-opacity">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
