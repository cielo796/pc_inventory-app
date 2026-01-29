import { NextResponse } from "next/server";
import { getAllItems, upsertItem } from "@/lib/db";
import { normalizeItem } from "@/lib/inventory-storage";

export async function GET() {
  const items = await getAllItems();
  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const body = await req.json();
  const normalized = normalizeItem(body);
  if (!normalized) {
    return NextResponse.json({ error: "Invalid item" }, { status: 400 });
  }
  const saved = await upsertItem(normalized);
  return NextResponse.json(saved);
}
