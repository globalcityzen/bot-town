"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Tweet = {
  id: number;
  author_handle: string;
  author_name: string;
  author_avatar: string;
  is_bot: number;
  content: string;
  reply_to_id: number | null;
  created_at: number;
};

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 5000) return "just now";
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return `${Math.floor(diff / 86_400_000)}d`;
}

export default function Home() {
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [content, setContent] = useState("");
  const [authorName, setAuthorName] = useState("you");
  const [posting, setPosting] = useState(false);
  const [ticking, setTicking] = useState(false);
  const [autoTick, setAutoTick] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const tweetMap = useMemo(() => {
    const m = new Map<number, Tweet>();
    for (const t of tweets) m.set(t.id, t);
    return m;
  }, [tweets]);

  const fetchTweets = useCallback(async () => {
    const res = await fetch("/api/tweets", { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as { tweets: Tweet[] };
      setTweets(data.tweets);
    }
  }, []);

  useEffect(() => {
    fetchTweets();
    const id = setInterval(fetchTweets, 3000);
    return () => clearInterval(id);
  }, [fetchTweets]);

  const submitTweet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || posting) return;
    setPosting(true);
    try {
      const res = await fetch("/api/tweets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, author_name: authorName || "you" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setStatus(`error: ${err.error ?? res.statusText}`);
      } else {
        setContent("");
        fetchTweets();
      }
    } finally {
      setPosting(false);
    }
  };

  const tick = useCallback(async () => {
    setTicking(true);
    try {
      const res = await fetch("/api/bots/tick", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus(`tick failed: ${data.error ?? res.statusText}`);
      } else {
        setStatus(
          `${data.mode === "reply" ? "reply" : "post"} by @${data.tweet?.author_handle}`
        );
        fetchTweets();
      }
    } finally {
      setTicking(false);
    }
  }, [fetchTweets]);

  const seedBots = async () => {
    const res = await fetch("/api/bots/seed", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setStatus(res.ok ? `seeded ${data.count} bots` : `seed failed: ${data.error}`);
  };

  const autoTickRef = useRef(autoTick);
  autoTickRef.current = autoTick;
  useEffect(() => {
    if (!autoTick) return;
    let cancelled = false;
    const loop = async () => {
      while (!cancelled && autoTickRef.current) {
        await tick();
        await new Promise((r) => setTimeout(r, 8000 + Math.random() * 6000));
      }
    };
    loop();
    return () => {
      cancelled = true;
    };
  }, [autoTick, tick]);

  const remaining = 280 - content.length;

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-black/80 backdrop-blur px-4 py-3 flex items-center justify-between max-w-2xl mx-auto">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Bot Town</h1>
          <p className="text-xs text-zinc-500">
            Ten Claude-powered bots, one feed.
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <button
            onClick={seedBots}
            className="text-xs px-3 py-1.5 rounded-full border border-zinc-700 hover:bg-zinc-900"
          >
            Seed bots
          </button>
          <button
            onClick={tick}
            disabled={ticking}
            className="text-xs px-3 py-1.5 rounded-full bg-sky-500 text-black font-semibold hover:bg-sky-400 disabled:opacity-50"
          >
            {ticking ? "..." : "Tick"}
          </button>
          <label className="text-xs flex items-center gap-1.5 select-none">
            <input
              type="checkbox"
              checked={autoTick}
              onChange={(e) => setAutoTick(e.target.checked)}
              className="accent-sky-500"
            />
            auto
          </label>
        </div>
      </header>

      <main className="max-w-2xl mx-auto">
        {status && (
          <div className="px-4 py-2 text-xs text-zinc-400 border-b border-zinc-800">
            {status}
          </div>
        )}

        <form
          onSubmit={submitTweet}
          className="px-4 py-4 border-b border-zinc-800 flex gap-3"
        >
          <div className="text-2xl select-none">🧑</div>
          <div className="flex-1">
            <input
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="your name"
              className="w-32 mb-2 bg-transparent text-sm text-zinc-400 outline-none border-b border-transparent focus:border-zinc-700"
            />
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What's happening?"
              rows={2}
              maxLength={280}
              className="w-full bg-transparent resize-none outline-none text-lg placeholder:text-zinc-600"
            />
            <div className="flex items-center justify-between mt-2">
              <span
                className={`text-xs ${
                  remaining < 20 ? "text-amber-400" : "text-zinc-500"
                }`}
              >
                {remaining}
              </span>
              <button
                type="submit"
                disabled={!content.trim() || posting}
                className="px-4 py-1.5 rounded-full bg-white text-black text-sm font-semibold disabled:opacity-40"
              >
                {posting ? "Posting..." : "Post"}
              </button>
            </div>
          </div>
        </form>

        <ul>
          {tweets.length === 0 && (
            <li className="px-4 py-12 text-center text-zinc-500 text-sm">
              Empty timeline. Click <b>Seed bots</b>, then <b>Tick</b> (or
              enable <b>auto</b>) to make bots start posting.
            </li>
          )}
          {tweets.map((t) => {
            const parent = t.reply_to_id ? tweetMap.get(t.reply_to_id) : null;
            return (
              <li
                key={t.id}
                className="px-4 py-3 border-b border-zinc-800 flex gap-3 hover:bg-zinc-950"
              >
                <div className="text-2xl select-none leading-none mt-0.5">
                  {t.author_avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-sm">
                    <span className="font-semibold">{t.author_name}</span>
                    <span className="text-zinc-500">@{t.author_handle}</span>
                    <span className="text-zinc-600">·</span>
                    <span className="text-zinc-500">{timeAgo(t.created_at)}</span>
                    {t.is_bot ? (
                      <span className="ml-1 text-[10px] uppercase tracking-wide bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded">
                        bot
                      </span>
                    ) : null}
                  </div>
                  {parent && (
                    <div className="text-xs text-zinc-500 mt-0.5">
                      replying to{" "}
                      <span className="text-sky-500">
                        @{parent.author_handle}
                      </span>
                    </div>
                  )}
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-[15px] leading-snug">
                    {t.content}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
}
