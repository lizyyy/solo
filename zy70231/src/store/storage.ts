import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Database } from '../types/models';
import type * as models from '../types/models';

interface SerializedDatabase {
  maintenanceWindows: { [key: string]: models.MaintenanceWindow };
  workZones: { [key: string]: models.WorkZone };
  resources: { [key: string]: models.Resource };
  workTasks: { [key: string]: models.WorkTask };
  blockSections: { [key: string]: models.BlockSection };
  scheduledTasks: { [key: string]: models.ScheduledTask };
  resourceOccupancies: { [key: string]: models.ResourceOccupancy };
  conflicts: models.Conflict[];
  runStates: models.RunState[];
}

export class Storage {
  private dbPath: string;
  private static instance: Storage | null = null;
  private database: Database = this.createEmptyDatabase();

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  static getInstance(dbPath?: string): Storage {
    if (!Storage.instance) {
      Storage.instance = new Storage(dbPath || path.join(process.cwd(), '.rw-data.json'));
    }
    return Storage.instance;
  }

  private createEmptyDatabase(): Database {
    return {
      maintenanceWindows: new Map(),
      workZones: new Map(),
      resources: new Map(),
      workTasks: new Map(),
      blockSections: new Map(),
      scheduledTasks: new Map(),
      resourceOccupancies: new Map(),
      conflicts: [],
      runStates: [],
    };
  }

  load(): void {
    if (!fs.existsSync(this.dbPath)) {
      return;
    }
    const raw = fs.readFileSync(this.dbPath, 'utf-8');
    const data: SerializedDatabase = JSON.parse(raw);
    this.database = {
      maintenanceWindows: new Map(Object.entries(data.maintenanceWindows || {})),
      workZones: new Map(Object.entries(data.workZones || {})),
      resources: new Map(Object.entries(data.resources || {})),
      workTasks: new Map(Object.entries(data.workTasks || {})),
      blockSections: new Map(Object.entries(data.blockSections || {})),
      scheduledTasks: new Map(Object.entries(data.scheduledTasks || {})),
      resourceOccupancies: new Map(Object.entries(data.resourceOccupancies || {})),
      conflicts: data.conflicts || [],
      runStates: data.runStates || [],
    };
  }

  save(): void {
    const data: SerializedDatabase = {
      maintenanceWindows: Object.fromEntries(this.database.maintenanceWindows),
      workZones: Object.fromEntries(this.database.workZones),
      resources: Object.fromEntries(this.database.resources),
      workTasks: Object.fromEntries(this.database.workTasks),
      blockSections: Object.fromEntries(this.database.blockSections),
      scheduledTasks: Object.fromEntries(this.database.scheduledTasks),
      resourceOccupancies: Object.fromEntries(this.database.resourceOccupancies),
      conflicts: this.database.conflicts,
      runStates: this.database.runStates,
    };
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.dbPath, JSON.stringify(data, null, 2), 'utf-8');
  }

  get db(): Database {
    return this.database;
  }

  clearRunData(runId: string): void {
    const scheduledToRemove = new Set<string>();
    const lastSuccessRun = this.database.runStates
      .filter(r => r.status === 'completed')
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
    
    for (const [id, task] of this.database.scheduledTasks) {
      scheduledToRemove.add(id);
    }
    
    for (const id of scheduledToRemove) {
      this.database.scheduledTasks.delete(id);
    }
    
    const occupanciesToRemove = new Set<string>();
    for (const [id, occ] of this.database.resourceOccupancies) {
      occupanciesToRemove.add(id);
    }
    for (const id of occupanciesToRemove) {
      this.database.resourceOccupancies.delete(id);
    }
    
    this.database.conflicts = [];
  }

  addRunState(state: Omit<models.RunState, 'runId' | 'timestamp'>): models.RunState {
    const runState: models.RunState = {
      runId: uuidv4(),
      timestamp: new Date().toISOString(),
      ...state,
    };
    this.database.runStates.push(runState);
    return runState;
  }

  updateRunState(runId: string, updates: Partial<models.RunState>): void {
    const index = this.database.runStates.findIndex(r => r.runId === runId);
    if (index !== -1) {
      this.database.runStates[index] = { ...this.database.runStates[index], ...updates };
    }
  }

  getLastRunState(): models.RunState | undefined {
    return [...this.database.runStates]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
  }
}
