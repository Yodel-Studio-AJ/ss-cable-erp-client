import api from "@/lib/api";
import type { GroupInput, AddGroupInputPayload, UpdateGroupInputPayload } from "@/types/productGroupInput";

export async function getGroupInputs(productGroupId: string): Promise<GroupInput[]> {
  const { data } = await api.get<GroupInput[]>(`/api/product-groups/${productGroupId}/inputs`);
  return data;
}

export async function addGroupInput(
  productGroupId: string,
  payload: AddGroupInputPayload,
): Promise<GroupInput> {
  const { data } = await api.post<GroupInput>(
    `/api/product-groups/${productGroupId}/inputs`,
    payload,
  );
  return data;
}

export async function updateGroupInput(
  productGroupId: string,
  inputId: string,
  payload: UpdateGroupInputPayload,
): Promise<GroupInput> {
  const { data } = await api.patch<GroupInput>(
    `/api/product-groups/${productGroupId}/inputs/${inputId}`,
    payload,
  );
  return data;
}

export async function removeGroupInput(
  productGroupId: string,
  inputId: string,
): Promise<void> {
  await api.delete(`/api/product-groups/${productGroupId}/inputs/${inputId}`);
}
