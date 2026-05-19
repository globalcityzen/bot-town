import { NextResponse } from "next/server";
import { getDb, type Bot, type Tweet } from "@/lib/db";
import { generateBotPost, generateBotReply } from "@/lib/claude";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REPLY_PROBABILITY = 0.4;

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export async function POST() {
  const db = getDb();
  const bots = db.prepare(`SELECT * FROM bots`).all() as Bot[];
  if (bots.length === 0) {
    return NextResponse.json(
      { error: "no bots seeded — POST /api/bots/seed first" },
      { status: 400 }
    );
  }

  const bot = pick(bots);
  const recent = db
    .prepare(`SELECT * FROM tweets ORDER BY created_at DESC LIMIT 12`)
    .all() as Tweet[];

  const replyCandidates = recent.filter((t) => t.author_handle !== bot.handle);
  const shouldReply =
    replyCandidates.length > 0 && Math.random() < REPLY_PROBABILITY;

  let content: string;
  let replyToId: number | null = null;

  try {
    if (shouldReply) {
      const parent = pick(replyCandidates);
      replyToId = parent.id;
      content = await generateBotReply({
        systemPrompt: bot.system_prompt,
        parent: { author: parent.author_handle, content: parent.content },
      });
    } else {
      content = await generateBotPost({
        systemPrompt: bot.system_prompt,
        recentFeed: recent.map((t) => ({
          author: t.author_handle,
          content: t.content,
        })),
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `claude api: ${msg}` }, { status: 502 });
  }

  if (!content) {
    return NextResponse.json({ error: "empty generation" }, { status: 502 });
  }

  const info = db
    .prepare(
      `INSERT INTO tweets (author_handle, author_name, author_avatar, is_bot, content, reply_to_id, created_at)
       VALUES (?, ?, ?, 1, ?, ?, ?)`
    )
    .run(
      bot.handle,
      bot.display_name,
      bot.avatar_emoji,
      content,
      replyToId,
      Date.now()
    );

  const tweet = db
    .prepare(`SELECT * FROM tweets WHERE id = ?`)
    .get(info.lastInsertRowid) as Tweet;
  return NextResponse.json({ tweet, mode: shouldReply ? "reply" : "post" });
}
