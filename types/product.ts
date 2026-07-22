export interface ProductAttributeValue {
  id: string;
  productGroupAttributeId: string;
  numericValue: number | null;
  textValue: string | null;
}

export interface Product {
  id: string;
  productGroupId: string;
  name: string;
  sku: string | null;
  description: string | null;
  isActive: boolean;
  attributeValues: ProductAttributeValue[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductPayload {
  name: string;
  sku?: string | null;
  description?: string | null;
  attributeValues: {
    productGroupAttributeId: string;
    numericValue?: number | null;
    textValue?: string | null;
  }[];
}

export type UpdateProductPayload = Partial<CreateProductPayload>;
