import * as fs from 'fs';
import * as path from 'path';
import { Order, OrderFile } from '../types';
import { v4 as uuidv4 } from 'uuid';

const DATA_DIR = path.join(process.cwd(), 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const COUNTER_FILE = path.join(DATA_DIR, 'counter.json');
const FILES_FILE = path.join(DATA_DIR, 'files.json');

interface DataStore {
  orders: Order[];
  files: Map<string, OrderFile>;
  orderCounter: number;
}

let inMemoryStore: DataStore = {
  orders: [],
  files: new Map(),
  orderCounter: 0
};

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

export function loadData(): void {
  ensureDataDir();
  
  try {
    if (fs.existsSync(ORDERS_FILE)) {
      const ordersData = fs.readFileSync(ORDERS_FILE, 'utf-8');
      inMemoryStore.orders = JSON.parse(ordersData).map((order: any) => ({
        ...order,
        createdAt: new Date(order.createdAt),
        updatedAt: new Date(order.updatedAt),
        calledAt: order.calledAt ? new Date(order.calledAt) : undefined,
        completedAt: order.completedAt ? new Date(order.completedAt) : undefined
      }));
    }
  } catch (error) {
    console.error('Error loading orders:', error);
    inMemoryStore.orders = [];
  }

  try {
    if (fs.existsSync(FILES_FILE)) {
      const filesData = fs.readFileSync(FILES_FILE, 'utf-8');
      const filesArray = JSON.parse(filesData);
      inMemoryStore.files = new Map(filesArray.map((f: OrderFile) => [f.id, f]);
    }
  } catch (error) {
    console.error('Error loading files:', error);
    inMemoryStore.files = new Map();
  }

  try {
    if (fs.existsSync(COUNTER_FILE)) {
      const counterData = fs.readFileSync(COUNTER_FILE, 'utf-8');
      inMemoryStore.orderCounter = JSON.parse(counterData).counter || 0;
    }
  } catch (error) {
    console.error('Error loading counter:', error);
    inMemoryStore.orderCounter = 0;
  }
}

export function saveData(): void {
  ensureDataDir();
  
  try {
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(inMemoryStore.orders, null, 2));
    const filesArray = Array.from(inMemoryStore.files.values());
    fs.writeFileSync(FILES_FILE, JSON.stringify(filesArray, null, 2));
    fs.writeFileSync(COUNTER_FILE, JSON.stringify({ counter: inMemoryStore.orderCounter }, null, 2));
  } catch (error) {
    console.error('Error saving data:', error);
  }
}

export function getNextOrderNumber(): number {
  inMemoryStore.orderCounter++;
  saveData();
  return inMemoryStore.orderCounter;
}

export function getOrders(): Order[] {
  return [...inMemoryStore.orders];
}

export function getOrderById(id: string): Order | undefined {
  return inMemoryStore.orders.find(o => o.id === id);
}

export function addOrder(order: Order): void {
  inMemoryStore.orders.push(order);
  saveData();
}

export function updateOrder(order: Order): void {
  const index = inMemoryStore.orders.findIndex(o => o.id === order.id);
  if (index !== -1) {
    inMemoryStore.orders[index] = order;
    saveData();
  }
}

export function getActiveOrders(): Order[] {
  return inMemoryStore.orders.filter(o => 
    o.status !== 'completed' && o.status !== 'refunded'
  ).sort((a, b) => a.orderNumber - b.orderNumber);
}

export function getQueueOrders(): Order[] {
  return inMemoryStore.orders.filter(o => 
    o.status === 'paid' || o.status === 'needs_topup'
  ).sort((a, b) => a.orderNumber - b.orderNumber);
}
