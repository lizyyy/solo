import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  DatabaseSchema,
  Elder,
  MenuItem,
  MealPlan,
  Delivery,
  FollowUp,
  ImportError,
  HistoryRecord,
} from './types';

const DB_DIR = path.join(process.cwd(), '.canteen-data');
const DB_PATH = path.join(DB_DIR, 'database.json');

const defaultDatabase: DatabaseSchema = {
  elders: [],
  menuItems: [],
  mealPlans: [],
  deliveries: [],
  followUps: [],
  importErrors: {
    elders: [],
    menuItems: [],
    deliveries: [],
  },
  history: [],
};

export class Database {
  private data: DatabaseSchema;

  constructor() {
    this.ensureDbDir();
    this.data = this.loadData();
  }

  private ensureDbDir(): void {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
  }

  private loadData(): DatabaseSchema {
    try {
      if (fs.existsSync(DB_PATH)) {
        const rawData = fs.readFileSync(DB_PATH, 'utf-8');
        return JSON.parse(rawData);
      }
    } catch (error) {
      console.warn('数据库文件损坏，使用默认数据库');
    }
    return { ...defaultDatabase };
  }

  private saveData(): void {
    fs.writeFileSync(DB_PATH, JSON.stringify(this.data, null, 2), 'utf-8');
  }

  private addHistory(action: string, entityType: string, entityId?: string, details: Record<string, any> = {}): void {
    const record: HistoryRecord = {
      id: uuidv4(),
      action,
      entityType,
      entityId,
      details,
      timestamp: new Date().toISOString(),
    };
    this.data.history.unshift(record);
    this.saveData();
  }

  getElders(): Elder[] {
    return [...this.data.elders];
  }

  getElderById(id: string): Elder | undefined {
    return this.data.elders.find(e => e.id === id);
  }

  addElder(elder: Omit<Elder, 'id' | 'createdAt' | 'updatedAt'>): Elder {
    const now = new Date().toISOString();
    const newElder: Elder = {
      ...elder,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
    };
    this.data.elders.push(newElder);
    this.addHistory('create', 'elder', newElder.id, { name: newElder.name });
    this.saveData();
    return newElder;
  }

  bulkAddElders(elders: Array<Omit<Elder, 'id' | 'createdAt' | 'updatedAt'>>): Elder[] {
    const now = new Date().toISOString();
    const newElders: Elder[] = elders.map(elder => ({
      ...elder,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
    }));
    this.data.elders.push(...newElders);
    newElders.forEach(e => {
      this.addHistory('create', 'elder', e.id, { name: e.name, bulk: true });
    });
    this.saveData();
    return newElders;
  }

  updateElder(id: string, updates: Partial<Elder>): Elder | undefined {
    const index = this.data.elders.findIndex(e => e.id === id);
    if (index === -1) return undefined;
    
    this.data.elders[index] = {
      ...this.data.elders[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.addHistory('update', 'elder', id, updates);
    this.saveData();
    return this.data.elders[index];
  }

  getMenuItems(): MenuItem[] {
    return [...this.data.menuItems];
  }

  getMenuItemById(id: string): MenuItem | undefined {
    return this.data.menuItems.find(m => m.id === id);
  }

  addMenuItem(item: Omit<MenuItem, 'id'>): MenuItem {
    const newItem: MenuItem = {
      ...item,
      id: uuidv4(),
    };
    this.data.menuItems.push(newItem);
    this.addHistory('create', 'menuItem', newItem.id, { name: newItem.name });
    this.saveData();
    return newItem;
  }

  bulkAddMenuItems(items: Array<Omit<MenuItem, 'id'>>): MenuItem[] {
    const newItems: MenuItem[] = items.map(item => ({
      ...item,
      id: uuidv4(),
    }));
    this.data.menuItems.push(...newItems);
    newItems.forEach(i => {
      this.addHistory('create', 'menuItem', i.id, { name: i.name, bulk: true });
    });
    this.saveData();
    return newItems;
  }

  getMealPlans(): MealPlan[] {
    return [...this.data.mealPlans];
  }

  getMealPlanById(id: string): MealPlan | undefined {
    return this.data.mealPlans.find(m => m.id === id);
  }

  getMealPlansByElderAndDate(elderId: string, date: string): MealPlan[] {
    return this.data.mealPlans.filter(m => m.elderId === elderId && m.date === date);
  }

  addMealPlan(plan: Omit<MealPlan, 'id' | 'createdAt' | 'updatedAt' | 'conflicts'>): MealPlan {
    const now = new Date().toISOString();
    const newPlan: MealPlan = {
      ...plan,
      id: uuidv4(),
      conflicts: [],
      createdAt: now,
      updatedAt: now,
    };
    this.data.mealPlans.push(newPlan);
    this.addHistory('create', 'mealPlan', newPlan.id, { 
      elderId: newPlan.elderId, 
      date: newPlan.date,
      mealType: newPlan.mealType 
    });
    this.saveData();
    return newPlan;
  }

  updateMealPlan(id: string, updates: Partial<MealPlan>): MealPlan | undefined {
    const index = this.data.mealPlans.findIndex(m => m.id === id);
    if (index === -1) return undefined;
    
    this.data.mealPlans[index] = {
      ...this.data.mealPlans[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.addHistory('update', 'mealPlan', id, updates);
    this.saveData();
    return this.data.mealPlans[index];
  }

  addConflictsToMealPlan(id: string, conflicts: string[]): MealPlan | undefined {
    const index = this.data.mealPlans.findIndex(m => m.id === id);
    if (index === -1) return undefined;
    
    const existingConflicts = this.data.mealPlans[index].conflicts;
    const newConflicts = [...new Set([...existingConflicts, ...conflicts])];
    this.data.mealPlans[index].conflicts = newConflicts;
    this.data.mealPlans[index].updatedAt = new Date().toISOString();
    this.addHistory('add_conflicts', 'mealPlan', id, { conflicts });
    this.saveData();
    return this.data.mealPlans[index];
  }

  getDeliveries(): Delivery[] {
    return [...this.data.deliveries];
  }

  getDeliveryById(id: string): Delivery | undefined {
    return this.data.deliveries.find(d => d.id === id);
  }

  addDelivery(delivery: Omit<Delivery, 'id' | 'createdAt'>): Delivery {
    const now = new Date().toISOString();
    const newDelivery: Delivery = {
      ...delivery,
      id: uuidv4(),
      createdAt: now,
    };
    this.data.deliveries.push(newDelivery);
    this.addHistory('create', 'delivery', newDelivery.id, {
      elderId: newDelivery.elderId,
      date: newDelivery.date,
      route: newDelivery.route,
    });
    this.saveData();
    return newDelivery;
  }

  updateDeliveryStatus(id: string, status: Delivery['status'], notes?: string): Delivery | undefined {
    const index = this.data.deliveries.findIndex(d => d.id === id);
    if (index === -1) return undefined;
    
    this.data.deliveries[index].status = status;
    if (notes) {
      this.data.deliveries[index].notes = notes;
    }
    if (status === 'delivered') {
      this.data.deliveries[index].deliveredAt = new Date().toISOString();
    }
    this.addHistory('update_status', 'delivery', id, { status, notes });
    this.saveData();
    return this.data.deliveries[index];
  }

  getFollowUps(): FollowUp[] {
    return [...this.data.followUps];
  }

  addFollowUp(followUp: Omit<FollowUp, 'id' | 'createdAt'>): FollowUp {
    const now = new Date().toISOString();
    const newFollowUp: FollowUp = {
      ...followUp,
      id: uuidv4(),
      createdAt: now,
    };
    this.data.followUps.push(newFollowUp);
    this.addHistory('create', 'followUp', newFollowUp.id, {
      elderId: newFollowUp.elderId,
      date: newFollowUp.date,
    });
    this.saveData();
    return newFollowUp;
  }

  saveImportErrors(type: 'elders' | 'menuItems' | 'deliveries', errors: ImportError[]): void {
    this.data.importErrors[type].push(...errors);
    this.saveData();
  }

  getImportErrors(type: 'elders' | 'menuItems' | 'deliveries'): ImportError[] {
    return [...this.data.importErrors[type]];
  }

  getHistory(limit?: number): HistoryRecord[] {
    const history = [...this.data.history];
    return limit ? history.slice(0, limit) : history;
  }

  reset(): void {
    this.data = { ...defaultDatabase };
    this.saveData();
  }

  getDbPath(): string {
    return DB_PATH;
  }
}

export const db = new Database();
