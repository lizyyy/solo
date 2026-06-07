import { 
  PromptVersion, 
  ProcessParamSample, 
  KnowledgeLink, 
  ReviewHistory,
  ModelVersion,
} from '../types';

export interface DataStore {
  promptVersions: Map<string, PromptVersion>;
  samples: Map<string, ProcessParamSample>;
  knowledgeLinks: Map<string, KnowledgeLink>;
  reviewHistory: Map<string, ReviewHistory>;
  modelVersions: Map<string, ModelVersion>;
}

let store: DataStore;

export function initDatabase(): DataStore {
  store = {
    promptVersions: new Map(),
    samples: new Map(),
    knowledgeLinks: new Map(),
    reviewHistory: new Map(),
    modelVersions: new Map(),
  };
  return store;
}

export function getDb(): DataStore {
  if (!store) {
    initDatabase();
  }
  return store;
}
