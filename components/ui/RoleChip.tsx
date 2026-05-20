const ROLE_CHIP: Record<string, string> = {
  owner:         "bg-purple-100 text-purple-700",
  admin:         "bg-blue-100 text-blue-700",
  floor_manager: "bg-amber-100 text-amber-700",
  member:        "bg-gray-100 text-gray-600",
};

export default function RoleChip({ role }: { role: string }) {
  return (
    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${ROLE_CHIP[role] ?? "bg-gray-100 text-gray-600"}`}>
      {role?.replace("_", " ") ?? "unknown"}
    </span>
  );
}
