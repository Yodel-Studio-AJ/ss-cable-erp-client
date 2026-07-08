"use client";

import { create } from "zustand";
import { getCustomers, deleteCustomer } from "@/api/customers";
import type { Customer } from "@/types/customer";
import type { AxiosError } from "axios";

interface CustomerState {
  customers: Customer[];
  loading: boolean;
  error: string | null;
  permissionDenied: boolean;

  fetch: () => Promise<void>;
  add: (customer: Customer) => void;
  update: (customer: Customer) => void;
  remove: (id: string) => Promise<void>;
  setError: (error: string | null) => void;
}

export const useCustomerStore = create<CustomerState>((set) => ({
  customers: [],
  loading: false,
  error: null,
  permissionDenied: false,

  fetch: async () => {
    set({ loading: true, error: null });
    try {
      const data = await getCustomers();
      set({ customers: data, loading: false });
    } catch (err) {
      const status = (err as AxiosError).response?.status;
      if (status === 403) set({ permissionDenied: true, loading: false });
      else set({ error: "Failed to load customers.", loading: false });
    }
  },

  add: (customer) =>
    set((s) => ({ customers: [customer, ...s.customers] })),

  update: (customer) =>
    set((s) => ({
      customers: s.customers.map((c) => (c.id === customer.id ? customer : c)),
    })),

  remove: async (id) => {
    try {
      await deleteCustomer(id);
      set((s) => ({ customers: s.customers.filter((c) => c.id !== id) }));
    } catch {
      set({ error: "Failed to delete customer." });
    }
  },

  setError: (error) => set({ error }),
}));
