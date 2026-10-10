import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Database from 'better-sqlite3';
import { getDbPathForRuntime } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function migrate() {
  const dbPath = getDbPathForRuntime();
  console.log('MIGRATE START - DB Path:', dbPath);
  const db = new Database(dbPath);
  
  // Enable WAL mode and foreign keys
  console.log('Setting pragmas...');
  const journalMode = db.pragma('journal_mode = WAL');
  console.log('Journal mode result:', journalMode);
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');
  db.pragma('temp_store = MEMORY');
  
  const schemaPath = join(__dirname, 'schema.sql');
  console.log('Schema path:', schemaPath);
  const schema = readFileSync(schemaPath, 'utf-8');
  console.log('Schema length:', schema.length);
  
  // Execute the entire schema as a single script (better-sqlite3 exec handles multiple statements)
  try {
    db.exec(schema);
    console.log('Database migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    db.close();
  }
}

// Run if called directly
const importUrl = import.meta.url.replace('file:///', '').replace(/\//g, '\\');
const arg1 = process.argv[1].replace(/\//g, '\\');
const isMain = importUrl === arg1;
console.log('Module loaded, import.meta.url:', import.meta.url);
console.log('process.argv[1]:', process.argv[1]);
console.log('Normalized import:', importUrl);
console.log('Normalized arg1:', arg1);
console.log('Is main:', isMain);
if (isMain) {
  console.log('Running migrate directly');
  migrate();
}