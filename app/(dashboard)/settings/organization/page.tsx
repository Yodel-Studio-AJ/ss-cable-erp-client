"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, Users, MapPin, Phone, Star, UserPlus } from "lucide-react";
import Modal from "@/components/ui/Modal";
import {
  getSubCompanies,
  createSubCompany,
  updateSubCompany,
  deleteSubCompany,
  getSubCompanyMembers,
  addSubCompanyMember,
  removeSubCompanyMember,
  updateSubCompanyMember,
} from "@/api/subCompanies";
import { getUsers } from "@/api/users";
import type { SubCompany, SubCompanyMember } from "@/types/subCompany";
import type { User } from "@/types/auth";
import type { AxiosError } from "axios";

const inputCls =
  "w-full border rounded-lg px-3 py-2 text-sm focus:outline-none transition-colors";
const inputStyle: React.CSSProperties = {
  backgroundColor: "var(--color-bg-input)",
  borderColor: "var(--color-border-input)",
  color: "var(--color-text-primary)",
};

function RoleChip({ role }: { role: string }) {
  const map: Record<string, string> = {
    owner: "bg-purple-100 text-purple-700",
    admin: "bg-blue-100 text-blue-700",
    floor_manager: "bg-amber-100 text-amber-700",
    member: "bg-gray-100 text-gray-600",
  };
  return (
    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${map[role] ?? "bg-gray-100 text-gray-600"}`}>
      {role.replace("_", " ")}
    </span>
  );
}

export default function OrganizationPage() {
  const [companies, setCompanies] = useState<SubCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Company modal
  const [companyModal, setCompanyModal] = useState<"create" | "edit" | null>(null);
  const [editTarget, setEditTarget] = useState<SubCompany | null>(null);
  const [companyForm, setCompanyForm] = useState({ name: "", address: "", city: "", phone: "" });
  const [saving, setSaving] = useState(false);

  // Members modal
  const [membersModal, setMembersModal] = useState<SubCompany | null>(null);
  const [members, setMembers] = useState<SubCompanyMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  // Add member
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [addMemberModal, setAddMemberModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [addingMember, setAddingMember] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setCompanies(await getSubCompanies());
    } catch {
      setError("Failed to load branches.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setCompanyForm({ name: "", address: "", city: "", phone: "" });
    setEditTarget(null);
    setCompanyModal("create");
  }

  function openEdit(c: SubCompany) {
    setCompanyForm({ name: c.name, address: c.address ?? "", city: c.city ?? "", phone: c.phone ?? "" });
    setEditTarget(c);
    setCompanyModal("edit");
  }

  async function handleCompanySave() {
    if (!companyForm.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: companyForm.name.trim(),
        address: companyForm.address || undefined,
        city: companyForm.city || undefined,
        phone: companyForm.phone || undefined,
      };
      if (companyModal === "create") {
        const created = await createSubCompany(payload);
        setCompanies((p) => [...p, created]);
      } else if (editTarget) {
        const updated = await updateSubCompany(editTarget.id, payload);
        setCompanies((p) => p.map((c) => (c.id === updated.id ? updated : c)));
      }
      setCompanyModal(null);
    } catch {
      setError("Failed to save branch.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this branch? This cannot be undone.")) return;
    try {
      await deleteSubCompany(id);
      setCompanies((p) => p.filter((c) => c.id !== id));
    } catch {
      setError("Failed to delete branch.");
    }
  }

  async function openMembers(c: SubCompany) {
    setMembersModal(c);
    setMembersLoading(true);
    try {
      const [m, u] = await Promise.all([getSubCompanyMembers(c.id), getUsers()]);
      setMembers(m);
      setAllUsers(u);
    } catch {
      setError("Failed to load members.");
    } finally {
      setMembersLoading(false);
    }
  }

  async function handleRemoveMember(userId: string) {
    if (!membersModal) return;
    try {
      await removeSubCompanyMember(membersModal.id, userId);
      setMembers((p) => p.filter((m) => m.userId !== userId));
    } catch {
      setError("Failed to remove member.");
    }
  }

  async function handleTogglePrimary(userId: string, current: boolean) {
    if (!membersModal) return;
    try {
      const updated = await updateSubCompanyMember(membersModal.id, userId, !current);
      setMembers((p) => p.map((m) => (m.userId === userId ? updated : m)));
    } catch {
      setError("Failed to update membership.");
    }
  }

  async function handleAddMember() {
    if (!membersModal || !selectedUserId) return;
    setAddingMember(true);
    try {
      const added = await addSubCompanyMember(membersModal.id, { userId: selectedUserId, isPrimary });
      setMembers((p) => [...p, added]);
      setAddMemberModal(false);
      setSelectedUserId("");
      setIsPrimary(false);
    } catch (err) {
      const e = err as AxiosError<{ message?: string }>;
      setError(e.response?.data?.message ?? "Failed to add member.");
    } finally {
      setAddingMember(false);
    }
  }

  const assignedIds = new Set(members.map((m) => m.userId));
  const unassignedUsers = allUsers.filter((u) => !assignedIds.has(u.id));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 style={{ color: "var(--color-text-primary)" }} className="text-xl font-bold">
            Organization
          </h1>
          <p style={{ color: "var(--color-text-muted)" }} className="text-sm mt-0.5">
            {companies.length} {companies.length === 1 ? "branch" : "branches"}
          </p>
        </div>
        <button
          onClick={openCreate}
          style={{ backgroundColor: "var(--color-btn-bg)", color: "var(--color-btn-text)" }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium hover:opacity-80 transition-opacity">
          <Plus size={16} />
          New Branch
        </button>
      </div>

      {error && (
        <p className="text-red-500 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">
          {error}
        </p>
      )}

      {/* Branches table */}
      {loading ? (
        <div style={{ color: "var(--color-text-muted)" }} className="text-sm py-12 text-center">
          Loading branches…
        </div>
      ) : companies.length === 0 ? (
        <div
          style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}
          className="border-2 border-dashed rounded-xl py-16 text-center text-sm">
          No branches yet.{" "}
          <button onClick={openCreate} className="underline hover:opacity-70">
            Create your first branch.
          </button>
        </div>
      ) : (
        <div style={{ borderColor: "var(--color-border)" }} className="border rounded-xl overflow-hidden">
          {/* Table header */}
          <div
            style={{ backgroundColor: "var(--color-btn-bg)", color: "var(--color-btn-text)" }}
            className="grid grid-cols-[1fr_1fr_1fr_auto] gap-4 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider">
            <span>Branch Name</span>
            <span>Location</span>
            <span>Phone</span>
            <span className="text-right">Actions</span>
          </div>

          {companies.map((c, i) => (
            <div
              key={c.id}
              style={{
                borderTopColor: "var(--color-border)",
                backgroundColor: "var(--color-bg-page)",
              }}
              className={`grid grid-cols-[1fr_1fr_1fr_auto] gap-4 px-4 py-3 items-center ${i > 0 ? "border-t" : ""}`}>
              <span style={{ color: "var(--color-text-primary)" }} className="text-sm font-medium truncate">
                {c.name}
              </span>
              <span style={{ color: "var(--color-text-secondary)" }} className="text-sm flex items-center gap-1.5 truncate">
                {(c.city || c.address) ? (
                  <><MapPin size={13} className="shrink-0" />{c.city ?? c.address}</>
                ) : (
                  <span style={{ color: "var(--color-text-muted)" }}>—</span>
                )}
              </span>
              <span style={{ color: "var(--color-text-secondary)" }} className="text-sm flex items-center gap-1.5">
                {c.phone ? (
                  <><Phone size={13} className="shrink-0" />{c.phone}</>
                ) : (
                  <span style={{ color: "var(--color-text-muted)" }}>—</span>
                )}
              </span>
              <div className="flex items-center gap-1 justify-end">
                <button
                  onClick={() => openMembers(c)}
                  title="View Members"
                  style={{ color: "var(--color-text-secondary)" }}
                  className="p-1.5 rounded hover:opacity-70 transition-opacity">
                  <Users size={15} />
                </button>
                <button
                  onClick={() => openEdit(c)}
                  title="Edit"
                  style={{ color: "var(--color-text-secondary)" }}
                  className="p-1.5 rounded hover:opacity-70 transition-opacity">
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => handleDelete(c.id)}
                  title="Delete"
                  className="p-1.5 rounded text-red-400 hover:opacity-70 transition-opacity">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit modal */}
      {companyModal && (
        <Modal
          title={companyModal === "create" ? "New Branch" : "Edit Branch"}
          onClose={() => setCompanyModal(null)}>
          <div className="space-y-3">
            {[
              { label: "Branch Name *", key: "name", placeholder: "SS Cable — Kolkata North" },
              { label: "Address", key: "address", placeholder: "123 Main St" },
              { label: "City", key: "city", placeholder: "Kolkata" },
              { label: "Phone", key: "phone", placeholder: "+91 98765 43210" },
            ].map(({ label, key, placeholder }) => (
              <div key={key}>
                <label style={{ color: "var(--color-text-muted)" }} className="block text-xs mb-1">
                  {label}
                </label>
                <input
                  type="text"
                  value={companyForm[key as keyof typeof companyForm]}
                  onChange={(e) => setCompanyForm((p) => ({ ...p, [key]: e.target.value }))}
                  placeholder={placeholder}
                  style={inputStyle}
                  className={inputCls}
                />
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setCompanyModal(null)}
                style={{ borderColor: "var(--color-border)", color: "var(--color-text-secondary)" }}
                className="flex-1 border rounded-lg py-2 text-sm hover:opacity-70 transition-opacity">
                Cancel
              </button>
              <button
                onClick={handleCompanySave}
                disabled={saving || !companyForm.name.trim()}
                style={{ backgroundColor: "var(--color-btn-bg)", color: "var(--color-btn-text)" }}
                className="flex-1 rounded-lg py-2 text-sm font-medium hover:opacity-80 transition-opacity disabled:opacity-40">
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Members modal */}
      {membersModal && (
        <Modal
          title={`${membersModal.name} — Members`}
          onClose={() => { setMembersModal(null); setMembers([]); }}
          width="max-w-2xl">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p style={{ color: "var(--color-text-muted)" }} className="text-sm">
                {members.length} member{members.length !== 1 ? "s" : ""}
              </p>
              <button
                onClick={() => setAddMemberModal(true)}
                style={{ backgroundColor: "var(--color-btn-bg)", color: "var(--color-btn-text)" }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-80 transition-opacity">
                <UserPlus size={13} />
                Add Member
              </button>
            </div>

            {membersLoading ? (
              <p style={{ color: "var(--color-text-muted)" }} className="text-sm text-center py-8">
                Loading…
              </p>
            ) : members.length === 0 ? (
              <p style={{ color: "var(--color-text-muted)" }} className="text-sm text-center py-8">
                No members assigned.
              </p>
            ) : (
              <div style={{ borderColor: "var(--color-border)" }} className="border rounded-lg overflow-hidden">
                {members.map((m, i) => (
                  <div
                    key={m.userId}
                    style={{
                      borderTopColor: "var(--color-border)",
                      backgroundColor: "var(--color-bg-page)",
                    }}
                    className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? "border-t" : ""}`}>
                    <div
                      style={{ backgroundColor: "var(--color-bg-initials)", color: "var(--color-text-initials)" }}
                      className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-xs font-semibold">
                      {m.user.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p style={{ color: "var(--color-text-primary)" }} className="text-sm font-medium truncate">
                          {m.user.name}
                        </p>
                        <RoleChip role={m.user.role} />
                        {m.isPrimary && (
                          <span className="flex items-center gap-0.5 text-[11px] text-amber-600">
                            <Star size={10} fill="currentColor" /> Primary
                          </span>
                        )}
                      </div>
                      <p style={{ color: "var(--color-text-muted)" }} className="text-xs truncate">
                        {m.user.email}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleTogglePrimary(m.userId, m.isPrimary)}
                        title={m.isPrimary ? "Unset primary" : "Set as primary"}
                        className={`p-1.5 rounded transition-opacity hover:opacity-70 ${m.isPrimary ? "text-amber-500" : ""}`}
                        style={m.isPrimary ? {} : { color: "var(--color-text-muted)" }}>
                        <Star size={14} fill={m.isPrimary ? "currentColor" : "none"} />
                      </button>
                      <button
                        onClick={() => handleRemoveMember(m.userId)}
                        className="p-1.5 rounded text-red-400 hover:opacity-70 transition-opacity">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Add member modal */}
      {addMemberModal && (
        <Modal title="Add Member" onClose={() => setAddMemberModal(false)}>
          <div className="space-y-3">
            <div>
              <label style={{ color: "var(--color-text-muted)" }} className="block text-xs mb-1">
                User *
              </label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                style={inputStyle}
                className={inputCls}>
                <option value="">Select a user…</option>
                {unassignedUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isPrimary}
                onChange={(e) => setIsPrimary(e.target.checked)}
                className="rounded"
              />
              <span style={{ color: "var(--color-text-secondary)" }} className="text-sm">
                Set as primary location
              </span>
            </label>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setAddMemberModal(false)}
                style={{ borderColor: "var(--color-border)", color: "var(--color-text-secondary)" }}
                className="flex-1 border rounded-lg py-2 text-sm hover:opacity-70 transition-opacity">
                Cancel
              </button>
              <button
                onClick={handleAddMember}
                disabled={addingMember || !selectedUserId}
                style={{ backgroundColor: "var(--color-btn-bg)", color: "var(--color-btn-text)" }}
                className="flex-1 rounded-lg py-2 text-sm font-medium hover:opacity-80 transition-opacity disabled:opacity-40">
                {addingMember ? "Adding…" : "Add"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
