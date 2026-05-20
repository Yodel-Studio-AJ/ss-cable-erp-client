import { Plus, Pencil, Trash2, Users, MapPin, Phone } from "lucide-react";
import type { SubCompany } from "@/types/subCompany";

interface Props {
  companies: SubCompany[];
  loading:   boolean;
  onCreate:  () => void;
  onEdit:    (c: SubCompany) => void;
  onDelete:  (id: string) => void;
  onMembers: (c: SubCompany) => void;
}

const TABLE_HEADERS = ["Branch Name", "Location", "Phone", "Actions"];

function TableSkeleton() {
  return (
    <tbody>
      {Array.from({ length: 4 }).map((_, i) => (
        <tr
          key={i}
          className="animate-pulse"
          style={{ borderTop: i > 0 ? "1px solid var(--color-border)" : undefined }}>
          <td className="px-4 py-3.5"><div className="h-3 rounded w-36" style={{ backgroundColor: "var(--color-border)" }} /></td>
          <td className="px-4 py-3.5"><div className="h-3 rounded w-28" style={{ backgroundColor: "var(--color-border)" }} /></td>
          <td className="px-4 py-3.5"><div className="h-3 rounded w-24" style={{ backgroundColor: "var(--color-border)" }} /></td>
          <td className="px-4 py-3.5">
            <div className="flex justify-end gap-1">
              <div className="w-6 h-6 rounded" style={{ backgroundColor: "var(--color-border)" }} />
            </div>
          </td>
        </tr>
      ))}
    </tbody>
  );
}

function TableHead() {
  return (
    <thead>
      <tr style={{ backgroundColor: "var(--color-btn-bg)" }}>
        {TABLE_HEADERS.map((h, i) => (
          <th
            key={h}
            style={{ color: "var(--color-btn-text)" }}
            className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider whitespace-nowrap ${i === TABLE_HEADERS.length - 1 ? "text-right" : "text-left"}`}>
            {h}
          </th>
        ))}
      </tr>
    </thead>
  );
}

export default function BranchTable({ companies, loading, onCreate, onEdit, onDelete, onMembers }: Props) {
  if (!loading && companies.length === 0) {
    return (
      <div
        style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}
        className="border-2 border-dashed rounded py-16 text-center text-sm">
        No branches yet.{" "}
        <button onClick={onCreate} className="underline hover:opacity-70">
          Create your first branch.
        </button>
      </div>
    );
  }

  return (
    <div
      style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-bg-popup)" }}
      className="border rounded overflow-hidden">
      <table className="w-full">
        <TableHead />
        {loading ? (
          <TableSkeleton />
        ) : (
          <tbody>
            {companies.map((c, i) => (
              <tr
                key={c.id}
                style={{
                  borderTop: i > 0 ? "1px solid var(--color-border)" : undefined,
                  backgroundColor: "var(--color-bg-page)",
                }}>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span style={{ color: "var(--color-text-primary)" }} className="text-sm font-medium">
                    {c.name}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span style={{ color: "var(--color-text-secondary)" }} className="text-sm flex items-center gap-1.5">
                    {c.city || c.address ? (
                      <><MapPin size={12} className="shrink-0" />{c.city ?? c.address}</>
                    ) : (
                      <span style={{ color: "var(--color-text-muted)" }}>—</span>
                    )}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span style={{ color: "var(--color-text-secondary)" }} className="text-sm flex items-center gap-1.5">
                    {c.phone ? (
                      <><Phone size={12} className="shrink-0" />{c.phone}</>
                    ) : (
                      <span style={{ color: "var(--color-text-muted)" }}>—</span>
                    )}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-0.5 justify-end">
                    <button
                      onClick={() => onMembers(c)}
                      style={{ color: "var(--color-text-secondary)" }}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium hover:opacity-70 transition-opacity">
                      <Users size={12} /> Members
                    </button>
                    <button
                      onClick={() => onEdit(c)}
                      style={{ color: "var(--color-text-muted)" }}
                      className="p-1.5 rounded hover:opacity-70 transition-opacity">
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => onDelete(c.id)}
                      className="p-1.5 rounded text-red-400 hover:opacity-70 transition-opacity">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        )}
      </table>
    </div>
  );
}
