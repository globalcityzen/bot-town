import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, "app.db");

declare global {
  // eslint-disable-next-line no-var
  var __twDb: Database.Database | undefined;
}

function init(db: Database.Database) {
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS bots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      handle TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      avatar_emoji TEXT NOT NULL,
      system_prompt TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tweets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      author_handle TEXT NOT NULL,
      author_name TEXT NOT NULL,
      author_avatar TEXT NOT NULL,
      is_bot INTEGER NOT NULL DEFAULT 0,
      content TEXT NOT NULL,
      reply_to_id INTEGER,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (reply_to_id) REFERENCES tweets(id)
    );
    CREATE INDEX IF NOT EXISTS idx_tweets_created ON tweets(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_tweets_reply ON tweets(reply_to_id);
  `);
}

export function getDb(): Database.Database {
  if (!global.__twDb) {
    const db = new Database(DB_PATH);
    init(db);
    global.__twDb = db;
  }
  return global.__twDb;
}

export type Bot = {
  id: number;
  handle: string;
  display_name: string;
  avatar_emoji: string;
  system_prompt: string;
  created_at: number;
};

export type Tweet = {
  id: number;
  author_handle: string;
  author_name: string;
  author_avatar: string;
  is_bot: number;
  content: string;
  reply_to_id: number | null;
  created_at: number;
};
