import api from "@/lib/api";
import type { User, UserRole } from "@/types/auth";

export interface CreateUserPayload {
  name: string;
  email: string;
  phoneNumber: string;
  password: string;
  role: UserRole;
}

export type UpdateUserPayload = Partial<Omit<CreateUserPayload, "password">>;

export async function getUsers(): Promise<User[]> {
  const { data } = await api.get<User[]>("/api/users");
  return data;
}

export async function getUser(id: string): Promise<User> {
  const { data } = await api.get<User>(`/api/users/${id}`);
  return data;
}

export async function createUser(payload: CreateUserPayload): Promise<User> {
  const { data } = await api.post<User>("/api/users", payload);
  return data;
}

export async function updateUser(id: string, payload: UpdateUserPayload): Promise<User> {
  const { data } = await api.patch<User>(`/api/users/${id}`, payload);
  return data;
}

export async function deleteUser(id: string): Promise<void> {
  await api.delete(`/api/users/${id}`);
}
