import { NextRequest, NextResponse } from "next/server";
import { getDb, type Tweet } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM tweets ORDER BY created_at DESC LIMIT 100`
    )
    .all() as Tweet[];
  return NextResponse.json({ tweets: rows });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    content?: string;
    author_name?: string;
  };
  const content = (body.content || "").trim();
  if (!content) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }
  if (content.length > 280) {
    return NextResponse.json({ error: "content too long" }, { status: 400 });
  }
  const author_name = (body.author_name || "you").trim().slice(0, 40) || "you";
  const handle = author_name.toLowerCase().replace(/[^a-z0-9_]/g, "") || "you";

  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO tweets (author_handle, author_name, author_avatar, is_bot, content, reply_to_id, created_at)
       VALUES (?, ?, ?, 0, ?, NULL, ?)`
    )
    .run(handle, author_name, "🧑", content, Date.now());

  const tweet = db
    .prepare(`SELECT * FROM tweets WHERE id = ?`)
    .get(info.lastInsertRowid) as Tweet;
  return NextResponse.json({ tweet });
}
