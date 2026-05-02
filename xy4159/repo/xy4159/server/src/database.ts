import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs';

export class ReviewDatabase {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const dataDir = dbPath 
      ? path.dirname(dbPath) 
      : path.join(process.cwd(), 'data');
    
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const actualPath = dbPath || path.join(dataDir, 'reviews.db');
    this.db = new Database(actualPath);
    this.initTables();
  }

  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS pull_requests (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        source_branch TEXT,
        target_branch TEXT,
        author TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS review_cards (
        id TEXT PRIMARY KEY,
        pr_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        severity TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (pr_id) REFERENCES pull_requests(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS code_locations (
        id TEXT PRIMARY KEY,
        card_id TEXT NOT NULL,
        file_path TEXT NOT NULL,
        start_line INTEGER NOT NULL,
        end_line INTEGER NOT NULL,
        start_column INTEGER,
        end_column INTEGER,
        line_content TEXT,
        context_before TEXT,
        context_after TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (card_id) REFERENCES review_cards(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS attachments (
        id TEXT PRIMARY KEY,
        card_id TEXT NOT NULL,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        data TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (card_id) REFERENCES review_cards(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS review_records (
        id TEXT PRIMARY KEY,
        card_id TEXT NOT NULL,
        reviewer TEXT NOT NULL,
        action TEXT NOT NULL,
        comment TEXT,
        old_status TEXT,
        new_status TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (card_id) REFERENCES review_cards(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_cards_pr ON review_cards(pr_id);
      CREATE INDEX IF NOT EXISTS idx_cards_status ON review_cards(status);
      CREATE INDEX IF NOT EXISTS idx_cards_severity ON review_cards(severity);
      CREATE INDEX IF NOT EXISTS idx_locations_card ON code_locations(card_id);
      CREATE INDEX IF NOT EXISTS idx_locations_file ON code_locations(file_path);
      CREATE INDEX IF NOT EXISTS idx_records_card ON review_records(card_id);
    `);
  }

  createPR(title: string, description?: string, sourceBranch?: string, targetBranch?: string, author?: string): string {
    const id = uuidv4();
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO pull_requests (id, title, description, source_branch, target_branch, author, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, title, description || null, sourceBranch || null, targetBranch || null, author || null, now, now);
    return id;
  }

  getPR(id: string): any {
    return this.db.prepare('SELECT * FROM pull_requests WHERE id = ?').get(id);
  }

  getAllPRs(): any[] {
    return this.db.prepare('SELECT * FROM pull_requests ORDER BY created_at DESC').all();
  }

  deletePR(id: string): void {
    this.db.prepare('DELETE FROM pull_requests WHERE id = ?').run(id);
  }

  createCard(prId: string, title: string, description: string, severity: string): string {
    const id = uuidv4();
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO review_cards (id, pr_id, title, description, severity, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'open', ?, ?)
    `).run(id, prId, title, description, severity, now, now);
    return id;
  }

  getCard(id: string): any {
    return this.db.prepare('SELECT * FROM review_cards WHERE id = ?').get(id);
  }

  getCardsByPR(prId: string): any[] {
    return this.db.prepare('SELECT * FROM review_cards WHERE pr_id = ? ORDER BY created_at DESC').all(prId);
  }

  updateCard(id: string, updates: { title?: string; description?: string; severity?: string; status?: string }): void {
    const now = new Date().toISOString();
    const fields: string[] = ['updated_at = ?'];
    const values: any[] = [now];

    if (updates.title !== undefined) {
      fields.push('title = ?');
      values.push(updates.title);
    }
    if (updates.description !== undefined) {
      fields.push('description = ?');
      values.push(updates.description);
    }
    if (updates.severity !== undefined) {
      fields.push('severity = ?');
      values.push(updates.severity);
    }
    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }

    values.push(id);
    this.db.prepare(`UPDATE review_cards SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  }

  deleteCard(id: string): void {
    this.db.prepare('DELETE FROM review_cards WHERE id = ?').run(id);
  }

  createCodeLocation(cardId: string, location: {
    filePath: string;
    startLine: number;
    endLine: number;
    startColumn?: number;
    endColumn?: number;
    lineContent?: string;
    contextBefore?: string[];
    contextAfter?: string[];
  }): string {
    const id = uuidv4();
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO code_locations 
      (id, card_id, file_path, start_line, end_line, start_column, end_column, line_content, context_before, context_after, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, 
      cardId, 
      location.filePath, 
      location.startLine, 
      location.endLine, 
      location.startColumn || null, 
      location.endColumn || null, 
      location.lineContent || null,
      location.contextBefore ? JSON.stringify(location.contextBefore) : null,
      location.contextAfter ? JSON.stringify(location.contextAfter) : null,
      now
    );
    return id;
  }

  getCodeLocationsByCard(cardId: string): any[] {
    const rows = this.db.prepare('SELECT * FROM code_locations WHERE card_id = ?').all(cardId);
    return rows.map((row: any) => ({
      ...row,
      contextBefore: row.context_before ? JSON.parse(row.context_before) : [],
      contextAfter: row.context_after ? JSON.parse(row.context_after) : []
    }));
  }

  checkDuplicateLocation(filePath: string, startLine: number, endLine: number): any | null {
    return this.db.prepare(`
      SELECT cl.*, rc.pr_id, rc.title as card_title, rc.status
      FROM code_locations cl
      JOIN review_cards rc ON cl.card_id = rc.id
      WHERE cl.file_path = ? 
      AND cl.start_line <= ? 
      AND cl.end_line >= ?
      AND rc.status IN ('open', 'in_progress')
      LIMIT 1
    `).get(filePath, endLine, startLine);
  }

  createAttachment(cardId: string, attachment: {
    type: string;
    name: string;
    data: string;
    mimeType: string;
  }): string {
    const id = uuidv4();
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO attachments (id, card_id, type, name, data, mime_type, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, cardId, attachment.type, attachment.name, attachment.data, attachment.mimeType, now);
    return id;
  }

  getAttachmentsByCard(cardId: string): any[] {
    return this.db.prepare('SELECT * FROM attachments WHERE card_id = ?').all(cardId);
  }

  createReviewRecord(record: {
    cardId: string;
    reviewer: string;
    action: string;
    comment?: string;
    oldStatus?: string;
    newStatus?: string;
  }): string {
    const id = uuidv4();
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO review_records (id, card_id, reviewer, action, comment, old_status, new_status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, record.cardId, record.reviewer, record.action, record.comment || null, record.oldStatus || null, record.newStatus || null, now);
    return id;
  }

  getReviewRecordsByCard(cardId: string): any[] {
    return this.db.prepare('SELECT * FROM review_records WHERE card_id = ? ORDER BY created_at DESC').all(cardId);
  }

  close(): void {
    this.db.close();
  }
}

export const db = new ReviewDatabase();
