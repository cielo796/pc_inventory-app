import { NextResponse } from "next/server";
import { insertMany, replaceAllItems } from "@/lib/db";
import { normalizeItem } from "@/lib/inventory-storage";

type ImportMode = "replace" | "merge";

export async function POST(req: Request) {
  const body = await req.json();
  const mode: ImportMode = body?.mode === "replace" ? "replace" : "merge";
  const items = Array.isArray(body?.items) ? body.items : [];
  const normalized = items
    .map((item: unknown) => normalizeItem(item))
    .filter((item): item is NonNullable<typeof item> => item !== null);

  if (normalized.length === 0) {
    return NextResponse.json({ error: "No valid items" }, { status: 400 });
  }

  if (mode === "replace") {
    await replaceAllItems(normalized);
  } else {
    await insertMany(normalized);
  }

  return NextResponse.json({ ok: true });
}
