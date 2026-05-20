"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: string;
}

export default function Modal({ title, onClose, children, width = "max-w-lg" }: ModalProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div
        style={{
          backgroundColor: "var(--color-bg-popup)",
          borderColor: "var(--color-border)",
          color: "var(--color-text-primary)",
        }}
        className={`relative z-10 w-full ${width} rounded-xl border shadow-2xl`}>
        <div
          style={{ borderBottomColor: "var(--color-border)" }}
          className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold text-base">{title}</h2>
          <button
            onClick={onClose}
            style={{ color: "var(--color-text-muted)" }}
            className="p-1 rounded hover:opacity-70 transition-opacity">
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
