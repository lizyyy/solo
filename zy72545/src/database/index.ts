import {
  PromptVersion,
  ProcessParamSample,
  KnowledgeLink,
  ReviewHistory,
  ModelVersion,
} from '../types';
import fs from 'fs';
import path from 'path';

export interface DataStore {
  promptVersions: Map<string, PromptVersion>;
  samples: Map<string, ProcessParamSample>;
  knowledgeLinks: Map<string, KnowledgeLink>;
  reviewHistory: Map<string, ReviewHistory>;
  modelVersions: Map<string, ModelVersion>;
}

interface SerializedStore {
  promptVersions: [string, PromptVersion][];
  samples: [string, ProcessParamSample][];
  knowledgeLinks: [string, KnowledgeLink][];
  reviewHistory: [string, ReviewHistory][];
  modelVersions: [string, ModelVersion][];
}

let store: DataStore;
let dataFilePath: string;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
const SAVE_DEBOUNCE_MS = 200;

function serialize(ds: DataStore): SerializedStore {
  return {
    promptVersions: Array.from(ds.promptVersions.entries()),
    samples: Array.from(ds.samples.entries()),
    knowledgeLinks: Array.from(ds.knowledgeLinks.entries()),
    reviewHistory: Array.from(ds.reviewHistory.entries()),
    modelVersions: Array.from(ds.modelVersions.entries()),
  };
}

function deserialize(raw: SerializedStore): DataStore {
  return {
    promptVersions: new Map(raw.promptVersions),
    samples: new Map(raw.samples),
    knowledgeLinks: new Map(raw.knowledgeLinks),
    reviewHistory: new Map(raw.reviewHistory),
    modelVersions: new Map(raw.modelVersions),
  };
}

function loadFromDisk(filePath: string): DataStore {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw) as SerializedStore;
      return deserialize(parsed);
    }
  } catch (e) {
    console.error(`数据文件读取失败，将使用空存储: ${(e as Error).message}`);
  }
  return {
    promptVersions: new Map(),
    samples: new Map(),
    knowledgeLinks: new Map(),
    reviewHistory: new Map(),
    modelVersions: new Map(),
  };
}

function saveToDisk(ds: DataStore, filePath: string): void {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tmpPath = filePath + '.tmp';
    fs.writeFileSync(tmpPath, JSON.stringify(serialize(ds), null, 2), 'utf-8');
    fs.renameSync(tmpPath, filePath);
  } catch (e) {
    console.error(`数据持久化失败: ${(e as Error).message}`);
  }
}

export function scheduleSave(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (store && dataFilePath) {
      saveToDisk(store, dataFilePath);
    }
    saveTimer = null;
  }, SAVE_DEBOUNCE_MS);
}

export function flush(): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (store && dataFilePath) {
    saveToDisk(store, dataFilePath);
  }
}

export function initDatabase(filePath?: string): DataStore {
  dataFilePath = filePath || path.join(process.cwd(), 'data', 'process-review.json');
  store = loadFromDisk(dataFilePath);
  console.log(`数据已加载，共 ${store.promptVersions.size} 个提示词版本、${store.samples.size} 个样本、${store.reviewHistory.size} 条历史`);
  return store;
}

export function getDb(): DataStore {
  if (!store) {
    initDatabase();
  }
  return store;
}
