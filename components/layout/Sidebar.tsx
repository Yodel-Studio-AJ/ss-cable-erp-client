"use client";

import { useState, useRef, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronsUpDown,
  LogOut,
  Sun,
  Moon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems } from "@/constants/navItems";
import Image from "next/image";
import { useAuthStore } from "@/store/authStore";
import { useThemeStore } from "@/store/themeStore";

function getInitials(name: string | undefined | null): string {
  if (!name || !name.trim()) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0][0].toUpperCase();
}

interface SidebarProps {
  open: boolean;
  minimized: boolean;
  onClose: () => void;
  onToggleMinimize: () => void;
}

export default function Sidebar({
  open,
  minimized,
  onClose,
  onToggleMinimize,
}: SidebarProps) {
  const pathname = usePathname();
  const [openMenus, setOpenMenus] = useState<string[]>([]);
  const [userPopupOpen, setUserPopupOpen] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);

  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setUserPopupOpen(false);
      }
    }
    if (userPopupOpen)
      document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [userPopupOpen]);

  const toggleMenu = (name: string) => {
    setOpenMenus((prev) =>
      prev.includes(name) ? prev.filter((i) => i !== name) : [...prev, name]
    );
  };

  return (
    <>
      <aside
        style={{
          backgroundColor: "var(--color-bg-sidebar)",
          borderRightColor: "var(--color-border)",
          color: "var(--color-text-nav)",
        }}
        className={`
          fixed lg:static inset-y-0 left-0 top-12 z-40
          border-r flex flex-col
          transition-all duration-300
          ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          ${minimized ? "w-16" : "w-64"}
        `}>

        {/* Minimize button */}
        <div
          style={{ borderBottomColor: "var(--color-border)" }}
          className="hidden lg:flex justify-end p-3 border-b">
          <button
            onClick={onToggleMinimize}
            style={{ color: "var(--color-text-muted)" }}
            className="p-1 rounded transition-colors hover:opacity-70">
            {minimized ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {navItems
            .filter((item) => {
              if (item.name === "Settings" && user?.role === "member")
                return false;
              return true;
            })
            .map((item) => {
              const Icon = item.icon;
              const isParentActive = item.children?.some((child) =>
                pathname.startsWith(child.href)
              );
              const isOpen = openMenus.includes(item.name) || isParentActive;

              if (!item.children) {
                const isActive =
                  pathname === item.href ||
                  (!!item.href &&
                    item.href !== "/" &&
                    pathname.startsWith(item.href + "/"));

                return (
                  <Link
                    key={item.name}
                    href={item.href!}
                    onClick={onClose}
                    style={
                      isActive
                        ? {
                          backgroundColor: "var(--color-bg-nav-active)",
                          color: "var(--color-text-nav-active)",
                        }
                        : { color: "var(--color-text-nav)" }
                    }
                    className={`flex items-center rounded-md transition-all
                      ${minimized ? "justify-center h-11" : "gap-3 px-3 py-2"}`}
                    onMouseEnter={(e) => {
                      if (!isActive)
                        (e.currentTarget as HTMLElement).style.backgroundColor =
                          "var(--color-bg-nav-hover)";
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive)
                        (e.currentTarget as HTMLElement).style.backgroundColor =
                          "";
                    }}>
                    <Icon size={18} />
                    {!minimized && <span>{item.name}</span>}
                  </Link>
                );
              }

              return (
                <div key={item.name}>
                  <button
                    onClick={() => toggleMenu(item.name)}
                    style={
                      isParentActive
                        ? {
                          backgroundColor: "var(--color-bg-nav-active)",
                          color: "var(--color-text-nav-active)",
                        }
                        : { color: "var(--color-text-nav)" }
                    }
                    className={`w-full flex items-center justify-between rounded-md transition-all
                      ${minimized ? "justify-center h-11" : "px-3 py-2"}`}
                    onMouseEnter={(e) => {
                      if (!isParentActive)
                        (e.currentTarget as HTMLElement).style.backgroundColor =
                          "var(--color-bg-nav-hover)";
                    }}
                    onMouseLeave={(e) => {
                      if (!isParentActive)
                        (e.currentTarget as HTMLElement).style.backgroundColor =
                          "";
                    }}>
                    <div className="flex items-center gap-3">
                      <Icon size={18} />
                      {!minimized && <span>{item.name}</span>}
                    </div>
                    {!minimized && (
                      <ChevronDown
                        size={16}
                        className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
                      />
                    )}
                  </button>

                  {!minimized && isOpen && (
                    <div className="mt-1 space-y-1">
                      {item.children.map((child) => {
                        const isActive =
                          pathname === child.href ||
                          pathname.startsWith(child.href + "/");

                        return (
                          <div className="flex gap-1 w-full" key={child.name}>
                            <div className="shrink-0">
                              <Image
                                src="/icons/sidebarIcon.svg"
                                alt=""
                                width={43}
                                height={43}
                              />
                            </div>
                            <Link
                              href={child.href}
                              onClick={onClose}
                              style={
                                isActive
                                  ? {
                                    backgroundColor:
                                      "var(--color-bg-nav-active)",
                                    color: "var(--color-text-nav-active)",
                                  }
                                  : { color: "var(--color-text-nav)" }
                              }
                              className="grow block text-sm rounded px-3 py-2 transition-colors font-medium"
                              onMouseEnter={(e) => {
                                if (!isActive)
                                  (
                                    e.currentTarget as HTMLElement
                                  ).style.backgroundColor =
                                    "var(--color-bg-nav-hover)";
                              }}
                              onMouseLeave={(e) => {
                                if (!isActive)
                                  (
                                    e.currentTarget as HTMLElement
                                  ).style.backgroundColor = "";
                              }}>
                              {child.name}
                            </Link>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
        </nav>

        {/* USER FOOTER */}
        <div
          style={{ borderTopColor: "var(--color-border)" }}
          className="border-t">

          {/* Theme toggle */}
          <div className="px-2 pt-2">
            <button
              onClick={toggleTheme}
              style={{ color: "var(--color-text-nav)" }}
              className={`w-full flex items-center rounded-md transition-colors
                ${minimized ? "justify-center h-10" : "gap-3 px-3 py-2"}`}
              onMouseEnter={(e) =>
              ((e.currentTarget as HTMLElement).style.backgroundColor =
                "var(--color-bg-nav-hover)")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLElement).style.backgroundColor = "")
              }>
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
              {!minimized && (
                <span className="text-sm">
                  {theme === "dark" ? "Light mode" : "Dark mode"}
                </span>
              )}
            </button>
          </div>

          {/* User profile */}
          {user && (
            <div ref={popupRef} className="relative p-2">
              {/* Floating popup */}
              {userPopupOpen && (
                <div
                  style={{
                    backgroundColor: "var(--color-bg-popup)",
                    borderColor: "var(--color-border)",
                  }}
                  className="absolute bottom-full left-2 right-2 mb-2 border rounded-xl shadow-2xl overflow-hidden z-50">
                  <div
                    style={{ borderBottomColor: "var(--color-border)" }}
                    className="p-4 border-b">
                    <div className="flex items-center gap-3">
                      <div
                        style={{
                          backgroundColor: "var(--color-bg-initials)",
                          color: "var(--color-text-initials)",
                        }}
                        className="w-10 h-10 rounded-lg shrink-0 flex items-center justify-center text-sm font-semibold">
                        {getInitials(user.name)}
                      </div>
                      <div className="overflow-hidden">
                        <p
                          style={{ color: "var(--color-text-primary)" }}
                          className="text-sm font-semibold truncate">
                          {user.name}
                        </p>
                        <p
                          style={{ color: "var(--color-text-secondary)" }}
                          className="text-xs capitalize">
                          {user.role}
                        </p>
                      </div>
                    </div>
                    <p
                      style={{ color: "var(--color-text-muted)" }}
                      className="text-xs mt-3 truncate">
                      {user.email}
                    </p>
                  </div>
                  <div className="p-1">
                    <button
                      onClick={logout}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-500 hover:bg-red-50/10 rounded-lg transition-colors">
                      <LogOut size={14} />
                      Log out
                    </button>
                  </div>
                </div>
              )}

              {/* Footer row */}
              <button
                onClick={() => setUserPopupOpen((v) => !v)}
                className="w-full flex items-center gap-3 rounded-lg p-2 transition-colors"
                onMouseEnter={(e) =>
                ((e.currentTarget as HTMLElement).style.backgroundColor =
                  "var(--color-bg-user-hover)")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLElement).style.backgroundColor = "")
                }>
                <div
                  style={{
                    backgroundColor: "var(--color-bg-initials)",
                    color: "var(--color-text-initials)",
                  }}
                  className="w-8 h-8 rounded shrink-0 flex items-center justify-center text-xs font-semibold">
                  {getInitials(user.name)}
                </div>
                {!minimized && (
                  <>
                    <div className="flex-1 overflow-hidden text-left">
                      <p
                        style={{ color: "var(--color-text-primary)" }}
                        className="text-sm truncate">
                        {user.name}
                      </p>
                      <p
                        style={{ color: "var(--color-text-secondary)" }}
                        className="text-xs capitalize">
                        {user.role}
                      </p>
                    </div>
                    <ChevronsUpDown
                      size={14}
                      style={{ color: "var(--color-text-muted)" }}
                      className="shrink-0"
                    />
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={onClose}
        />
      )}
    </>
  );
}
