import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import log from '../utils/logger';

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (db) return db;

  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'contextmaster.db');
  log.info('Opening database:', dbPath);

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  initSchema(db);
  return db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS operation_records (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp       TEXT    NOT NULL,
      operation_type  TEXT    NOT NULL,
      target_name     TEXT    NOT NULL,
      registry_path   TEXT    NOT NULL,
      old_value       TEXT,
      new_value       TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_op_timestamp ON operation_records(timestamp);

    CREATE TABLE IF NOT EXISTS backup_snapshots (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      name            TEXT    NOT NULL,
      creation_time   TEXT    NOT NULL,
      type            TEXT    NOT NULL,
      menu_items_json TEXT    NOT NULL,
      sha256_checksum TEXT    NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_backup_time ON backup_snapshots(creation_time);
  `);
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
