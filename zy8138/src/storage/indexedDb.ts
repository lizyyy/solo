import { openDB, type IDBPDatabase } from 'idb';
import type { ConfirmedIssue, Scene, Prop, PropAppearance, ContinuityRule } from '../types';

const DB_NAME = 'ContinuityCheckerDB';
const DB_VERSION = 1;

interface DBSchema {
  confirmedIssues: {
    key: string;
    value: ConfirmedIssue;
    indexes: { 'by-issue-id': string };
  };
  scenes: {
    key: string;
    value: Scene;
    indexes: { 'by-scene-number': string };
  };
  props: {
    key: string;
    value: Prop;
    indexes: { 'by-prop-number': string };
  };
  appearances: {
    key: string;
    value: PropAppearance;
    indexes: { 'by-prop-id': string; 'by-scene-id': string };
  };
  rules: {
    key: string;
    value: ContinuityRule;
    indexes: { 'by-rule-type': string };
  };
  projectSettings: {
    key: string;
    value: {
      projectName: string;
      lastUpdated: number;
      activeDataSet: string;
    };
  };
}

let db: IDBPDatabase<DBSchema> | null = null;

export async function initDB(): Promise<IDBPDatabase<DBSchema>> {
  if (db) return db;

  db = await openDB<DBSchema>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('confirmedIssues')) {
        const confirmedStore = db.createObjectStore('confirmedIssues', { keyPath: 'id' });
        confirmedStore.createIndex('by-issue-id', 'issueId', { unique: true });
      }

      if (!db.objectStoreNames.contains('scenes')) {
        const scenesStore = db.createObjectStore('scenes', { keyPath: 'id' });
        scenesStore.createIndex('by-scene-number', 'sceneNumber', { unique: false });
      }

      if (!db.objectStoreNames.contains('props')) {
        const propsStore = db.createObjectStore('props', { keyPath: 'id' });
        propsStore.createIndex('by-prop-number', 'propNumber', { unique: false });
      }

      if (!db.objectStoreNames.contains('appearances')) {
        const appearancesStore = db.createObjectStore('appearances', { keyPath: 'id' });
        appearancesStore.createIndex('by-prop-id', 'propId', { unique: false });
        appearancesStore.createIndex('by-scene-id', 'sceneId', { unique: false });
      }

      if (!db.objectStoreNames.contains('rules')) {
        const rulesStore = db.createObjectStore('rules', { keyPath: 'id' });
        rulesStore.createIndex('by-rule-type', 'ruleType', { unique: false });
      }

      if (!db.objectStoreNames.contains('projectSettings')) {
        db.createObjectStore('projectSettings', { keyPath: 'id' });
      }
    },
  });

  return db;
}

export async function getDB(): Promise<IDBPDatabase<DBSchema>> {
  if (!db) {
    return initDB();
  }
  return db;
}

export async function saveConfirmedIssue(issue: ConfirmedIssue): Promise<void> {
  const db = await getDB();
  await db.put('confirmedIssues', issue);
}

export async function getConfirmedIssue(issueId: string): Promise<ConfirmedIssue | undefined> {
  const db = await getDB();
  const index = db.transaction('confirmedIssues').store.index('by-issue-id');
  return index.get(issueId);
}

export async function getAllConfirmedIssues(): Promise<ConfirmedIssue[]> {
  const db = await getDB();
  return db.getAll('confirmedIssues');
}

export async function deleteConfirmedIssue(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('confirmedIssues', id);
}

export async function clearConfirmedIssues(): Promise<void> {
  const db = await getDB();
  await db.clear('confirmedIssues');
}

export async function saveScenes(scenes: Scene[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('scenes', 'readwrite');
  await Promise.all(scenes.map(scene => tx.store.put(scene)));
  await tx.done;
}

export async function getAllScenes(): Promise<Scene[]> {
  const db = await getDB();
  return db.getAll('scenes');
}

export async function clearScenes(): Promise<void> {
  const db = await getDB();
  await db.clear('scenes');
}

export async function saveProps(props: Prop[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('props', 'readwrite');
  await Promise.all(props.map(prop => tx.store.put(prop)));
  await tx.done;
}

export async function getAllProps(): Promise<Prop[]> {
  const db = await getDB();
  return db.getAll('props');
}

export async function clearProps(): Promise<void> {
  const db = await getDB();
  await db.clear('props');
}

export async function saveAppearances(appearances: PropAppearance[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('appearances', 'readwrite');
  await Promise.all(appearances.map(appearance => tx.store.put(appearance)));
  await tx.done;
}

export async function getAllAppearances(): Promise<PropAppearance[]> {
  const db = await getDB();
  return db.getAll('appearances');
}

export async function clearAppearances(): Promise<void> {
  const db = await getDB();
  await db.clear('appearances');
}

export async function saveRules(rules: ContinuityRule[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('rules', 'readwrite');
  await Promise.all(rules.map(rule => tx.store.put(rule)));
  await tx.done;
}

export async function getAllRules(): Promise<ContinuityRule[]> {
  const db = await getDB();
  return db.getAll('rules');
}

export async function clearRules(): Promise<void> {
  const db = await getDB();
  await db.clear('rules');
}

export async function saveProjectSettings(settings: {
  projectName: string;
  lastUpdated: number;
  activeDataSet: string;
}): Promise<void> {
  const db = await getDB();
  await db.put('projectSettings', { ...settings, id: 'current' });
}

export async function getProjectSettings(): Promise<{
  projectName: string;
  lastUpdated: number;
  activeDataSet: string;
} | undefined> {
  const db = await getDB();
  return db.get('projectSettings', 'current');
}

export async function clearAllData(): Promise<void> {
  await Promise.all([
    clearScenes(),
    clearProps(),
    clearAppearances(),
    clearRules(),
    clearConfirmedIssues(),
  ]);
}

export async function loadSampleDataSet(dataSet: {
  scenes: Scene[];
  props: Prop[];
  appearances: PropAppearance[];
  rules: ContinuityRule[];
  projectName: string;
}): Promise<void> {
  await clearAllData();
  await saveScenes(dataSet.scenes);
  await saveProps(dataSet.props);
  await saveAppearances(dataSet.appearances);
  await saveRules(dataSet.rules);
  await saveProjectSettings({
    projectName: dataSet.projectName,
    lastUpdated: Date.now(),
    activeDataSet: 'sample',
  });
}

export async function getCurrentDataSet(): Promise<{
  scenes: Scene[];
  props: Prop[];
  appearances: PropAppearance[];
  rules: ContinuityRule[];
  confirmedIssues: ConfirmedIssue[];
  projectSettings?: {
    projectName: string;
    lastUpdated: number;
    activeDataSet: string;
  };
}> {
  const [scenes, props, appearances, rules, confirmedIssues, projectSettings] = await Promise.all([
    getAllScenes(),
    getAllProps(),
    getAllAppearances(),
    getAllRules(),
    getAllConfirmedIssues(),
    getProjectSettings(),
  ]);

  return {
    scenes,
    props,
    appearances,
    rules,
    confirmedIssues,
    projectSettings,
  };
}
