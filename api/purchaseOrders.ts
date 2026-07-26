import api from "@/lib/api";
import type {
  PurchaseOrder, CreatePoPayload, UpdatePoPayload,
  StockInfo, StockBatch, ProductPricingData, PricingMethod,
} from "@/types/purchaseOrder";

const BASE = `/api/purchase-orders`;

// ─── purchase orders ──────────────────────────────────────────────────────────

export async function listPurchaseOrders(productId?: string): Promise<PurchaseOrder[]> {
  const params = productId ? `?productId=${productId}` : '';
  const { data } = await api.get<PurchaseOrder[]>(`${BASE}${params}`);
  return data;
}

export async function getPurchaseOrder(id: string): Promise<PurchaseOrder> {
  const { data } = await api.get<PurchaseOrder>(`${BASE}/${id}`);
  return data;
}

export async function createPurchaseOrder(payload: CreatePoPayload): Promise<PurchaseOrder> {
  const { data } = await api.post<PurchaseOrder>(`${BASE}`, payload);
  return data;
}

export async function updatePurchaseOrder(id: string, payload: UpdatePoPayload): Promise<PurchaseOrder> {
  const { data } = await api.patch<PurchaseOrder>(`${BASE}/${id}`, payload);
  return data;
}

export async function cancelPurchaseOrder(id: string): Promise<PurchaseOrder> {
  const { data } = await api.post<PurchaseOrder>(`${BASE}/${id}/cancel`);
  return data;
}

export async function deliverPurchaseOrderItem(poId: string, itemId: string): Promise<PurchaseOrder> {
  const { data } = await api.post<PurchaseOrder>(`${BASE}/${poId}/items/${itemId}/deliver`);
  return data;
}

// ─── stock ────────────────────────────────────────────────────────────────────

export async function getStock(productId: string): Promise<StockInfo> {
  const { data } = await api.get<StockInfo>(`${BASE}/stock/${productId}`);
  return data;
}

export async function setLowStockThreshold(productId: string, threshold: number | null): Promise<StockInfo> {
  const { data } = await api.patch<StockInfo>(`${BASE}/stock/${productId}/threshold`, { threshold });
  return data;
}

export async function getStockBatches(productId: string): Promise<StockBatch[]> {
  const { data } = await api.get<StockBatch[]>(`${BASE}/stock/${productId}/batches`);
  return data;
}

// ─── pricing ──────────────────────────────────────────────────────────────────

export async function getProductPricing(productId: string): Promise<ProductPricingData> {
  const { data } = await api.get<ProductPricingData>(`${BASE}/pricing/${productId}`);
  return data;
}

export async function updatePricingConfig(
  productId: string,
  pricingMethod: PricingMethod,
  manualPrice?: number | null,
): Promise<{ currentPrice: number | null }> {
  const { data } = await api.put<{ currentPrice: number | null }>(
    `${BASE}/pricing/${productId}`,
    { pricingMethod, manualPrice },
  );
  return data;
}
