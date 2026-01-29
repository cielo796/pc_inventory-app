import { NextResponse } from "next/server";
import { deleteItem, upsertItem } from "@/lib/db";
import { normalizeItem } from "@/lib/inventory-storage";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();
  const normalized = normalizeItem({ ...body, id: params.id });
  if (!normalized) {
    return NextResponse.json({ error: "Invalid item" }, { status: 400 });
  }
  const saved = await upsertItem(normalized);
  return NextResponse.json(saved);
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  await deleteItem(params.id);
  return NextResponse.json({ ok: true });
}
