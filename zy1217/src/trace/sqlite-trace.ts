import * as fs from 'fs';
import * as path from 'path';
import initSqlJs, { Database } from 'sql.js';
import { AnalysisResult, Issue, Suggestion } from '../types';

export interface AnalysisSession {
  id: string;
  timestamp: number;
  canDeploy: boolean;
  blockerCount: number;
  warningCount: number;
  infoCount: number;
  traceCount: number;
  batchCount: number;
  tableCount: number;
  configHash?: string;
}

export interface IssueRecord {
  id: string;
  sessionId: string;
  category: string;
  severity: string;
  title: string;
  description: string;
  affectedObjects: string;
  evidence: string;
}

export interface SuggestionRecord {
  id: string;
  sessionId: string;
  title: string;
  description: string;
  priority: string;
  implementation: string;
}

export class SQLiteTrace {
  private db: Database | null = null;
  private dbPath: string;
  private sessionId: string;

  constructor(dbPath: string, sessionId?: string) {
    this.dbPath = dbPath;
    this.sessionId = sessionId || this.generateSessionId();
  }

  async initialize(): Promise<void> {
    const SQL = await initSqlJs();
    
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(this.dbPath)) {
      const buffer = fs.readFileSync(this.dbPath);
      this.db = new SQL.Database(buffer);
    } else {
      this.db = new SQL.Database();
    }

    this.createTables();
  }

  private createTables(): void {
    if (!this.db) throw new Error('Database not initialized');

    this.db.run(`
      CREATE TABLE IF NOT EXISTS analysis_sessions (
        id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        can_deploy INTEGER NOT NULL,
        blocker_count INTEGER NOT NULL,
        warning_count INTEGER NOT NULL,
        info_count INTEGER NOT NULL,
        trace_count INTEGER NOT NULL,
        batch_count INTEGER NOT NULL,
        table_count INTEGER NOT NULL,
        config_hash TEXT
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS issues (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        category TEXT NOT NULL,
        severity TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        affected_objects TEXT NOT NULL,
        evidence TEXT,
        FOREIGN KEY (session_id) REFERENCES analysis_sessions(id)
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS suggestions (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        priority TEXT NOT NULL,
        implementation TEXT,
        FOREIGN KEY (session_id) REFERENCES analysis_sessions(id)
      )
    `);

    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_issues_session ON issues(session_id)
    `);

    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_issues_severity ON issues(severity)
    `);

    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_suggestions_session ON suggestions(session_id)
    `);

    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_sessions_timestamp ON analysis_sessions(timestamp)
    `);
  }

  async saveAnalysisResult(result: AnalysisResult, configHash?: string): Promise<string> {
    if (!this.db) throw new Error('Database not initialized');

    const session: AnalysisSession = {
      id: this.sessionId,
      timestamp: Date.now(),
      canDeploy: result.summary.canDeploy,
      blockerCount: result.summary.blockerCount,
      warningCount: result.summary.warningCount,
      infoCount: result.summary.infoCount,
      traceCount: result.rawData.traceCount,
      batchCount: result.rawData.batchCount,
      tableCount: result.rawData.tableCount,
      configHash
    };

    this.saveSession(session);

    for (const issue of result.issues) {
      this.saveIssue(issue);
    }

    for (const suggestion of result.suggestions) {
      this.saveSuggestion(suggestion);
    }

    this.commit();

    return this.sessionId;
  }

  private saveSession(session: AnalysisSession): void {
    if (!this.db) throw new Error('Database not initialized');

    this.db.run(
      `INSERT INTO analysis_sessions 
       (id, timestamp, can_deploy, blocker_count, warning_count, info_count, 
        trace_count, batch_count, table_count, config_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        session.id,
        session.timestamp,
        session.canDeploy ? 1 : 0,
        session.blockerCount,
        session.warningCount,
        session.infoCount,
        session.traceCount,
        session.batchCount,
        session.tableCount,
        session.configHash || null
      ]
    );
  }

  private saveIssue(issue: Issue): void {
    if (!this.db) throw new Error('Database not initialized');

    this.db.run(
      `INSERT INTO issues 
       (id, session_id, category, severity, title, description, affected_objects, evidence)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        issue.id,
        this.sessionId,
        issue.category,
        issue.severity,
        issue.title,
        issue.description,
        JSON.stringify(issue.affectedObjects),
        issue.evidence
      ]
    );
  }

  private saveSuggestion(suggestion: Suggestion): void {
    if (!this.db) throw new Error('Database not initialized');

    this.db.run(
      `INSERT INTO suggestions 
       (id, session_id, title, description, priority, implementation)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        suggestion.id,
        this.sessionId,
        suggestion.title,
        suggestion.description,
        suggestion.priority,
        suggestion.implementation
      ]
    );
  }

  async getSession(sessionId: string): Promise<AnalysisSession | null> {
    if (!this.db) throw new Error('Database not initialized');

    const result = this.db.exec(
      'SELECT * FROM analysis_sessions WHERE id = ?',
      [sessionId]
    );

    if (result.length === 0 || result[0].values.length === 0) {
      return null;
    }

    const row = result[0].values[0];
    return {
      id: row[0] as string,
      timestamp: row[1] as number,
      canDeploy: (row[2] as number) === 1,
      blockerCount: row[3] as number,
      warningCount: row[4] as number,
      infoCount: row[5] as number,
      traceCount: row[6] as number,
      batchCount: row[7] as number,
      tableCount: row[8] as number,
      configHash: row[9] as string | undefined
    };
  }

  async getIssues(sessionId?: string): Promise<IssueRecord[]> {
    if (!this.db) throw new Error('Database not initialized');

    let query = 'SELECT * FROM issues';
    let params: any[] = [];

    if (sessionId) {
      query += ' WHERE session_id = ?';
      params = [sessionId];
    }

    query += ' ORDER BY severity DESC';

    const result = this.db.exec(query, params);

    if (result.length === 0) {
      return [];
    }

    return result[0].values.map(row => ({
      id: row[0] as string,
      sessionId: row[1] as string,
      category: row[2] as string,
      severity: row[3] as string,
      title: row[4] as string,
      description: row[5] as string,
      affectedObjects: row[6] as string,
      evidence: row[7] as string
    }));
  }

  async getRecentSessions(limit: number = 10): Promise<AnalysisSession[]> {
    if (!this.db) throw new Error('Database not initialized');

    const result = this.db.exec(
      'SELECT * FROM analysis_sessions ORDER BY timestamp DESC LIMIT ?',
      [limit]
    );

    if (result.length === 0) {
      return [];
    }

    return result[0].values.map(row => ({
      id: row[0] as string,
      timestamp: row[1] as number,
      canDeploy: (row[2] as number) === 1,
      blockerCount: row[3] as number,
      warningCount: row[4] as number,
      infoCount: row[5] as number,
      traceCount: row[6] as number,
      batchCount: row[7] as number,
      tableCount: row[8] as number,
      configHash: row[9] as string | undefined
    }));
  }

  private commit(): void {
    if (!this.db) throw new Error('Database not initialized');

    const data = this.db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(this.dbPath, buffer);
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  private generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `ses_${timestamp}_${random}`;
  }

  getSessionId(): string {
    return this.sessionId;
  }
}
