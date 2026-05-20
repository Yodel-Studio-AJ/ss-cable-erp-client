"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { register } from "@/api/auth";
import { useAuthStore } from "@/store/authStore";
import { isTokenExpired } from "@/utils/token";
import type { AxiosError } from "axios";

export default function RegisterForm() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    if (token && !isTokenExpired(token)) {
      router.replace("/dashboard");
    }
  }, [token, router]);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phoneNumber: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const res = await register({
        name: form.name,
        email: form.email,
        phoneNumber: form.phoneNumber,
        password: form.password,
      });
      setAuth(res.accessToken, res.user, res.refreshToken);
      router.replace("/dashboard");
    } catch (err) {
      const axiosErr = err as AxiosError<{ message?: string }>;
      const status = axiosErr.response?.status;
      if (status === 403)
        setError("Owner account already exists. Please sign in.");
      else if (status === 400)
        setError(axiosErr.response?.data?.message ?? "Invalid input.");
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

  const labelStyle: React.CSSProperties = { color: "var(--color-text-muted)" };

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <h1
          style={{ color: "var(--color-text-primary)" }}
          className="text-2xl font-bold">
          SS Cable ERP
        </h1>
        <p style={labelStyle} className="text-sm mt-1">
          Create the owner account
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {(
          [
            { label: "Full Name", name: "name", type: "text", placeholder: "John Doe" },
            { label: "Email", name: "email", type: "email", placeholder: "you@example.com" },
            { label: "Phone Number", name: "phoneNumber", type: "tel", placeholder: "9876543210" },
            { label: "Password", name: "password", type: "password", placeholder: "••••••••" },
            { label: "Confirm Password", name: "confirmPassword", type: "password", placeholder: "••••••••" },
          ] as const
        ).map(({ label, name, type, placeholder }) => (
          <div key={name}>
            <label style={labelStyle} className="block text-xs mb-1.5">
              {label}
            </label>
            <input
              type={type}
              name={name}
              value={form[name]}
              onChange={handleChange}
              required
              placeholder={placeholder}
              style={inputStyle}
              className="w-full border rounded-lg px-3 py-2.5 text-sm placeholder-[#9ca3af] focus:outline-none transition-colors"
            />
          </div>
        ))}

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
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p style={labelStyle} className="text-center text-xs mt-6">
        Already have an account?{" "}
        <Link
          href="/login"
          style={{ color: "var(--color-text-secondary)" }}
          className="hover:underline transition-colors">
          Sign in
        </Link>
      </p>
    </div>
  );
}
