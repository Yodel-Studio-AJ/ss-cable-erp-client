import api from "@/lib/api";
import type { ProductAttributeValue } from "@/types/product";

export interface BomAttrValue extends ProductAttributeValue {
  productGroupAttributeId: string;
  formulaAlias?: string | null;
}

export interface BomQtyBasisAttr {
  attrName: string | null;
  attrUnit: string | null;
}

export interface BomProductSummary {
  id:            string;
  name:          string;
  groupName:     string;
  sku:           string | null;
  unitPrice:     number | null;
  pricingMethod: string | null;
  attributeValues: BomAttrValue[];
  qtyBasisAttr:    BomQtyBasisAttr | null;
}

export interface BomInputResult {
  bomInputId:     string;
  label:          string | null;
  inputGroupId:   string;
  inputGroupName: string;
  qtyFormula:     string;
  humanFormula:   string;
  yieldFactor:    number;
  notes:          string | null;
  inputProduct:   BomProductSummary;
  baseQty:        number | null;
  requiredQty:    number | null;
  error:          string | null;
  subBom:         BomResult | null;   // recursive BOM for this input material
}

export interface BomResult {
  outputProductId: string;
  outputProduct:   BomProductSummary;
  outputQty:       number;
  inputResults:    BomInputResult[];
}

export interface BomInput {
  id:             string;
  outputGroupId:  string;
  inputGroupId:   string;
  inputGroupName: string;
  qtyFormula:     string;
  yieldFactor:    string;
  label:          string | null;
  notes:          string | null;
  sortOrder:      number;
}

export async function getBomInputs(productId: string): Promise<BomInput[]> {
  const { data } = await api.get<BomInput[]>(`/api/bom/inputs/${productId}`);
  return data;
}

export async function calculateBom(payload: {
  outputProductId: string;
  outputQty:       number;
  inputs: { bomInputId: string; inputProductId: string }[];
}): Promise<BomResult> {
  const { data } = await api.post<BomResult>('/api/bom/calculate', payload);
  return data;
}
