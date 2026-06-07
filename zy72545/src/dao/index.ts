import { getDb } from '../database';
import { 
  PromptVersion, 
  ProcessParamSample, 
  KnowledgeLink, 
  ReviewHistory,
  ModelVersion,
  ReviewStatus,
} from '../types';
import { randomUUID } from 'crypto';

export const promptVersionDao = {
  insert(version: Omit<PromptVersion, 'id'>): PromptVersion {
    const db = getDb();
    const id = randomUUID();
    const record: PromptVersion = { ...version, id };
    db.promptVersions.set(id, record);
    return record;
  },

  findByVersion(version: string): PromptVersion | null {
    const db = getDb();
    for (const pv of db.promptVersions.values()) {
      if (pv.version === version) return pv;
    }
    return null;
  },

  findById(id: string): PromptVersion | null {
    const db = getDb();
    return db.promptVersions.get(id) || null;
  },

  listAll(): PromptVersion[] {
    const db = getDb();
    return Array.from(db.promptVersions.values())
      .sort((a, b) => b.importedAt - a.importedAt);
  },
};

export const sampleDao = {
  insert(sample: Omit<ProcessParamSample, 'id'>): ProcessParamSample {
    const db = getDb();
    const id = randomUUID();
    const record: ProcessParamSample = { ...sample, id };
    db.samples.set(id, record);
    return record;
  },

  update(sample: ProcessParamSample): void {
    const db = getDb();
    db.samples.set(sample.id, sample);
  },

  findByPromptAndKey(promptVersionId: string, sampleKey: string): ProcessParamSample | null {
    const db = getDb();
    for (const s of db.samples.values()) {
      if (s.promptVersionId === promptVersionId && s.sampleKey === sampleKey) {
        return s;
      }
    }
    return null;
  },

  findById(id: string): ProcessParamSample | null {
    const db = getDb();
    return db.samples.get(id) || null;
  },

  findByPromptVersion(promptVersionId: string): ProcessParamSample[] {
    const db = getDb();
    return Array.from(db.samples.values())
      .filter(s => s.promptVersionId === promptVersionId)
      .sort((a, b) => b.createdAt - a.createdAt);
  },

  findByStatus(status: ReviewStatus): ProcessParamSample[] {
    const db = getDb();
    return Array.from(db.samples.values())
      .filter(s => s.status === status)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  },

  countByPromptVersion(promptVersionId: string): number {
    const db = getDb();
    let count = 0;
    for (const s of db.samples.values()) {
      if (s.promptVersionId === promptVersionId) count++;
    }
    return count;
  },
};

export const knowledgeLinkDao = {
  insert(link: Omit<KnowledgeLink, 'id'>): KnowledgeLink {
    const db = getDb();
    const id = randomUUID();
    const record: KnowledgeLink = { ...link, id };
    db.knowledgeLinks.set(id, record);
    return record;
  },

  findByPromptVersion(promptVersionId: string): KnowledgeLink[] {
    const db = getDb();
    return Array.from(db.knowledgeLinks.values())
      .filter(l => l.promptVersionId === promptVersionId)
      .sort((a, b) => b.addedAt - a.addedAt);
  },

  findById(id: string): KnowledgeLink | null {
    const db = getDb();
    return db.knowledgeLinks.get(id) || null;
  },
};

export const reviewHistoryDao = {
  insert(history: Omit<ReviewHistory, 'id'>): ReviewHistory {
    const db = getDb();
    const id = randomUUID();
    const record: ReviewHistory = { ...history, id };
    db.reviewHistory.set(id, record);
    return record;
  },

  findBySample(sampleId: string): ReviewHistory[] {
    const db = getDb();
    return Array.from(db.reviewHistory.values())
      .filter(h => h.sampleId === sampleId)
      .sort((a, b) => a.timestamp - b.timestamp);
  },

  findByPromptVersion(promptVersionId: string): ReviewHistory[] {
    const db = getDb();
    const sampleIds = new Set<string>();
    for (const s of db.samples.values()) {
      if (s.promptVersionId === promptVersionId) {
        sampleIds.add(s.id);
      }
    }
    return Array.from(db.reviewHistory.values())
      .filter(h => sampleIds.has(h.sampleId))
      .sort((a, b) => a.timestamp - b.timestamp);
  },
};

export const modelVersionDao = {
  insert(version: Omit<ModelVersion, 'id'>): ModelVersion {
    const db = getDb();
    const id = randomUUID();
    const record: ModelVersion = { ...version, id };
    db.modelVersions.set(id, record);
    return record;
  },

  findByPromptVersion(promptVersionId: string): ModelVersion[] {
    const db = getDb();
    return Array.from(db.modelVersions.values())
      .filter(v => v.promptVersionId === promptVersionId)
      .sort((a, b) => b.comparedAt - a.comparedAt);
  },
};
