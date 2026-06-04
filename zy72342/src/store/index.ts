import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  SurveyRawRow,
  BoundaryNote,
  FilterResult,
  CounterExample,
  AuditLog,
  FilterRun,
  User,
  FilterConfig,
} from '../types';

export interface StoreData {
  users: User[];
  surveyRows: SurveyRawRow[];
  boundaryNotes: BoundaryNote[];
  filterResults: FilterResult[];
  counterExamples: CounterExample[];
  auditLogs: AuditLog[];
  filterRuns: FilterRun[];
  config: FilterConfig;
}

const defaultConfig: FilterConfig = {
  threshold: 0.5,
  autoResolveAbove: true,
  requireReviewAtThreshold: true,
  defaultHandlerForPending: '张老师',
};

const dataFilePath = path.join(__dirname, '../../data/store.json');

function loadFromDisk(): StoreData | null {
  try {
    if (fs.existsSync(dataFilePath)) {
      const raw = fs.readFileSync(dataFilePath, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Failed to load store from disk, using empty store');
  }
  return null;
}

function saveToDisk(data: StoreData): void {
  try {
    const dir = path.dirname(dataFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to save store to disk:', e);
  }
}

class DataStore {
  private data: StoreData;

  constructor() {
    const loaded = loadFromDisk();
    this.data = loaded || {
      users: [],
      surveyRows: [],
      boundaryNotes: [],
      filterResults: [],
      counterExamples: [],
      auditLogs: [],
      filterRuns: [],
      config: defaultConfig,
    };
  }

  private persist(): void {
    saveToDisk(this.data);
  }

  generateId(): string {
    return uuidv4();
  }

  getConfig(): FilterConfig {
    return { ...this.data.config };
  }

  updateConfig(config: Partial<FilterConfig>): FilterConfig {
    this.data.config = { ...this.data.config, ...config };
    this.persist();
    return this.getConfig();
  }

  getUsers(): User[] {
    return [...this.data.users];
  }

  addUser(user: Omit<User, 'id'>): User {
    const newUser: User = { ...user, id: this.generateId() };
    this.data.users.push(newUser);
    this.persist();
    return newUser;
  }

  findUserByName(name: string): User | undefined {
    return this.data.users.find(u => u.name === name);
  }

  getSurveyRows(): SurveyRawRow[] {
    return [...this.data.surveyRows];
  }

  getSurveyRowById(id: string): SurveyRawRow | undefined {
    return this.data.surveyRows.find(r => r.id === id);
  }

  getSurveyRowsByQuestion(questionId: string): SurveyRawRow[] {
    return this.data.surveyRows.filter(r => r.questionId === questionId);
  }

  addSurveyRow(row: Omit<SurveyRawRow, 'id'>): SurveyRawRow {
    const newRow: SurveyRawRow = { ...row, id: this.generateId() };
    this.data.surveyRows.push(newRow);
    this.persist();
    return newRow;
  }

  addSurveyRows(rows: Array<Omit<SurveyRawRow, 'id'>>): SurveyRawRow[] {
    const newRows = rows.map(r => ({ ...r, id: this.generateId() }));
    this.data.surveyRows.push(...newRows);
    this.persist();
    return newRows;
  }

  getBoundaryNotes(): BoundaryNote[] {
    return [...this.data.boundaryNotes];
  }

  getBoundaryNoteById(id: string): BoundaryNote | undefined {
    return this.data.boundaryNotes.find(n => n.id === id);
  }

  getBoundaryNotesByQuestion(questionId: string): BoundaryNote[] {
    return this.data.boundaryNotes.filter(n => n.questionId === questionId);
  }

  addBoundaryNote(note: Omit<BoundaryNote, 'id'>): BoundaryNote {
    const newNote: BoundaryNote = { ...note, id: this.generateId() };
    this.data.boundaryNotes.push(newNote);
    this.persist();
    return newNote;
  }

  updateBoundaryNote(id: string, updates: Partial<BoundaryNote>): BoundaryNote | undefined {
    const idx = this.data.boundaryNotes.findIndex(n => n.id === id);
    if (idx === -1) return undefined;
    this.data.boundaryNotes[idx] = { ...this.data.boundaryNotes[idx], ...updates };
    this.persist();
    return this.data.boundaryNotes[idx];
  }

  addBoundaryNotes(notes: Array<Omit<BoundaryNote, 'id'>>): BoundaryNote[] {
    const newNotes = notes.map(n => ({ ...n, id: this.generateId() }));
    this.data.boundaryNotes.push(...newNotes);
    this.persist();
    return newNotes;
  }

  getFilterResults(): FilterResult[] {
    return [...this.data.filterResults];
  }

  getFilterResultById(id: string): FilterResult | undefined {
    return this.data.filterResults.find(r => r.id === id);
  }

  getFilterResultsByQuestion(questionId: string): FilterResult[] {
    return this.data.filterResults.filter(r => r.questionId === questionId);
  }

  getFilterResultsByRespondent(respondentId: string): FilterResult[] {
    return this.data.filterResults.filter(r => r.respondentId === respondentId);
  }

  getFilterResultsByStatus(status: FilterResult['status']): FilterResult[] {
    return this.data.filterResults.filter(r => r.status === status);
  }

  addFilterResult(result: Omit<FilterResult, 'id'>): FilterResult {
    const newResult: FilterResult = { ...result, id: this.generateId() };
    this.data.filterResults.push(newResult);
    this.persist();
    return newResult;
  }

  addFilterResults(results: Array<Omit<FilterResult, 'id'>>): FilterResult[] {
    const newResults = results.map(r => ({ ...r, id: this.generateId() }));
    this.data.filterResults.push(...newResults);
    this.persist();
    return newResults;
  }

  updateFilterResult(id: string, updates: Partial<FilterResult>): FilterResult | undefined {
    const idx = this.data.filterResults.findIndex(r => r.id === id);
    if (idx === -1) return undefined;
    this.data.filterResults[idx] = {
      ...this.data.filterResults[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.persist();
    return this.data.filterResults[idx];
  }

  deleteFilterResultsByRun(runId: string): void {
    this.data.filterResults = this.data.filterResults.filter(r => !r.id.startsWith('run-' + runId));
    this.persist();
  }

  getCounterExamples(): CounterExample[] {
    return [...this.data.counterExamples];
  }

  getCounterExampleById(id: string): CounterExample | undefined {
    return this.data.counterExamples.find(c => c.id === id);
  }

  getCounterExamplesByStatus(status: CounterExample['status']): CounterExample[] {
    return this.data.counterExamples.filter(c => c.status === status);
  }

  getCounterExamplesByHandler(handler: string): CounterExample[] {
    return this.data.counterExamples.filter(c => c.nextHandler === handler);
  }

  addCounterExample(example: Omit<CounterExample, 'id'>): CounterExample {
    const newExample: CounterExample = { ...example, id: this.generateId() };
    this.data.counterExamples.push(newExample);
    this.persist();
    return newExample;
  }

  addCounterExamples(examples: Array<Omit<CounterExample, 'id'>>): CounterExample[] {
    const newExamples = examples.map(e => ({ ...e, id: this.generateId() }));
    this.data.counterExamples.push(...newExamples);
    this.persist();
    return newExamples;
  }

  updateCounterExample(id: string, updates: Partial<CounterExample>): CounterExample | undefined {
    const idx = this.data.counterExamples.findIndex(c => c.id === id);
    if (idx === -1) return undefined;
    this.data.counterExamples[idx] = {
      ...this.data.counterExamples[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.persist();
    return this.data.counterExamples[idx];
  }

  getAuditLogs(): AuditLog[] {
    return [...this.data.auditLogs].sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  getAuditLogsByEntity(entityType: AuditLog['entityType'], entityId: string): AuditLog[] {
    return this.data.auditLogs
      .filter(l => l.entityType === entityType && l.entityId === entityId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  getAuditLogsByActor(actor: string): AuditLog[] {
    return this.data.auditLogs
      .filter(l => l.actor === actor)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  addAuditLog(log: Omit<AuditLog, 'id'>): AuditLog {
    const newLog: AuditLog = { ...log, id: this.generateId() };
    this.data.auditLogs.push(newLog);
    this.persist();
    return newLog;
  }

  getFilterRuns(): FilterRun[] {
    return [...this.data.filterRuns].sort((a, b) =>
      new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
  }

  getFilterRunById(id: string): FilterRun | undefined {
    return this.data.filterRuns.find(r => r.id === id);
  }

  addFilterRun(run: Omit<FilterRun, 'id'>): FilterRun {
    const newRun: FilterRun = { ...run, id: this.generateId() };
    this.data.filterRuns.push(newRun);
    this.persist();
    return newRun;
  }

  updateFilterRun(id: string, updates: Partial<FilterRun>): FilterRun | undefined {
    const idx = this.data.filterRuns.findIndex(r => r.id === id);
    if (idx === -1) return undefined;
    this.data.filterRuns[idx] = { ...this.data.filterRuns[idx], ...updates };
    this.persist();
    return this.data.filterRuns[idx];
  }

  reset(): void {
    this.data = {
      users: [],
      surveyRows: [],
      boundaryNotes: [],
      filterResults: [],
      counterExamples: [],
      auditLogs: [],
      filterRuns: [],
      config: defaultConfig,
    };
    this.persist();
  }

  importData(data: Partial<StoreData>): void {
    if (data.users) this.data.users = [...data.users];
    if (data.surveyRows) this.data.surveyRows = [...data.surveyRows];
    if (data.boundaryNotes) this.data.boundaryNotes = [...data.boundaryNotes];
    if (data.filterResults) this.data.filterResults = [...data.filterResults];
    if (data.counterExamples) this.data.counterExamples = [...data.counterExamples];
    if (data.auditLogs) this.data.auditLogs = [...data.auditLogs];
    if (data.filterRuns) this.data.filterRuns = [...data.filterRuns];
    if (data.config) this.data.config = { ...data.config };
    this.persist();
  }

  exportData(): StoreData {
    return JSON.parse(JSON.stringify(this.data));
  }
}

export const store = new DataStore();
