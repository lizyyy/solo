import { openDB, IDBPDatabase } from 'idb';
import {
  Musician,
  Microphone,
  MonitorPoint,
  RoomConfig,
  RehearsalPlan,
  RehearsalReport,
  CompletePlanData,
} from '../types';
import { runAllSceneValidations } from '../utils/sceneDetection';

const DB_NAME = 'band_rehearsal_db';
const DB_VERSION = 1;

interface DBSchema {
  plans: {
    key: string;
    value: RehearsalPlan;
    indexes: { 'by-name': string; 'by-createdAt': Date; 'by-updatedAt': Date };
  };
  musicians: {
    key: string;
    value: Musician;
    indexes: { 'by-planId': string; 'by-type': string };
  };
  microphones: {
    key: string;
    value: Microphone;
    indexes: { 'by-planId': string };
  };
  monitorPoints: {
    key: string;
    value: MonitorPoint;
    indexes: { 'by-planId': string };
  };
  roomConfigs: {
    key: string;
    value: RoomConfig;
    indexes: { 'by-planId': string };
  };
  reports: {
    key: string;
    value: RehearsalReport;
    indexes: { 'by-planId': string; 'by-createdAt': Date };
  };
}

let dbPromise: Promise<IDBPDatabase<DBSchema>> | null = null;

const getDB = async (): Promise<IDBPDatabase<DBSchema>> => {
  if (!dbPromise) {
    dbPromise = openDB<DBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const plansStore = db.createObjectStore('plans', { keyPath: 'id' });
        plansStore.createIndex('by-name', 'name');
        plansStore.createIndex('by-createdAt', 'createdAt');
        plansStore.createIndex('by-updatedAt', 'updatedAt');

        const musiciansStore = db.createObjectStore('musicians', { keyPath: 'id' });
        musiciansStore.createIndex('by-planId', 'planId');
        musiciansStore.createIndex('by-type', 'type');

        const micsStore = db.createObjectStore('microphones', { keyPath: 'id' });
        micsStore.createIndex('by-planId', 'planId');

        const monitorsStore = db.createObjectStore('monitorPoints', { keyPath: 'id' });
        monitorsStore.createIndex('by-planId', 'planId');

        const roomStore = db.createObjectStore('roomConfigs', { keyPath: 'id' });
        roomStore.createIndex('by-planId', 'planId');

        const reportsStore = db.createObjectStore('reports', { keyPath: 'id' });
        reportsStore.createIndex('by-planId', 'planId');
        reportsStore.createIndex('by-createdAt', 'createdAt');
      },
    });
  }
  return dbPromise;
};

export const savePlan = async (data: CompletePlanData): Promise<void> => {
  const db = await getDB();
  const tx = db.transaction([
    'plans', 'musicians', 'microphones', 'monitorPoints', 'roomConfigs', 'reports'
  ], 'readwrite');

  const planToSave = {
    ...data.plan,
    updatedAt: new Date(),
    isSaved: true,
  };

  await tx.objectStore('plans').put(planToSave);

  await Promise.all(data.musicians.map(m => tx.objectStore('musicians').put(m)));
  await Promise.all(data.microphones.map(m => tx.objectStore('microphones').put(m)));
  await Promise.all(data.monitorPoints.map(m => tx.objectStore('monitorPoints').put(m)));
  await tx.objectStore('roomConfigs').put(data.roomConfig);
  await Promise.all(data.reports.map(r => tx.objectStore('reports').put(r)));

  await tx.done;
};

export const loadPlan = async (planId: string): Promise<CompletePlanData | null> => {
  const db = await getDB();
  const plan = await db.get('plans', planId);

  if (!plan) return null;

  const [musicians, microphones, monitorPoints, roomConfigs, reports] = await Promise.all([
    db.getAllFromIndex('musicians', 'by-planId', planId),
    db.getAllFromIndex('microphones', 'by-planId', planId),
    db.getAllFromIndex('monitorPoints', 'by-planId', planId),
    db.getAllFromIndex('roomConfigs', 'by-planId', planId),
    db.getAllFromIndex('reports', 'by-planId', planId),
  ]);

  return {
    plan,
    musicians,
    microphones,
    monitorPoints,
    roomConfig: roomConfigs[0],
    reports,
  };
};

export const getAllPlans = async (): Promise<RehearsalPlan[]> => {
  const db = await getDB();
  const plans = await db.getAllFromIndex('plans', 'by-updatedAt');

  const plansWithStats = await Promise.all(plans.map(async (plan) => {
    const [musicians, monitorPoints] = await Promise.all([
      db.getAllFromIndex('musicians', 'by-planId', plan.id),
      db.getAllFromIndex('monitorPoints', 'by-planId', plan.id),
    ]);

    const issues = runAllSceneValidations(musicians, monitorPoints);

    return {
      ...plan,
      musicianCount: musicians.length,
      monitorCount: monitorPoints.length,
      issueCount: issues.length,
    };
  }));

  return plansWithStats;
};

export const deletePlan = async (planId: string): Promise<void> => {
  const db = await getDB();
  const tx = db.transaction([
    'plans', 'musicians', 'microphones', 'monitorPoints', 'roomConfigs', 'reports'
  ], 'readwrite');

  await tx.objectStore('plans').delete(planId);

  const musicians = await tx.objectStore('musicians').index('by-planId').getAll(planId);
  const microphones = await tx.objectStore('microphones').index('by-planId').getAll(planId);
  const monitors = await tx.objectStore('monitorPoints').index('by-planId').getAll(planId);
  const roomConfigs = await tx.objectStore('roomConfigs').index('by-planId').getAll(planId);
  const reports = await tx.objectStore('reports').index('by-planId').getAll(planId);

  await Promise.all([
    ...musicians.map(m => tx.objectStore('musicians').delete(m.id)),
    ...microphones.map(m => tx.objectStore('microphones').delete(m.id)),
    ...monitors.map(m => tx.objectStore('monitorPoints').delete(m.id)),
    ...roomConfigs.map(r => tx.objectStore('roomConfigs').delete(r.id)),
    ...reports.map(r => tx.objectStore('reports').delete(r.id)),
  ]);

  await tx.done;
};

export const saveReport = async (report: RehearsalReport): Promise<void> => {
  const db = await getDB();
  await db.put('reports', report);
};

export const getReportsForPlan = async (planId: string): Promise<RehearsalReport[]> => {
  const db = await getDB();
  return db.getAllFromIndex('reports', 'by-planId', planId);
};

export const syncWithBackend = async (data: CompletePlanData): Promise<boolean> => {
  try {
    const response = await fetch('/api/plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.ok;
  } catch (error) {
    console.warn('Backend sync failed, using local storage only:', error);
    return false;
  }
};

export const loadFromBackend = async (planId: string): Promise<CompletePlanData | null> => {
  try {
    const response = await fetch(`/api/plans/${planId}`);
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch (error) {
    console.warn('Backend load failed:', error);
    return null;
  }
};

export const getAllPlansFromBackend = async (): Promise<RehearsalPlan[]> => {
  try {
    const response = await fetch('/api/plans');
    if (response.ok) {
      return await response.json();
    }
    return [];
  } catch (error) {
    console.warn('Backend list failed:', error);
    return [];
  }
};
