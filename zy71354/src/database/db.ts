import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import path from 'path';
import fs from 'fs';
import type {
  Installation,
  Material,
  Signature,
  RiskCheck,
  VersionHistory,
} from '../types';

interface DatabaseSchema {
  installations: Installation[];
  materials: Material[];
  signatures: Signature[];
  riskChecks: RiskCheck[];
  versionHistory: VersionHistory[];
}

const dbDir = path.join(process.cwd(), 'data');
const dbPath = path.join(dbDir, 'db.json');

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const defaultData: DatabaseSchema = {
  installations: [],
  materials: [],
  signatures: [],
  riskChecks: [],
  versionHistory: [],
};

const adapter = new JSONFile<DatabaseSchema>(dbPath);
const db = new Low<DatabaseSchema>(adapter, defaultData);

export async function initDatabase() {
  await db.read();
  db.data ||= defaultData;
  await db.write();
}

export default db;
