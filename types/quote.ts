export const QUOTE_STATUSES = ['draft', 'sent', 'accepted', 'rejected', 'expired'] as const;
export type QuoteStatus = typeof QUOTE_STATUSES[number];

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft:    'Draft',
  sent:     'Sent',
  accepted: 'Accepted',
  rejected: 'Rejected',
  expired:  'Expired',
};

export const QUOTE_NEXT_STATUS: Record<QuoteStatus, QuoteStatus | null> = {
  draft:    'sent',
  sent:     'accepted',
  accepted: null,
  rejected: null,
  expired:  null,
};

// ─── item ─────────────────────────────────────────────────────────────────────

export interface QuoteItem {
  id:          string;
  productId:   string;
  displayName: string;
  productSku:  string | null;
  quantity:    number;
  unitPrice:   number | null;
  totalAmount: number | null;
  notes:       string | null;
}

// ─── quote ────────────────────────────────────────────────────────────────────

export interface Quote {
  id:           string;
  quoteNumber:  string;
  status:       QuoteStatus;
  customerId:   string | null;
  customerName: string | null;
  notes:        string | null;
  validUntil:   string | null;
  createdAt:    string;
  updatedAt:    string;
  createdBy:    string | null;
  items:        QuoteItem[];
  totalAmount:  number;
  itemCount:    number;
}

// ─── payloads ─────────────────────────────────────────────────────────────────

export interface QuoteItemInput {
  productId:    string;
  displayName?: string | null; // defaults to product name if omitted
  quantity:     number;
  unitPrice?:   number | null;
  notes?:       string | null;
}

export interface CreateQuotePayload {
  customerId?: string | null;
  notes?:      string | null;
  validUntil?: string | null;
  items:       QuoteItemInput[];
}

export interface UpdateQuotePayload {
  customerId?: string | null;
  notes?:      string | null;
  validUntil?: string | null;
  status?:     QuoteStatus;
}
