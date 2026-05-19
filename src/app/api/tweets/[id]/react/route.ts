import { NextRequest, NextResponse } from "next/server";
import { getDb, type Tweet } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Reaction = "like" | "dislike";
type Action = { add?: Reaction | null; remove?: Reaction | null };

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as Action;
  const add = body.add ?? null;
  const remove = body.remove ?? null;
  if (add && add !== "like" && add !== "dislike") {
    return NextResponse.json({ error: "invalid add" }, { status: 400 });
  }
  if (remove && remove !== "like" && remove !== "dislike") {
    return NextResponse.json({ error: "invalid remove" }, { status: 400 });
  }
  if (!add && !remove) {
    return NextResponse.json({ error: "no-op" }, { status: 400 });
  }

  const db = getDb();
  const existing = db
    .prepare(`SELECT id FROM tweets WHERE id = ?`)
    .get(id) as { id: number } | undefined;
  if (!existing) {
    return NextResponse.json({ error: "tweet not found" }, { status: 404 });
  }

  const tx = db.transaction(() => {
    if (remove === "like") {
      db.prepare(
        `UPDATE tweets SET likes = MAX(likes - 1, 0) WHERE id = ?`
      ).run(id);
    } else if (remove === "dislike") {
      db.prepare(
        `UPDATE tweets SET dislikes = MAX(dislikes - 1, 0) WHERE id = ?`
      ).run(id);
    }
    if (add === "like") {
      db.prepare(`UPDATE tweets SET likes = likes + 1 WHERE id = ?`).run(id);
    } else if (add === "dislike") {
      db.prepare(`UPDATE tweets SET dislikes = dislikes + 1 WHERE id = ?`).run(
        id
      );
    }
  });
  tx();

  const tweet = db
    .prepare(`SELECT * FROM tweets WHERE id = ?`)
    .get(id) as Tweet;
  return NextResponse.json({ tweet });
}
