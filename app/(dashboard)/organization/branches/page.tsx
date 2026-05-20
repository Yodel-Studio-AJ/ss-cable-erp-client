"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import PermissionDenied from "@/components/ui/PermissionDenied";
import BranchTable from "@/components/branches/BranchTable";
import BranchFormModal from "@/components/branches/BranchFormModal";
import BranchMembersModal from "@/components/branches/BranchMembersModal";
import {
  getSubCompanies,
  createSubCompany,
  updateSubCompany,
  deleteSubCompany,
} from "@/api/subCompanies";
import type { SubCompany } from "@/types/subCompany";
import type { BranchFormPayload } from "@/components/branches/BranchFormModal";
import type { AxiosError } from "axios";

export default function BranchesPage() {
  const [companies, setCompanies]         = useState<SubCompany[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const [formModal, setFormModal]         = useState<"create" | "edit" | null>(null);
  const [editTarget, setEditTarget]       = useState<SubCompany | null>(null);
  const [membersTarget, setMembersTarget] = useState<SubCompany | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const data = await getSubCompanies();
        if (!cancelled) setCompanies(data);
      } catch (err) {
        if (!cancelled) {
          const status = (err as AxiosError).response?.status;
          if (status === 403) setPermissionDenied(true);
          else setError("Failed to load branches.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  function openCreate() {
    setEditTarget(null);
    setFormModal("create");
  }

  function openEdit(c: SubCompany) {
    setEditTarget(c);
    setFormModal("edit");
  }

  async function handleSave(payload: BranchFormPayload) {
    try {
      if (formModal === "create") {
        const created = await createSubCompany(payload);
        setCompanies((p) => [...p, created]);
      } else if (editTarget) {
        const updated = await updateSubCompany(editTarget.id, payload);
        setCompanies((p) => p.map((c) => (c.id === updated.id ? updated : c)));
      }
      setFormModal(null);
    } catch {
      setError("Failed to save branch.");
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

  if (permissionDenied) return <PermissionDenied />;

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 style={{ color: "var(--color-text-primary)" }} className="text-xl font-bold">
            Branches
          </h1>
          <p style={{ color: "var(--color-text-muted)" }} className="text-sm mt-0.5">
            {companies.length} {companies.length === 1 ? "branch" : "branches"}
          </p>
        </div>
        <button
          onClick={openCreate}
          style={{ backgroundColor: "var(--color-btn-bg)", color: "var(--color-btn-text)" }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium hover:opacity-80 transition-opacity">
          <Plus size={14} /> New Branch
        </button>
      </div>

      {error && (
        <p className="text-red-500 text-sm bg-red-500/10 border border-red-500/20 rounded px-4 py-2">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline text-xs">dismiss</button>
        </p>
      )}

      <BranchTable
        companies={companies}
        loading={loading}
        onCreate={openCreate}
        onEdit={openEdit}
        onDelete={handleDelete}
        onMembers={setMembersTarget}
      />

      {formModal && (
        <BranchFormModal
          mode={formModal}
          initial={editTarget ?? undefined}
          onSave={handleSave}
          onClose={() => setFormModal(null)}
        />
      )}

      {membersTarget && (
        <BranchMembersModal
          branch={membersTarget}
          onClose={() => setMembersTarget(null)}
        />
      )}
    </div>
  );
}
