export type VendorType = 'manufacturer' | 'distributor' | 'wholesaler' | 'trader';

export interface Vendor {
  id:                  string;
  orgId:               string | null;
  createdByUserId:     string | null;
  companyName:         string;
  vendorType:          VendorType;
  specialization:      string | null;
  gstin:               string | null;
  address:             string | null;
  city:                string | null;
  state:               string | null;
  pincode:             string | null;
  contactName:         string;
  contactPhone:        string | null;
  contactEmail:        string | null;
  contactDesignation:  string | null;
  createdAt:           string;
  updatedAt:           string;
  productGroupIds:     string[];
  branchIds:           string[];
}

export interface CreateVendorPayload {
  companyName:         string;
  vendorType?:         VendorType;
  specialization?:     string;
  gstin?:              string;
  address?:            string;
  city?:               string;
  state?:              string;
  pincode?:            string;
  contactName:         string;
  contactPhone?:       string;
  contactEmail?:       string;
  contactDesignation?: string;
}

export type UpdateVendorPayload = Partial<CreateVendorPayload>;
