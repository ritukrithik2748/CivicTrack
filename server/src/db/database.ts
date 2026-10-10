import Database from 'better-sqlite3';
import { getDbPathForRuntime } from '../config.js';

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!dbInstance) {
    dbInstance = new Database(getDbPathForRuntime());
    dbInstance.pragma('journal_mode = WAL');
    dbInstance.pragma('foreign_keys = ON');
    dbInstance.pragma('synchronous = NORMAL');
    dbInstance.pragma('temp_store = MEMORY');
  }
  return dbInstance;
}

export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

export function runInTransaction<T>(fn: (db: Database.Database) => T): T {
  const db = getDb();
  const transaction = db.transaction(fn);
  return transaction(db);
}