"use client";

import { useMemo, useState } from "react";
import { Item } from "@/types";
import { sampleItems } from "@/lib/sample-data";
import { loadItemsFromStorage } from "@/lib/inventory-storage";
import { formatCurrency } from "@/lib/utils";
import PageTabs from "@/components/PageTabs";

type CashflowGranularity = "month" | "year";
type CashflowRow = {
  key: string;
  label: string;
  income: number;
  expense: number;
  net: number;
};

const tabOptions: { value: CashflowGranularity; label: string }[] = [
  { value: "month", label: "月別" },
  { value: "year", label: "年別" },
];

function getYearMonthLabel(year: number, month: number) {
  return `${year}年${month}月`;
}

function getYearLabel(year: number) {
  return `${year}年`;
}

function buildCashflow(items: Item[], granularity: CashflowGranularity): CashflowRow[] {
  const map = new Map<
    string,
    { key: string; label: string; income: number; expense: number }
  >();

  const add = (dateString: string | null, income: number, expense: number) => {
    if (!dateString) return;
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return;
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const key =
      granularity === "month"
        ? `${year}-${String(month).padStart(2, "0")}`
        : `${year}`;
    const label =
      granularity === "month"
        ? getYearMonthLabel(year, month)
        : getYearLabel(year);
    const current = map.get(key) ?? { key, label, income: 0, expense: 0 };
    current.income += income;
    current.expense += expense;
    map.set(key, current);
  };

  items.forEach((item) => {
    if (item.recordType === "expense") {
      const expense = (item.miscExpense || 0) + (item.consumableExpense || 0);
      add(item.purchaseDate, 0, expense);
      return;
    }

    const baseExpense =
      item.purchasePrice +
      (item.miscExpense || 0) +
      (item.consumableExpense || 0);
    add(item.purchaseDate, 0, baseExpense);
    if (item.sellingPrice && item.soldDate) {
      add(item.soldDate, item.sellingPrice, 0);
    }
  });

  return Array.from(map.values())
    .map((row) => ({ ...row, net: row.income - row.expense }))
    .sort((a, b) => b.key.localeCompare(a.key));
}

function calculateTotals(items: Item[]) {
  let income = 0;
  let expense = 0;

  items.forEach((item) => {
    if (item.recordType === "expense") {
      expense += (item.miscExpense || 0) + (item.consumableExpense || 0);
      return;
    }

    expense +=
      item.purchasePrice +
      (item.miscExpense || 0) +
      (item.consumableExpense || 0);
    if (item.sellingPrice && item.soldDate) {
      income += item.sellingPrice;
    }
  });

  return {
    income,
    expense,
    net: income - expense,
  };
}

export default function CashflowPage() {
  const [items] = useState<Item[]>(() => {
    if (typeof window === "undefined") return sampleItems;
    const storedItems = loadItemsFromStorage();
    return storedItems ?? sampleItems;
  });
  const [tab, setTab] = useState<CashflowGranularity>("month");

  const totals = useMemo(() => calculateTotals(items), [items]);
  const monthlyCashflow = useMemo(
    () => buildCashflow(items, "month"),
    [items]
  );
  const yearlyCashflow = useMemo(
    () => buildCashflow(items, "year"),
    [items]
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 space-y-3">
          <h1 className="text-xl font-bold text-gray-800">収支ボード</h1>
          <PageTabs />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SummaryCard
            label="収入合計"
            value={formatCurrency(totals.income)}
            color="green"
          />
          <SummaryCard
            label="支出合計"
            value={formatCurrency(totals.expense)}
            color="amber"
          />
          <SummaryCard
            label="収支合計"
            value={formatCurrency(totals.net)}
            color={totals.net >= 0 ? "blue" : "red"}
          />
        </div>

        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-sm font-semibold text-gray-700">収支推移</h2>
            <div className="flex gap-2">
              {tabOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setTab(option.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                    tab === option.value
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="p-4">
            {tab === "month" ? (
              <CashflowBoard title="月別収支" rows={monthlyCashflow} />
            ) : (
              <CashflowBoard title="年別収支" rows={yearlyCashflow} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: "blue" | "green" | "amber" | "red";
}) {
  const colorClasses: Record<string, string> = {
    blue: "bg-blue-50 border-blue-200",
    green: "bg-green-50 border-green-200",
    amber: "bg-amber-50 border-amber-200",
    red: "bg-red-50 border-red-200",
  };

  return (
    <div className={`p-4 rounded-xl border ${colorClasses[color]}`}>
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-lg font-bold text-gray-800">{value}</div>
    </div>
  );
}

function CashflowBoard({ title, rows }: { title: string; rows: CashflowRow[] }) {
  return (
    <div>
      <div className="mb-3 text-sm font-semibold text-gray-700">{title}</div>
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-gray-500 border-b bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left">期間</th>
              <th className="px-4 py-2 text-right">収入</th>
              <th className="px-4 py-2 text-right">支出</th>
              <th className="px-4 py-2 text-right">収支</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-gray-400" colSpan={4}>
                  データがありません
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.key} className="hover:bg-gray-50">
                <td className="px-4 py-2 text-gray-700">{row.label}</td>
                <td className="px-4 py-2 text-right text-gray-700">
                  {formatCurrency(row.income)}
                </td>
                <td className="px-4 py-2 text-right text-gray-700">
                  {formatCurrency(row.expense)}
                </td>
                <td
                  className={`px-4 py-2 text-right font-medium ${
                    row.net >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {row.net >= 0 ? "+" : ""}
                  {formatCurrency(row.net)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
