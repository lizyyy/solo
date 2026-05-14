import sqlite3 from 'sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { Plugin, PluginVersion, PermissionDeclaration, SecurityScan, ReviewOpinion, TimelineEvent, PluginVersionStatus, ReviewResult } from './types';

export class Database {
  private db: sqlite3.Database;

  constructor(dbPath: string = './audit_platform.db') {
    this.db = new sqlite3.Database(dbPath);
    this.initializeTables();
  }

  private initializeTables(): void {
    this.db.serialize(() => {
      this.db.run(`
        CREATE TABLE IF NOT EXISTS plugins (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          author TEXT NOT NULL,
          ownerId TEXT NOT NULL,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        )
      `);

      this.db.run(`
        CREATE TABLE IF NOT EXISTS plugin_versions (
          id TEXT PRIMARY KEY,
          pluginId TEXT NOT NULL,
          version TEXT NOT NULL,
          status TEXT NOT NULL,
          packageUrl TEXT NOT NULL,
          packageHash TEXT NOT NULL,
          permissionDeclarations TEXT NOT NULL,
          retryCount INTEGER DEFAULT 0,
          maxRetries INTEGER DEFAULT 3,
          submittedBy TEXT NOT NULL,
          submittedAt TEXT NOT NULL,
          reviewedBy TEXT,
          reviewedAt TEXT,
          publishedBy TEXT,
          publishedAt TEXT,
          unpublishedBy TEXT,
          unpublishedAt TEXT,
          unpublishedReason TEXT,
          FOREIGN KEY (pluginId) REFERENCES plugins(id)
        )
      `);

      this.db.run(`
        CREATE TABLE IF NOT EXISTS security_scans (
          id TEXT PRIMARY KEY,
          versionId TEXT NOT NULL,
          status TEXT NOT NULL,
          findings TEXT NOT NULL,
          startedAt TEXT NOT NULL,
          completedAt TEXT,
          scannerVersion TEXT NOT NULL,
          FOREIGN KEY (versionId) REFERENCES plugin_versions(id)
        )
      `);

      this.db.run(`
        CREATE TABLE IF NOT EXISTS review_opinions (
          id TEXT PRIMARY KEY,
          versionId TEXT NOT NULL,
          reviewerId TEXT NOT NULL,
          reviewerName TEXT NOT NULL,
          result TEXT NOT NULL,
          comment TEXT NOT NULL,
          createdAt TEXT NOT NULL,
          correctionPath TEXT,
          FOREIGN KEY (versionId) REFERENCES plugin_versions(id)
        )
      `);

      this.db.run(`
        CREATE TABLE IF NOT EXISTS timeline_events (
          id TEXT PRIMARY KEY,
          versionId TEXT NOT NULL,
          type TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          actor TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          metadata TEXT,
          FOREIGN KEY (versionId) REFERENCES plugin_versions(id)
        )
      `);

      this.db.run(`
        CREATE TABLE IF NOT EXISTS idempotency_keys (
          key TEXT PRIMARY KEY,
          versionId TEXT NOT NULL,
          createdAt TEXT NOT NULL
        )
      `);
    });
  }

  private runAsync(sql: string, params: any[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private getAsync<T>(sql: string, params: any[] = []): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row as T);
      });
    });
  }

  private allAsync<T>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows as T[]);
      });
    });
  }

  async checkIdempotency(key: string): Promise<string | null> {
    const result = await this.getAsync<{ versionId: string }>(
      'SELECT versionId FROM idempotency_keys WHERE key = ?',
      [key]
    );
    return result?.versionId || null;
  }

  async saveIdempotencyKey(key: string, versionId: string): Promise<void> {
    await this.runAsync(
      'INSERT INTO idempotency_keys (key, versionId, createdAt) VALUES (?, ?, ?)',
      [key, versionId, new Date().toISOString()]
    );
  }

  async createPlugin(plugin: Omit<Plugin, 'id' | 'createdAt' | 'updatedAt'>): Promise<Plugin> {
    const id = uuidv4();
    const now = new Date().toISOString();
    await this.runAsync(
      'INSERT INTO plugins (id, name, description, author, ownerId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, plugin.name, plugin.description, plugin.author, plugin.ownerId, now, now]
    );
    return { ...plugin, id, createdAt: now, updatedAt: now };
  }

  async getPlugin(id: string): Promise<Plugin | undefined> {
    return this.getAsync<Plugin>('SELECT * FROM plugins WHERE id = ?', [id]);
  }

  async getAllPlugins(): Promise<Plugin[]> {
    return this.allAsync<Plugin>('SELECT * FROM plugins ORDER BY createdAt DESC');
  }

  async createVersion(version: Omit<PluginVersion, 'id' | 'retryCount' | 'maxRetries'>): Promise<PluginVersion> {
    const id = uuidv4();
    const versionData: PluginVersion = {
      ...version,
      id,
      retryCount: 0,
      maxRetries: 3
    };
    await this.runAsync(
      `INSERT INTO plugin_versions 
       (id, pluginId, version, status, packageUrl, packageHash, permissionDeclarations, 
        retryCount, maxRetries, submittedBy, submittedAt) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, version.pluginId, version.version, version.status,
        version.packageUrl, version.packageHash,
        JSON.stringify(version.permissionDeclarations),
        0, 3, version.submittedBy, version.submittedAt
      ]
    );
    return versionData;
  }

  async updateVersionStatus(id: string, status: PluginVersionStatus, extra: Partial<PluginVersion> = {}): Promise<void> {
    const updates: string[] = ['status = ?'];
    const params: any[] = [status];
    
    if (extra.reviewedBy) { updates.push('reviewedBy = ?'); params.push(extra.reviewedBy); }
    if (extra.reviewedAt) { updates.push('reviewedAt = ?'); params.push(extra.reviewedAt); }
    if (extra.publishedBy) { updates.push('publishedBy = ?'); params.push(extra.publishedBy); }
    if (extra.publishedAt) { updates.push('publishedAt = ?'); params.push(extra.publishedAt); }
    if (extra.unpublishedBy) { updates.push('unpublishedBy = ?'); params.push(extra.unpublishedBy); }
    if (extra.unpublishedAt) { updates.push('unpublishedAt = ?'); params.push(extra.unpublishedAt); }
    if (extra.unpublishedReason) { updates.push('unpublishedReason = ?'); params.push(extra.unpublishedReason); }
    if (extra.retryCount !== undefined) { updates.push('retryCount = ?'); params.push(extra.retryCount); }
    
    params.push(id);
    await this.runAsync(
      `UPDATE plugin_versions SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
  }

  async getVersion(id: string): Promise<PluginVersion | undefined> {
    const row = await this.getAsync<any>('SELECT * FROM plugin_versions WHERE id = ?', [id]);
    if (row) {
      return {
        ...row,
        permissionDeclarations: JSON.parse(row.permissionDeclarations)
      };
    }
    return undefined;
  }

  async getVersionsByPlugin(pluginId: string): Promise<PluginVersion[]> {
    const rows = await this.allAsync<any>('SELECT * FROM plugin_versions WHERE pluginId = ? ORDER BY submittedAt DESC', [pluginId]);
    return rows.map(row => ({
      ...row,
      permissionDeclarations: JSON.parse(row.permissionDeclarations)
    }));
  }

  async getAllVersions(): Promise<PluginVersion[]> {
    const rows = await this.allAsync<any>('SELECT * FROM plugin_versions ORDER BY submittedAt DESC');
    return rows.map(row => ({
      ...row,
      permissionDeclarations: JSON.parse(row.permissionDeclarations)
    }));
  }

  async createSecurityScan(scan: Omit<SecurityScan, 'id'>): Promise<SecurityScan> {
    const id = uuidv4();
    await this.runAsync(
      'INSERT INTO security_scans (id, versionId, status, findings, startedAt, scannerVersion) VALUES (?, ?, ?, ?, ?, ?)',
      [id, scan.versionId, scan.status, JSON.stringify(scan.findings), scan.startedAt, scan.scannerVersion]
    );
    return { ...scan, id };
  }

  async updateSecurityScan(id: string, status: string, findings: any[], completedAt: string): Promise<void> {
    await this.runAsync(
      'UPDATE security_scans SET status = ?, findings = ?, completedAt = ? WHERE id = ?',
      [status, JSON.stringify(findings), completedAt, id]
    );
  }

  async getSecurityScansByVersion(versionId: string): Promise<SecurityScan[]> {
    const rows = await this.allAsync<any>('SELECT * FROM security_scans WHERE versionId = ? ORDER BY startedAt DESC', [versionId]);
    return rows.map(row => ({
      ...row,
      findings: JSON.parse(row.findings)
    }));
  }

  async createReviewOpinion(opinion: Omit<ReviewOpinion, 'id'>): Promise<ReviewOpinion> {
    const id = uuidv4();
    await this.runAsync(
      'INSERT INTO review_opinions (id, versionId, reviewerId, reviewerName, result, comment, createdAt, correctionPath) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, opinion.versionId, opinion.reviewerId, opinion.reviewerName, opinion.result, opinion.comment, opinion.createdAt, opinion.correctionPath ? JSON.stringify(opinion.correctionPath) : null]
    );
    return { ...opinion, id };
  }

  async updateReviewOpinionCorrection(opinionId: string, correctionPath: any): Promise<void> {
    await this.runAsync(
      'UPDATE review_opinions SET correctionPath = ? WHERE id = ?',
      [JSON.stringify(correctionPath), opinionId]
    );
  }

  async getReviewOpinionsByVersion(versionId: string): Promise<ReviewOpinion[]> {
    const rows = await this.allAsync<any>('SELECT * FROM review_opinions WHERE versionId = ? ORDER BY createdAt DESC', [versionId]);
    return rows.map(row => ({
      ...row,
      correctionPath: row.correctionPath ? JSON.parse(row.correctionPath) : undefined
    }));
  }

  async createTimelineEvent(event: Omit<TimelineEvent, 'id'>): Promise<TimelineEvent> {
    const id = uuidv4();
    await this.runAsync(
      'INSERT INTO timeline_events (id, versionId, type, title, description, actor, timestamp, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, event.versionId, event.type, event.title, event.description, event.actor, event.timestamp, event.metadata ? JSON.stringify(event.metadata) : null]
    );
    return { ...event, id };
  }

  async getTimelineByVersion(versionId: string): Promise<TimelineEvent[]> {
    const rows = await this.allAsync<any>('SELECT * FROM timeline_events WHERE versionId = ? ORDER BY timestamp DESC', [versionId]);
    return rows.map(row => ({
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    }));
  }

  async runAsync(sql: string, params: any[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, (err: any) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async getStatistics(): Promise<any> {
    const allVersions = await this.getAllVersions();
    const totalVersions = allVersions.length;
    const pendingReview = allVersions.filter(v => v.status === PluginVersionStatus.PENDING_REVIEW).length;
    const approved = allVersions.filter(v => v.status === PluginVersionStatus.REVIEW_APPROVED || v.status === PluginVersionStatus.PUBLISHED).length;
    const rejected = allVersions.filter(v => v.status === PluginVersionStatus.REVIEW_REJECTED).length;
    const published = allVersions.filter(v => v.status === PluginVersionStatus.PUBLISHED).length;
    const unpublished = allVersions.filter(v => v.status === PluginVersionStatus.UNPUBLISHED).length;

    let securityPassed = 0;
    let securityTotal = 0;
    let totalReviewTime = 0;
    let reviewedCount = 0;

    for (const version of allVersions) {
      const scans = await this.getSecurityScansByVersion(version.id);
      if (scans.length > 0) {
        securityTotal++;
        if (scans.some(s => s.status === 'passed')) {
          securityPassed++;
        }
      }
      if (version.reviewedAt && version.submittedAt) {
        totalReviewTime += new Date(version.reviewedAt).getTime() - new Date(version.submittedAt).getTime();
        reviewedCount++;
      }
    }

    return {
      totalVersions,
      pendingReview,
      approved,
      rejected,
      published,
      unpublished,
      securityPassRate: securityTotal > 0 ? Math.round((securityPassed / securityTotal) * 100) : 0,
      avgReviewTimeHours: reviewedCount > 0 ? Math.round((totalReviewTime / reviewedCount) / (1000 * 60 * 60)) : 0
    };
  }

  close(): void {
    this.db.close();
  }
}

export const db = new Database();
