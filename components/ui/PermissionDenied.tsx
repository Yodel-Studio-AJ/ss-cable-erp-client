import { ShieldOff } from "lucide-react";

export default function PermissionDenied() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div
        style={{ backgroundColor: "var(--color-bg-input)" }}
        className="w-14 h-14 rounded-full flex items-center justify-center mb-4">
        <ShieldOff size={24} style={{ color: "var(--color-text-muted)" }} />
      </div>
      <h2 style={{ color: "var(--color-text-primary)" }} className="text-base font-semibold mb-1">
        Access Denied
      </h2>
      <p style={{ color: "var(--color-text-muted)" }} className="text-sm max-w-xs">
        You don&apos;t have permission to view this page. Contact your administrator if you think this is a mistake.
      </p>
    </div>
  );
}
