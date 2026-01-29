"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Item, ItemStatus, Category, RecordType } from "@/types";
import { categories, statuses } from "@/lib/sample-data";
import { normalizeItem } from "@/lib/inventory-storage";
import {
  calculateSummary,
  calculateProfit,
  formatCurrency,
  formatDate,
} from "@/lib/utils";
import PageTabs from "@/components/PageTabs";

const FILTER_ALL = "すべて";
const FILTER_EXPENSE = "費用";

type FilterStatus = ItemStatus | typeof FILTER_ALL | typeof FILTER_EXPENSE;
type FilterCategory = Category | typeof FILTER_ALL;
type SortKey =
  | "created-desc"
  | "created-asc"
  | "purchase-desc"
  | "purchase-asc"
  | "profit-desc"
  | "profit-asc"
  | "name-asc"
  | "name-desc";

const sortOptions: { value: SortKey; label: string }[] = [
  { value: "created-desc", label: "追加日（新しい順）" },
  { value: "created-asc", label: "追加日（古い順）" },
  { value: "purchase-desc", label: "仕入価格（高い順）" },
  { value: "purchase-asc", label: "仕入価格（安い順）" },
  { value: "profit-desc", label: "利益（高い順）" },
  { value: "profit-asc", label: "利益（低い順）" },
  { value: "name-asc", label: "商品名（昇順）" },
  { value: "name-desc", label: "商品名（降順）" },
];

function compareNullableNumber(
  a: number | null,
  b: number | null,
  direction: "asc" | "desc"
) {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return direction === "asc" ? a - b : b - a;
}

const CSV_HEADERS = [
  "id",
  "recordType",
  "name",
  "category",
  "purchasePrice",
  "purchaseDate",
  "miscExpense",
  "consumableExpense",
  "sellingPrice",
  "soldDate",
  "status",
  "memo",
  "createdAt",
] as const;

function escapeCsvValue(value: string) {
  if (value.includes('"') || value.includes(",") || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toCsvRow(values: (string | number | null)[]) {
  return values
    .map((value) => escapeCsvValue(value === null ? "" : String(value)))
    .join(",");
}

function serializeCsv(items: Item[]) {
  const rows = [CSV_HEADERS.join(",")];
  items.forEach((item) => {
    rows.push(
      toCsvRow([
        item.id,
        item.recordType,
        item.name,
        item.category,
        item.purchasePrice,
        item.purchaseDate,
        item.miscExpense,
        item.consumableExpense,
        item.sellingPrice,
        item.soldDate,
        item.status,
        item.memo,
        item.createdAt,
      ])
    );
  });
  return rows.join("\n");
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let value = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (char === '"' && next === '"') {
        value += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        value += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      current.push(value);
      value = "";
    } else if (char === "\n") {
      current.push(value);
      rows.push(current);
      current = [];
      value = "";
    } else if (char !== "\r") {
      value += char;
    }
  }
  current.push(value);
  rows.push(current);
  return rows.filter((row) => row.some((cell) => cell.trim() !== ""));
}

function rowsToItems(rows: string[][]): Item[] {
  if (rows.length === 0) return [];
  const headerRow = rows[0].map((value) => value.trim());
  const startIndex =
    headerRow.join(",") === CSV_HEADERS.join(",") ? 1 : 0;
  return rows.slice(startIndex).flatMap((row) => {
    const raw: Record<string, unknown> = {};
    CSV_HEADERS.forEach((header, index) => {
      const value = row[index] ?? "";
      if (
        header === "purchasePrice" ||
        header === "miscExpense" ||
        header === "consumableExpense"
      ) {
        raw[header] = value === "" ? 0 : Number(value);
      } else if (header === "sellingPrice") {
        raw[header] = value === "" ? null : Number(value);
      } else {
        raw[header] = value;
      }
    });
    const normalized = normalizeItem(raw);
    return normalized ? [normalized] : [];
  });
}

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}


export default function Home() {
  const [items, setItems] = useState<Item[]>([]);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>(FILTER_ALL);
  const [filterCategory, setFilterCategory] =
    useState<FilterCategory>(FILTER_ALL);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created-desc");
  const [importError, setImportError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const hasMounted = useRef(false);

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        const res = await fetch("/api/items");
        if (!res.ok) {
          throw new Error("load_failed");
        }
        const data = (await res.json()) as Item[];
        setItems(data);
        setLoadError(null);
      } catch {
        setLoadError("データの読み込みに失敗しました。");
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, []);

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }
  }, [items]);

  const filteredItems = useMemo(() => {
    let result = items;
    if (filterStatus === FILTER_EXPENSE) {
      result = result.filter((item) => item.recordType === "expense");
    } else if (filterStatus !== FILTER_ALL) {
      result = result.filter(
        (item) => item.recordType !== "expense" && item.status === filterStatus
      );
    }
    if (filterCategory !== FILTER_ALL) {
      result = result.filter((item) => item.category === filterCategory);
    }
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      result = result.filter((item) => {
        const recordHint =
          item.recordType === "expense"
            ? "費用 雑費 消耗品"
            : `${item.status} 在庫 販売済み`;
        const haystack = `${item.name} ${item.category} ${item.memo} ${recordHint}`.toLowerCase();
        return haystack.includes(query);
      });
    }

    const sorted = [...result].sort((a, b) => {
      switch (sortKey) {
        case "created-desc":
          return b.createdAt.localeCompare(a.createdAt);
        case "created-asc":
          return a.createdAt.localeCompare(b.createdAt);
        case "purchase-desc":
          return b.purchasePrice - a.purchasePrice;
        case "purchase-asc":
          return a.purchasePrice - b.purchasePrice;
        case "profit-desc":
          return compareNullableNumber(
            calculateProfit(a),
            calculateProfit(b),
            "desc"
          );
        case "profit-asc":
          return compareNullableNumber(
            calculateProfit(a),
            calculateProfit(b),
            "asc"
          );
        case "name-desc":
          return b.name.localeCompare(a.name, "ja");
        case "name-asc":
          return a.name.localeCompare(b.name, "ja");
        default:
          return 0;
      }
    });

    return sorted;
  }, [items, filterStatus, filterCategory, searchQuery, sortKey]);

  const summary = useMemo(() => calculateSummary(items), [items]);

  const handleSaveItem = async (formData: Partial<Item>) => {
    const recordType = formData.recordType ?? "item";
    const isExpense = recordType === "expense";
    setIsSaving(true);
    if (editingItem) {
      const updated: Item = {
        ...editingItem,
        ...formData,
        recordType,
        purchasePrice: isExpense ? 0 : formData.purchasePrice ?? editingItem.purchasePrice,
        sellingPrice: isExpense ? null : formData.sellingPrice ?? editingItem.sellingPrice,
        soldDate: isExpense ? null : formData.soldDate ?? editingItem.soldDate,
        status: isExpense ? "販売済み" : formData.status ?? editingItem.status,
      } as Item;
      try {
        const res = await fetch(`/api/items/${editingItem.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updated),
        });
        if (!res.ok) throw new Error("save_failed");
        const saved = (await res.json()) as Item;
        setItems(
          items.map((item) => (item.id === saved.id ? saved : item))
        );
      } catch {
        setImportError("保存に失敗しました。");
        setIsSaving(false);
        return;
      }
    } else {
      const newItem: Item = {
        id: Date.now().toString(),
        recordType,
        name: formData.name || "",
        category: formData.category || "その他",
        purchasePrice: isExpense ? 0 : formData.purchasePrice || 0,
        purchaseDate:
          formData.purchaseDate || new Date().toISOString().split("T")[0],
        miscExpense: formData.miscExpense || 0,
        consumableExpense: formData.consumableExpense || 0,
        sellingPrice: isExpense ? null : formData.sellingPrice || null,
        soldDate: isExpense ? null : formData.soldDate || null,
        status: isExpense ? "販売済み" : formData.status || "在庫",
        memo: formData.memo || "",
        createdAt: new Date().toISOString(),
      };
      try {
        const res = await fetch("/api/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newItem),
        });
        if (!res.ok) throw new Error("save_failed");
        const saved = (await res.json()) as Item;
        setItems([saved, ...items]);
      } catch {
        setImportError("保存に失敗しました。");
        setIsSaving(false);
        return;
      }
    }
    setIsModalOpen(false);
    setEditingItem(null);
    setIsSaving(false);
  };

  const handleDeleteItem = (id: string) => {
    if (confirm("この在庫を削除しますか？")) {
      fetch(`/api/items/${id}`, { method: "DELETE" })
        .then(() => {
          setItems(items.filter((item) => item.id !== id));
        })
        .catch(() => {
          setImportError("削除に失敗しました。");
        });
    }
  };

  const handleExportCsv = () => {
    const csv = serializeCsv(items);
    const dateTag = new Date().toISOString().slice(0, 10);
    downloadCsv(`inventory-${dateTag}.csv`, csv);
  };

  const handleImportCsv = async (file: File) => {
    try {
      setImportError(null);
      const text = await file.text();
      const rows = parseCsv(text);
      const imported = rowsToItems(rows);
      if (imported.length === 0) {
        setImportError("読み込めるデータがありませんでした。");
        return;
      }
      const shouldReplace = confirm(
        "既存データを上書きしますか？キャンセルで追加します。"
      );
      const mode = shouldReplace ? "replace" : "merge";
      const res = await fetch("/api/items/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, items: imported }),
      });
      if (!res.ok) {
        throw new Error("import_failed");
      }
      const listRes = await fetch("/api/items");
      const list = (await listRes.json()) as Item[];
      setItems(list);
    } catch {
      setImportError("CSVの読み込みに失敗しました。");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 space-y-3">
          <h1 className="text-xl font-bold text-gray-800">在庫管理</h1>
          <PageTabs />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <SummaryCard
            label="在庫数"
            value={`${summary.totalStock} 件`}
            color="blue"
          />
          <SummaryCard
            label="販売数"
            value={`${summary.totalSold} 件`}
            color="green"
          />
          <SummaryCard
            label="利益合計"
            value={formatCurrency(summary.totalProfit)}
            color="emerald"
          />
          <SummaryCard
            label="在庫金額"
            value={formatCurrency(summary.stockValue)}
            color="gray"
          />
          <SummaryCard
            label="雑費合計"
            value={formatCurrency(summary.totalMiscExpense)}
            color="amber"
          />
          <SummaryCard
            label="消耗品合計"
            value={formatCurrency(summary.totalConsumableExpense)}
            color="orange"
          />
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex gap-2 flex-wrap">
            {([FILTER_ALL, ...statuses, FILTER_EXPENSE] as const).map(
              (status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  filterStatus === status
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-100 border"
                }`}
              >
                {status}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleExportCsv}
              className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              CSVエクスポート
            </button>
            <label className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 cursor-pointer">
              CSVインポート
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void handleImportCsv(file);
                  }
                  event.currentTarget.value = "";
                }}
              />
            </label>
            <button
              onClick={() => {
                setEditingItem(null);
                setIsModalOpen(true);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
            >
              + 在庫を追加
            </button>
          </div>
        </div>

        {loadError && (
          <div className="text-sm text-red-600">{loadError}</div>
        )}
        {isLoading && (
          <div className="text-sm text-gray-500">読み込み中...</div>
        )}

        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-6">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                検索
              </label>
              <input
                type="search"
                placeholder="商品名・カテゴリ・メモで検索"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                カテゴリ
              </label>
              <select
                value={filterCategory}
                onChange={(event) =>
                  setFilterCategory(event.target.value as FilterCategory)
                }
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value={FILTER_ALL}>すべて</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-3">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                並び替え
              </label>
              <select
                value={sortKey}
                onChange={(event) => setSortKey(event.target.value as SortKey)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {importError && (
            <div className="mt-3 text-sm text-red-600">{importError}</div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  商品名
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">
                  カテゴリ
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  仕入価格
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">
                  仕入日
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">
                  雑費
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">
                  消耗品
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  販売価格
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">
                  販売日
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">
                  利益
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  状態
                </th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredItems.map((item) => {
                const profit = calculateProfit(item);
                return (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        {item.name || (item.recordType === "expense" ? "（費用）" : "")}
                      </div>
                      <div className="text-xs text-gray-500 sm:hidden">
                        {item.category}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">
                      {item.category}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {item.recordType === "expense"
                        ? "-"
                        : formatCurrency(item.purchasePrice)}
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">
                      {formatDate(item.purchaseDate)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600 hidden lg:table-cell">
                      {formatCurrency(item.miscExpense)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600 hidden lg:table-cell">
                      {formatCurrency(item.consumableExpense)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {item.recordType === "expense"
                        ? "-"
                        : item.sellingPrice
                          ? formatCurrency(item.sellingPrice)
                          : "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">
                      {item.recordType === "expense"
                        ? "-"
                        : item.soldDate
                          ? formatDate(item.soldDate)
                          : "-"}
                    </td>
                    <td className="px-4 py-3 text-right hidden sm:table-cell">
                      {profit !== null ? (
                        <span
                          className={
                            profit >= 0 ? "text-green-600" : "text-red-600"
                          }
                        >
                          {profit >= 0 ? "+" : ""}
                          {formatCurrency(profit)}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                          item.recordType === "expense"
                            ? "bg-amber-100 text-amber-700"
                            : item.status === "在庫"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-green-100 text-green-700"
                        }`}
                      >
                        {item.recordType === "expense" ? "費用" : item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => {
                          setEditingItem(item);
                          setIsModalOpen(true);
                        }}
                        className="text-gray-400 hover:text-blue-600 mr-2"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="text-gray-400 hover:text-red-600"
                      >
                        削除
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredItems.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-gray-400"
                  >
                    データがありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>

      {isModalOpen && (
        <ItemModal
          item={editingItem}
          onSave={handleSaveItem}
          isSaving={isSaving}
          onClose={() => {
            setIsModalOpen(false);
            setEditingItem(null);
          }}
        />
      )}
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
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    blue: "bg-blue-50 border-blue-200",
    green: "bg-green-50 border-green-200",
    emerald: "bg-emerald-50 border-emerald-200",
    gray: "bg-gray-50 border-gray-200",
    amber: "bg-amber-50 border-amber-200",
    orange: "bg-orange-50 border-orange-200",
  };
  return (
    <div className={`p-4 rounded-xl border ${colorClasses[color]}`}>
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-lg font-bold text-gray-800">{value}</div>
    </div>
  );
}

function ItemModal({
  item,
  onSave,
  isSaving,
  onClose,
}: {
  item: Item | null;
  onSave: (data: Partial<Item>) => Promise<void>;
  isSaving: boolean;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState({
    recordType: item?.recordType ?? ("item" as RecordType),
    name: item?.name || "",
    category: item?.category || ("その他" as Category),
    purchasePrice: item?.purchasePrice || 0,
    purchaseDate: item?.purchaseDate || new Date().toISOString().split("T")[0],
    miscExpense: item?.miscExpense ?? 0,
    consumableExpense: item?.consumableExpense ?? 0,
    sellingPrice: item?.sellingPrice ? item.sellingPrice.toString() : "",
    soldDate: item?.soldDate || "",
    status: item?.status || ("在庫" as ItemStatus),
    memo: item?.memo || "",
  });
  const isExpense = formData.recordType === "expense";

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await onSave({
      ...formData,
      recordType: formData.recordType,
      sellingPrice: formData.sellingPrice
        ? Number(formData.sellingPrice)
        : null,
      soldDate: formData.soldDate || null,
      status: isExpense ? "販売済み" : formData.status,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-bold">
            {item ? "在庫を編集" : "在庫を追加"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            閉じる
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              記録種別
            </label>
            <select
              value={formData.recordType}
              onChange={(event) =>
                setFormData({
                  ...formData,
                  recordType: event.target.value as RecordType,
                })
              }
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="item">在庫/販売</option>
              <option value="expense">消耗品/雑費</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              商品名 {isExpense ? "（任意）" : "*"}
            </label>
            <input
              type="text"
              required={!isExpense}
              value={formData.name}
              onChange={(event) =>
                setFormData({ ...formData, name: event.target.value })
              }
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                カテゴリ
              </label>
              <select
                value={formData.category}
                onChange={(event) =>
                  setFormData({
                    ...formData,
                    category: event.target.value as Category,
                  })
                }
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            {!isExpense && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  状態
                </label>
                <select
                  value={formData.status}
                  onChange={(event) =>
                    setFormData({
                      ...formData,
                      status: event.target.value as ItemStatus,
                    })
                  }
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {statuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                仕入価格 {isExpense ? "（任意）" : "*"}
              </label>
              <input
                type="number"
                required={!isExpense}
                min={0}
                value={formData.purchasePrice}
                onChange={(event) =>
                  setFormData({
                    ...formData,
                    purchasePrice: Number(event.target.value),
                  })
                }
                disabled={isExpense}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {isExpense ? "発生日 *" : "仕入日 *"}
              </label>
              <input
                type="date"
                required
                value={formData.purchaseDate}
                onChange={(event) =>
                  setFormData({
                    ...formData,
                    purchaseDate: event.target.value,
                  })
                }
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                雑費
              </label>
              <input
                type="number"
                min={0}
                value={formData.miscExpense}
                onChange={(event) =>
                  setFormData({
                    ...formData,
                    miscExpense: Number(event.target.value),
                  })
                }
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                消耗品
              </label>
              <input
                type="number"
                min={0}
                value={formData.consumableExpense}
                onChange={(event) =>
                  setFormData({
                    ...formData,
                    consumableExpense: Number(event.target.value),
                  })
                }
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {!isExpense && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  販売価格
                </label>
                <input
                  type="number"
                  min={0}
                  value={formData.sellingPrice}
                  onChange={(event) =>
                    setFormData({
                      ...formData,
                      sellingPrice: event.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  販売日
                </label>
                <input
                  type="date"
                  value={formData.soldDate}
                  onChange={(event) =>
                    setFormData({ ...formData, soldDate: event.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              メモ
            </label>
            <textarea
              rows={2}
              value={formData.memo}
              onChange={(event) =>
                setFormData({ ...formData, memo: event.target.value })
              }
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-50"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {isSaving ? "保存中..." : "保存"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
