import api from "@/lib/api";
import type {
  Customer, CustomerContact, CustomerWithContacts,
  CreateCustomerPayload, UpdateCustomerPayload,
  CreateContactPayload, UpdateContactPayload,
} from "@/types/customer";

export async function getCustomers(): Promise<Customer[]> {
  const { data } = await api.get<Customer[]>("/api/customers");
  return data;
}

export async function getCustomer(id: string): Promise<CustomerWithContacts> {
  const { data } = await api.get<CustomerWithContacts>(`/api/customers/${id}`);
  return data;
}

export async function createCustomer(payload: CreateCustomerPayload): Promise<Customer> {
  const { data } = await api.post<Customer>("/api/customers", payload);
  return data;
}

export async function updateCustomer(id: string, payload: UpdateCustomerPayload): Promise<Customer> {
  const { data } = await api.patch<Customer>(`/api/customers/${id}`, payload);
  return data;
}

export async function deleteCustomer(id: string): Promise<void> {
  await api.delete(`/api/customers/${id}`);
}

export async function getContacts(customerId: string): Promise<CustomerContact[]> {
  const { data } = await api.get<CustomerContact[]>(`/api/customers/${customerId}/contacts`);
  return data;
}

export async function createContact(customerId: string, payload: CreateContactPayload): Promise<CustomerContact> {
  const { data } = await api.post<CustomerContact>(`/api/customers/${customerId}/contacts`, payload);
  return data;
}

export async function updateContact(customerId: string, contactId: string, payload: UpdateContactPayload): Promise<CustomerContact> {
  const { data } = await api.patch<CustomerContact>(`/api/customers/${customerId}/contacts/${contactId}`, payload);
  return data;
}

export async function deleteContact(customerId: string, contactId: string): Promise<void> {
  await api.delete(`/api/customers/${customerId}/contacts/${contactId}`);
}
