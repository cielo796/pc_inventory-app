import { Item, Summary } from "@/types";

// 利益を計算
export function calculateProfit(item: Item): number | null {
  if (item.recordType === "expense") return null;
  if (item.sellingPrice === null) return null;
  const extraCosts = (item.miscExpense || 0) + (item.consumableExpense || 0);
  return item.sellingPrice - item.purchasePrice - extraCosts;
}

// サマリーを計算
export function calculateSummary(items: Item[]): Summary {
  const itemRecords = items.filter((item) => item.recordType !== "expense");
  const stockItems = itemRecords.filter((item) => item.status === "在庫");
  const soldItems = itemRecords.filter((item) => item.status === "販売済み");
  const totalMiscExpense = items.reduce(
    (sum, item) => sum + (item.miscExpense || 0),
    0
  );
  const totalConsumableExpense = items.reduce(
    (sum, item) => sum + (item.consumableExpense || 0),
    0
  );

  const totalProfit = soldItems.reduce((sum, item) => {
    const profit = calculateProfit(item);
    return sum + (profit ?? 0);
  }, 0);

  const stockValue = stockItems.reduce(
    (sum, item) => sum + item.purchasePrice,
    0
  );

  return {
    totalStock: stockItems.length,
    totalSold: soldItems.length,
    totalProfit,
    stockValue,
    totalMiscExpense,
    totalConsumableExpense,
  };
}

// 金額フォーマット
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(amount);
}

// 日付フォーマット
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
