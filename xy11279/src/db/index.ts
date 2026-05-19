import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { DatabaseSchema, Vehicle, Charger, Task, Shift, Exception, Operator } from '../types';
import { sanitizeLog } from '../utils/security';

const defaultData: DatabaseSchema = {
  vehicles: [],
  chargers: [],
  tasks: [],
  shifts: [],
  exceptions: [],
  operators: [],
  importHistory: []
};

let db: Low<DatabaseSchema>;

export async function initDatabase(dbPath?: string): Promise<void> {
  const path = dbPath || join(process.cwd(), 'data', 'db.json');
  const adapter = new JSONFile<DatabaseSchema>(path);
  db = new Low(adapter, defaultData);
  await db.read();
}

export async function saveDatabase(): Promise<void> {
  await db.write();
}

export function getDatabase(): Low<DatabaseSchema> {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

export function generateId(): string {
  return uuidv4();
}

export function generateHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

export async function checkImportDuplicate(type: string, hash: string): Promise<boolean> {
  const db = getDatabase();
  return db.data.importHistory.some(h => h.type === type && h.hash === hash);
}

export async function recordImport(type: string, fileName: string, recordCount: number, hash: string): Promise<void> {
  const db = getDatabase();
  db.data.importHistory.push({
    id: generateId(),
    type,
    fileName,
    timestamp: new Date().toISOString(),
    recordCount,
    hash
  });
  await saveDatabase();
}

export async function getVehicles(): Promise<Vehicle[]> {
  return getDatabase().data.vehicles;
}

export async function getVehicleById(id: string): Promise<Vehicle | undefined> {
  return getDatabase().data.vehicles.find(v => v.id === id);
}

export async function getVehicleByPlate(plateNumber: string): Promise<Vehicle | undefined> {
  return getDatabase().data.vehicles.find(v => v.plateNumber === plateNumber);
}

export async function addVehicle(vehicle: Omit<Vehicle, 'id' | 'lastUpdate'>): Promise<Vehicle> {
  const db = getDatabase();
  const newVehicle: Vehicle = {
    ...vehicle,
    id: generateId(),
    lastUpdate: new Date().toISOString()
  };
  db.data.vehicles.push(newVehicle);
  await saveDatabase();
  return newVehicle;
}

export async function updateVehicle(id: string, updates: Partial<Vehicle>): Promise<Vehicle | null> {
  const db = getDatabase();
  const index = db.data.vehicles.findIndex(v => v.id === id);
  if (index === -1) return null;
  
  db.data.vehicles[index] = {
    ...db.data.vehicles[index],
    ...updates,
    lastUpdate: new Date().toISOString()
  };
  await saveDatabase();
  return db.data.vehicles[index];
}

export async function getChargers(): Promise<Charger[]> {
  return getDatabase().data.chargers;
}

export async function getChargerById(id: string): Promise<Charger | undefined> {
  return getDatabase().data.chargers.find(c => c.id === id);
}

export async function addCharger(charger: Omit<Charger, 'id'>): Promise<Charger> {
  const db = getDatabase();
  const newCharger: Charger = {
    ...charger,
    id: generateId()
  };
  db.data.chargers.push(newCharger);
  await saveDatabase();
  return newCharger;
}

export async function updateCharger(id: string, updates: Partial<Charger>): Promise<Charger | null> {
  const db = getDatabase();
  const index = db.data.chargers.findIndex(c => c.id === id);
  if (index === -1) return null;
  
  db.data.chargers[index] = { ...db.data.chargers[index], ...updates };
  await saveDatabase();
  return db.data.chargers[index];
}

export async function getTasks(): Promise<Task[]> {
  return getDatabase().data.tasks;
}

export async function getTaskById(id: string): Promise<Task | undefined> {
  return getDatabase().data.tasks.find(t => t.id === id);
}

export async function getTaskByOrderNumber(orderNumber: string): Promise<Task | undefined> {
  return getDatabase().data.tasks.find(t => t.orderNumber === orderNumber);
}

export async function addTask(task: Omit<Task, 'id' | 'createdAt'>): Promise<Task> {
  const db = getDatabase();
  const newTask: Task = {
    ...task,
    id: generateId(),
    createdAt: new Date().toISOString()
  };
  db.data.tasks.push(newTask);
  await saveDatabase();
  return newTask;
}

export async function updateTask(id: string, updates: Partial<Task>): Promise<Task | null> {
  const db = getDatabase();
  const index = db.data.tasks.findIndex(t => t.id === id);
  if (index === -1) return null;
  
  db.data.tasks[index] = { ...db.data.tasks[index], ...updates };
  await saveDatabase();
  return db.data.tasks[index];
}

export async function getShifts(): Promise<Shift[]> {
  return getDatabase().data.shifts;
}

export async function getShiftById(id: string): Promise<Shift | undefined> {
  return getDatabase().data.shifts.find(s => s.id === id);
}

export async function getShiftByDateAndType(date: string, type: string): Promise<Shift | undefined> {
  return getDatabase().data.shifts.find(s => s.date === date && s.type === type);
}

export async function addShift(shift: Omit<Shift, 'id' | 'createdAt'>): Promise<Shift> {
  const db = getDatabase();
  const newShift: Shift = {
    ...shift,
    id: generateId(),
    createdAt: new Date().toISOString()
  };
  db.data.shifts.push(newShift);
  await saveDatabase();
  return newShift;
}

export async function updateShift(id: string, updates: Partial<Shift>): Promise<Shift | null> {
  const db = getDatabase();
  const index = db.data.shifts.findIndex(s => s.id === id);
  if (index === -1) return null;
  
  db.data.shifts[index] = { ...db.data.shifts[index], ...updates };
  await saveDatabase();
  return db.data.shifts[index];
}

export async function getExceptions(): Promise<Exception[]> {
  return getDatabase().data.exceptions;
}

export async function getExceptionById(id: string): Promise<Exception | undefined> {
  return getDatabase().data.exceptions.find(e => e.id === id);
}

export async function addException(exception: Omit<Exception, 'id' | 'createdAt' | 'resolved'>): Promise<Exception> {
  const db = getDatabase();
  const newException: Exception = {
    ...exception,
    id: generateId(),
    createdAt: new Date().toISOString(),
    resolved: false
  };
  db.data.exceptions.push(newException);
  await saveDatabase();
  return newException;
}

export async function resolveException(id: string, resolution: string): Promise<Exception | null> {
  const db = getDatabase();
  const index = db.data.exceptions.findIndex(e => e.id === id);
  if (index === -1) return null;
  
  db.data.exceptions[index] = {
    ...db.data.exceptions[index],
    resolved: true,
    resolution,
    resolvedAt: new Date().toISOString()
  };
  await saveDatabase();
  return db.data.exceptions[index];
}

export async function getOperators(): Promise<Operator[]> {
  return getDatabase().data.operators;
}

export async function getOperatorById(id: string): Promise<Operator | undefined> {
  return getDatabase().data.operators.find(o => o.id === id);
}

export async function addOperator(operator: Omit<Operator, 'id'>): Promise<Operator> {
  const db = getDatabase();
  const newOperator: Operator = {
    ...operator,
    id: generateId()
  };
  db.data.operators.push(newOperator);
  await saveDatabase();
  return newOperator;
}
