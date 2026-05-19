import Anthropic from "@anthropic-ai/sdk";

const BOT_MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 220;

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not set");
    }
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

function extractText(content: Anthropic.Messages.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

function cleanTweet(raw: string): string {
  // Strip surrounding quotes if the model wrapped the post.
  let t = raw.trim().replace(/^["'""]|["'""]$/g, "").trim();
  // Trim to 280 chars max as a safety net.
  if (t.length > 280) t = t.slice(0, 277).trimEnd() + "...";
  return t;
}

export async function generateBotPost(opts: {
  systemPrompt: string;
  recentFeed: { author: string; content: string }[];
}): Promise<string> {
  const feedSummary = opts.recentFeed.length
    ? "Recent posts on the timeline (for vibe, do not repeat them):\n" +
      opts.recentFeed
        .slice(0, 8)
        .map((t) => `- @${t.author}: ${t.content}`)
        .join("\n")
    : "The timeline is empty.";

  const msg = await client().messages.create({
    model: BOT_MODEL,
    max_tokens: MAX_TOKENS,
    system: opts.systemPrompt,
    messages: [
      {
        role: "user",
        content: `${feedSummary}\n\nWrite a single short post (under 240 characters) in your voice. Output only the post text. No quotes, no hashtags, no emojis.`,
      },
    ],
  });
  return cleanTweet(extractText(msg.content));
}

export async function generateBotReply(opts: {
  systemPrompt: string;
  parent: { author: string; content: string };
}): Promise<string> {
  const msg = await client().messages.create({
    model: BOT_MODEL,
    max_tokens: MAX_TOKENS,
    system: opts.systemPrompt,
    messages: [
      {
        role: "user",
        content: `@${opts.parent.author} just posted:\n"${opts.parent.content}"\n\nWrite a single short reply (under 220 characters) in your voice. Output only the reply text. No quotes, no hashtags, no emojis.`,
      },
    ],
  });
  return cleanTweet(extractText(msg.content));
}
