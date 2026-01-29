import { Item, ItemStatus, Category, RecordType } from "@/types";
import { categories, statuses } from "@/lib/sample-data";

export const STORAGE_KEY = "inventory-items-v1";

const categorySet = new Set(categories as readonly string[]);
const statusSet = new Set(statuses as readonly string[]);
const recordTypeSet = new Set<RecordType>(["item", "expense"]);

export function normalizeItem(value: unknown): Item | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;

  if (
    typeof item.id !== "string" ||
    typeof item.name !== "string" ||
    typeof item.purchasePrice !== "number" ||
    typeof item.purchaseDate !== "string" ||
    typeof item.createdAt !== "string"
  ) {
    return null;
  }

  const category: Category =
    typeof item.category === "string" && categorySet.has(item.category)
      ? (item.category as Category)
      : "その他";
  const status: ItemStatus =
    typeof item.status === "string" && statusSet.has(item.status)
      ? (item.status as ItemStatus)
      : "在庫";
  const recordType: RecordType =
    typeof item.recordType === "string" &&
    recordTypeSet.has(item.recordType as RecordType)
      ? (item.recordType as RecordType)
      : "item";
  const sellingPrice =
    typeof item.sellingPrice === "number" ? item.sellingPrice : null;
  const soldDate = typeof item.soldDate === "string" ? item.soldDate : null;
  const miscExpense = typeof item.miscExpense === "number" ? item.miscExpense : 0;
  const consumableExpense =
    typeof item.consumableExpense === "number" ? item.consumableExpense : 0;
  const memo = typeof item.memo === "string" ? item.memo : "";

  return {
    id: item.id,
    recordType,
    name: item.name,
    category,
    purchasePrice: item.purchasePrice,
    purchaseDate: item.purchaseDate,
    miscExpense,
    consumableExpense,
    sellingPrice,
    soldDate,
    status,
    memo,
    createdAt: item.createdAt,
  };
}

export function loadItemsFromStorage(): Item[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const normalized = parsed
      .map(normalizeItem)
      .filter((item): item is Item => item !== null);
    return normalized.length > 0 ? normalized : [];
  } catch {
    return null;
  }
}
