export interface Customer {
  id:              string;
  orgId:           string | null;
  createdByUserId: string | null;
  companyName:     string;
  industry:        string | null;
  gstin:           string | null;
  address:         string | null;
  city:            string | null;
  state:           string | null;
  pincode:         string | null;
  notes:           string | null;
  createdAt:       string;
  updatedAt:       string;
}

export interface CustomerContact {
  id:          string;
  customerId:  string;
  name:        string;
  phone:       string | null;
  email:       string | null;
  designation: string | null;
  isPrimary:   boolean;
  createdAt:   string;
  updatedAt:   string;
}

export interface CustomerWithContacts extends Customer {
  contacts: CustomerContact[];
}

export interface CreateCustomerPayload {
  companyName: string;
  industry?:   string;
  gstin?:      string;
  address?:    string;
  city?:       string;
  state?:      string;
  pincode?:    string;
  notes?:      string;
}

export type UpdateCustomerPayload = Partial<CreateCustomerPayload>;

export interface CreateContactPayload {
  name:         string;
  phone?:       string;
  email?:       string;
  designation?: string;
  isPrimary?:   boolean;
}

export type UpdateContactPayload = Partial<CreateContactPayload>;
