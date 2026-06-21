import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SchemeComparisonRecord } from '../shared/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '..', '.data');
const DATA_FILE = path.join(DATA_DIR, 'records.json');

export class RecordRepository {
  private store: Map<string, SchemeComparisonRecord>;
  private dataFile: string;
  private _initialized: boolean;

  constructor(dataFile?: string) {
    this.store = new Map();
    this.dataFile = dataFile ?? DATA_FILE;
    this._initialized = false;
  }

  get initialized(): boolean {
    return this._initialized;
  }

  private ensureDir(): void {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  load(): void {
    this.ensureDir();
    if (fs.existsSync(this.dataFile)) {
      try {
        const raw = fs.readFileSync(this.dataFile, 'utf-8');
        const arr: SchemeComparisonRecord[] = JSON.parse(raw);
        this.store.clear();
        for (const rec of arr) {
          this.store.set(rec.record_id, rec);
        }
      } catch (err) {
        console.error('[RecordRepository] 加载数据失败，使用空仓储:', err);
        this.store.clear();
      }
    } else {
      this.store.clear();
    }
    this._initialized = true;
  }

  flush(): void {
    this.ensureDir();
    const arr: SchemeComparisonRecord[] = Array.from(this.store.values());
    fs.writeFileSync(this.dataFile, JSON.stringify(arr, null, 2), 'utf-8');
  }

  isEmpty(): boolean {
    return this.store.size === 0;
  }

  count(): number {
    return this.store.size;
  }

  renameId(oldId: string, newId: string): boolean {
    if (!this.store.has(oldId) || this.store.has(newId)) return false;
    const rec = this.store.get(oldId)!;
    this.store.delete(oldId);
    this.store.set(newId, rec);
    return true;
  }

  list(): SchemeComparisonRecord[] {
    return Array.from(this.store.values());
  }

  listSummary(): Array<{
    record_id: string;
    project_name: string;
    project_code: string;
    structural_element: string;
    status: SchemeComparisonRecord['status'];
    conclusion?: SchemeComparisonRecord['conclusion'];
    confidence: number;
    materials_count: number;
    pending_count: number;
    version: number;
    created_at: string;
    updated_at: string;
  }> {
    return Array.from(this.store.values()).map((r) => ({
      record_id: r.record_id,
      project_name: r.project_name,
      project_code: r.project_code,
      structural_element: r.structural_element,
      status: r.status,
      conclusion: r.conclusion,
      confidence: r.confidence,
      materials_count: r.materials.length,
      pending_count: r.pending_queue.filter((p) => !p.resolved_at).length,
      version: r.current_version,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));
  }

  get(id: string): SchemeComparisonRecord | undefined {
    return this.store.get(id);
  }

  has(id: string): boolean {
    return this.store.has(id);
  }

  save(record: SchemeComparisonRecord): SchemeComparisonRecord {
    this.store.set(record.record_id, record);
    this.flush();
    return record;
  }

  delete(id: string): boolean {
    const existed = this.store.delete(id);
    if (existed) this.flush();
    return existed;
  }

  clearAll(): void {
    this.store.clear();
    this.flush();
  }
}

export const recordRepository = new RecordRepository();

export function initRepository(): RecordRepository {
  recordRepository.load();
  return recordRepository;
}
