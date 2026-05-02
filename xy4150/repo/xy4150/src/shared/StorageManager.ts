import { TrainingPlan, TrainingSession } from './types';
import { generateId, now } from './utils';
import { DEFAULT_BPM, DEFAULT_BEATS_PER_MEASURE, DEFAULT_REPEAT_COUNT, HAND_ACTIONS } from './constants';

const STORAGE_KEYS = {
  PLANS: 'hand_rehab_plans',
  SESSIONS: 'hand_rehab_sessions',
  SETTINGS: 'hand_rehab_settings',
};

export interface StorageProvider {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
}

export class LocalStorageProvider implements StorageProvider {
  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  setItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }
  }

  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.error('Failed to remove from localStorage:', e);
    }
  }

  clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.PLANS);
      localStorage.removeItem(STORAGE_KEYS.SESSIONS);
      localStorage.removeItem(STORAGE_KEYS.SETTINGS);
    } catch (e) {
      console.error('Failed to clear localStorage:', e);
    }
  }
}

export class MemoryStorageProvider implements StorageProvider {
  private data: Map<string, string> = new Map();

  getItem(key: string): string | null {
    return this.data.get(key) || null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  clear(): void {
    this.data.clear();
  }

  getAllData(): Map<string, string> {
    return new Map(this.data);
  }
}

export class StorageManager {
  private provider: StorageProvider;

  constructor(provider?: StorageProvider) {
    this.provider = provider || new LocalStorageProvider();
  }

  private loadJSON<T>(key: string, defaultValue: T): T {
    const raw = this.provider.getItem(key);
    if (!raw) return defaultValue;
    
    try {
      return JSON.parse(raw) as T;
    } catch {
      return defaultValue;
    }
  }

  private saveJSON(key: string, value: any): void {
    try {
      const json = JSON.stringify(value);
      this.provider.setItem(key, json);
    } catch (e) {
      console.error('Failed to serialize data:', e);
    }
  }

  getPlans(): TrainingPlan[] {
    return this.loadJSON<TrainingPlan[]>(STORAGE_KEYS.PLANS, []);
  }

  getPlanById(id: string): TrainingPlan | null {
    const plans = this.getPlans();
    return plans.find((p) => p.id === id) || null;
  }

  savePlan(plan: TrainingPlan): void {
    const plans = this.getPlans();
    const existingIndex = plans.findIndex((p) => p.id === plan.id);
    
    if (existingIndex >= 0) {
      plans[existingIndex] = {
        ...plan,
        updatedAt: new Date().toISOString(),
      };
    } else {
      plans.push({
        ...plan,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    this.saveJSON(STORAGE_KEYS.PLANS, plans);
  }

  deletePlan(id: string): boolean {
    const plans = this.getPlans();
    const newPlans = plans.filter((p) => p.id !== id);
    
    if (newPlans.length === plans.length) {
      return false;
    }

    this.saveJSON(STORAGE_KEYS.PLANS, newPlans);
    return true;
  }

  duplicatePlan(id: string): TrainingPlan | null {
    const original = this.getPlanById(id);
    if (!original) return null;

    const newPlan: TrainingPlan = {
      ...original,
      id: generateId(),
      name: `${original.name} (副本)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.savePlan(newPlan);
    return newPlan;
  }

  getSessions(): TrainingSession[] {
    return this.loadJSON<TrainingSession[]>(STORAGE_KEYS.SESSIONS, []);
  }

  getSessionById(id: string): TrainingSession | null {
    const sessions = this.getSessions();
    return sessions.find((s) => s.id === id) || null;
  }

  getSessionsByPlanId(planId: string): TrainingSession[] {
    const sessions = this.getSessions();
    return sessions.filter((s) => s.planId === planId);
  }

  saveSession(session: TrainingSession): void {
    const sessions = this.getSessions();
    const existingIndex = sessions.findIndex((s) => s.id === session.id);
    
    if (existingIndex >= 0) {
      sessions[existingIndex] = session;
    } else {
      sessions.unshift(session);
    }

    this.saveJSON(STORAGE_KEYS.SESSIONS, sessions);
  }

  deleteSession(id: string): boolean {
    const sessions = this.getSessions();
    const newSessions = sessions.filter((s) => s.id !== id);
    
    if (newSessions.length === sessions.length) {
      return false;
    }

    this.saveJSON(STORAGE_KEYS.SESSIONS, newSessions);
    return true;
  }

  clearAllSessions(): void {
    this.provider.removeItem(STORAGE_KEYS.SESSIONS);
  }

  exportPlanToJSON(planId: string): string | null {
    const plan = this.getPlanById(planId);
    if (!plan) return null;
    return JSON.stringify(plan, null, 2);
  }

  importPlanFromJSON(jsonString: string): TrainingPlan | null {
    try {
      const plan = JSON.parse(jsonString) as TrainingPlan;
      
      if (!plan.id || !plan.name || !plan.steps) {
        throw new Error('Invalid plan format');
      }

      plan.id = generateId();
      plan.createdAt = new Date().toISOString();
      plan.updatedAt = new Date().toISOString();
      
      this.savePlan(plan);
      return plan;
    } catch (e) {
      console.error('Failed to import plan:', e);
      return null;
    }
  }

  exportSessionToJSON(sessionId: string): string | null {
    const session = this.getSessionById(sessionId);
    if (!session) return null;
    return JSON.stringify(session, null, 2);
  }

  getRecentSessions(limit: number = 10): TrainingSession[] {
    const sessions = this.getSessions();
    return sessions.slice(0, limit);
  }

  getStatistics(): {
    totalPlans: number;
    totalSessions: number;
    totalActions: number;
    totalCorrectActions: number;
    avgAccuracy: number;
  } {
    const plans = this.getPlans();
    const sessions = this.getSessions();

    let totalActions = 0;
    let totalCorrect = 0;

    sessions.forEach((s) => {
      totalActions += s.actionResults.length;
      totalCorrect += s.totalCorrect;
    });

    return {
      totalPlans: plans.length,
      totalSessions: sessions.length,
      totalActions,
      totalCorrectActions: totalCorrect,
      avgAccuracy: totalActions > 0 ? (totalCorrect / totalActions) * 100 : 0,
    };
  }

  clearAllData(): void {
    this.provider.clear();
  }
}

export function createDefaultPlan(): TrainingPlan {
  return {
    id: generateId(),
    name: '基础康复训练',
    description: '适合初学者的基础手部康复训练方案，包含握拳、张掌、捏合三个基本动作。',
    bpm: DEFAULT_BPM,
    beatsPerMeasure: DEFAULT_BEATS_PER_MEASURE,
    repeatCount: DEFAULT_REPEAT_COUNT,
    steps: [
      {
        id: generateId(),
        actionId: HAND_ACTIONS[0].id,
        beatCount: 4,
      },
      {
        id: generateId(),
        actionId: HAND_ACTIONS[1].id,
        beatCount: 4,
      },
      {
        id: generateId(),
        actionId: HAND_ACTIONS[2].id,
        beatCount: 4,
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function initializeSamplePlans(storage: StorageManager): void {
  const existingPlans = storage.getPlans();
  if (existingPlans.length > 0) return;

  const plan1 = createDefaultPlan();
  storage.savePlan(plan1);

  const plan2: TrainingPlan = {
    id: generateId(),
    name: '进阶交替训练',
    description: '快速交替动作，适合有一定基础的患者。',
    bpm: 80,
    beatsPerMeasure: 4,
    repeatCount: 5,
    steps: [
      {
        id: generateId(),
        actionId: HAND_ACTIONS[0].id,
        beatCount: 2,
      },
      {
        id: generateId(),
        actionId: HAND_ACTIONS[1].id,
        beatCount: 2,
      },
      {
        id: generateId(),
        actionId: HAND_ACTIONS[0].id,
        beatCount: 2,
      },
      {
        id: generateId(),
        actionId: HAND_ACTIONS[1].id,
        beatCount: 2,
      },
      {
        id: generateId(),
        actionId: HAND_ACTIONS[2].id,
        beatCount: 4,
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  storage.savePlan(plan2);

  const plan3: TrainingPlan = {
    id: generateId(),
    name: '耐力训练',
    description: '长时间保持动作，锻炼手部肌肉耐力。',
    bpm: 40,
    beatsPerMeasure: 4,
    repeatCount: 2,
    steps: [
      {
        id: generateId(),
        actionId: HAND_ACTIONS[0].id,
        beatCount: 8,
        holdBeats: 6,
      },
      {
        id: generateId(),
        actionId: HAND_ACTIONS[1].id,
        beatCount: 8,
        holdBeats: 6,
      },
      {
        id: generateId(),
        actionId: HAND_ACTIONS[2].id,
        beatCount: 8,
        holdBeats: 6,
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  storage.savePlan(plan3);
}
