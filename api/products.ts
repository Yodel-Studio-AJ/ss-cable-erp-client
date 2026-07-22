import api from "@/lib/api";
import type { Product, CreateProductPayload, UpdateProductPayload } from "@/types/product";

export interface ProductWithGroup extends Product {
  groupName: string;
}

export async function listAllProducts(): Promise<ProductWithGroup[]> {
  const { data } = await api.get<ProductWithGroup[]>(`/api/products`);
  return data;
}

export async function listGroupProducts(groupId: string): Promise<Product[]> {
  const { data } = await api.get<Product[]>(`/api/product-groups/${groupId}/products`);
  return data;
}

export async function getGroupProduct(groupId: string, productId: string): Promise<Product> {
  const { data } = await api.get<Product>(`/api/product-groups/${groupId}/products/${productId}`);
  return data;
}

export async function createGroupProduct(groupId: string, payload: CreateProductPayload): Promise<Product> {
  const { data } = await api.post<Product>(`/api/product-groups/${groupId}/products`, payload);
  return data;
}

export async function updateGroupProduct(groupId: string, productId: string, payload: UpdateProductPayload): Promise<Product> {
  const { data } = await api.patch<Product>(`/api/product-groups/${groupId}/products/${productId}`, payload);
  return data;
}

export async function deleteGroupProduct(groupId: string, productId: string): Promise<void> {
  await api.delete(`/api/product-groups/${groupId}/products/${productId}`);
}
