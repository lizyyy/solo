import * as fs from 'fs';
import * as path from 'path';
import {
  BoundarySample,
  ManualCounterExample,
  QuestionnaireRow,
  ReviewStatus,
} from '../types';
import { boundarySampleManager } from './boundarySampleManager';

export interface ReviewHistoryEntry {
  id: string;
  sampleId: string;
  action:
    | 'create'
    | 'created'
    | 'ta_review'
    | 'coach_review'
    | 'dismiss'
    | 'dismissed'
    | 'data_import'
    | 'supplement'
    | 'resolved'
    | 'reopened';
  operator: string;
  timestamp: Date;
  originalValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  reason?: string;
  notes?: string;
  statusBefore?: ReviewStatus;
  statusAfter?: ReviewStatus;
  rawStatementAdded?: boolean;
  originalWaitTime?: number;
  correctedWaitTime?: number;
  originalArrivalCount?: number;
  correctedArrivalCount?: number;
}

export interface AppPersistentState {
  version: string;
  lastUpdated: Date;
  manualCounterExamples: ManualCounterExample[];
  questionnaireRows: QuestionnaireRow[];
  boundarySamples: Array<{
    internalId: string;
    data: BoundarySample;
  }>;
  reviewHistory: ReviewHistoryEntry[];
}

const DEFAULT_STATE_PATH = path.resolve(process.cwd(), 'data', 'app-state.json');
const STATE_VERSION = '1.0.0';

function emptyState(): AppPersistentState {
  return {
    version: STATE_VERSION,
    lastUpdated: new Date(),
    manualCounterExamples: [],
    questionnaireRows: [],
    boundarySamples: [],
    reviewHistory: [],
  };
}

function reviveDates(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Date) return obj;
  if (typeof obj === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(obj)) {
      return new Date(obj);
    }
    return obj;
  }
  if (Array.isArray(obj)) return obj.map(reviveDates);
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      result[k] = reviveDates(v);
    }
    return result;
  }
  return obj;
}

export class StateStore {
  private statePath: string;
  private state: AppPersistentState;
  private loaded = false;

  constructor(statePath: string = DEFAULT_STATE_PATH) {
    this.statePath = statePath;
    this.state = emptyState();
  }

  setStatePath(p: string): void {
    this.statePath = path.resolve(p);
    this.loaded = false;
  }

  getStatePath(): string {
    return this.statePath;
  }

  load(force = false): AppPersistentState {
    if (this.loaded && !force) return this.state;

    if (fs.existsSync(this.statePath)) {
      try {
        const raw = fs.readFileSync(this.statePath, 'utf-8');
        const parsed = JSON.parse(raw);
        this.state = reviveDates(parsed) as AppPersistentState;
      } catch (e) {
        console.warn(`[StateStore] 状态文件损坏，使用空状态: ${(e as Error).message}`);
        this.state = emptyState();
      }
    } else {
      this.state = emptyState();
      this.ensureDir();
      fs.writeFileSync(this.statePath, JSON.stringify(this.state, null, 2));
    }

    this.syncToManager();
    this.loaded = true;
    return this.state;
  }

  save(): void {
    this.ensureDir();
    this.syncFromManager();
    this.state.lastUpdated = new Date();
    fs.writeFileSync(this.statePath, JSON.stringify(this.state, null, 2));
  }

  private ensureDir(): void {
    const dir = path.dirname(this.statePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private syncFromManager(): void {
    const all = boundarySampleManager.getAllBoundarySamples();
    this.state.boundarySamples = all.map((data) => ({
      internalId: `bs_${data.sampleId}`,
      data,
    }));
  }

  private syncToManager(): void {
    boundarySampleManager.clear();
    for (const bs of this.state.boundarySamples) {
      const existing = boundarySampleManager.findBySampleId(bs.data.sampleId);
      if (existing) continue;
      boundarySampleManager.createBoundarySample(
        bs.data.negativeSample,
        bs.data.manualCounterExample,
        bs.data.questionnaireRow
      );
      const created = boundarySampleManager.findBySampleId(bs.data.sampleId);
      if (created) {
        created.status = bs.data.status;
        created.createdAt = bs.data.createdAt;
        created.updatedAt = bs.data.updatedAt;
        created.whyKept = bs.data.whyKept;
        created.missingMaterials = [...bs.data.missingMaterials];
        created.nextAction = bs.data.nextAction;
        created.assignee = bs.data.assignee;
        created.taReviewNotes = bs.data.taReviewNotes;
        created.coachReviewNotes = bs.data.coachReviewNotes;
        if (bs.data.originalNegativeValues) {
          created.originalNegativeValues = { ...bs.data.originalNegativeValues };
        }
        if (bs.data.reviewLog) {
          created.reviewLog = [...bs.data.reviewLog];
        }
        if (bs.data.rawOriginalStatement) {
          created.rawOriginalStatement = bs.data.rawOriginalStatement;
        }
        if (bs.data.dataResolution) {
          created.dataResolution = { ...bs.data.dataResolution };
        }
      }
    }
  }

  addManualCounterExamples(examples: ManualCounterExample[]): void {
    this.load();
    const existingIds = new Set(this.state.manualCounterExamples.map((m) => m.sampleId));
    for (const ex of examples) {
      if (!existingIds.has(ex.sampleId)) {
        this.state.manualCounterExamples.push(ex);
      } else {
        const idx = this.state.manualCounterExamples.findIndex((m) => m.sampleId === ex.sampleId);
        this.state.manualCounterExamples[idx] = ex;
      }
    }
  }

  addQuestionnaireRows(rows: QuestionnaireRow[]): void {
    this.load();
    const existingIds = new Set(this.state.questionnaireRows.map((q) => q.sampleId));
    for (const row of rows) {
      if (!existingIds.has(row.sampleId)) {
        this.state.questionnaireRows.push(row);
      } else {
        const idx = this.state.questionnaireRows.findIndex((q) => q.sampleId === row.sampleId);
        this.state.questionnaireRows[idx] = row;
      }
    }
  }

  getManualCounterExamples(): ManualCounterExample[] {
    this.load();
    return this.state.manualCounterExamples;
  }

  getQuestionnaireRows(): QuestionnaireRow[] {
    this.load();
    return this.state.questionnaireRows;
  }

  addHistoryEntry(entry: Omit<ReviewHistoryEntry, 'id' | 'timestamp'>): ReviewHistoryEntry {
    this.load();
    const full: ReviewHistoryEntry = {
      ...entry,
      id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date(),
    };
    this.state.reviewHistory.push(full);
    return full;
  }

  getHistory(sampleId?: string): ReviewHistoryEntry[] {
    this.load();
    if (!sampleId) return this.state.reviewHistory;
    return this.state.reviewHistory.filter((h) => h.sampleId === sampleId);
  }

  clearAll(): void {
    this.state = emptyState();
    boundarySampleManager.clear();
    this.save();
  }

  upsertBoundarySample(sample: BoundarySample): void {
    this.load();
    const idx = this.state.boundarySamples.findIndex((b) => b.data.sampleId === sample.sampleId);
    if (idx >= 0) {
      this.state.boundarySamples[idx] = { internalId: `bs_${sample.sampleId}`, data: sample };
    } else {
      this.state.boundarySamples.push({ internalId: `bs_${sample.sampleId}`, data: sample });
    }
  }

  findBoundarySample(sampleId: string): BoundarySample | undefined {
    this.load();
    const found = this.state.boundarySamples.find((b) => b.data.sampleId === sampleId);
    return found?.data;
  }
}

export const stateStore = new StateStore();
