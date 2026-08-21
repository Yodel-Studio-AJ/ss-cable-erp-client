/**
 * BOM Sandbox — shared types and utilities for the parallel BOM compare feature.
 * State is persisted in localStorage under BOM_SANDBOX_KEY.
 */

import type { BomResult, BomInputResult } from "@/api-client/bom";

export const BOM_SANDBOX_KEY = "bom-sandbox-v1";

// ─── types ────────────────────────────────────────────────────────────────────

/**
 * An editable node in the parallel BOM tree.
 * Mirrors one BomInputResult but allows the user to override the chosen input product
 * and the chosen sub-level inputs (children).
 */
export type EditNode = {
  /** Which BOM input slot (= productGroupInputId in the DB). */
  bomInputId: string;
  label: string | null;
  inputGroupId: string;
  inputGroupName: string;
  yieldFactor: number;

  /** Original input product (from real BOM snapshot). */
  originalProductId: string;
  originalProductName: string;

  /** Currently selected product (user can swap). */
  currentProductId: string;
  currentProductName: string;

  /** Original qty from real BOM result (null if formula couldn't evaluate). */
  originalQty: number | null;

  /** Optional manual qty override — null means "derive from formula / original". */
  manualQty: number | null;

  /** Sub-BOM nodes (this node's own BOM inputs). */
  children: EditNode[];
};

/**
 * A variant that was created during this sandbox session.
 */
export type SessionVariant = {
  originalId: string;
  newId: string;
  newName: string;
  groupId: string;
  groupName: string;
};

/**
 * The full sandbox state saved to localStorage.
 */
export type BomSandbox = {
  productId: string;
  productName: string;
  productGroupId: string;
  outputQty: number;
  /** Frozen real BOM used as the left-panel reference. */
  realBom: BomResult;
  /** Editable parallel tree (null = not yet initialised). */
  editTree: EditNode[] | null;
  /** Direct attribute overrides on the OUTPUT product (e.g. PVC ratios). pgaId → value */
  attrOverrides: Record<string, number | string>;
  /** Variants created during this session. */
  sessionVariants: SessionVariant[];
  savedAt: number;
};

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Build an EditNode tree from a BomResult snapshot. */
export function bomResultToEditTree(results: BomInputResult[]): EditNode[] {
  return results.map((r): EditNode => ({
    bomInputId:          r.bomInputId,
    label:               r.label,
    inputGroupId:        r.inputGroupId,
    inputGroupName:      r.inputGroupName,
    yieldFactor:         r.yieldFactor,
    originalProductId:   r.inputProduct.id,
    originalProductName: r.inputProduct.name,
    currentProductId:    r.inputProduct.id,
    currentProductName:  r.inputProduct.name,
    originalQty:         r.requiredQty,
    manualQty:           null,
    children:            r.subBom ? bomResultToEditTree(r.subBom.inputResults) : [],
  }));
}

/** Count how many nodes (at any depth) differ from their original. */
export function countChanges(tree: EditNode[]): number {
  let n = 0;
  for (const node of tree) {
    if (node.currentProductId !== node.originalProductId || node.manualQty !== null) n++;
    n += countChanges(node.children);
  }
  return n;
}

/** True if any direct child differs from its original (triggers parent variant creation). */
export function childrenChanged(node: EditNode): boolean {
  return node.children.some(
    (c) => c.currentProductId !== c.originalProductId || c.manualQty !== null || childrenChanged(c),
  );
}

/**
 * Immutably update a node in the tree, matched by bomInputId at any depth.
 * Returns a new tree (reference-unchanged sub-trees are reused).
 */
export function updateNodeInTree(
  tree: EditNode[],
  bomInputId: string,
  updater: (n: EditNode) => EditNode,
): EditNode[] {
  return tree.map((node) => {
    if (node.bomInputId === bomInputId) return updater(node);
    const children = updateNodeInTree(node.children, bomInputId, updater);
    if (children === node.children) return node;
    return { ...node, children };
  });
}

/** Read sandbox from localStorage. */
export function readSandbox(): BomSandbox | null {
  try {
    const raw = localStorage.getItem(BOM_SANDBOX_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as BomSandbox;
  } catch {
    return null;
  }
}

/** Write sandbox to localStorage. */
export function writeSandbox(s: BomSandbox): void {
  localStorage.setItem(BOM_SANDBOX_KEY, JSON.stringify(s));
}

/** Clear sandbox from localStorage. */
export function clearSandbox(): void {
  localStorage.removeItem(BOM_SANDBOX_KEY);
}
