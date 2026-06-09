import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import path from 'path';
import fs from 'fs';
import process from 'process';
import type { ReviewTask, CadLayer, LayerHistory, Screenshot } from '../shared/types.js';
import { seed } from './seed.js';

interface DataSchema {
  tasks: ReviewTask[];
  layers: CadLayer[];
  histories: LayerHistory[];
  screenshots: Screenshot[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.resolve(DATA_DIR, 'db.json');
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');

const defaultData: DataSchema = {
  tasks: [],
  layers: [],
  histories: [],
  screenshots: [],
};

let dbInstance: Low<DataSchema> | null = null;

export async function initDb(): Promise<Low<DataSchema>> {
  if (dbInstance) return dbInstance;

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });

  const adapter = new JSONFile<DataSchema>(DB_FILE);
  const db = new Low<DataSchema>(adapter, defaultData);

  await db.read();

  const isEmpty =
    !db.data ||
    (db.data.tasks.length === 0 &&
      db.data.layers.length === 0 &&
      db.data.histories.length === 0 &&
      db.data.screenshots.length === 0);

  if (isEmpty) {
    seed(db.data);
    await db.write();
  }

  dbInstance = db;
  return db;
}

export async function getDb(): Promise<Low<DataSchema>> {
  if (!dbInstance) {
    return initDb();
  }
  return dbInstance;
}

export { UPLOADS_DIR, DATA_DIR, DB_FILE };
