import * as fs from 'fs-extra';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { format, parseISO } from 'date-fns';
import { ReviewSession, SourceFileInfo, SessionData, SessionAnalysis } from '../types';

const SESSIONS_DIR = '.vaccine-review-sessions';
const SESSION_EXT = '.session.json';

export interface SessionInfo {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  recordCount: number;
  anomalyCount: number;
  riskFragmentCount: number;
}

export interface ISessionStorage {
  save(session: ReviewSession): Promise<string>;
  load(id: string): Promise<ReviewSession | null>;
  delete(id: string): Promise<boolean>;
  list(): Promise<SessionInfo[]>;
  exists(id: string): Promise<boolean>;
}

export class SessionStorage implements ISessionStorage {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || path.join(process.cwd(), SESSIONS_DIR);
    this.ensureDir();
  }

  private ensureDir(): void {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  private getSessionPath(id: string): string {
    return path.join(this.baseDir, `${id}${SESSION_EXT}`);
  }

  private serializeDate(obj: unknown): unknown {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (obj instanceof Date) {
      return {
        __type: 'Date',
        value: obj.toISOString(),
      };
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.serializeDate(item));
    }

    if (typeof obj === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.serializeDate(value);
      }
      return result;
    }

    return obj;
  }

  private deserializeDate(obj: unknown): unknown {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.deserializeDate(item));
    }

    if (typeof obj === 'object') {
      const objRecord = obj as Record<string, unknown>;
      
      if (objRecord.__type === 'Date' && typeof objRecord.value === 'string') {
        return parseISO(objRecord.value);
      }

      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(objRecord)) {
        result[key] = this.deserializeDate(value);
      }
      return result;
    }

    return obj;
  }

  async save(session: ReviewSession): Promise<string> {
    session.updatedAt = new Date();
    
    if (!session.id) {
      session.id = uuidv4();
    }

    const serialized = this.serializeDate(session);
    const content = JSON.stringify(serialized, null, 2);
    
    const filePath = this.getSessionPath(session.id);
    await fs.writeFile(filePath, content, 'utf-8');

    return session.id;
  }

  async load(id: string): Promise<ReviewSession | null> {
    const filePath = this.getSessionPath(id);
    
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const content = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    
    return this.deserializeDate(parsed) as ReviewSession;
  }

  async delete(id: string): Promise<boolean> {
    const filePath = this.getSessionPath(id);
    
    if (!fs.existsSync(filePath)) {
      return false;
    }

    await fs.remove(filePath);
    return true;
  }

  async list(): Promise<SessionInfo[]> {
    if (!fs.existsSync(this.baseDir)) {
      return [];
    }

    const files = await fs.readdir(this.baseDir);
    const sessionFiles = files.filter(f => f.endsWith(SESSION_EXT));

    const sessions: SessionInfo[] = [];

    for (const file of sessionFiles) {
      const id = file.replace(SESSION_EXT, '');
      const session = await this.load(id);
      
      if (session) {
        sessions.push({
          id: session.id,
          name: session.name,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          recordCount: session.analysis.summary.totalRecords,
          anomalyCount: session.analysis.summary.totalAnomalies,
          riskFragmentCount: session.analysis.summary.totalRiskFragments,
        });
      }
    }

    return sessions.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async exists(id: string): Promise<boolean> {
    const filePath = this.getSessionPath(id);
    return fs.existsSync(filePath);
  }

  getBaseDir(): string {
    return this.baseDir;
  }
}

export function createSession(
  name: string,
  sourceFiles: SourceFileInfo[],
  data: SessionData,
  analysis: SessionAnalysis
): ReviewSession {
  const now = new Date();
  
  return {
    id: uuidv4(),
    name,
    createdAt: now,
    updatedAt: now,
    sourceFiles,
    data,
    analysis,
    annotations: [],
    settings: {
      temperatureRules: [],
      reportTemplate: 'default',
      alertThresholds: {
        overTempThreshold: 8,
        underTempThreshold: 2,
        missingDataMinutes: 30,
        rapidChangeThreshold: 2,
        doorOpenMinutes: 5,
      },
    },
  };
}
