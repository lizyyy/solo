import * as fs from 'fs/promises';
import * as path from 'path';
import { Session, AnomalyType } from '../types';
import { getNowTimestamp, ensureDirectoryExists } from '../utils';

export interface StorageOptions {
  dataDir?: string;
  maxSessions?: number;
}

export interface SessionSummary {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  totalDuration: number;
  stutterPercentage: number;
  callQualityScore: number;
  anomalyCount: Partial<Record<AnomalyType, number>>;
  sourceCount: number;
}

interface DatabaseData {
  version: string;
  sessions: Session[];
  updatedAt: number;
}

const DEFAULT_DATA_DIR = '.webrtc-diagnostic';
const DEFAULT_MAX_SESSIONS = 100;
const DB_VERSION = '1.0.0';

export class SessionStorage {
  private dataDir: string;
  private dbPath: string;
  private maxSessions: number;
  private db: DatabaseData | null = null;

  constructor(options: StorageOptions = {}) {
    this.dataDir = options.dataDir || this.getDefaultDataDir();
    this.maxSessions = options.maxSessions || DEFAULT_MAX_SESSIONS;
    this.dbPath = path.join(this.dataDir, 'sessions.json');
  }

  private getDefaultDataDir(): string {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '.';
    return path.join(homeDir, DEFAULT_DATA_DIR);
  }

  async initialize(): Promise<void> {
    ensureDirectoryExists(this.dataDir);
    
    try {
      const data = await fs.readFile(this.dbPath, 'utf-8');
      this.db = JSON.parse(data);
      
      if (!this.db || !this.db.version || !this.db.sessions) {
        this.db = this.createEmptyDatabase();
      }
    } catch {
      this.db = this.createEmptyDatabase();
    }
  }

  private createEmptyDatabase(): DatabaseData {
    return {
      version: DB_VERSION,
      sessions: [],
      updatedAt: getNowTimestamp()
    };
  }

  private async saveDb(): Promise<void> {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }
    
    this.db.updatedAt = getNowTimestamp();
    await fs.writeFile(this.dbPath, JSON.stringify(this.db, null, 2), 'utf-8');
  }

  async saveSession(session: Session): Promise<Session> {
    if (!this.db) {
      await this.initialize();
    }

    const existingIndex = this.db!.sessions.findIndex(s => s.id === session.id);
    
    if (existingIndex >= 0) {
      this.db!.sessions[existingIndex] = {
        ...session,
        updatedAt: getNowTimestamp()
      };
    } else {
      this.db!.sessions.push({
        ...session,
        createdAt: getNowTimestamp(),
        updatedAt: getNowTimestamp()
      });
      
      if (this.db!.sessions.length > this.maxSessions) {
        this.db!.sessions.sort((a, b) => b.updatedAt - a.updatedAt);
        this.db!.sessions = this.db!.sessions.slice(0, this.maxSessions);
      }
    }

    await this.saveDb();
    return this.db!.sessions.find(s => s.id === session.id)!;
  }

  async getSession(id: string): Promise<Session | null> {
    if (!this.db) {
      await this.initialize();
    }

    const session = this.db!.sessions.find(s => s.id === id);
    return session || null;
  }

  async deleteSession(id: string): Promise<boolean> {
    if (!this.db) {
      await this.initialize();
    }

    const index = this.db!.sessions.findIndex(s => s.id === id);
    if (index >= 0) {
      this.db!.sessions.splice(index, 1);
      await this.saveDb();
      return true;
    }
    return false;
  }

  async listSessions(): Promise<SessionSummary[]> {
    if (!this.db) {
      await this.initialize();
    }

    return this.db!.sessions
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map(session => this.toSessionSummary(session));
  }

  private toSessionSummary(session: Session): SessionSummary {
    return {
      id: session.id,
      name: session.name,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      totalDuration: session.metadata.totalDuration,
      stutterPercentage: session.metadata.stutterPercentage,
      callQualityScore: session.metadata.callQualityScore,
      anomalyCount: session.metadata.anomalyCount,
      sourceCount: session.sources.length
    };
  }

  async searchSessions(
    query: string,
    options: {
      startDate?: number;
      endDate?: number;
      minQualityScore?: number;
      maxStutterPercentage?: number;
    } = {}
  ): Promise<SessionSummary[]> {
    if (!this.db) {
      await this.initialize();
    }

    let results = this.db!.sessions;

    if (query) {
      const lowerQuery = query.toLowerCase();
      results = results.filter(s => 
        s.name.toLowerCase().includes(lowerQuery) ||
        s.id.toLowerCase().includes(lowerQuery)
      );
    }

    if (options.startDate !== undefined) {
      results = results.filter(s => s.createdAt >= options.startDate!);
    }

    if (options.endDate !== undefined) {
      results = results.filter(s => s.createdAt <= options.endDate!);
    }

    if (options.minQualityScore !== undefined) {
      results = results.filter(s => s.metadata.callQualityScore >= options.minQualityScore!);
    }

    if (options.maxStutterPercentage !== undefined) {
      results = results.filter(s => s.metadata.stutterPercentage <= options.maxStutterPercentage!);
    }

    return results
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map(s => this.toSessionSummary(s));
  }

  async clearAllSessions(): Promise<number> {
    if (!this.db) {
      await this.initialize();
    }

    const count = this.db!.sessions.length;
    this.db!.sessions = [];
    await this.saveDb();
    return count;
  }

  async getStatistics(): Promise<{
    totalSessions: number;
    totalDuration: number;
    avgQualityScore: number;
    avgStutterPercentage: number;
    oldestSessionDate: number | null;
    newestSessionDate: number | null;
  }> {
    if (!this.db) {
      await this.initialize();
    }

    const sessions = this.db!.sessions;
    
    if (sessions.length === 0) {
      return {
        totalSessions: 0,
        totalDuration: 0,
        avgQualityScore: 0,
        avgStutterPercentage: 0,
        oldestSessionDate: null,
        newestSessionDate: null
      };
    }

    const totalDuration = sessions.reduce((sum, s) => sum + s.metadata.totalDuration, 0);
    const avgQualityScore = sessions.reduce((sum, s) => sum + s.metadata.callQualityScore, 0) / sessions.length;
    const avgStutterPercentage = sessions.reduce((sum, s) => sum + s.metadata.stutterPercentage, 0) / sessions.length;
    
    const sortedByDate = [...sessions].sort((a, b) => a.createdAt - b.createdAt);

    return {
      totalSessions: sessions.length,
      totalDuration,
      avgQualityScore,
      avgStutterPercentage,
      oldestSessionDate: sortedByDate[0]?.createdAt || null,
      newestSessionDate: sortedByDate[sortedByDate.length - 1]?.createdAt || null
    };
  }

  async exportSession(sessionId: string, outputPath: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`会话不存在: ${sessionId}`);
    }

    const outputDir = path.dirname(outputPath);
    ensureDirectoryExists(outputDir);
    
    await fs.writeFile(outputPath, JSON.stringify(session, null, 2), 'utf-8');
  }

  async importSession(inputPath: string): Promise<Session> {
    const content = await fs.readFile(inputPath, 'utf-8');
    const session = JSON.parse(content) as Session;

    if (!session.id || !session.name) {
      throw new Error('无效的会话数据格式');
    }

    return this.saveSession(session);
  }

  getDataDir(): string {
    return this.dataDir;
  }

  getDbPath(): string {
    return this.dbPath;
  }
}

export { SessionStorage as default };
