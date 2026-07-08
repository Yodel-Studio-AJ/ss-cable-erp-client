import api from "@/lib/api";
import type { Vendor, CreateVendorPayload, UpdateVendorPayload } from "@/types/vendor";

export async function getVendors(): Promise<Vendor[]> {
  const { data } = await api.get<Vendor[]>("/api/vendors");
  return data;
}

export async function getVendor(id: string): Promise<Vendor> {
  const { data } = await api.get<Vendor>(`/api/vendors/${id}`);
  return data;
}

export async function createVendor(payload: CreateVendorPayload): Promise<Vendor> {
  const { data } = await api.post<Vendor>("/api/vendors", payload);
  return data;
}

export async function updateVendor(id: string, payload: UpdateVendorPayload): Promise<Vendor> {
  const { data } = await api.patch<Vendor>(`/api/vendors/${id}`, payload);
  return data;
}

export async function deleteVendor(id: string): Promise<void> {
  await api.delete(`/api/vendors/${id}`);
}

export async function setVendorProductGroups(id: string, productGroupIds: string[]): Promise<void> {
  await api.put(`/api/vendors/${id}/product-groups`, { productGroupIds });
}
