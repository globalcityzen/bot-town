import { NextResponse } from "next/server";
import { getDb, type Bot } from "@/lib/db";
import { BOT_SEEDS } from "@/lib/bots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const db = getDb();
  const insert = db.prepare(
    `INSERT INTO bots (handle, display_name, avatar_emoji, system_prompt, created_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(handle) DO UPDATE SET
       display_name = excluded.display_name,
       avatar_emoji = excluded.avatar_emoji,
       system_prompt = excluded.system_prompt`
  );
  const now = Date.now();
  const tx = db.transaction(() => {
    for (const b of BOT_SEEDS) {
      insert.run(b.handle, b.display_name, b.avatar_emoji, b.system_prompt, now);
    }
  });
  tx();
  const bots = db.prepare(`SELECT * FROM bots ORDER BY id`).all() as Bot[];
  return NextResponse.json({ ok: true, count: bots.length, bots: bots.map((b) => b.handle) });
}
