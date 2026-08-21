"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  FileText, Plus, Search, ChevronRight, Package,
  CheckCircle, XCircle, Clock, Send,
} from "lucide-react";
import { listQuotes } from "@/api-client/quotes";
import { listAllProducts } from "@/api-client/products";
import { getCustomers } from "@/api-client/customers";
import type { Quote, QuoteStatus } from "@/types/quote";
import { QUOTE_STATUS_LABELS } from "@/types/quote";
import type { ProductWithGroup } from "@/api-client/products";
import type { Customer } from "@/types/customer";
import { CreateQuoteModal } from "@/components/quotes/CreateQuoteModal";

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(n: number) {
  if (!n) return "—";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);
}

const STATUS_ICON: Record<QuoteStatus, React.ReactNode> = {
  draft:    <FileText size={12} />,
  sent:     <Send size={12} />,
  accepted: <CheckCircle size={12} />,
  rejected: <XCircle size={12} />,
  expired:  <Clock size={12} />,
};

const STATUS_COLOR: Record<QuoteStatus, string> = {
  draft:    "#6b7280",
  sent:     "#3b82f6",
  accepted: "#22c55e",
  rejected: "#ef4444",
  expired:  "#f59e0b",
};

function StatusBadge({ status }: { status: QuoteStatus }) {
  const color = STATUS_COLOR[status];
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap"
      style={{
        color,
        backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
      }}>
      {STATUS_ICON[status]} {QUOTE_STATUS_LABELS[status]}
    </span>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function QuotesPage() {
  const [quotesList, setQuotesList] = useState<Quote[]>([]);
  const [products, setProducts]     = useState<ProductWithGroup[]>([]);
  const [customers, setCustomers]   = useState<Customer[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch]         = useState("");
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | "">("");

  useEffect(() => {
    Promise.all([listQuotes(), listAllProducts(), getCustomers()])
      .then(([qs, prods, custs]) => { setQuotesList(qs); setProducts(prods); setCustomers(custs); })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return quotesList.filter((quote) => {
      const matchSearch =
        !q ||
        quote.quoteNumber.toLowerCase().includes(q) ||
        quote.items.some((it) => it.displayName.toLowerCase().includes(q)) ||
        (quote.customerName?.toLowerCase().includes(q) ?? false);
      const matchStatus = !statusFilter || quote.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [quotesList, search, statusFilter]);

  function handleCreated(quote: Quote) {
    setQuotesList((prev) => [quote, ...prev]);
    setShowCreate(false);
  }

  if (loading) {
    return <div className="p-8 text-center text-sm" style={{ color: "var(--color-text-muted)" }}>Loading…</div>;
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl" style={{ backgroundColor: "var(--color-bg-subtle)" }}>
            <FileText size={18} style={{ color: "var(--color-text-secondary)" }} />
          </div>
          <div>
            <h1 className="text-xl font-semibold" style={{ color: "var(--color-text-primary)" }}>Quotes</h1>
            <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>{quotesList.length} total</p>
          </div>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium hover:opacity-80 transition-opacity"
          style={{ backgroundColor: "var(--color-btn-bg)", color: "var(--color-btn-text)" }}>
          <Plus size={14} /> New Quote
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--color-text-muted)" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search quote number, product, customer…"
            className="w-full border rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none"
            style={{ backgroundColor: "var(--color-bg-input)", borderColor: "var(--color-border-input)", color: "var(--color-text-primary)" }} />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as QuoteStatus | "")}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none"
          style={{ backgroundColor: "var(--color-bg-input)", borderColor: "var(--color-border-input)", color: "var(--color-text-primary)" }}>
          <option value="">All Statuses</option>
          {(["draft", "sent", "accepted", "rejected", "expired"] as QuoteStatus[]).map((s) => (
            <option key={s} value={s}>{QUOTE_STATUS_LABELS[s]}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="border rounded-xl overflow-hidden"
        style={{ backgroundColor: "var(--color-bg-popup)", borderColor: "var(--color-border)" }}>
        {filtered.length === 0 ? (
          <div className="text-center py-12" style={{ color: "var(--color-text-muted)" }}>
            <FileText size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">
              {quotesList.length === 0 ? "No quotes yet." : "No quotes match your search."}
            </p>
            {quotesList.length === 0 && (
              <button onClick={() => setShowCreate(true)} className="mt-3 text-sm underline hover:opacity-70">
                Create the first one
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-[6rem_1fr_1fr_5rem_7rem_5rem_2rem] items-center px-5 py-2.5
              text-[11px] font-medium uppercase tracking-wider"
              style={{ color: "var(--color-text-muted)", borderBottom: "1px solid var(--color-border)" }}>
              <span>Quote #</span><span>Products</span><span>Customer</span>
              <span className="text-center">Items</span><span className="text-right">Total</span>
              <span>Status</span><span />
            </div>
            {filtered.map((quote, idx) => (
              <Link key={quote.id} href={`/sales/quotes/${quote.id}`}
                className="grid grid-cols-[6rem_1fr_1fr_5rem_7rem_5rem_2rem] items-center px-5 py-3.5 gap-x-3
                  hover:opacity-80 transition-opacity"
                style={{ borderTop: idx > 0 ? "1px solid var(--color-border)" : undefined }}>
                <span className="text-xs font-mono font-medium"
                  style={{ color: "var(--color-text-secondary)" }}>{quote.quoteNumber}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--color-text-primary)" }}>
                    {quote.items[0]?.displayName ?? "—"}
                  </p>
                  {quote.itemCount > 1 && (
                    <p className="text-[10px] mt-0.5 flex items-center gap-1" style={{ color: "var(--color-text-muted)" }}>
                      <Package size={10} /> +{quote.itemCount - 1} more item{quote.itemCount - 1 > 1 ? "s" : ""}
                    </p>
                  )}
                </div>
                <span className="text-sm truncate" style={{ color: "var(--color-text-secondary)" }}>
                  {quote.customerName ?? <span style={{ color: "var(--color-text-muted)" }}>—</span>}
                </span>
                <span className="text-sm text-center font-mono" style={{ color: "var(--color-text-secondary)" }}>
                  {quote.itemCount}
                </span>
                <span className="text-sm text-right font-mono tabular-nums"
                  style={{ color: "var(--color-text-secondary)" }}>
                  {formatCurrency(quote.totalAmount)}
                </span>
                <StatusBadge status={quote.status} />
                <ChevronRight size={14} style={{ color: "var(--color-text-muted)" }} />
              </Link>
            ))}
          </>
        )}
      </div>

      {showCreate && (
        <CreateQuoteModal products={products} customers={customers}
          onCreated={handleCreated} onClose={() => setShowCreate(false)} />
      )}
    </div>
  );
}
