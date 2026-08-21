import api from "@/lib/api";
import type {
  Attribute,
  GroupAttribute,
  CreateAttributePayload,
  UpdateAttributePayload,
  AddGroupAttributePayload,
  UpdateGroupAttributePayload,
} from "@/types/attribute";

// ─── global attribute library ─────────────────────────────────────────────────

export async function getAttributes(): Promise<Attribute[]> {
  const { data } = await api.get<Attribute[]>("/api/attributes");
  return data;
}

export async function createAttribute(payload: CreateAttributePayload): Promise<Attribute> {
  const { data } = await api.post<Attribute>("/api/attributes", payload);
  return data;
}

export async function updateAttribute(id: string, payload: UpdateAttributePayload): Promise<Attribute> {
  const { data } = await api.patch<Attribute>(`/api/attributes/${id}`, payload);
  return data;
}

export async function deleteAttribute(id: string): Promise<void> {
  await api.delete(`/api/attributes/${id}`);
}

// ─── group-attribute management ───────────────────────────────────────────────

export async function getGroupAttributes(productGroupId: string): Promise<GroupAttribute[]> {
  const { data } = await api.get<GroupAttribute[]>(`/api/product-groups/${productGroupId}/attributes`);
  return data;
}

export async function addGroupAttribute(
  productGroupId: string,
  payload: AddGroupAttributePayload,
): Promise<GroupAttribute> {
  const { data } = await api.post<GroupAttribute>(
    `/api/product-groups/${productGroupId}/attributes`,
    payload,
  );
  return data;
}

export async function updateGroupAttribute(
  productGroupId: string,
  pgaId: string,
  payload: UpdateGroupAttributePayload,
): Promise<GroupAttribute> {
  const { data } = await api.patch<GroupAttribute>(
    `/api/product-groups/${productGroupId}/attributes/${pgaId}`,
    payload,
  );
  return data;
}

export async function removeGroupAttribute(productGroupId: string, pgaId: string): Promise<void> {
  await api.delete(`/api/product-groups/${productGroupId}/attributes/${pgaId}`);
}

export async function reorderGroupAttributes(
  productGroupId: string,
  orderedIds: string[],
): Promise<GroupAttribute[]> {
  const { data } = await api.put<GroupAttribute[]>(
    `/api/product-groups/${productGroupId}/attributes/reorder`,
    { orderedIds },
  );
  return data;
}
