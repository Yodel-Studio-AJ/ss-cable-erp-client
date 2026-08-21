"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Save, AlertCircle, CheckCircle, X } from "lucide-react";
import { getVendor, updateVendor } from "@/api-client/vendors";
import type { UpdateVendorPayload, VendorType } from "@/types/vendor";
import type { AxiosError } from "axios";

const inputCls = "w-full border rounded-lg px-3 py-2 text-sm focus:outline-none transition-colors";
const inputStyle: React.CSSProperties = {
  backgroundColor: "var(--color-bg-input)",
  borderColor:     "var(--color-border-input)",
  color:           "var(--color-text-primary)",
};
const inputErrorStyle: React.CSSProperties = {
  ...inputStyle,
  borderColor: "#ef4444",
};

const FIELD_LABELS: Record<string, string> = {
  companyName:        "Company Name",
  vendorType:         "Vendor Type",
  specialization:     "Specialization",
  gstin:              "GSTIN",
  address:            "Street Address",
  city:               "City",
  state:              "State",
  pincode:            "Pincode",
  contactName:        "Contact Name",
  contactPhone:       "Phone",
  contactEmail:       "Email",
  contactDesignation: "Designation",
};

const VENDOR_TYPE_LABELS: Record<VendorType, string> = {
  manufacturer: "Manufacturer",
  distributor:  "Distributor",
  wholesaler:   "Wholesaler",
  trader:       "Trader",
};

// ─── toast ────────────────────────────────────────────────────────────────────

interface Toast { id: number; type: "error" | "success"; message: string; details?: string[] }

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <div key={t.id}
          className="flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm"
          style={{
            backgroundColor: t.type === "error"
              ? "color-mix(in srgb, #ef4444 12%, var(--color-bg-popup))"
              : "color-mix(in srgb, #22c55e 12%, var(--color-bg-popup))",
            borderColor: t.type === "error"
              ? "color-mix(in srgb, #ef4444 40%, transparent)"
              : "color-mix(in srgb, #22c55e 40%, transparent)",
            color: t.type === "error" ? "#ef4444" : "#22c55e",
          }}>
          {t.type === "error"
            ? <AlertCircle size={15} className="shrink-0 mt-0.5" />
            : <CheckCircle size={15} className="shrink-0 mt-0.5" />}
          <div className="flex-1 min-w-0">
            <p className="font-medium">{t.message}</p>
            {t.details && t.details.length > 0 && (
              <ul className="mt-1 space-y-0.5 text-xs opacity-90">
                {t.details.map((d, i) => <li key={i}>• {d}</li>)}
              </ul>
            )}
          </div>
          <button onClick={() => onDismiss(t.id)} className="shrink-0 opacity-60 hover:opacity-100 transition-opacity">
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);
  function push(type: Toast["type"], message: string, details?: string[]) {
    const id = ++counter.current;
    setToasts((prev) => [...prev, { id, type, message, details }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 6000);
  }
  function dismiss(id: number) { setToasts((prev) => prev.filter((t) => t.id !== id)); }
  return { toasts, push, dismiss };
}

function parseFieldErrors(err: AxiosError<any>): Record<string, string> {
  const fieldErrors: Record<string, string[]> = err.response?.data?.errors?.fieldErrors ?? {};
  const result: Record<string, string> = {};
  for (const [key, msgs] of Object.entries(fieldErrors)) {
    if (Array.isArray(msgs) && msgs.length > 0) result[key] = msgs[0];
  }
  return result;
}

function fieldErrorDetails(fieldErrors: Record<string, string>): string[] {
  return Object.entries(fieldErrors).map(([k, v]) => `${FIELD_LABELS[k] ?? k}: ${v}`);
}

// ─── components ───────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: "var(--color-bg-popup)", borderColor: "var(--color-border)" }}
      className="border rounded-xl p-5 space-y-3">
      <p style={{ color: "var(--color-text-muted)" }} className="text-xs font-semibold uppercase tracking-wider">
        {title}
      </p>
      {children}
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs mb-1"
        style={{ color: error ? "#ef4444" : "var(--color-text-muted)" }}>
        {label}
      </label>
      {children}
      {error && (
        <p className="text-xs mt-1 flex items-center gap-1" style={{ color: "#ef4444" }}>
          <AlertCircle size={10} /> {error}
        </p>
      )}
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function EditVendorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [form, setForm]           = useState<UpdateVendorPayload>({});
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [fieldErrors, setFE]      = useState<Record<string, string>>({});
  const { toasts, push, dismiss } = useToast();

  useEffect(() => {
    async function load() {
      try {
        const v = await getVendor(id);
        setForm({
          companyName:        v.companyName,
          vendorType:         v.vendorType,
          specialization:     v.specialization ?? "",
          gstin:              v.gstin ?? "",
          address:            v.address ?? "",
          city:               v.city ?? "",
          state:              v.state ?? "",
          pincode:            v.pincode ?? "",
          contactName:        v.contactName,
          contactPhone:       v.contactPhone ?? "",
          contactEmail:       v.contactEmail ?? "",
          contactDesignation: v.contactDesignation ?? "",
        });
      } catch {
        push("error", "Failed to load vendor.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const set = (key: keyof UpdateVendorPayload) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm((p) => ({ ...p, [key]: e.target.value }));
      if (fieldErrors[key]) setFE((p) => { const n = { ...p }; delete n[key]; return n; });
    };

  function validate(): Record<string, string> {
    const errs: Record<string, string> = {};
    if (!form.companyName?.trim()) errs.companyName = "Company name is required";
    if (!form.contactName?.trim()) errs.contactName = "Contact name is required";
    const email = form.contactEmail?.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errs.contactEmail = "Must be a valid email address";
    }
    return errs;
  }

  async function handleSave() {
    const clientErrs = validate();
    if (Object.keys(clientErrs).length > 0) {
      setFE(clientErrs);
      push("error", "Please fix the highlighted fields", fieldErrorDetails(clientErrs));
      return;
    }

    setSaving(true);
    setFE({});
    try {
      await updateVendor(id, {
        companyName:        form.companyName!.trim(),
        vendorType:         form.vendorType,
        specialization:     form.specialization?.trim() || undefined,
        gstin:              form.gstin?.trim() || undefined,
        address:            form.address?.trim() || undefined,
        city:               form.city?.trim() || undefined,
        state:              form.state?.trim() || undefined,
        pincode:            form.pincode?.trim() || undefined,
        contactName:        form.contactName!.trim(),
        contactPhone:       form.contactPhone?.trim() || undefined,
        contactEmail:       form.contactEmail?.trim() || undefined,
        contactDesignation: form.contactDesignation?.trim() || undefined,
      });
      router.replace("/parties/vendors");
    } catch (err) {
      const axErr = err as AxiosError<any>;
      const fe = parseFieldErrors(axErr);
      if (Object.keys(fe).length > 0) {
        setFE(fe);
        push("error", "Could not save vendor", fieldErrorDetails(fe));
      } else {
        const msg = axErr.response?.data?.message ?? "Failed to save vendor.";
        push("error", msg);
      }
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center justify-between">
        <button onClick={() => router.back()}
          style={{ color: "var(--color-text-secondary)" }}
          className="flex items-center gap-1.5 text-sm hover:opacity-70 transition-opacity">
          <ArrowLeft size={15} /> Back
        </button>
        <h1 style={{ color: "var(--color-text-primary)" }} className="text-base font-semibold">Edit Vendor</h1>
        <div className="w-16" />
      </div>

      {loading ? (
        <div style={{ color: "var(--color-text-muted)" }} className="text-sm text-center py-16">Loading…</div>
      ) : (
        <>
          <Section title="Company">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Field label="Company Name *" error={fieldErrors.companyName}>
                  <input type="text" value={form.companyName ?? ""} onChange={set("companyName")}
                    placeholder="Acme Cables Pvt. Ltd."
                    style={fieldErrors.companyName ? inputErrorStyle : inputStyle}
                    className={inputCls} />
                </Field>
              </div>
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
              <Field label="Name *" error={fieldErrors.contactName}>
                <input type="text" value={form.contactName ?? ""} onChange={set("contactName")}
                  placeholder="Ravi Kumar"
                  style={fieldErrors.contactName ? inputErrorStyle : inputStyle}
                  className={inputCls} />
              </Field>
              <Field label="Designation">
                <input type="text" value={form.contactDesignation ?? ""} onChange={set("contactDesignation")}
                  placeholder="Sales Manager" style={inputStyle} className={inputCls} />
              </Field>
              <Field label="Phone" error={fieldErrors.contactPhone}>
                <input type="tel" value={form.contactPhone ?? ""} onChange={set("contactPhone")}
                  placeholder="9876543210"
                  style={fieldErrors.contactPhone ? inputErrorStyle : inputStyle}
                  className={inputCls} />
              </Field>
              <Field label="Email" error={fieldErrors.contactEmail}>
                <input type="text" value={form.contactEmail ?? ""} onChange={set("contactEmail")}
                  placeholder="ravi@vendor.com"
                  style={fieldErrors.contactEmail ? inputErrorStyle : inputStyle}
                  className={inputCls} />
              </Field>
            </div>
          </Section>

          <div className="flex gap-3 pb-4">
            <button onClick={() => router.back()}
              style={{ borderColor: "var(--color-border)", color: "var(--color-text-secondary)" }}
              className="flex-1 border rounded-lg py-2.5 text-sm hover:opacity-70 transition-opacity">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              style={{ backgroundColor: "var(--color-btn-bg)", color: "var(--color-btn-text)" }}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium hover:opacity-80 transition-opacity disabled:opacity-40">
              <Save size={14} />
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </>
      )}

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
