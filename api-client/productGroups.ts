import api from "@/lib/api";
import type {
  ProductGroup,
  CreateProductGroupPayload,
  UpdateProductGroupPayload,
} from "@/types/productGroup";

export async function getProductGroups(): Promise<ProductGroup[]> {
  const { data } = await api.get<ProductGroup[]>("/api/product-groups");
  return data;
}

export async function getProductGroup(id: string): Promise<ProductGroup> {
  const { data } = await api.get<ProductGroup>(`/api/product-groups/${id}`);
  return data;
}

export async function createProductGroup(payload: CreateProductGroupPayload): Promise<ProductGroup> {
  const { data } = await api.post<ProductGroup>("/api/product-groups", payload);
  return data;
}

export async function updateProductGroup(id: string, payload: UpdateProductGroupPayload): Promise<ProductGroup> {
  const { data } = await api.patch<ProductGroup>(`/api/product-groups/${id}`, payload);
  return data;
}

export async function deleteProductGroup(id: string): Promise<void> {
  await api.delete(`/api/product-groups/${id}`);
}
