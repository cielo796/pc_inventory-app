"use client";

import { useMemo, useState } from "react";
import { Item, Category } from "@/types";
import { categories, sampleItems } from "@/lib/sample-data";
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
type DatePreset = "all" | "this-month" | "this-year" | "custom";
type Transaction = {
  date: string;
  income: number;
  expense: number;
  category: Category;
};

const tabOptions: { value: CashflowGranularity; label: string }[] = [
  { value: "month", label: "月別" },
  { value: "year", label: "年別" },
];
const presetOptions: { value: DatePreset; label: string }[] = [
  { value: "all", label: "全期間" },
  { value: "this-month", label: "今月" },
  { value: "this-year", label: "今年" },
  { value: "custom", label: "期間指定" },
];

function getYearMonthLabel(year: number, month: number) {
  return `${year}年${month}月`;
}

function getYearLabel(year: number) {
  return `${year}年`;
}

function buildCashflow(
  transactions: Transaction[],
  granularity: CashflowGranularity
): CashflowRow[] {
  const map = new Map<
    string,
    { key: string; label: string; income: number; expense: number }
  >();

  const add = (dateString: string, income: number, expense: number) => {
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

  transactions.forEach((transaction) => {
    add(transaction.date, transaction.income, transaction.expense);
  });

  return Array.from(map.values())
    .map((row) => ({ ...row, net: row.income - row.expense }))
    .sort((a, b) => b.key.localeCompare(a.key));
}

function collectTransactions(items: Item[]): Transaction[] {
  const rows: Transaction[] = [];
  items.forEach((item) => {
    if (item.recordType === "expense") {
      rows.push({
        date: item.purchaseDate,
        income: 0,
        expense: (item.miscExpense || 0) + (item.consumableExpense || 0),
        category: item.category,
      });
      return;
    }

    rows.push({
      date: item.purchaseDate,
      income: 0,
      expense:
        item.purchasePrice +
        (item.miscExpense || 0) +
        (item.consumableExpense || 0),
      category: item.category,
    });
    if (item.sellingPrice && item.soldDate) {
      rows.push({
        date: item.soldDate,
        income: item.sellingPrice,
        expense: 0,
        category: item.category,
      });
    }
  });
  return rows;
}

function isWithinRange(dateString: string, start?: Date, end?: Date) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return false;
  if (start && date < start) return false;
  if (end && date > end) return false;
  return true;
}

function calculateTotals(transactions: Transaction[]) {
  const totals = transactions.reduce(
    (acc, transaction) => {
      acc.income += transaction.income;
      acc.expense += transaction.expense;
      return acc;
    },
    { income: 0, expense: 0 }
  );
  return {
    income: totals.income,
    expense: totals.expense,
    net: totals.income - totals.expense,
  };
}

function buildCategoryBreakdown(transactions: Transaction[]) {
  const map = new Map<Category, { income: number; expense: number }>();
  categories.forEach((category) => {
    map.set(category, { income: 0, expense: 0 });
  });
  transactions.forEach((transaction) => {
    const current = map.get(transaction.category) ?? { income: 0, expense: 0 };
    current.income += transaction.income;
    current.expense += transaction.expense;
    map.set(transaction.category, current);
  });
  return categories
    .map((category) => {
      const totals = map.get(category) ?? { income: 0, expense: 0 };
      const net = totals.income - totals.expense;
      return { category, ...totals, net };
    })
    .filter((row) => row.income !== 0 || row.expense !== 0 || row.net !== 0);
}

export default function CashflowPage() {
  const [items] = useState<Item[]>(() => {
    if (typeof window === "undefined") return sampleItems;
    const storedItems = loadItemsFromStorage();
    return storedItems ?? sampleItems;
  });
  const [tab, setTab] = useState<CashflowGranularity>("month");
  const [preset, setPreset] = useState<DatePreset>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const dateRange = useMemo(() => {
    const now = new Date();
    if (preset === "this-month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    if (preset === "this-year") {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 11, 31);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    if (preset === "custom") {
      const start = startDate ? new Date(startDate) : undefined;
      const end = endDate ? new Date(endDate) : undefined;
      if (end) end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    return { start: undefined, end: undefined };
  }, [preset, startDate, endDate]);

  const filteredTransactions = useMemo(() => {
    const all = collectTransactions(items);
    if (!dateRange.start && !dateRange.end) return all;
    return all.filter((transaction) =>
      isWithinRange(transaction.date, dateRange.start, dateRange.end)
    );
  }, [items, dateRange]);
  const totals = useMemo(
    () => calculateTotals(filteredTransactions),
    [filteredTransactions]
  );
  const monthlyCashflow = useMemo(
    () => buildCashflow(filteredTransactions, "month"),
    [filteredTransactions]
  );
  const yearlyCashflow = useMemo(
    () => buildCashflow(filteredTransactions, "year"),
    [filteredTransactions]
  );
  const categoryBreakdown = useMemo(
    () => buildCategoryBreakdown(filteredTransactions),
    [filteredTransactions]
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
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex flex-wrap gap-2">
            {presetOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setPreset(option.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                  preset === option.value
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-600 hover:bg-gray-100"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          {preset === "custom" && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  開始日
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  終了日
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}
        </div>

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

        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50">
            <h2 className="text-sm font-semibold text-gray-700">
              カテゴリ別収支
            </h2>
          </div>
          <div className="p-4">
            <CategoryBoard rows={categoryBreakdown} />
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
  const maxValue = rows.reduce((max, row) => {
    const localMax = Math.max(row.income, row.expense, Math.abs(row.net));
    return Math.max(max, localMax);
  }, 0);

  return (
    <div>
      <div className="mb-3 text-sm font-semibold text-gray-700">{title}</div>
      <div className="space-y-2 mb-4">
        {rows.length === 0 && (
          <div className="text-sm text-gray-400">データがありません</div>
        )}
        {rows.map((row) => (
          <div key={row.key} className="grid grid-cols-1 sm:grid-cols-12 gap-2">
            <div className="text-xs text-gray-600 sm:col-span-3">{row.label}</div>
            <div className="sm:col-span-9 space-y-1">
              <ChartBar
                label="収入"
                value={row.income}
                maxValue={maxValue}
                colorClass="bg-green-500"
              />
              <ChartBar
                label="支出"
                value={row.expense}
                maxValue={maxValue}
                colorClass="bg-amber-500"
              />
              <ChartBar
                label="収支"
                value={Math.abs(row.net)}
                maxValue={maxValue}
                colorClass={row.net >= 0 ? "bg-blue-500" : "bg-red-500"}
                prefix={row.net >= 0 ? "+" : "-"}
              />
            </div>
          </div>
        ))}
      </div>
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

function ChartBar({
  label,
  value,
  maxValue,
  colorClass,
  prefix = "",
}: {
  label: string;
  value: number;
  maxValue: number;
  colorClass: string;
  prefix?: string;
}) {
  const widthPercent = maxValue === 0 ? 0 : Math.min(100, (value / maxValue) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="w-12 text-xs text-gray-500">{label}</div>
      <div className="flex-1 h-3 rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`h-full ${colorClass}`}
          style={{ width: `${widthPercent}%` }}
        />
      </div>
      <div className="w-24 text-right text-xs text-gray-600">
        {prefix}
        {formatCurrency(value)}
      </div>
    </div>
  );
}

function CategoryBoard({
  rows,
}: {
  rows: { category: Category; income: number; expense: number; net: number }[];
}) {
  const totalExpense = rows.reduce((sum, row) => sum + row.expense, 0);
  const pieSlices = rows.map((row) => {
    const percent = totalExpense === 0 ? 0 : (row.expense / totalExpense) * 100;
    return { ...row, percent };
  });
  const colorPalette = [
    "#2563eb",
    "#16a34a",
    "#f59e0b",
    "#ef4444",
    "#6b7280",
  ];
  const gradientStops = pieSlices.reduce(
    (acc, slice, index) => {
      const start = acc.offset;
      const end = start + slice.percent;
      const color = colorPalette[index % colorPalette.length];
      acc.stops.push(`${color} ${start}% ${end}%`);
      return { ...acc, offset: end };
    },
    { stops: [] as string[], offset: 0 }
  );
  const pieStyle =
    pieSlices.length === 0
      ? {}
      : {
          background: `conic-gradient(${gradientStops.stops.join(", ")})`,
        };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="flex flex-col items-center justify-center">
        <div className="w-40 h-40 rounded-full border" style={pieStyle} />
        <div className="text-xs text-gray-500 mt-2">支出割合</div>
      </div>
      <div className="lg:col-span-2 overflow-x-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-gray-500 border-b bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left">カテゴリ</th>
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
            {rows.map((row, index) => (
              <tr key={row.category} className="hover:bg-gray-50">
                <td className="px-4 py-2 text-gray-700">
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="inline-block w-3 h-3 rounded-full"
                      style={{
                        backgroundColor:
                          colorPalette[index % colorPalette.length],
                      }}
                    />
                    {row.category}
                  </span>
                </td>
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
