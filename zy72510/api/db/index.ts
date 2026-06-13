import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GrayBatch, Sample, ConflictEvidence } from '../../shared/types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface DatabaseSchema {
  batches: GrayBatch[];
  samples: Sample[];
  conflicts: ConflictEvidence[];
}

const defaultData: DatabaseSchema = {
  batches: [],
  samples: [],
  conflicts: [],
};

const file = path.join(__dirname, 'db.json');
const adapter = new JSONFile<DatabaseSchema>(file);
export const db = new Low<DatabaseSchema>(adapter, defaultData);

export async function initDb() {
  await db.read();
  if (!db.data.batches) db.data.batches = [];
  if (!db.data.samples) db.data.samples = [];
  if (!db.data.conflicts) db.data.conflicts = [];
  await db.write();
}

export async function resetDb() {
  db.data = { batches: [], samples: [], conflicts: [] };
  await db.write();
}
