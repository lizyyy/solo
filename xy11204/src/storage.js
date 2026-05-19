import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');
const RECORDS_FILE = path.join(DATA_DIR, 'records.json');
const INVENTORY_FILE = path.join(DATA_DIR, 'inventory.json');

async function ensureDataDir() {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
}

export async function initStorage() {
  await ensureDataDir();
  const emptyRecords = [];
  const emptyInventory = {};
  
  try {
    await fs.access(RECORDS_FILE);
  } catch {
    await fs.writeFile(RECORDS_FILE, JSON.stringify(emptyRecords, null, 2));
  }
  
  try {
    await fs.access(INVENTORY_FILE);
  } catch {
    await fs.writeFile(INVENTORY_FILE, JSON.stringify(emptyInventory, null, 2));
  }
  
  return { success: true, message: '存储初始化完成' };
}

export async function getRecords() {
  await ensureDataDir();
  try {
    const data = await fs.readFile(RECORDS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export async function saveRecords(records) {
  await ensureDataDir();
  await fs.writeFile(RECORDS_FILE, JSON.stringify(records, null, 2));
}

export async function addRecord(record) {
  const records = await getRecords();
  const newRecord = {
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
    status: 'pending',
    reviewReason: null,
    ...record
  };
  records.push(newRecord);
  await saveRecords(records);
  return newRecord;
}

export async function getInventory() {
  await ensureDataDir();
  try {
    const data = await fs.readFile(INVENTORY_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

export async function saveInventory(inventory) {
  await ensureDataDir();
  await fs.writeFile(INVENTORY_FILE, JSON.stringify(inventory, null, 2));
}

export async function updateInventory(batchNumber, quantity, productName) {
  const inventory = await getInventory();
  if (!inventory[batchNumber]) {
    inventory[batchNumber] = {
      productName,
      batchNumber,
      quantity: 0,
      lastUpdated: new Date().toISOString()
    };
  }
  inventory[batchNumber].quantity += quantity;
  inventory[batchNumber].lastUpdated = new Date().toISOString();
  await saveInventory(inventory);
  return inventory[batchNumber];
}

export async function queryRecords(filters = {}) {
  let records = await getRecords();
  
  if (filters.handler) {
    records = records.filter(r => r.handler === filters.handler);
  }
  
  if (filters.status) {
    records = records.filter(r => r.status === filters.status);
  }
  
  if (filters.exceptionType) {
    records = records.filter(r => 
      r.reviewReason && r.reviewReason.includes(filters.exceptionType)
    );
  }
  
  if (filters.startDate) {
    records = records.filter(r => new Date(r.createdAt) >= new Date(filters.startDate));
  }
  
  if (filters.endDate) {
    records = records.filter(r => new Date(r.createdAt) <= new Date(filters.endDate));
  }
  
  return records;
}
