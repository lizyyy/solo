import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';

const defaultData = {
  vouchers: [],
  passengers: [],
  corporateAccounts: [],
  transactions: [],
  reconciliationRecords: []
};

let db;

export async function initDB() {
  const adapter = new JSONFile('./data/db.json');
  db = new Low(adapter, defaultData);
  await db.read();
  db.data ||= defaultData;
  await db.write();
  return db;
}

export async function getDB() {
  if (!db) {
    await initDB();
  }
  return db;
}

export async function saveDB() {
  if (db) {
    await db.write();
  }
}