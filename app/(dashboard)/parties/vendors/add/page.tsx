"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import { createVendor } from "@/api/vendors";
import type { CreateVendorPayload, VendorType } from "@/types/vendor";
import type { AxiosError } from "axios";

const inputCls = "w-full border rounded-lg px-3 py-2 text-sm focus:outline-none transition-colors";
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

const EMPTY: CreateVendorPayload = {
  companyName: "", vendorType: "trader", specialization: "", gstin: "",
  address: "", city: "", state: "", pincode: "",
  contactName: "", contactPhone: "", contactEmail: "", contactDesignation: "",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: "var(--color-bg-popup)", borderColor: "var(--color-border)" }}
      className="border rounded-lg p-5 space-y-3">
      <p style={{ color: "var(--color-text-muted)" }} className="text-xs font-semibold uppercase tracking-wider">
        {title}
      </p>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ color: "var(--color-text-muted)" }} className="block text-xs mb-1">{label}</label>
      {children}
    </div>
  );
}

export default function AddVendorPage() {
  const router = useRouter();
  const [form, setForm] = useState<CreateVendorPayload>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof CreateVendorPayload) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [key]: e.target.value }));

  async function handleSave() {
    if (!form.companyName.trim() || !form.contactName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const payload: CreateVendorPayload = {
        companyName:        form.companyName.trim(),
        vendorType:         form.vendorType,
        specialization:     form.specialization || undefined,
        gstin:              form.gstin || undefined,
        address:            form.address || undefined,
        city:               form.city || undefined,
        state:              form.state || undefined,
        pincode:            form.pincode || undefined,
        contactName:        form.contactName.trim(),
        contactPhone:       form.contactPhone || undefined,
        contactEmail:       form.contactEmail || undefined,
        contactDesignation: form.contactDesignation || undefined,
      };
      await createVendor(payload);
      router.replace("/parties/vendors");
    } catch (err) {
      const e = err as AxiosError<{ message?: string }>;
      setError(e.response?.data?.message ?? "Failed to create vendor.");
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={() => router.back()}
          style={{ color: "var(--color-text-secondary)" }}
          className="flex items-center gap-1.5 text-sm hover:opacity-70 transition-opacity">
          <ArrowLeft size={15} /> Back
        </button>
        <h1 style={{ color: "var(--color-text-primary)" }} className="text-base font-semibold">New Vendor</h1>
        <div className="w-16" />
      </div>

      {error && (
        <p className="text-red-500 text-sm bg-red-500/10 border border-red-500/20 rounded px-4 py-2">{error}</p>
      )}

      <Section title="Company">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Company Name *">
            <input type="text" value={form.companyName} onChange={set("companyName")}
              placeholder="Acme Cables Pvt. Ltd." style={inputStyle} className={`${inputCls} col-span-2`} />
          </Field>
          <Field label="Vendor Type">
            <select value={form.vendorType ?? "trader"} onChange={set("vendorType")}
              style={inputStyle} className={inputCls}>
              {(Object.keys(VENDOR_TYPE_LABELS) as VendorType[]).map((t) => (
                <option key={t} value={t}>{VENDOR_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </Field>
          <Field label="Specialization">
            <input type="text" value={form.specialization ?? ""} onChange={set("specialization")}
              placeholder="Copper wires, PVC cables…" style={inputStyle} className={inputCls} />
          </Field>
          <Field label="GSTIN">
            <input type="text" value={form.gstin ?? ""} onChange={set("gstin")}
              placeholder="22AAAAA0000A1Z5" style={inputStyle} className={inputCls} />
          </Field>
        </div>
      </Section>

      <Section title="Address">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Field label="Street Address">
              <input type="text" value={form.address ?? ""} onChange={set("address")}
                placeholder="123 Industrial Area" style={inputStyle} className={inputCls} />
            </Field>
          </div>
          <Field label="City">
            <input type="text" value={form.city ?? ""} onChange={set("city")}
              placeholder="Mumbai" style={inputStyle} className={inputCls} />
          </Field>
          <Field label="State">
            <input type="text" value={form.state ?? ""} onChange={set("state")}
              placeholder="Maharashtra" style={inputStyle} className={inputCls} />
          </Field>
          <Field label="Pincode">
            <input type="text" value={form.pincode ?? ""} onChange={set("pincode")}
              placeholder="400001" style={inputStyle} className={inputCls} />
          </Field>
        </div>
      </Section>

      <Section title="Primary Contact">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name *">
            <input type="text" value={form.contactName} onChange={set("contactName")}
              placeholder="Ravi Kumar" style={inputStyle} className={inputCls} />
          </Field>
          <Field label="Designation">
            <input type="text" value={form.contactDesignation ?? ""} onChange={set("contactDesignation")}
              placeholder="Sales Manager" style={inputStyle} className={inputCls} />
          </Field>
          <Field label="Phone">
            <input type="tel" value={form.contactPhone ?? ""} onChange={set("contactPhone")}
              placeholder="9876543210" style={inputStyle} className={inputCls} />
          </Field>
          <Field label="Email">
            <input type="email" value={form.contactEmail ?? ""} onChange={set("contactEmail")}
              placeholder="ravi@vendor.com" style={inputStyle} className={inputCls} />
          </Field>
        </div>
      </Section>

      {/* Actions */}
      <div className="flex gap-3 pb-4">
        <button onClick={() => router.back()}
          style={{ borderColor: "var(--color-border)", color: "var(--color-text-secondary)" }}
          className="flex-1 border rounded-lg py-2.5 text-sm hover:opacity-70 transition-opacity">
          Cancel
        </button>
        <button onClick={handleSave} disabled={saving || !form.companyName.trim() || !form.contactName.trim()}
          style={{ backgroundColor: "var(--color-btn-bg)", color: "var(--color-btn-text)" }}
          className="flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium hover:opacity-80 transition-opacity disabled:opacity-40">
          <Save size={14} />
          {saving ? "Creating…" : "Create Vendor"}
        </button>
      </div>
    </div>
  );
}
