"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { login } from "@/api/auth";
import { useAuthStore } from "@/store/authStore";
import { isTokenExpired } from "@/utils/token";
import type { AxiosError } from "axios";

export default function LoginForm() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    if (token && !isTokenExpired(token)) {
      router.replace("/dashboard");
    }
  }, [token, router]);

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await login({ identifier, password });
      setAuth(res.accessToken, res.user, res.refreshToken);
      router.replace("/dashboard");
    } catch (err) {
      const axiosErr = err as AxiosError<{ message?: string }>;
      const status = axiosErr.response?.status;
      if (status === 401) setError("Invalid credentials.");
      else if (status === 403) setError("Your account has been deactivated.");
      else setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    backgroundColor: "var(--color-bg-input)",
    borderColor: "var(--color-border-input)",
    color: "var(--color-text-primary)",
  };

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <h1
          style={{ color: "var(--color-text-primary)" }}
          className="text-2xl font-bold">
          SS Cable ERP
        </h1>
        <p
          style={{ color: "var(--color-text-muted)" }}
          className="text-sm mt-1">
          Sign in to your account
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            style={{ color: "var(--color-text-muted)" }}
            className="block text-xs mb-1.5">
            Email or Phone
          </label>
          <input
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
            placeholder="you@example.com or 9876543210"
            style={inputStyle}
            className="w-full border rounded-lg px-3 py-2.5 text-sm placeholder-[#9ca3af] focus:outline-none transition-colors"
          />
        </div>

        <div>
          <label
            style={{ color: "var(--color-text-muted)" }}
            className="block text-xs mb-1.5">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
            style={inputStyle}
            className="w-full border rounded-lg px-3 py-2.5 text-sm placeholder-[#9ca3af] focus:outline-none transition-colors"
          />
        </div>

        {error && (
          <p className="text-red-500 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            backgroundColor: "var(--color-btn-bg)",
            color: "var(--color-btn-text)",
          }}
          className="w-full font-medium text-sm rounded-lg py-2.5 transition-opacity hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed">
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p
        style={{ color: "var(--color-text-muted)" }}
        className="text-center text-xs mt-6">
        First time setup?{" "}
        <Link
          href="/register"
          style={{ color: "var(--color-text-secondary)" }}
          className="hover:underline transition-colors">
          Create owner account
        </Link>
      </p>
    </div>
  );
}
