import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  Hall,
  Movie,
  Key,
  CleaningRule,
  Schedule,
  Conflict,
  CompensationTask,
  ConflictType,
  CompensationType,
  TaskStatus
} from '../types';

const DEFAULT_DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'cinema-data.json');

interface DatabaseData {
  halls: Hall[];
  movies: Movie[];
  keys: Key[];
  cleaningRules: CleaningRule[];
  schedules: Schedule[];
  conflicts: Conflict[];
  compensationTasks: CompensationTask[];
}

function loadData(dbPath: string): DatabaseData {
  if (fs.existsSync(dbPath)) {
    try {
      const content = fs.readFileSync(dbPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return initData();
    }
  }
  return initData();
}

function initData(): DatabaseData {
  return {
    halls: [],
    movies: [],
    keys: [],
    cleaningRules: [],
    schedules: [],
    conflicts: [],
    compensationTasks: []
  };
}

function saveData(dbPath: string, data: DatabaseData): void {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

export class DatabaseService {
  private data: DatabaseData;
  private dbPath: string;

  constructor(dbPath: string = DEFAULT_DB_PATH) {
    this.dbPath = dbPath;
    this.data = loadData(dbPath);
  }

  private now(): number {
    return Date.now();
  }

  private persist(): void {
    saveData(this.dbPath, this.data);
  }

  createHall(name: string, capacity: number): Hall {
    const id = uuidv4();
    const now = this.now();
    const hall: Hall = {
      id,
      name,
      capacity,
      createdAt: now,
      updatedAt: now
    };
    this.data.halls.push(hall);
    this.persist();
    return hall;
  }

  getHall(id: string): Hall | undefined {
    return this.data.halls.find(h => h.id === id);
  }

  getAllHalls(): Hall[] {
    return [...this.data.halls];
  }

  createMovie(name: string, duration: number): Movie {
    const id = uuidv4();
    const now = this.now();
    const movie: Movie = {
      id,
      name,
      duration,
      createdAt: now,
      updatedAt: now
    };
    this.data.movies.push(movie);
    this.persist();
    return movie;
  }

  getMovie(id: string): Movie | undefined {
    return this.data.movies.find(m => m.id === id);
  }

  createKey(movieId: string, startAt: number, endAt: number): Key {
    const id = uuidv4();
    const now = this.now();
    const key: Key = {
      id,
      movieId,
      startAt,
      endAt,
      createdAt: now,
      updatedAt: now
    };
    this.data.keys.push(key);
    this.persist();
    return key;
  }

  getKey(id: string): Key | undefined {
    return this.data.keys.find(k => k.id === id);
  }

  getKeysByMovie(movieId: string): Key[] {
    return this.data.keys.filter(k => k.movieId === movieId);
  }

  createCleaningRule(hallId: string, duration: number): CleaningRule {
    const id = uuidv4();
    const now = this.now();
    const rule: CleaningRule = {
      id,
      hallId,
      duration,
      createdAt: now,
      updatedAt: now
    };
    this.data.cleaningRules.push(rule);
    this.persist();
    return rule;
  }

  getCleaningRule(id: string): CleaningRule | undefined {
    return this.data.cleaningRules.find(r => r.id === id);
  }

  getCleaningRuleByHall(hallId: string): CleaningRule | undefined {
    return this.data.cleaningRules.find(r => r.hallId === hallId);
  }

  createSchedule(hallId: string, movieId: string, startAt: number, endAt: number): Schedule {
    const id = uuidv4();
    const now = this.now();
    const schedule: Schedule = {
      id,
      hallId,
      movieId,
      startAt,
      endAt,
      ticketLock: false,
      status: 'active',
      createdAt: now,
      updatedAt: now
    };
    this.data.schedules.push(schedule);
    this.persist();
    return schedule;
  }

  getSchedule(id: string): Schedule | undefined {
    return this.data.schedules.find(s => s.id === id);
  }

  updateSchedule(id: string, updates: Partial<Schedule>): Schedule {
    const index = this.data.schedules.findIndex(s => s.id === id);
    if (index === -1) throw new Error('Schedule not found');

    const now = this.now();
    this.data.schedules[index] = {
      ...this.data.schedules[index],
      ...updates,
      updatedAt: now
    };
    this.persist();
    return this.data.schedules[index];
  }

  getSchedulesByHallAndTime(hallId: string, startTime: number, endTime: number): Schedule[] {
    return this.data.schedules.filter(s => 
      s.hallId === hallId &&
      s.status === 'active' &&
      !(s.endAt <= startTime || s.startAt >= endTime)
    );
  }

  getSchedulesByMovie(movieId: string): Schedule[] {
    return this.data.schedules.filter(s => s.movieId === movieId && s.status === 'active');
  }

  createConflict(
    type: ConflictType,
    scheduleId: string,
    description: string,
    severity: 'low' | 'medium' | 'high',
    affectedScheduleIds?: string[]
  ): Conflict {
    const id = uuidv4();
    const now = this.now();
    const conflict: Conflict = {
      id,
      type,
      scheduleId,
      description,
      severity,
      affectedScheduleIds,
      createdAt: now
    };
    this.data.conflicts.push(conflict);
    this.persist();
    return conflict;
  }

  getConflict(id: string): Conflict | undefined {
    return this.data.conflicts.find(c => c.id === id);
  }

  getConflictsBySchedule(scheduleId: string): Conflict[] {
    return this.data.conflicts
      .filter(c => c.scheduleId === scheduleId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  resolveConflict(id: string): Conflict {
    const index = this.data.conflicts.findIndex(c => c.id === id);
    if (index === -1) throw new Error('Conflict not found');

    this.data.conflicts[index] = {
      ...this.data.conflicts[index],
      resolvedAt: Date.now()
    };
    this.persist();
    return this.data.conflicts[index];
  }

  createCompensationTask(
    scheduleId: string,
    type: CompensationType,
    payload: Record<string, any>,
    maxAttempts: number = 3
  ): CompensationTask {
    const id = uuidv4();
    const now = this.now();
    const task: CompensationTask = {
      id,
      scheduleId,
      type,
      status: TaskStatus.PENDING,
      attempts: 0,
      maxAttempts,
      payload,
      createdAt: now,
      updatedAt: now
    };
    this.data.compensationTasks.push(task);
    this.persist();
    return task;
  }

  getCompensationTask(id: string): CompensationTask | undefined {
    return this.data.compensationTasks.find(t => t.id === id);
  }

  getPendingCompensationTasks(): CompensationTask[] {
    return this.data.compensationTasks
      .filter(t => 
        (t.status === TaskStatus.PENDING || t.status === TaskStatus.FAILED) &&
        t.attempts < t.maxAttempts
      )
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  updateCompensationTask(id: string, updates: Partial<CompensationTask>): CompensationTask {
    const index = this.data.compensationTasks.findIndex(t => t.id === id);
    if (index === -1) throw new Error('Task not found');

    const now = this.now();
    this.data.compensationTasks[index] = {
      ...this.data.compensationTasks[index],
      ...updates,
      updatedAt: now
    };
    this.persist();
    return this.data.compensationTasks[index];
  }

  getCompensationTasksBySchedule(scheduleId: string): CompensationTask[] {
    return this.data.compensationTasks
      .filter(t => t.scheduleId === scheduleId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  close(): void {
  }
}

let defaultDbInstance: DatabaseService | null = null;

export function getDb(): DatabaseService {
  if (!defaultDbInstance) {
    defaultDbInstance = new DatabaseService();
  }
  return defaultDbInstance;
}

export function setDbInstance(instance: DatabaseService): void {
  defaultDbInstance = instance;
}

export const db = getDb();
