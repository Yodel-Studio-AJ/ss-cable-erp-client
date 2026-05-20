import { useState } from "react";
import Modal from "@/components/ui/Modal";
import type { SubCompany } from "@/types/subCompany";

export interface BranchFormPayload {
  name:     string;
  address?: string;
  city?:    string;
  phone?:   string;
}

interface Props {
  mode:    "create" | "edit";
  initial?: SubCompany;
  onSave:  (payload: BranchFormPayload) => Promise<void>;
  onClose: () => void;
}

const inputCls = "w-full border rounded-lg px-3 py-2 text-sm focus:outline-none transition-colors";
const inputStyle: React.CSSProperties = {
  backgroundColor: "var(--color-bg-input)",
  borderColor:     "var(--color-border-input)",
  color:           "var(--color-text-primary)",
};

const FIELDS = [
  { label: "Branch Name *", key: "name",    placeholder: "SS Cable — Kolkata North" },
  { label: "Address",       key: "address", placeholder: "123 Main St" },
  { label: "City",          key: "city",    placeholder: "Kolkata" },
  { label: "Phone",         key: "phone",   placeholder: "+91 98765 43210" },
] as const;

type FormKey = typeof FIELDS[number]["key"];
type FormState = Record<FormKey, string>;

export default function BranchFormModal({ mode, initial, onSave, onClose }: Props) {
  const [form, setForm] = useState<FormState>({
    name:    initial?.name    ?? "",
    address: initial?.address ?? "",
    city:    initial?.city    ?? "",
    phone:   initial?.phone   ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await onSave({
        name:    form.name.trim(),
        address: form.address || undefined,
        city:    form.city    || undefined,
        phone:   form.phone   || undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={mode === "create" ? "New Branch" : "Edit Branch"} onClose={onClose}>
      <div className="space-y-3">
        {FIELDS.map(({ label, key, placeholder }) => (
          <div key={key}>
            <label style={{ color: "var(--color-text-muted)" }} className="block text-xs mb-1">
              {label}
            </label>
            <input
              type="text"
              value={form[key]}
              onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
              placeholder={placeholder}
              style={inputStyle}
              className={inputCls}
            />
          </div>
        ))}

        <div className="flex gap-2 pt-2">
          <button
            onClick={onClose}
            style={{ borderColor: "var(--color-border)", color: "var(--color-text-secondary)" }}
            className="flex-1 border rounded-lg py-2 text-sm hover:opacity-70 transition-opacity">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.name.trim()}
            style={{ backgroundColor: "var(--color-btn-bg)", color: "var(--color-btn-text)" }}
            className="flex-1 rounded-lg py-2 text-sm font-medium hover:opacity-80 transition-opacity disabled:opacity-40">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
