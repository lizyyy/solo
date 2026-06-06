import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');

interface DatabaseData {
  cards: any[];
  attendance: any[];
  tickets: any[];
  conflicts: any[];
  revenue: any[];
  snapshots: any[];
}

let data: DatabaseData = {
  cards: [],
  attendance: [],
  tickets: [],
  conflicts: [],
  revenue: [],
  snapshots: [],
};

let loaded = false;

export function initDatabase() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (fs.existsSync(DATA_FILE)) {
    try {
      const content = fs.readFileSync(DATA_FILE, 'utf-8');
      data = JSON.parse(content);
    } catch (e) {
      console.warn('读取数据库文件失败，使用空数据库');
    }
  }
  loaded = true;
}

function saveData() {
  if (!loaded) initDatabase();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

export function getCollection(name: keyof DatabaseData): any[] {
  if (!loaded) initDatabase();
  return data[name];
}

export function insertOne(collection: keyof DatabaseData, doc: any) {
  if (!loaded) initDatabase();
  data[collection].push(doc);
  saveData();
  return doc;
}

export function insertMany(collection: keyof DatabaseData, docs: any[]) {
  if (!loaded) initDatabase();
  data[collection].push(...docs);
  saveData();
  return docs;
}

export function updateOne(
  collection: keyof DatabaseData,
  predicate: (doc: any) => boolean,
  update: Partial<any>
) {
  if (!loaded) initDatabase();
  const idx = data[collection].findIndex(predicate);
  if (idx === -1) return null;
  data[collection][idx] = { ...data[collection][idx], ...update };
  saveData();
  return data[collection][idx];
}

export function findOne(
  collection: keyof DatabaseData,
  predicate: (doc: any) => boolean
): any | undefined {
  if (!loaded) initDatabase();
  return data[collection].find(predicate);
}

export function findMany(
  collection: keyof DatabaseData,
  predicate: (doc: any) => boolean = () => true
): any[] {
  if (!loaded) initDatabase();
  return data[collection].filter(predicate);
}

export function deleteMany(
  collection: keyof DatabaseData,
  predicate: (doc: any) => boolean
) {
  if (!loaded) initDatabase();
  const before = data[collection].length;
  data[collection] = data[collection].filter((d) => !predicate(d));
  const deleted = before - data[collection].length;
  saveData();
  return deleted;
}

export function getDb() {
  if (!loaded) initDatabase();
  return data;
}
