import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AuditLog, Collision, Material, VersionSnapshot } from '../../shared/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_DIR = path.resolve(__dirname, '..', '..', 'data');
const DB_PATH = path.join(DB_DIR, 'db.json');

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

interface Tables {
  collision: Collision[];
  material: Material[];
  version_snapshot: VersionSnapshot[];
  audit_log: AuditLog[];
}

const emptyTables = (): Tables => ({
  collision: [],
  material: [],
  version_snapshot: [],
  audit_log: [],
});

class InMemoryStore {
  private tables: Tables = emptyTables();
  private ready = false;

  ensureLoaded(): void {
    if (this.ready) return;
    try {
      if (fs.existsSync(DB_PATH)) {
        const raw = fs.readFileSync(DB_PATH, 'utf8');
        const json = JSON.parse(raw);
        this.tables = { ...emptyTables(), ...json };
      }
    } catch (e) {
      console.warn('[DB] 加载持久化文件失败，使用空库：', e);
      this.tables = emptyTables();
    }
    this.ready = true;
  }

  all<K extends keyof Tables>(table: K): Tables[K] {
    this.ensureLoaded();
    return [...this.tables[table]] as any;
  }

  insert<K extends keyof Tables>(table: K, row: any): void {
    this.ensureLoaded();
    (this.tables[table] as any[]).push(row);
    this.persist();
  }

  update<K extends keyof Tables>(
    table: K,
    pk: string,
    id: string,
    patch: Record<string, any>,
  ): void {
    this.ensureLoaded();
    const list = this.tables[table] as any[];
    const idx = list.findIndex((r) => r[pk] === id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...patch };
      this.persist();
    }
  }

  private persist(): void {
    try {
      fs.writeFileSync(DB_PATH, JSON.stringify(this.tables, null, 2), 'utf8');
    } catch (e) {
      console.warn('[DB] 持久化失败：', e);
    }
  }

  reset(): void {
    this.tables = emptyTables();
    try {
      if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
    } catch {}
    this.persist();
  }
}

export const db = new InMemoryStore();
export type { Tables };
