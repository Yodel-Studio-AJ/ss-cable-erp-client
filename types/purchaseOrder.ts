export const PO_STATUSES = ['draft', 'confirmed', 'in_transit', 'delivered', 'cancelled'] as const;
export type PoStatus = typeof PO_STATUSES[number];

export const PRICING_METHODS = ['weighted_average', 'average_all', 'latest_lot', 'oldest_lot', 'manual'] as const;
export type PricingMethod = typeof PRICING_METHODS[number];

export const PO_STATUS_LABELS: Record<PoStatus, string> = {
  draft:      'Draft',
  confirmed:  'Confirmed',
  in_transit: 'In Transit',
  delivered:  'Delivered',
  cancelled:  'Cancelled',
};

export const PO_NEXT_STATUS: Record<PoStatus, PoStatus | null> = {
  draft:      'confirmed',
  confirmed:  'in_transit',
  in_transit: 'delivered',
  delivered:  null,
  cancelled:  null,
};

export const PRICING_METHOD_LABELS: Record<PricingMethod, string> = {
  weighted_average: 'Weighted Average',
  average_all:      'Average All Lots',
  latest_lot:       'Latest Lot Price',
  oldest_lot:       'Oldest Lot Price',
  manual:           'Manual / Fixed',
};

// ─── item ─────────────────────────────────────────────────────────────────────

export interface PurchaseOrderItem {
  id:               string;
  productId:        string;
  productName:      string;
  productSku:       string | null;
  quantityOrdered:  number;
  unitPrice:        number | null;
  totalAmount:      number | null;
  quantityReceived: number;
  deliveredAt:      string | null;
  notes:            string | null;
}

// ─── purchase order ───────────────────────────────────────────────────────────

export interface PurchaseOrder {
  id:                   string;
  poNumber:             string;
  status:               PoStatus;
  vendorId:             string | null;
  vendorName:           string | null;
  notes:                string | null;
  expectedDeliveryDate: string | null;
  deliveredAt:          string | null;
  createdAt:            string;
  updatedAt:            string;
  createdBy:            string | null;
  items:                PurchaseOrderItem[];
  totalAmount:          number;
  itemCount:            number;
  allDelivered:         boolean;
}

// ─── payloads ─────────────────────────────────────────────────────────────────

export interface PoItemInput {
  productId:       string;
  quantityOrdered: number;
  unitPrice?:      number | null;
  notes?:          string | null;
}

export interface CreatePoPayload {
  vendorId?:             string | null;
  notes?:                string | null;
  expectedDeliveryDate?: string | null;
  items:                 PoItemInput[];
}

export interface UpdatePoPayload {
  vendorId?:             string | null;
  notes?:                string | null;
  expectedDeliveryDate?: string | null;
  status?:               PoStatus;
}

// ─── stock / pricing / history ────────────────────────────────────────────────

export interface StockInfo {
  productId:         string;
  quantityOnHand:    number;
  lowStockThreshold: number | null;
  updatedAt:         string;
}

export interface StockBatch {
  id:              string;
  productId:       string;
  purchaseOrderId: string | null;
  lotNumber:       string | null;
  quantity:        number;
  unitCost:        number | null;
  totalCost:       number | null;
  receivedAt:      string;
  notes:           string | null;
}

export interface PricingConfig {
  id:            string;
  productId:     string;
  pricingMethod: PricingMethod;
  currentPrice:  number | null;
  updatedAt:     string;
}

export interface PriceHistoryEntry {
  id:              string;
  productId:       string;
  price:           number;
  pricingMethod:   PricingMethod;
  stockBatchId:    string | null;
  purchaseOrderId: string | null;
  lotUnitCost:     number | null;
  createdAt:       string;
  notes:           string | null;
}

export interface ProductPricingData {
  config:  PricingConfig | null;
  history: PriceHistoryEntry[];
}
