export type AttributeDataType = 'string' | 'number';

export interface Attribute {
  id:        string;
  name:      string;
  unit:      string | null;
  dataType:  AttributeDataType;
  createdAt: string;
  updatedAt: string;
}

// A single attribute as it appears within a product group
export interface GroupAttribute {
  id:             string;
  productGroupId: string;
  attributeId:    string;
  formulaAlias:   string | null;   // null → derived from attribute.name at runtime
  isCalculated:   boolean;
  formula:        string | null;   // formula referencing sibling formulaAliases
  isQuantityBasis: boolean;        // the ONE "measured in / stock unit" attribute
  sortOrder:      number;
  createdAt:      string;
  attribute: {
    id:       string;
    name:     string;
    unit:     string | null;
    dataType: AttributeDataType;
  };
}

export interface CreateAttributePayload {
  name:      string;
  unit?:     string;
  dataType?: AttributeDataType;
}

export type UpdateAttributePayload = Partial<CreateAttributePayload>;

export interface AddGroupAttributePayload {
  attributeId:     string;
  formulaAlias?:   string;
  isCalculated?:   boolean;
  formula?:        string;
  isQuantityBasis?: boolean;
  sortOrder?:      number;
}

export interface UpdateGroupAttributePayload {
  formulaAlias?:   string | null;
  isCalculated?:   boolean;
  formula?:        string | null;
  isQuantityBasis?: boolean;
  sortOrder?:      number;
}

/** Derive the formula variable name from an attribute name when no alias is set */
export function deriveAlias(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

/** Returns the effective alias to use in formula expressions */
export function effectiveAlias(ga: Pick<GroupAttribute, 'formulaAlias' | 'attribute'>): string {
  return ga.formulaAlias ?? deriveAlias(ga.attribute.name);
}
