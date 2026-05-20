"use client";

import { useState, useEffect } from "react";
import { UserPlus, Star, Trash2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import RoleChip from "@/components/ui/RoleChip";
import {
  getSubCompanyMembers,
  addSubCompanyMember,
  removeSubCompanyMember,
  updateSubCompanyMember,
} from "@/api/subCompanies";
import { getUsers } from "@/api/users";
import type { SubCompany, SubCompanyMember } from "@/types/subCompany";
import type { User, UserRole } from "@/types/auth";
import type { AxiosError } from "axios";

const ROLE_LABELS: Record<UserRole, string> = {
  owner:         "Owner",
  admin:         "Admin",
  floor_manager: "Floor Manager",
  member:        "Member",
};

const inputCls = "w-full border rounded-lg px-3 py-2 text-sm focus:outline-none transition-colors";
const inputStyle: React.CSSProperties = {
  backgroundColor: "var(--color-bg-input)",
  borderColor:     "var(--color-border-input)",
  color:           "var(--color-text-primary)",
};

interface Props {
  branch:  SubCompany;
  onClose: () => void;
}

export default function BranchMembersModal({ branch, onClose }: Props) {
  const [members, setMembers]       = useState<SubCompanyMember[]>([]);
  const [allUsers, setAllUsers]     = useState<User[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  // Add-member sub-state
  const [showAdd, setShowAdd]       = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [isPrimary, setIsPrimary]   = useState(false);
  const [adding, setAdding]         = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [m, u] = await Promise.all([getSubCompanyMembers(branch.id), getUsers()]);
        if (!cancelled) { setMembers(m); setAllUsers(u); }
      } catch {
        if (!cancelled) setError("Failed to load members.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [branch.id]);

  async function handleRemove(userId: string) {
    try {
      await removeSubCompanyMember(branch.id, userId);
      setMembers((p) => p.filter((m) => m.userId !== userId));
    } catch {
      setError("Failed to remove member.");
    }
  }

  async function handleTogglePrimary(userId: string, current: boolean) {
    try {
      const updated = await updateSubCompanyMember(branch.id, userId, !current);
      setMembers((p) => p.map((m) => (m.userId === userId ? updated : m)));
    } catch {
      setError("Failed to update membership.");
    }
  }

  async function handleAdd() {
    if (!selectedId) return;
    setAdding(true);
    try {
      const added = await addSubCompanyMember(branch.id, { userId: selectedId, isPrimary });
      setMembers((p) => [...p, added]);
      setShowAdd(false);
      setSelectedId("");
      setIsPrimary(false);
    } catch (err) {
      const e = err as AxiosError<{ message?: string }>;
      setError(e.response?.data?.message ?? "Failed to add member.");
    } finally {
      setAdding(false);
    }
  }

  const assignedIds      = new Set(members.map((m) => m.userId));
  const unassignedUsers  = allUsers.filter((u) => !assignedIds.has(u.id));

  return (
    <>
      <Modal
        title={`${branch.name} — Members`}
        onClose={onClose}
        width="max-w-2xl">
        <div className="space-y-4">
          {error && (
            <p className="text-red-500 text-xs bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
              {error}
              <button onClick={() => setError(null)} className="ml-2 underline">dismiss</button>
            </p>
          )}

          <div className="flex items-center justify-between">
            <p style={{ color: "var(--color-text-muted)" }} className="text-sm">
              {members.length} member{members.length !== 1 ? "s" : ""}
            </p>
            <button
              onClick={() => setShowAdd(true)}
              style={{ backgroundColor: "var(--color-btn-bg)", color: "var(--color-btn-text)" }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-80 transition-opacity">
              <UserPlus size={13} /> Add Existing User
            </button>
          </div>

          {loading ? (
            <p style={{ color: "var(--color-text-muted)" }} className="text-sm text-center py-8">Loading…</p>
          ) : members.length === 0 ? (
            <p style={{ color: "var(--color-text-muted)" }} className="text-sm text-center py-8">No members assigned.</p>
          ) : (
            <div style={{ borderColor: "var(--color-border)" }} className="border rounded overflow-hidden">
              {members.map((m, i) => (
                <div
                  key={m.userId}
                  style={{ borderTopColor: "var(--color-border)", backgroundColor: "var(--color-bg-page)" }}
                  className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? "border-t" : ""}`}>
                  <div
                    style={{ backgroundColor: "var(--color-bg-initials)", color: "var(--color-text-initials)" }}
                    className="w-8 h-8 rounded shrink-0 flex items-center justify-center text-xs font-semibold">
                    {m.name?.charAt(0).toUpperCase() ?? "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p style={{ color: "var(--color-text-primary)" }} className="text-sm font-medium truncate">
                        {m.name}
                      </p>
                      <RoleChip role={m.role} />
                      {m.isPrimary && (
                        <span className="flex items-center gap-0.5 text-[11px] text-amber-600">
                          <Star size={10} fill="currentColor" /> Primary
                        </span>
                      )}
                    </div>
                    <p style={{ color: "var(--color-text-muted)" }} className="text-xs truncate">{m.email}</p>
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
                      onClick={() => handleRemove(m.userId)}
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

      {/* Add member sub-modal */}
      {showAdd && (
        <Modal title="Add Member to Branch" onClose={() => setShowAdd(false)}>
          <div className="space-y-3">
            <div>
              <label style={{ color: "var(--color-text-muted)" }} className="block text-xs mb-1">User *</label>
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                style={inputStyle}
                className={inputCls}>
                <option value="">Select a user…</option>
                {unassignedUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} · {ROLE_LABELS[u.role]}
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
                onClick={() => setShowAdd(false)}
                style={{ borderColor: "var(--color-border)", color: "var(--color-text-secondary)" }}
                className="flex-1 border rounded-lg py-2 text-sm hover:opacity-70 transition-opacity">
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={adding || !selectedId}
                style={{ backgroundColor: "var(--color-btn-bg)", color: "var(--color-btn-text)" }}
                className="flex-1 rounded-lg py-2 text-sm font-medium hover:opacity-80 transition-opacity disabled:opacity-40">
                {adding ? "Adding…" : "Add"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
