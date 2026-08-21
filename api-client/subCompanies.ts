import api from "@/lib/api";
import type {
  SubCompany,
  SubCompanyMember,
  CreateSubCompanyPayload,
  UpdateSubCompanyPayload,
  AddMemberPayload,
} from "@/types/subCompany";

export async function getSubCompanies(): Promise<SubCompany[]> {
  const { data } = await api.get<SubCompany[]>("/api/sub-companies");
  return data;
}

export async function getSubCompany(id: string): Promise<SubCompany> {
  const { data } = await api.get<SubCompany>(`/api/sub-companies/${id}`);
  return data;
}

export async function createSubCompany(payload: CreateSubCompanyPayload): Promise<SubCompany> {
  const { data } = await api.post<SubCompany>("/api/sub-companies", payload);
  return data;
}

export async function updateSubCompany(id: string, payload: UpdateSubCompanyPayload): Promise<SubCompany> {
  const { data } = await api.patch<SubCompany>(`/api/sub-companies/${id}`, payload);
  return data;
}

export async function deleteSubCompany(id: string): Promise<void> {
  await api.delete(`/api/sub-companies/${id}`);
}

export async function getSubCompanyMembers(id: string): Promise<SubCompanyMember[]> {
  const { data } = await api.get<SubCompanyMember[]>(`/api/sub-companies/${id}/users`);
  return data;
}

export async function addSubCompanyMember(subCompanyId: string, payload: AddMemberPayload): Promise<SubCompanyMember> {
  const { data } = await api.post<SubCompanyMember>(`/api/sub-companies/${subCompanyId}/users`, payload);
  return data;
}

export async function updateSubCompanyMember(
  subCompanyId: string,
  userId: string,
  isPrimary: boolean
): Promise<SubCompanyMember> {
  const { data } = await api.patch<SubCompanyMember>(
    `/api/sub-companies/${subCompanyId}/users/${userId}`,
    { isPrimary }
  );
  return data;
}

export async function removeSubCompanyMember(subCompanyId: string, userId: string): Promise<void> {
  await api.delete(`/api/sub-companies/${subCompanyId}/users/${userId}`);
}
