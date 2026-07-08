"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { createCustomer, updateCustomer } from "@/api/customers";
import { useCustomerStore } from "@/store/customerStore";
import type { Customer, CreateCustomerPayload } from "@/types/customer";
import type { AxiosError } from "axios";

const inputCls = "w-full border rounded-lg px-3 py-2 text-sm focus:outline-none transition-colors";
const inputStyle: React.CSSProperties = {
  backgroundColor: "var(--color-bg-input)",
  borderColor: "var(--color-border-input)",
  color: "var(--color-text-primary)",
};

interface Props {
  customer?: Customer;
  onClose: () => void;
}

export default function CustomerFormModal({ customer, onClose }: Props) {
  const add = useCustomerStore((s) => s.add);
  const update = useCustomerStore((s) => s.update);
  const mode = customer ? "edit" : "create";

  const [form, setForm] = useState<CreateCustomerPayload>({
    companyName: customer?.companyName ?? "",
    industry:    customer?.industry ?? "",
    gstin:       customer?.gstin ?? "",
    address:     customer?.address ?? "",
    city:        customer?.city ?? "",
    state:       customer?.state ?? "",
    pincode:     customer?.pincode ?? "",
    notes:       customer?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof CreateCustomerPayload) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [key]: e.target.value }));

  async function handleSave() {
    if (!form.companyName.trim()) return;
    setSaving(true); setError(null);
    try {
      const payload: CreateCustomerPayload = {
        companyName: form.companyName.trim(),
        industry:    form.industry || undefined,
        gstin:       form.gstin || undefined,
        address:     form.address || undefined,
        city:        form.city || undefined,
        state:       form.state || undefined,
        pincode:     form.pincode || undefined,
        notes:       form.notes || undefined,
      };
      if (mode === "create") {
        add(await createCustomer(payload));
      } else {
        update(await updateCustomer(customer!.id, payload));
      }
      onClose();
    } catch (err) {
      const e = err as AxiosError<{ message?: string }>;
      setError(e.response?.data?.message ?? "Failed to save customer.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={mode === "create" ? "New Customer" : "Edit Customer"} onClose={onClose} width="max-w-xl">
      <div className="space-y-3">
        {error && (
          <p className="text-red-500 text-xs bg-red-500/10 border border-red-500/20 rounded px-3 py-2">{error}</p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label style={{ color: "var(--color-text-muted)" }} className="block text-xs mb-1">Company Name *</label>
            <input type="text" value={form.companyName} onChange={set("companyName")}
              placeholder="Acme Cables Pvt. Ltd." style={inputStyle} className={inputCls} />
          </div>
          <div>
            <label style={{ color: "var(--color-text-muted)" }} className="block text-xs mb-1">Industry</label>
            <input type="text" value={form.industry ?? ""} onChange={set("industry")}
              placeholder="Manufacturing" style={inputStyle} className={inputCls} />
          </div>
          <div>
            <label style={{ color: "var(--color-text-muted)" }} className="block text-xs mb-1">GSTIN</label>
            <input type="text" value={form.gstin ?? ""} onChange={set("gstin")}
              placeholder="22AAAAA0000A1Z5" style={inputStyle} className={inputCls} />
          </div>
          <div className="col-span-2">
            <label style={{ color: "var(--color-text-muted)" }} className="block text-xs mb-1">Address</label>
            <input type="text" value={form.address ?? ""} onChange={set("address")}
              placeholder="123 Industrial Area" style={inputStyle} className={inputCls} />
          </div>
          <div>
            <label style={{ color: "var(--color-text-muted)" }} className="block text-xs mb-1">City</label>
            <input type="text" value={form.city ?? ""} onChange={set("city")}
              placeholder="Kolkata" style={inputStyle} className={inputCls} />
          </div>
          <div>
            <label style={{ color: "var(--color-text-muted)" }} className="block text-xs mb-1">State</label>
            <input type="text" value={form.state ?? ""} onChange={set("state")}
              placeholder="West Bengal" style={inputStyle} className={inputCls} />
          </div>
          <div>
            <label style={{ color: "var(--color-text-muted)" }} className="block text-xs mb-1">Pincode</label>
            <input type="text" value={form.pincode ?? ""} onChange={set("pincode")}
              placeholder="700001" style={inputStyle} className={inputCls} />
          </div>
        </div>
        <div>
          <label style={{ color: "var(--color-text-muted)" }} className="block text-xs mb-1">Notes</label>
          <textarea value={form.notes ?? ""} onChange={set("notes")}
            placeholder="Additional notes…" rows={3} style={inputStyle}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none transition-colors resize-none" />
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose}
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
  );
}
