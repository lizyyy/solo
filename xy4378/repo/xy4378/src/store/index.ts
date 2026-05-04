import * as path from 'path';
import Database from 'better-sqlite3';
import { Issue, IssueStatus, ScanResult, IssueType, Severity } from '../types';

interface DbIssue {
  id: string;
  type: string;
  severity: string;
  key: string | null;
  message: string;
  locale: string | null;
  source_file: string | null;
  line: number | null;
  column: number | null;
  context: string | null;
  placeholder_info: string | null;
  plural_info: string | null;
  status: string;
  false_positive: number;
  notes: string;
  fix_suggestion: string;
  created_at: number;
  updated_at: number;
  scan_id: string | null;
}

interface DbScan {
  id: string;
  timestamp: number;
  locales: string;
  total_keys: number;
  source_files: string;
  locale_files: string;
  project_path: string;
}

export class DataStore {
  private db: Database.Database;

  constructor(dbPath: string = path.join(process.cwd(), '.i18n-checker.db')) {
    this.db = new Database(dbPath);
    this.initializeTables();
  }

  private initializeTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS scans (
        id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        locales TEXT NOT NULL,
        total_keys INTEGER NOT NULL,
        source_files TEXT NOT NULL,
        locale_files TEXT NOT NULL,
        project_path TEXT NOT NULL
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS issues (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        severity TEXT NOT NULL,
        key TEXT,
        message TEXT NOT NULL,
        locale TEXT,
        source_file TEXT,
        line INTEGER,
        column INTEGER,
        context TEXT,
        placeholder_info TEXT,
        plural_info TEXT,
        status TEXT NOT NULL DEFAULT 'open',
        false_positive INTEGER NOT NULL DEFAULT 0,
        notes TEXT NOT NULL DEFAULT '',
        fix_suggestion TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        scan_id TEXT,
        FOREIGN KEY (scan_id) REFERENCES scans(id)
      )
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status)
    `);
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_issues_type ON issues(type)
    `);
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_issues_scan_id ON issues(scan_id)
    `);
  }

  saveScanResult(scanResult: ScanResult, projectPath: string): string {
    const scanId = `scan-${Date.now()}`;
    
    const insertScan = this.db.prepare(`
      INSERT INTO scans (id, timestamp, locales, total_keys, source_files, locale_files, project_path)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    insertScan.run(
      scanId,
      scanResult.timestamp,
      JSON.stringify(scanResult.locales),
      scanResult.totalKeys,
      JSON.stringify(scanResult.sourceFiles),
      JSON.stringify(scanResult.localeFiles),
      projectPath
    );

    const insertIssue = this.db.prepare(`
      INSERT INTO issues (
        id, type, severity, key, message, locale, source_file, line, column,
        context, placeholder_info, plural_info, status, false_positive,
        notes, fix_suggestion, created_at, updated_at, scan_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = this.db.transaction((issues: Issue[]) => {
      for (const issue of issues) {
        insertIssue.run(
          issue.id,
          issue.type,
          issue.severity,
          issue.key || null,
          issue.message,
          issue.locale || null,
          issue.sourceFile || null,
          issue.line || null,
          issue.column || null,
          issue.context || null,
          issue.placeholderInfo ? JSON.stringify(issue.placeholderInfo) : null,
          issue.pluralInfo ? JSON.stringify(issue.pluralInfo) : null,
          issue.status,
          issue.falsePositive ? 1 : 0,
          issue.notes,
          issue.fixSuggestion,
          issue.createdAt,
          issue.updatedAt,
          scanId
        );
      }
    });

    transaction(scanResult.issues);

    return scanId;
  }

  getIssues(filters?: {
    status?: IssueStatus[];
    type?: IssueType[];
    severity?: Severity[];
    falsePositive?: boolean;
    scanId?: string;
  }): Issue[] {
    let query = 'SELECT * FROM issues WHERE 1=1';
    const params: (string | number | null)[] = [];

    if (filters?.status && filters.status.length > 0) {
      query += ` AND status IN (${filters.status.map(() => '?').join(',')})`;
      params.push(...filters.status);
    }

    if (filters?.type && filters.type.length > 0) {
      query += ` AND type IN (${filters.type.map(() => '?').join(',')})`;
      params.push(...filters.type);
    }

    if (filters?.severity && filters.severity.length > 0) {
      query += ` AND severity IN (${filters.severity.map(() => '?').join(',')})`;
      params.push(...filters.severity);
    }

    if (filters?.falsePositive !== undefined) {
      query += ' AND false_positive = ?';
      params.push(filters.falsePositive ? 1 : 0);
    }

    if (filters?.scanId) {
      query += ' AND scan_id = ?';
      params.push(filters.scanId);
    }

    query += ' ORDER BY created_at DESC';

    const rows = this.db.prepare(query).all(...params) as DbIssue[];
    return rows.map(row => this.mapDbIssueToIssue(row));
  }

  getIssueById(id: string): Issue | null {
    const row = this.db.prepare('SELECT * FROM issues WHERE id = ?').get(id) as DbIssue | undefined;
    return row ? this.mapDbIssueToIssue(row) : null;
  }

  updateIssue(id: string, updates: {
    status?: IssueStatus;
    falsePositive?: boolean;
    notes?: string;
    fixSuggestion?: string;
  }): boolean {
    const fields: string[] = [];
    const values: (string | number)[] = [];

    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }

    if (updates.falsePositive !== undefined) {
      fields.push('false_positive = ?');
      values.push(updates.falsePositive ? 1 : 0);
    }

    if (updates.notes !== undefined) {
      fields.push('notes = ?');
      values.push(updates.notes);
    }

    if (updates.fixSuggestion !== undefined) {
      fields.push('fix_suggestion = ?');
      values.push(updates.fixSuggestion);
    }

    if (fields.length === 0) {
      return false;
    }

    fields.push('updated_at = ?');
    values.push(Date.now());

    const query = `UPDATE issues SET ${fields.join(', ')} WHERE id = ?`;
    values.push(id);

    const result = this.db.prepare(query).run(...values);
    return result.changes > 0;
  }

  getLatestScan(): DbScan | null {
    const row = this.db.prepare('SELECT * FROM scans ORDER BY timestamp DESC LIMIT 1').get() as DbScan | undefined;
    return row || null;
  }

  getScanById(id: string): DbScan | null {
    const row = this.db.prepare('SELECT * FROM scans WHERE id = ?').get(id) as DbScan | undefined;
    return row || null;
  }

  getAllScans(): DbScan[] {
    return this.db.prepare('SELECT * FROM scans ORDER BY timestamp DESC').all() as DbScan[];
  }

  deleteScan(scanId: string): boolean {
    this.db.prepare('DELETE FROM issues WHERE scan_id = ?').run(scanId);
    const result = this.db.prepare('DELETE FROM scans WHERE id = ?').run(scanId);
    return result.changes > 0;
  }

  getStatistics(scanId?: string): {
    total: number;
    bySeverity: Record<Severity, number>;
    byType: Record<IssueType, number>;
    byStatus: Record<IssueStatus, number>;
    falsePositives: number;
  } {
    let query = 'SELECT * FROM issues WHERE 1=1';
    const params: string[] = [];

    if (scanId) {
      query += ' AND scan_id = ?';
      params.push(scanId);
    }

    const issues = this.db.prepare(query).all(...params) as DbIssue[];

    const stats = {
      total: issues.length,
      bySeverity: { critical: 0, high: 0, medium: 0, low: 0 } as Record<Severity, number>,
      byType: {} as Record<IssueType, number>,
      byStatus: { open: 0, acknowledged: 0, resolved: 0, ignored: 0 } as Record<IssueStatus, number>,
      falsePositives: 0,
    };

    for (const issue of issues) {
      const severity = issue.severity as Severity;
      if (stats.bySeverity[severity] !== undefined) {
        stats.bySeverity[severity]++;
      }

      const type = issue.type as IssueType;
      stats.byType[type] = (stats.byType[type] || 0) + 1;

      const status = issue.status as IssueStatus;
      if (stats.byStatus[status] !== undefined) {
        stats.byStatus[status]++;
      }

      if (issue.false_positive) {
        stats.falsePositives++;
      }
    }

    return stats;
  }

  close(): void {
    this.db.close();
  }

  private mapDbIssueToIssue(row: DbIssue): Issue {
    return {
      id: row.id,
      type: row.type as IssueType,
      severity: row.severity as Severity,
      key: row.key || undefined,
      message: row.message,
      locale: row.locale as 'zh' | 'en' | 'ja' | undefined,
      sourceFile: row.source_file || undefined,
      line: row.line || undefined,
      column: row.column || undefined,
      context: row.context || undefined,
      placeholderInfo: row.placeholder_info ? JSON.parse(row.placeholder_info) : undefined,
      pluralInfo: row.plural_info ? JSON.parse(row.plural_info) : undefined,
      status: row.status as IssueStatus,
      falsePositive: row.false_positive === 1,
      notes: row.notes,
      fixSuggestion: row.fix_suggestion,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
