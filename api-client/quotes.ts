import api from "@/lib/api";
import type { Quote, CreateQuotePayload, UpdateQuotePayload, QuoteItemInput } from "@/types/quote";

const BASE = `/api/quotes`;

export async function listQuotes(customerId?: string): Promise<Quote[]> {
  const params = customerId ? `?customerId=${customerId}` : '';
  const { data } = await api.get<Quote[]>(`${BASE}${params}`);
  return data;
}

export async function getQuote(id: string): Promise<Quote> {
  const { data } = await api.get<Quote>(`${BASE}/${id}`);
  return data;
}

export async function createQuote(payload: CreateQuotePayload): Promise<Quote> {
  const { data } = await api.post<Quote>(`${BASE}`, payload);
  return data;
}

export async function updateQuote(id: string, payload: UpdateQuotePayload): Promise<Quote> {
  const { data } = await api.patch<Quote>(`${BASE}/${id}`, payload);
  return data;
}

export async function addQuoteItem(quoteId: string, item: QuoteItemInput): Promise<Quote> {
  const { data } = await api.post<Quote>(`${BASE}/${quoteId}/items`, item);
  return data;
}

export async function removeQuoteItem(quoteId: string, itemId: string): Promise<Quote> {
  const { data } = await api.delete<Quote>(`${BASE}/${quoteId}/items/${itemId}`);
  return data;
}
