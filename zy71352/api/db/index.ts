import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Database } from '../../shared/types.js';
import { mockDatabase } from '../data/mockData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'db.json');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

if (!fs.existsSync(dbPath)) {
  fs.writeFileSync(dbPath, JSON.stringify(mockDatabase, null, 2), 'utf-8');
}

const adapter = new JSONFile<Database>(dbPath);
const db = new Low<Database>(adapter, mockDatabase);

await db.read();

export const getDb = async (): Promise<Low<Database>> => {
  await db.read();
  return db;
};

export const saveDb = async (): Promise<void> => {
  await db.write();
};

export default db;
