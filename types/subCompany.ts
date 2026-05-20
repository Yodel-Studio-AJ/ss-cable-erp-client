import type { UserRole } from "./auth";

export interface SubCompany {
  id: string;
  name: string;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SubCompanyMember {
  userId: string;
  subCompanyId: string;
  isPrimary: boolean;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    phoneNumber: string;
    role: UserRole;
    isActive: boolean;
  };
}

export interface CreateSubCompanyPayload {
  name: string;
  address?: string;
  city?: string;
  phone?: string;
}

export type UpdateSubCompanyPayload = Partial<CreateSubCompanyPayload>;

export interface AddMemberPayload {
  userId: string;
  isPrimary: boolean;
}
