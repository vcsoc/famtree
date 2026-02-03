import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import crypto from "node:crypto";
import sqlite3 from "sqlite3";
import { open, type Database } from "sqlite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DB_PATH || path.join(__dirname, "..", "data", "famtree.db");
const dataDir = path.dirname(dbPath);

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db: Database<sqlite3.Database, sqlite3.Statement> | null = null;

export const createId = () => crypto.randomUUID();

export async function initDb() {
  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS tenants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      settings TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      tenant_id TEXT,
      display_name TEXT,
      avatar_url TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    );

    CREATE TABLE IF NOT EXISTS forests (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS trees (
      id TEXT PRIMARY KEY,
      forest_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      theme TEXT DEFAULT 'modern',
      layout TEXT DEFAULT 'vertical',
      created_by TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (forest_id) REFERENCES forests(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS people (
      id TEXT PRIMARY KEY,
      tree_id TEXT NOT NULL,
      first_name TEXT NOT NULL,
      middle_name TEXT,
      last_name TEXT,
      maiden_name TEXT,
      gender TEXT,
      birth_date TEXT,
      birth_place TEXT,
      death_date TEXT,
      death_place TEXT,
      biography TEXT,
      photo_url TEXT,
      position_x REAL DEFAULT 0,
      position_y REAL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tree_id) REFERENCES trees(id)
    );

    CREATE TABLE IF NOT EXISTS relationships (
      id TEXT PRIMARY KEY,
      tree_id TEXT NOT NULL,
      person1_id TEXT NOT NULL,
      person2_id TEXT NOT NULL,
      type TEXT NOT NULL,
      start_date TEXT,
      end_date TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tree_id) REFERENCES trees(id),
      FOREIGN KEY (person1_id) REFERENCES people(id),
      FOREIGN KEY (person2_id) REFERENCES people(id)
    );

    CREATE TABLE IF NOT EXISTS life_events (
      id TEXT PRIMARY KEY,
      person_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      event_date TEXT,
      location TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (person_id) REFERENCES people(id)
    );

    CREATE TABLE IF NOT EXISTS media (
      id TEXT PRIMARY KEY,
      person_id TEXT,
      tree_id TEXT NOT NULL,
      type TEXT NOT NULL,
      url TEXT NOT NULL,
      title TEXT,
      description TEXT,
      upload_date TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (person_id) REFERENCES people(id),
      FOREIGN KEY (tree_id) REFERENCES trees(id)
    );

    CREATE TABLE IF NOT EXISTS stories (
      id TEXT PRIMARY KEY,
      person_id TEXT NOT NULL,
      tree_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      author_id TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (person_id) REFERENCES people(id),
      FOREIGN KEY (tree_id) REFERENCES trees(id),
      FOREIGN KEY (author_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS person_images (
      id TEXT PRIMARY KEY,
      person_id TEXT NOT NULL,
      image_url TEXT NOT NULL,
      is_primary INTEGER DEFAULT 0,
      uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_activity (
      user_id TEXT PRIMARY KEY,
      last_seen TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS forest_members (
      id TEXT PRIMARY KEY,
      forest_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (forest_id) REFERENCES forests(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS tree_members (
      id TEXT PRIMARY KEY,
      tree_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tree_id) REFERENCES trees(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS invitations (
      id TEXT PRIMARY KEY,
      forest_id TEXT,
      tree_id TEXT,
      inviter_id TEXT NOT NULL,
      invitee_email TEXT NOT NULL,
      role TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      token TEXT UNIQUE NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (forest_id) REFERENCES forests(id),
      FOREIGN KEY (tree_id) REFERENCES trees(id),
      FOREIGN KEY (inviter_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS ai_tasks (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      tree_id TEXT,
      person_id TEXT,
      status TEXT NOT NULL,
      provider TEXT NOT NULL,
      task_type TEXT NOT NULL,
      payload TEXT,
      result TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id),
      FOREIGN KEY (tree_id) REFERENCES trees(id),
      FOREIGN KEY (person_id) REFERENCES people(id)
    );
  `);
}

export function getDb() {
  if (!db) {
    throw new Error("Database not initialized");
  }
  return db;
}
