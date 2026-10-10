import { resolve } from 'path';

export function getDbPath(): string {
  // In production (Docker), use /data directory for persistence
  // In development, use local data directory
  const dataDir = process.env.DATA_DIR || resolve(process.cwd(), '..', 'data');
  return resolve(dataDir, 'civictrack.db');
}

export function getDbPathForRuntime(): string {
  // Compute at runtime to handle different working directories
  const dataDir = process.env.DATA_DIR || resolve(process.cwd(), '..', 'data');
  return resolve(dataDir, 'civictrack.db');
}