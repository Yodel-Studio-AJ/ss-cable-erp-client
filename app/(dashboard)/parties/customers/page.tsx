"use client";

import { useEffect, useState, useMemo } from "react";
import { Plus, Pencil, Trash2, Users, Star, Search, MapPin, Phone, Mail, Briefcase } from "lucide-react";
import Modal from "@/components/ui/Modal";
import PermissionDenied from "@/components/ui/PermissionDenied";
import {
  getCustomers, createCustomer, updateCustomer, deleteCustomer,
  getContacts, createContact, updateContact, deleteContact,
} from "@/api/customers";
import type { Customer, CustomerContact, CreateCustomerPayload, CreateContactPayload } from "@/types/customer";
import type { AxiosError } from "axios";

const inputCls = "w-full border rounded-lg px-3 py-2 text-sm focus:outline-none transition-colors";
const inputStyle: React.CSSProperties = {
  backgroundColor: "var(--color-bg-input)",
  borderColor: "var(--color-border-input)",
  color: "var(--color-text-primary)",
};

const EMPTY_FORM: CreateCustomerPayload = {
  companyName: "", industry: "", gstin: "", address: "", city: "", state: "", pincode: "", notes: "",
};

const EMPTY_CONTACT: CreateContactPayload = {
  name: "", phone: "", email: "", designation: "", isPrimary: false,
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  // Search
  const [search, setSearch] = useState("");

  // Customer create/edit modal
  const [customerModal, setCustomerModal] = useState<"create" | "edit" | null>(null);
  const [editTarget, setEditTarget] = useState<Customer | null>(null);
  const [form, setForm] = useState<CreateCustomerPayload>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Contacts modal
  const [contactsTarget, setContactsTarget] = useState<Customer | null>(null);
  const [contacts, setContacts] = useState<CustomerContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactForm, setContactForm] = useState<CreateContactPayload>(EMPTY_CONTACT);
  const [editContact, setEditContact] = useState<CustomerContact | null>(null);
  const [showContactForm, setShowContactForm] = useState(false);
  const [savingContact, setSavingContact] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const data = await getCustomers();
        if (!cancelled) setCustomers(data);
      } catch (err) {
        if (!cancelled) {
          const status = (err as AxiosError).response?.status;
          if (status === 403) setPermissionDenied(true);
          else setError("Failed to load customers.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

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

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditTarget(null);
    setFormError(null);
    setCustomerModal("create");
  }

  function openEdit(c: Customer) {
    setForm({
      companyName: c.companyName,
      industry:    c.industry ?? "",
      gstin:       c.gstin ?? "",
      address:     c.address ?? "",
      city:        c.city ?? "",
      state:       c.state ?? "",
      pincode:     c.pincode ?? "",
      notes:       c.notes ?? "",
    });
    setEditTarget(c);
    setFormError(null);
    setCustomerModal("edit");
  }

  async function handleSave() {
    if (!form.companyName.trim()) return;
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        companyName: form.companyName.trim(),
        industry:    form.industry || undefined,
        gstin:       form.gstin || undefined,
        address:     form.address || undefined,
        city:        form.city || undefined,
        state:       form.state || undefined,
        pincode:     form.pincode || undefined,
        notes:       form.notes || undefined,
      };
      if (customerModal === "create") {
        const created = await createCustomer(payload);
        setCustomers((p) => [created, ...p]);
      } else if (editTarget) {
        const updated = await updateCustomer(editTarget.id, payload);
        setCustomers((p) => p.map((c) => (c.id === updated.id ? updated : c)));
      }
      setCustomerModal(null);
    } catch (err) {
      const e = err as AxiosError<{ message?: string }>;
      setFormError(e.response?.data?.message ?? "Failed to save customer.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this customer? All contacts will also be removed.")) return;
    try {
      await deleteCustomer(id);
      setCustomers((p) => p.filter((c) => c.id !== id));
    } catch {
      setError("Failed to delete customer.");
    }
  }

  async function openContacts(c: Customer) {
    setContactsTarget(c);
    setContactsLoading(true);
    setContacts([]);
    setShowContactForm(false);
    setEditContact(null);
    setContactError(null);
    try {
      const data = await getContacts(c.id);
      setContacts(data);
    } catch {
      setContactError("Failed to load contacts.");
    } finally {
      setContactsLoading(false);
    }
  }

  function openAddContact() {
    setEditContact(null);
    setContactForm(EMPTY_CONTACT);
    setContactError(null);
    setShowContactForm(true);
  }

  function openEditContact(contact: CustomerContact) {
    setEditContact(contact);
    setContactForm({
      name:        contact.name,
      phone:       contact.phone ?? "",
      email:       contact.email ?? "",
      designation: contact.designation ?? "",
      isPrimary:   contact.isPrimary,
    });
    setContactError(null);
    setShowContactForm(true);
  }

  async function handleSaveContact() {
    if (!contactsTarget || !contactForm.name.trim()) return;
    setSavingContact(true);
    setContactError(null);
    try {
      const payload = {
        name:        contactForm.name.trim(),
        phone:       contactForm.phone || undefined,
        email:       contactForm.email || undefined,
        designation: contactForm.designation || undefined,
        isPrimary:   contactForm.isPrimary,
      };
      if (editContact) {
        const updated = await updateContact(contactsTarget.id, editContact.id, payload);
        setContacts((p) => p.map((c) => (c.id === updated.id ? updated : c)));
      } else {
        const created = await createContact(contactsTarget.id, payload);
        setContacts((p) => [...p, created]);
      }
      setShowContactForm(false);
      setEditContact(null);
    } catch (err) {
      const e = err as AxiosError<{ message?: string }>;
      setContactError(e.response?.data?.message ?? "Failed to save contact.");
    } finally {
      setSavingContact(false);
    }
  }

  async function handleDeleteContact(contactId: string) {
    if (!contactsTarget) return;
    try {
      await deleteContact(contactsTarget.id, contactId);
      setContacts((p) => p.filter((c) => c.id !== contactId));
    } catch {
      setContactError("Failed to delete contact.");
    }
  }

  if (permissionDenied) return <PermissionDenied />;

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 style={{ color: "var(--color-text-primary)" }} className="text-xl font-bold">Customers</h1>
          <p style={{ color: "var(--color-text-muted)" }} className="text-sm mt-0.5">
            {search ? `${filtered.length} of ${customers.length}` : customers.length}{" "}
            {customers.length === 1 ? "customer" : "customers"}
          </p>
        </div>
        <button
          onClick={openCreate}
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
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--color-text-muted)" }} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search customers…"
          style={inputStyle}
          className="w-full border rounded-lg pl-8 pr-3 py-1.5 text-sm focus:outline-none transition-colors"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-bg-popup)" }}
          className="border rounded overflow-hidden">
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: "var(--color-btn-bg)" }}>
                {["Company", "Industry", "GSTIN", "Location", "Actions"].map((h, i) => (
                  <th key={h} style={{ color: "var(--color-btn-text)" }}
                    className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider ${i === 4 ? "text-right" : "text-left"}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse" style={{ borderTop: i > 0 ? `1px solid var(--color-border)` : undefined }}>
                  <td className="px-4 py-3.5"><div className="h-3 rounded w-36" style={{ backgroundColor: "var(--color-border)" }} /></td>
                  <td className="px-4 py-3.5"><div className="h-3 rounded w-24" style={{ backgroundColor: "var(--color-border)" }} /></td>
                  <td className="px-4 py-3.5"><div className="h-3 rounded w-28" style={{ backgroundColor: "var(--color-border)" }} /></td>
                  <td className="px-4 py-3.5"><div className="h-3 rounded w-20" style={{ backgroundColor: "var(--color-border)" }} /></td>
                  <td className="px-4 py-3.5"><div className="flex justify-end gap-1"><div className="w-6 h-6 rounded" style={{ backgroundColor: "var(--color-border)" }} /></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : customers.length === 0 ? (
        <div style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}
          className="border-2 border-dashed rounded py-16 text-center text-sm">
          No customers yet.{" "}
          <button onClick={openCreate} className="underline hover:opacity-70">Add your first customer.</button>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}
          className="border-2 border-dashed rounded py-16 text-center text-sm">
          No customers match your search.{" "}
          <button onClick={() => setSearch("")} className="underline hover:opacity-70">Clear search</button>
        </div>
      ) : (
        <div style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-bg-popup)" }}
          className="border rounded overflow-hidden">
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: "var(--color-btn-bg)" }}>
                {["Company", "Industry", "GSTIN", "Location", "Actions"].map((h, i) => (
                  <th key={h} style={{ color: "var(--color-btn-text)" }}
                    className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider whitespace-nowrap ${i === 4 ? "text-right" : "text-left"}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <tr key={c.id}
                  style={{
                    borderTop: i > 0 ? `1px solid var(--color-border)` : undefined,
                    backgroundColor: "var(--color-bg-page)",
                  }}>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span style={{ color: "var(--color-text-primary)" }} className="text-sm font-medium">{c.companyName}</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {c.industry
                      ? <span style={{ color: "var(--color-text-secondary)" }} className="text-sm flex items-center gap-1.5"><Briefcase size={12} className="shrink-0" />{c.industry}</span>
                      : <span style={{ color: "var(--color-text-muted)" }} className="text-sm">—</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span style={{ color: "var(--color-text-secondary)" }} className="text-xs font-mono">
                      {c.gstin || <span style={{ color: "var(--color-text-muted)" }}>—</span>}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {(c.city || c.state)
                      ? <span style={{ color: "var(--color-text-secondary)" }} className="text-sm flex items-center gap-1.5"><MapPin size={12} className="shrink-0" />{[c.city, c.state].filter(Boolean).join(", ")}</span>
                      : <span style={{ color: "var(--color-text-muted)" }} className="text-sm">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-0.5 justify-end">
                      <button onClick={() => openContacts(c)} title="Manage contacts"
                        style={{ color: "var(--color-text-secondary)" }}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium hover:opacity-70 transition-opacity">
                        <Users size={12} /> Contacts
                      </button>
                      <button onClick={() => openEdit(c)} title="Edit"
                        style={{ color: "var(--color-text-muted)" }}
                        className="p-1.5 rounded hover:opacity-70 transition-opacity">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => handleDelete(c.id)} title="Delete"
                        className="p-1.5 rounded text-red-400 hover:opacity-70 transition-opacity">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit customer modal */}
      {customerModal && (
        <Modal title={customerModal === "create" ? "New Customer" : "Edit Customer"} onClose={() => setCustomerModal(null)} width="max-w-xl">
          <div className="space-y-3">
            {formError && (
              <p className="text-red-500 text-xs bg-red-500/10 border border-red-500/20 rounded px-3 py-2">{formError}</p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label style={{ color: "var(--color-text-muted)" }} className="block text-xs mb-1">Company Name *</label>
                <input type="text" value={form.companyName} onChange={(e) => setForm((p) => ({ ...p, companyName: e.target.value }))}
                  placeholder="Acme Cables Pvt. Ltd." style={inputStyle} className={inputCls} />
              </div>
              <div>
                <label style={{ color: "var(--color-text-muted)" }} className="block text-xs mb-1">Industry</label>
                <input type="text" value={form.industry ?? ""} onChange={(e) => setForm((p) => ({ ...p, industry: e.target.value }))}
                  placeholder="Manufacturing" style={inputStyle} className={inputCls} />
              </div>
              <div>
                <label style={{ color: "var(--color-text-muted)" }} className="block text-xs mb-1">GSTIN</label>
                <input type="text" value={form.gstin ?? ""} onChange={(e) => setForm((p) => ({ ...p, gstin: e.target.value }))}
                  placeholder="22AAAAA0000A1Z5" style={inputStyle} className={inputCls} />
              </div>
              <div className="col-span-2">
                <label style={{ color: "var(--color-text-muted)" }} className="block text-xs mb-1">Address</label>
                <input type="text" value={form.address ?? ""} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                  placeholder="123 Industrial Area" style={inputStyle} className={inputCls} />
              </div>
              <div>
                <label style={{ color: "var(--color-text-muted)" }} className="block text-xs mb-1">City</label>
                <input type="text" value={form.city ?? ""} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
                  placeholder="Kolkata" style={inputStyle} className={inputCls} />
              </div>
              <div>
                <label style={{ color: "var(--color-text-muted)" }} className="block text-xs mb-1">State</label>
                <input type="text" value={form.state ?? ""} onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))}
                  placeholder="West Bengal" style={inputStyle} className={inputCls} />
              </div>
              <div>
                <label style={{ color: "var(--color-text-muted)" }} className="block text-xs mb-1">Pincode</label>
                <input type="text" value={form.pincode ?? ""} onChange={(e) => setForm((p) => ({ ...p, pincode: e.target.value }))}
                  placeholder="700001" style={inputStyle} className={inputCls} />
              </div>
            </div>
            <div>
              <label style={{ color: "var(--color-text-muted)" }} className="block text-xs mb-1">Notes</label>
              <textarea value={form.notes ?? ""} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Additional notes about this customer…"
                rows={3} style={inputStyle}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none transition-colors resize-none" />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setCustomerModal(null)}
                style={{ borderColor: "var(--color-border)", color: "var(--color-text-secondary)" }}
                className="flex-1 border rounded-lg py-2 text-sm hover:opacity-70 transition-opacity">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving || !form.companyName.trim()}
                style={{ backgroundColor: "var(--color-btn-bg)", color: "var(--color-btn-text)" }}
                className="flex-1 rounded-lg py-2 text-sm font-medium hover:opacity-80 transition-opacity disabled:opacity-40">
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Contacts modal */}
      {contactsTarget && (
        <Modal title={`${contactsTarget.companyName} — Contacts`} onClose={() => setContactsTarget(null)} width="max-w-2xl">
          <div className="space-y-4">
            {contactError && (
              <p className="text-red-500 text-xs bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
                {contactError}
                <button onClick={() => setContactError(null)} className="ml-2 underline">dismiss</button>
              </p>
            )}

            {!showContactForm && (
              <div className="flex items-center justify-between">
                <p style={{ color: "var(--color-text-muted)" }} className="text-sm">
                  {contacts.length} contact{contacts.length !== 1 ? "s" : ""}
                </p>
                <button onClick={openAddContact}
                  style={{ backgroundColor: "var(--color-btn-bg)", color: "var(--color-btn-text)" }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-80 transition-opacity">
                  <Plus size={13} /> Add Contact
                </button>
              </div>
            )}

            {/* Contact form */}
            {showContactForm && (
              <div style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-bg-input)" }}
                className="border rounded-lg p-4 space-y-3">
                <p style={{ color: "var(--color-text-primary)" }} className="text-sm font-medium">
                  {editContact ? "Edit Contact" : "New Contact"}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label style={{ color: "var(--color-text-muted)" }} className="block text-xs mb-1">Name *</label>
                    <input type="text" value={contactForm.name} onChange={(e) => setContactForm((p) => ({ ...p, name: e.target.value }))}
                      placeholder="Ravi Kumar" style={inputStyle} className={inputCls} />
                  </div>
                  <div>
                    <label style={{ color: "var(--color-text-muted)" }} className="block text-xs mb-1">Phone</label>
                    <input type="tel" value={contactForm.phone ?? ""} onChange={(e) => setContactForm((p) => ({ ...p, phone: e.target.value }))}
                      placeholder="9876543210" style={inputStyle} className={inputCls} />
                  </div>
                  <div>
                    <label style={{ color: "var(--color-text-muted)" }} className="block text-xs mb-1">Email</label>
                    <input type="email" value={contactForm.email ?? ""} onChange={(e) => setContactForm((p) => ({ ...p, email: e.target.value }))}
                      placeholder="ravi@example.com" style={inputStyle} className={inputCls} />
                  </div>
                  <div>
                    <label style={{ color: "var(--color-text-muted)" }} className="block text-xs mb-1">Designation</label>
                    <input type="text" value={contactForm.designation ?? ""} onChange={(e) => setContactForm((p) => ({ ...p, designation: e.target.value }))}
                      placeholder="Purchase Manager" style={inputStyle} className={inputCls} />
                  </div>
                  <div className="flex items-end pb-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={contactForm.isPrimary ?? false} onChange={(e) => setContactForm((p) => ({ ...p, isPrimary: e.target.checked }))}
                        className="h-4 w-4 rounded cursor-pointer" />
                      <span style={{ color: "var(--color-text-secondary)" }} className="text-sm">Primary contact</span>
                    </label>
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={() => { setShowContactForm(false); setEditContact(null); }}
                    style={{ borderColor: "var(--color-border)", color: "var(--color-text-secondary)" }}
                    className="flex-1 border rounded-lg py-1.5 text-sm hover:opacity-70 transition-opacity">
                    Cancel
                  </button>
                  <button onClick={handleSaveContact} disabled={savingContact || !contactForm.name.trim()}
                    style={{ backgroundColor: "var(--color-btn-bg)", color: "var(--color-btn-text)" }}
                    className="flex-1 rounded-lg py-1.5 text-sm font-medium hover:opacity-80 transition-opacity disabled:opacity-40">
                    {savingContact ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            )}

            {/* Contacts list */}
            {contactsLoading ? (
              <p style={{ color: "var(--color-text-muted)" }} className="text-sm text-center py-8">Loading…</p>
            ) : contacts.length === 0 && !showContactForm ? (
              <p style={{ color: "var(--color-text-muted)" }} className="text-sm text-center py-8">No contacts yet.</p>
            ) : contacts.length > 0 && (
              <div style={{ borderColor: "var(--color-border)" }} className="border rounded overflow-hidden">
                {contacts.map((contact, i) => (
                  <div key={contact.id}
                    style={{ borderTopColor: "var(--color-border)", backgroundColor: "var(--color-bg-page)" }}
                    className={`flex items-start gap-3 px-4 py-3 ${i > 0 ? "border-t" : ""}`}>
                    <div style={{ backgroundColor: "var(--color-bg-initials)", color: "var(--color-text-initials)" }}
                      className="w-8 h-8 rounded shrink-0 flex items-center justify-center text-xs font-semibold mt-0.5">
                      {contact.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span style={{ color: "var(--color-text-primary)" }} className="text-sm font-medium">{contact.name}</span>
                        {contact.isPrimary && (
                          <span className="flex items-center gap-0.5 text-[11px] text-amber-600">
                            <Star size={10} fill="currentColor" /> Primary
                          </span>
                        )}
                        {contact.designation && (
                          <span style={{ color: "var(--color-text-muted)" }} className="text-xs">{contact.designation}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        {contact.phone && (
                          <span style={{ color: "var(--color-text-secondary)" }} className="text-xs flex items-center gap-1">
                            <Phone size={10} />{contact.phone}
                          </span>
                        )}
                        {contact.email && (
                          <span style={{ color: "var(--color-text-secondary)" }} className="text-xs flex items-center gap-1">
                            <Mail size={10} />{contact.email}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => openEditContact(contact)}
                        style={{ color: "var(--color-text-muted)" }}
                        className="p-1.5 rounded hover:opacity-70 transition-opacity">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => handleDeleteContact(contact.id)}
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
      )}
    </div>
  );
}
