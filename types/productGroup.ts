export type ProductGroupType =
  | "raw_material"
  | "intermediate"
  | "finished_goods"
  | "processed_product";

export type MaterialType = "metal" | "pvc" | "mixed";

export interface ProductGroup {
  id: string;
  name: string;
  type: ProductGroupType;
  isProcured: boolean;
  materialType: MaterialType;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductGroupPayload {
  name: string;
  type: ProductGroupType;
  isProcured: boolean;
  materialType: MaterialType;
}

export type UpdateProductGroupPayload = Partial<CreateProductGroupPayload>;

export const PRODUCT_GROUP_TYPE_LABELS: Record<ProductGroupType, string> = {
  raw_material: "Raw Material",
  intermediate: "Intermediate",
  finished_goods: "Finished Goods",
  processed_product: "Processed Product",
};

export const MATERIAL_TYPE_LABELS: Record<MaterialType, string> = {
  metal: "Metal",
  pvc: "PVC",
  mixed: "Mixed",
};
