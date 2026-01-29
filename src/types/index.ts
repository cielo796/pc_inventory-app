// 在庫ステータス
export type ItemStatus = "在庫" | "販売済み";

// レコード種別
export type RecordType = "item" | "expense";

// カテゴリ
export type Category = "PC本体" | "パーツ" | "周辺機器" | "その他";

// 在庫アイテム
export interface Item {
  id: string;
  recordType: RecordType;
  name: string;
  category: Category;
  purchasePrice: number;
  purchaseDate: string;
  miscExpense: number;
  consumableExpense: number;
  sellingPrice: number | null;
  soldDate: string | null;
  status: ItemStatus;
  memo: string;
  createdAt: string;
}

// 入力用データ
export interface ItemFormData {
  name: string;
  category: Category;
  purchasePrice: number;
  purchaseDate: string;
  miscExpense: number;
  consumableExpense: number;
  sellingPrice?: number;
  soldDate?: string;
  status: ItemStatus;
  memo: string;
}

// サマリー
export interface Summary {
  totalStock: number;
  totalSold: number;
  totalProfit: number;
  stockValue: number;
  totalMiscExpense: number;
  totalConsumableExpense: number;
}
