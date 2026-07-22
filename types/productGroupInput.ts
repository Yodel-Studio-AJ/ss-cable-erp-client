import type { ProductGroupType } from './productGroup';

export interface FormulaVar {
  pgaId:     string;
  groupId:   string;
  groupName: string;
  attrName:  string;
  alias:     string;  // effective alias — used for display only, not for evaluation
}

export type FormulaVars = Record<string, FormulaVar>;

export interface GroupInput {
  id:            string;
  outputGroupId: string;
  inputGroupId:  string;
  qtyFormula:    string;
  formulaVars:   FormulaVars | null;
  yieldFactor:   string;   // decimal string from DB
  label:         string | null;
  sortOrder:     number;
  notes:         string | null;
  createdAt:     string;
  inputGroup: {
    id:   string;
    name: string;
    type: ProductGroupType;
  };
}

export interface AddGroupInputPayload {
  inputGroupId: string;
  qtyFormula:   string;
  formulaVars?: FormulaVars;
  yieldFactor?: number;
  label?:       string;
  sortOrder?:   number;
  notes?:       string;
}

export interface UpdateGroupInputPayload {
  qtyFormula?:   string;
  formulaVars?:  FormulaVars | null;
  yieldFactor?:  number;
  label?:        string | null;
  sortOrder?:    number;
  notes?:        string | null;
}
