"use client";

import { useEffect, useState, useMemo } from "react";
import { Plus, Trash2, UserPlus, User as UserIcon, Mail, Hash, Search, ChevronDown } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { getSubCompanies, addSubCompanyMember } from "@/api/subCompanies";
import { getUsers, createUser, deleteUser } from "@/api/users";
import type { CreateUserPayload } from "@/api/users";
import type { SubCompany } from "@/types/subCompany";
import type { User, UserRole } from "@/types/auth";
import type { AxiosError } from "axios";
import { useAuthStore } from "@/store/authStore";

const inputCls = "w-full border rounded-lg px-3 py-2 text-sm focus:outline-none transition-colors";
const inputStyle: React.CSSProperties = {
  backgroundColor: "var(--color-bg-input)",
  borderColor: "var(--color-border-input)",
  color: "var(--color-text-primary)",
};

const ROLE_LABELS: Record<UserRole, string> = {
  owner: "Owner",
  admin: "Admin",
  floor_manager: "Floor Manager",
  member: "Member",
};

const ROLE_CHIP: Record<string, string> = {
  owner: "bg-purple-100 text-purple-700",
  admin: "bg-blue-100 text-blue-700",
  floor_manager: "bg-amber-100 text-amber-700",
  member: "bg-gray-100 text-gray-600",
};

function RoleChip({ role }: { role: string }) {
  return (
    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${ROLE_CHIP[role] ?? "bg-gray-100 text-gray-600"}`}>
      {role.replace("_", " ")}
    </span>
  );
}

const EMPTY_FORM: CreateUserPayload = {
  name: "", email: "", phoneNumber: "", password: "", role: "member",
};

export default function MembersPage() {
  const currentUser = useAuthStore((s) => s.user);

  const [users, setUsers] = useState<User[]>([]);
  const [companies, setCompanies] = useState<SubCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "">("");
  const [branchFilter, setBranchFilter] = useState("");

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateUserPayload>(EMPTY_FORM);
  const [selectedBranchIds, setSelectedBranchIds] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [u, c] = await Promise.all([getUsers(), getSubCompanies()]);
        if (!cancelled) { setUsers(u); setCompanies(c); }
      } catch {
        if (!cancelled) setError("Failed to load data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    let list = users;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    }
    if (roleFilter) list = list.filter((u) => u.role === roleFilter);
    if (branchFilter) list = list.filter((u) => (u.subCompanyIds ?? []).includes(branchFilter));
    return list;
  }, [users, search, roleFilter, branchFilter]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setSelectedBranchIds(new Set());
    setCreateError(null);
    setShowCreate(true);
  }

  function toggleBranch(id: string) {
    setSelectedBranchIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleCreate() {
    if (!form.name.trim() || !form.email.trim() || !form.phoneNumber.trim() || !form.password.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const created = await createUser(form);
      await Promise.all(
        Array.from(selectedBranchIds).map((id) =>
          addSubCompanyMember(id, { userId: created.id, isPrimary: false })
        )
      );
      setUsers((p) => [{ ...created, subCompanyIds: Array.from(selectedBranchIds) }, ...p]);
      setShowCreate(false);
    } catch (err) {
      const e = err as AxiosError<{ message?: string }>;
      setCreateError(e.response?.data?.message ?? "Failed to create member.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this user? This cannot be undone.")) return;
    try {
      await deleteUser(id);
      setUsers((p) => p.filter((u) => u.id !== id));
    } catch {
      setError("Failed to delete user.");
    }
  }

  const creatableRoles: UserRole[] = currentUser?.role === "owner"
    ? ["admin", "floor_manager", "member"]
    : ["floor_manager", "member"];

  const clearFilters = () => { setSearch(""); setRoleFilter(""); setBranchFilter(""); };
  const hasFilters = !!(search || roleFilter || branchFilter);

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 style={{ color: "var(--color-text-primary)" }} className="text-xl font-bold">Members</h1>
          <p style={{ color: "var(--color-text-muted)" }} className="text-sm mt-0.5">
            {hasFilters ? `${filtered.length} of ${users.length}` : users.length}{" "}
            {users.length === 1 ? "user" : "users"}
          </p>
        </div>
        <button
          onClick={openCreate}
          style={{ backgroundColor: "var(--color-btn-bg)", color: "var(--color-btn-text)" }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium hover:opacity-80 transition-opacity">
          <UserPlus size={14} />
          New Member
        </button>
      </div>

      {error && (
        <p className="text-red-500 text-sm bg-red-500/10 border border-red-500/20 rounded px-4 py-2">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline text-xs">dismiss</button>
        </p>
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-40 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--color-text-muted)" }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            style={inputStyle}
            className="w-full border rounded-lg pl-8 pr-3 py-1.5 text-sm focus:outline-none transition-colors"
          />
        </div>
        <div className="relative">
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as UserRole | "")}
            style={inputStyle}
            className="border rounded-lg pl-3 pr-7 py-1.5 text-sm focus:outline-none appearance-none cursor-pointer">
            <option value="">All roles</option>
            {(["admin", "floor_manager", "member"] as UserRole[]).map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
          <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--color-text-muted)" }} />
        </div>
        <div className="relative">
          <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}
            style={inputStyle}
            className="border rounded-lg pl-3 pr-7 py-1.5 text-sm focus:outline-none appearance-none cursor-pointer">
            <option value="">All branches</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--color-text-muted)" }} />
        </div>
        {hasFilters && (
          <button onClick={clearFilters} style={{ color: "var(--color-text-muted)" }}
            className="text-xs hover:opacity-70 transition-opacity px-1">
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-bg-popup)" }}
          className="border rounded overflow-hidden">
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: "var(--color-btn-bg)" }}>
                {["Member", "Role", "Contact", "Branches", "Actions"].map((h, i) => (
                  <th key={h} style={{ color: "var(--color-btn-text)" }}
                    className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider ${i === 4 ? "text-right" : "text-left"}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="animate-pulse" style={{ borderTop: i > 0 ? `1px solid var(--color-border)` : undefined }}>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded shrink-0" style={{ backgroundColor: "var(--color-border)" }} />
                      <div>
                        <div className="h-3 rounded w-28 mb-1.5" style={{ backgroundColor: "var(--color-border)" }} />
                        <div className="h-2.5 rounded w-36" style={{ backgroundColor: "var(--color-border)" }} />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5"><div className="h-5 rounded-full w-16" style={{ backgroundColor: "var(--color-border)" }} /></td>
                  <td className="px-4 py-3.5"><div className="h-3 rounded w-24" style={{ backgroundColor: "var(--color-border)" }} /></td>
                  <td className="px-4 py-3.5"><div className="h-3 rounded w-20" style={{ backgroundColor: "var(--color-border)" }} /></td>
                  <td className="px-4 py-3.5"><div className="flex justify-end"><div className="w-6 h-6 rounded" style={{ backgroundColor: "var(--color-border)" }} /></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : users.length === 0 ? (
        <div style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}
          className="border-2 border-dashed rounded py-16 text-center text-sm">
          No members yet.{" "}
          <button onClick={openCreate} className="underline hover:opacity-70">Add your first member.</button>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}
          className="border-2 border-dashed rounded py-16 text-center text-sm">
          No members match your filters.{" "}
          <button onClick={clearFilters} className="underline hover:opacity-70">Clear filters</button>
        </div>
      ) : (
        <div style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-bg-popup)" }}
          className="border rounded overflow-hidden">
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: "var(--color-btn-bg)" }}>
                {["Member", "Role", "Contact", "Branches", "Actions"].map((h, i) => (
                  <th key={h} style={{ color: "var(--color-btn-text)" }}
                    className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider whitespace-nowrap ${i === 4 ? "text-right" : "text-left"}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, i) => {
                const assignedBranches = companies.filter((c) => (u.subCompanyIds ?? []).includes(c.id));
                const isCurrentUser = u.id === currentUser?.id;
                return (
                  <tr key={u.id}
                    style={{
                      borderTop: i > 0 ? `1px solid var(--color-border)` : undefined,
                      backgroundColor: "var(--color-bg-page)",
                    }}>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <div style={{ backgroundColor: "var(--color-bg-initials)", color: "var(--color-text-initials)" }}
                          className="w-8 h-8 rounded shrink-0 flex items-center justify-center text-xs font-semibold">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span style={{ color: "var(--color-text-primary)" }} className="text-sm font-medium">{u.name}</span>
                            {isCurrentUser && <span style={{ color: "var(--color-text-muted)" }} className="text-[10px]">(you)</span>}
                          </div>
                          <span style={{ color: "var(--color-text-muted)" }} className="text-xs">{u.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap"><RoleChip role={u.role} /></td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span style={{ color: "var(--color-text-secondary)" }} className="text-xs">{u.phoneNumber || "—"}</span>
                    </td>
                    <td className="px-4 py-3">
                      {assignedBranches.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {assignedBranches.map((b) => (
                            <span key={b.id}
                              style={{ backgroundColor: "var(--color-bg-nav-active)", color: "var(--color-text-secondary)" }}
                              className="text-[11px] rounded px-1.5 py-0.5 font-medium">
                              {b.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: "var(--color-text-muted)" }} className="text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end">
                        {!isCurrentUser && u.role !== "owner" && (
                          <button onClick={() => handleDelete(u.id)}
                            style={{ color: "var(--color-text-muted)" }}
                            className="p-1.5 rounded transition-colors hover:text-red-500">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create member modal */}
      {showCreate && (
        <Modal title="New Member" onClose={() => setShowCreate(false)} width="max-w-xl">
          <div className="space-y-4">
            {createError && (
              <p className="text-red-500 text-xs bg-red-500/10 border border-red-500/20 rounded px-3 py-2">{createError}</p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={{ color: "var(--color-text-muted)" }} className="block text-xs mb-1">Full Name *</label>
                <div className="relative">
                  <UserIcon size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--color-text-muted)" }} />
                  <input type="text" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Rahul Sharma" style={inputStyle}
                    className="w-full border rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none transition-colors" />
                </div>
              </div>
              <div>
                <label style={{ color: "var(--color-text-muted)" }} className="block text-xs mb-1">Role *</label>
                <select value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as UserRole }))}
                  style={inputStyle} className={inputCls}>
                  {creatableRoles.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label style={{ color: "var(--color-text-muted)" }} className="block text-xs mb-1">Email *</label>
              <div className="relative">
                <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--color-text-muted)" }} />
                <input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="rahul@example.com" style={inputStyle}
                  className="w-full border rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none transition-colors" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={{ color: "var(--color-text-muted)" }} className="block text-xs mb-1">Phone Number *</label>
                <div className="relative">
                  <Hash size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--color-text-muted)" }} />
                  <input type="tel" value={form.phoneNumber} onChange={(e) => setForm((p) => ({ ...p, phoneNumber: e.target.value }))}
                    placeholder="9876543210" style={inputStyle}
                    className="w-full border rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none transition-colors" />
                </div>
              </div>
              <div>
                <label style={{ color: "var(--color-text-muted)" }} className="block text-xs mb-1">Password *</label>
                <input type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                  placeholder="••••••••" style={inputStyle} className={inputCls} />
              </div>
            </div>
            {companies.length > 0 && (
              <div>
                <label style={{ color: "var(--color-text-muted)" }} className="block text-xs mb-2">
                  Assign to Branches <span className="opacity-60">(optional)</span>
                </label>
                <div style={{ borderColor: "var(--color-border)" }} className="border rounded divide-y max-h-44 overflow-y-auto">
                  {companies.map((c) => (
                    <label key={c.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:opacity-80 transition-opacity"
                      style={{ backgroundColor: "var(--color-bg-page)" }}>
                      <input type="checkbox" checked={selectedBranchIds.has(c.id)} onChange={() => toggleBranch(c.id)}
                        className="h-4 w-4 rounded cursor-pointer" />
                      <div className="flex-1 min-w-0">
                        <span style={{ color: "var(--color-text-primary)" }} className="text-sm font-medium">{c.name}</span>
                        {(c.city || c.address) && (
                          <span style={{ color: "var(--color-text-muted)" }} className="text-xs ml-2">{c.city ?? c.address}</span>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
                {selectedBranchIds.size > 0 && (
                  <p style={{ color: "var(--color-text-muted)" }} className="text-xs mt-1.5">
                    {selectedBranchIds.size} branch{selectedBranchIds.size !== 1 ? "es" : ""} selected
                  </p>
                )}
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button onClick={() => setShowCreate(false)}
                style={{ borderColor: "var(--color-border)", color: "var(--color-text-secondary)" }}
                className="flex-1 border rounded-lg py-2 text-sm hover:opacity-70 transition-opacity">
                Cancel
              </button>
              <button onClick={handleCreate}
                disabled={creating || !form.name.trim() || !form.email.trim() || !form.phoneNumber.trim() || !form.password.trim()}
                style={{ backgroundColor: "var(--color-btn-bg)", color: "var(--color-btn-text)" }}
                className="flex-1 rounded-lg py-2 text-sm font-medium hover:opacity-80 transition-opacity disabled:opacity-40">
                {creating ? "Creating…" : "Create Member"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
