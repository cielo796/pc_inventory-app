import fs from "fs";
import path from "path";
import initSqlJs from "sql.js";
import type { Database, SqlJsStatic } from "sql.js";
import { Item } from "@/types";

const DB_FILE_NAME = "inventory.db";
let sqlPromise: Promise<SqlJsStatic> | null = null;
let dbPromise: Promise<Database> | null = null;

function getDbPath() {
  const baseDir =
    process.env.APPDATA ||
    (process.platform === "darwin"
      ? path.join(process.env.HOME || "", "Library", "Application Support")
      : process.env.XDG_DATA_HOME ||
        path.join(process.env.HOME || "", ".local", "share"));
  const appDir = path.join(baseDir, "pc-inventory");
  fs.mkdirSync(appDir, { recursive: true });
  return path.join(appDir, DB_FILE_NAME);
}

async function getSql() {
  if (!sqlPromise) {
    sqlPromise = initSqlJs({
      locateFile: (file) =>
        path.join(process.cwd(), "node_modules", "sql.js", "dist", file),
    });
  }
  return sqlPromise;
}

async function ensureDb() {
  if (dbPromise) return dbPromise;
  dbPromise = (async () => {
    const SQL = await getSql();
    const dbPath = getDbPath();
    const fileExists = fs.existsSync(dbPath);
    const db = fileExists
      ? new SQL.Database(new Uint8Array(fs.readFileSync(dbPath)))
      : new SQL.Database();
    db.run(`
      CREATE TABLE IF NOT EXISTS items (
        id TEXT PRIMARY KEY,
        record_type TEXT NOT NULL,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        purchase_price REAL NOT NULL,
        purchase_date TEXT NOT NULL,
        misc_expense REAL NOT NULL,
        consumable_expense REAL NOT NULL,
        selling_price REAL,
        sold_date TEXT,
        status TEXT NOT NULL,
        memo TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
    return db;
  })();
  return dbPromise;
}

async function persistDb(db: Database) {
  const dbPath = getDbPath();
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

function mapRow(row: Record<string, unknown>): Item {
  return {
    id: String(row.id ?? ""),
    recordType: String(row.record_type ?? "item"),
    name: String(row.name ?? ""),
    category: String(row.category ?? "その他"),
    purchasePrice: Number(row.purchase_price ?? 0),
    purchaseDate: String(row.purchase_date ?? ""),
    miscExpense: Number(row.misc_expense ?? 0),
    consumableExpense: Number(row.consumable_expense ?? 0),
    sellingPrice:
      row.selling_price === null || row.selling_price === undefined
        ? null
        : Number(row.selling_price),
    soldDate:
      row.sold_date === null || row.sold_date === undefined
        ? null
        : String(row.sold_date),
    status: String(row.status ?? "在庫"),
    memo: String(row.memo ?? ""),
    createdAt: String(row.created_at ?? ""),
  };
}

export async function getAllItems(): Promise<Item[]> {
  const db = await ensureDb();
  const stmt = db.prepare("SELECT * FROM items ORDER BY created_at DESC");
  const rows: Item[] = [];
  while (stmt.step()) {
    rows.push(mapRow(stmt.getAsObject()));
  }
  stmt.free();
  return rows;
}

export async function upsertItem(item: Item): Promise<Item> {
  const db = await ensureDb();
  const stmt = db.prepare(`
    INSERT INTO items (
      id, record_type, name, category, purchase_price, purchase_date,
      misc_expense, consumable_expense, selling_price, sold_date, status,
      memo, created_at
    ) VALUES (
      $id, $recordType, $name, $category, $purchasePrice, $purchaseDate,
      $miscExpense, $consumableExpense, $sellingPrice, $soldDate, $status,
      $memo, $createdAt
    )
    ON CONFLICT(id) DO UPDATE SET
      record_type = excluded.record_type,
      name = excluded.name,
      category = excluded.category,
      purchase_price = excluded.purchase_price,
      purchase_date = excluded.purchase_date,
      misc_expense = excluded.misc_expense,
      consumable_expense = excluded.consumable_expense,
      selling_price = excluded.selling_price,
      sold_date = excluded.sold_date,
      status = excluded.status,
      memo = excluded.memo,
      created_at = excluded.created_at
  `);
  stmt.run({
    $id: item.id,
    $recordType: item.recordType,
    $name: item.name,
    $category: item.category,
    $purchasePrice: item.purchasePrice,
    $purchaseDate: item.purchaseDate,
    $miscExpense: item.miscExpense,
    $consumableExpense: item.consumableExpense,
    $sellingPrice: item.sellingPrice,
    $soldDate: item.soldDate,
    $status: item.status,
    $memo: item.memo,
    $createdAt: item.createdAt,
  });
  stmt.free();
  await persistDb(db);
  return item;
}

export async function deleteItem(id: string) {
  const db = await ensureDb();
  const stmt = db.prepare("DELETE FROM items WHERE id = $id");
  stmt.run({ $id: id });
  stmt.free();
  await persistDb(db);
}

export async function replaceAllItems(items: Item[]) {
  const db = await ensureDb();
  db.run("DELETE FROM items");
  const stmt = db.prepare(`
    INSERT INTO items (
      id, record_type, name, category, purchase_price, purchase_date,
      misc_expense, consumable_expense, selling_price, sold_date, status,
      memo, created_at
    ) VALUES (
      $id, $recordType, $name, $category, $purchasePrice, $purchaseDate,
      $miscExpense, $consumableExpense, $sellingPrice, $soldDate, $status,
      $memo, $createdAt
    )
  `);
  items.forEach((item) => {
    stmt.run({
      $id: item.id,
      $recordType: item.recordType,
      $name: item.name,
      $category: item.category,
      $purchasePrice: item.purchasePrice,
      $purchaseDate: item.purchaseDate,
      $miscExpense: item.miscExpense,
      $consumableExpense: item.consumableExpense,
      $sellingPrice: item.sellingPrice,
      $soldDate: item.soldDate,
      $status: item.status,
      $memo: item.memo,
      $createdAt: item.createdAt,
    });
  });
  stmt.free();
  await persistDb(db);
}

export async function insertMany(items: Item[]) {
  const db = await ensureDb();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO items (
      id, record_type, name, category, purchase_price, purchase_date,
      misc_expense, consumable_expense, selling_price, sold_date, status,
      memo, created_at
    ) VALUES (
      $id, $recordType, $name, $category, $purchasePrice, $purchaseDate,
      $miscExpense, $consumableExpense, $sellingPrice, $soldDate, $status,
      $memo, $createdAt
    )
  `);
  items.forEach((item) => {
    stmt.run({
      $id: item.id,
      $recordType: item.recordType,
      $name: item.name,
      $category: item.category,
      $purchasePrice: item.purchasePrice,
      $purchaseDate: item.purchaseDate,
      $miscExpense: item.miscExpense,
      $consumableExpense: item.consumableExpense,
      $sellingPrice: item.sellingPrice,
      $soldDate: item.soldDate,
      $status: item.status,
      $memo: item.memo,
      $createdAt: item.createdAt,
    });
  });
  stmt.free();
  await persistDb(db);
}
