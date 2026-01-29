import { Item } from "@/types";

// サンプルデータ（後でAPI/DBに置き換え）
export const sampleItems: Item[] = [
  {
    id: "1",
    recordType: "item",
    name: "ThinkPad X1 Carbon",
    category: "PC本体",
    purchasePrice: 15000,
    purchaseDate: "2025-01-10",
    miscExpense: 500,
    consumableExpense: 300,
    sellingPrice: 28000,
    soldDate: "2025-01-18",
    status: "販売済み",
    memo: "第8世代 Core i5 / 8GB RAM",
    createdAt: "2025-01-10T10:00:00Z",
  },
  {
    id: "2",
    recordType: "item",
    name: "DDR4 16GB (8GBx2)",
    category: "パーツ",
    purchasePrice: 2000,
    purchaseDate: "2025-01-15",
    miscExpense: 0,
    consumableExpense: 0,
    sellingPrice: null,
    soldDate: null,
    status: "在庫",
    memo: "PC4-21300",
    createdAt: "2025-01-15T10:00:00Z",
  },
  {
    id: "3",
    recordType: "item",
    name: "Dell OptiPlex 7050",
    category: "PC本体",
    purchasePrice: 8000,
    purchaseDate: "2025-01-20",
    miscExpense: 200,
    consumableExpense: 150,
    sellingPrice: null,
    soldDate: null,
    status: "在庫",
    memo: "Core i5-7500 / SSD 256GB",
    createdAt: "2025-01-20T10:00:00Z",
  },
  {
    id: "4",
    recordType: "item",
    name: "USB-C ハブ",
    category: "周辺機器",
    purchasePrice: 500,
    purchaseDate: "2025-01-12",
    miscExpense: 0,
    consumableExpense: 100,
    sellingPrice: 1500,
    soldDate: "2025-01-22",
    status: "販売済み",
    memo: "",
    createdAt: "2025-01-12T10:00:00Z",
  },
];

// カテゴリ一覧
export const categories = ["PC本体", "パーツ", "周辺機器", "その他"] as const;

// ステータス一覧
export const statuses = ["在庫", "販売済み"] as const;
