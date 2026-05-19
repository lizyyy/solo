import sqlite3 from 'sqlite3';
import crypto from 'crypto';
import { DeclarationSubmission, DeclarationRecord, PackageRecord, ValidationError } from './types';

const db = new sqlite3.Database('./declaration.db');

export function initDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS declarations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          declarationNo TEXT UNIQUE NOT NULL,
          submitter TEXT NOT NULL,
          submitTime TEXT NOT NULL,
          totalAmount REAL NOT NULL,
          totalTax REAL NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          contentHash TEXT UNIQUE NOT NULL,
          customsCode TEXT,
          logisticsNo TEXT,
          rejectionReason TEXT,
          processor TEXT,
          processedAt TEXT,
          createdAt TEXT NOT NULL
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS packages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          declarationId INTEGER NOT NULL,
          itemNo TEXT NOT NULL,
          name TEXT NOT NULL,
          category TEXT NOT NULL,
          quantity INTEGER NOT NULL,
          unitPrice REAL NOT NULL,
          currency TEXT NOT NULL,
          taxRate REAL NOT NULL,
          taxAmount REAL NOT NULL,
          FOREIGN KEY (declarationId) REFERENCES declarations (id)
        )
      `);

      db.run('CREATE INDEX IF NOT EXISTS idx_declarationNo ON declarations (declarationNo)');
      db.run('CREATE INDEX IF NOT EXISTS idx_contentHash ON declarations (contentHash)');
      db.run('CREATE INDEX IF NOT EXISTS idx_status ON declarations (status)');
      resolve();
    });
  });
}

export function generateContentHash(submission: DeclarationSubmission): string {
  const content = JSON.stringify({
    declarationNo: submission.declarationNo,
    submitter: submission.submitter,
    packages: submission.packages,
    totalAmount: submission.totalAmount
  });
  return crypto.createHash('md5').update(content).digest('hex');
}

export function findByHash(hash: string): Promise<DeclarationRecord | null> {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM declarations WHERE contentHash = ?', [hash], (err, row: any) => {
      if (err) reject(err);
      else resolve(row || null);
    });
  });
}

export function findByDeclarationNo(declarationNo: string): Promise<DeclarationRecord | null> {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM declarations WHERE declarationNo = ?', [declarationNo], (err, row: any) => {
      if (err) reject(err);
      else resolve(row || null);
    });
  });
}

export function getPackagesByDeclarationId(declarationId: number): Promise<PackageRecord[]> {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM packages WHERE declarationId = ?', [declarationId], (err, rows: any[]) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

export function insertDeclaration(
  submission: DeclarationSubmission,
  contentHash: string,
  totalTax: number
): Promise<number> {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    db.run(
      `INSERT INTO declarations 
       (declarationNo, submitter, submitTime, totalAmount, totalTax, contentHash, customsCode, logisticsNo, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        submission.declarationNo,
        submission.submitter,
        submission.submitTime,
        submission.totalAmount,
        totalTax,
        contentHash,
        submission.customsCode || null,
        submission.logisticsNo || null,
        now
      ],
      function (err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
}

export function insertPackages(declarationId: number, packages: PackageRecord[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      INSERT INTO packages 
      (declarationId, itemNo, name, category, quantity, unitPrice, currency, taxRate, taxAmount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    packages.forEach(pkg => {
      stmt.run([
        declarationId,
        pkg.itemNo,
        pkg.name,
        pkg.category,
        pkg.quantity,
        pkg.unitPrice,
        pkg.currency,
        pkg.taxRate,
        pkg.taxAmount
      ]);
    });

    stmt.finalize((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export function queryDeclarations(params: {
  declarationNo?: string;
  submitter?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}): Promise<DeclarationRecord[]> {
  return new Promise((resolve, reject) => {
    let sql = 'SELECT * FROM declarations WHERE 1=1';
    const values: any[] = [];

    if (params.declarationNo) {
      sql += ' AND declarationNo = ?';
      values.push(params.declarationNo);
    }
    if (params.submitter) {
      sql += ' AND submitter = ?';
      values.push(params.submitter);
    }
    if (params.status) {
      sql += ' AND status = ?';
      values.push(params.status);
    }
    if (params.startDate) {
      sql += ' AND submitTime >= ?';
      values.push(params.startDate);
    }
    if (params.endDate) {
      sql += ' AND submitTime <= ?';
      values.push(params.endDate);
    }

    sql += ' ORDER BY createdAt DESC';

    db.all(sql, values, (err, rows: any[]) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

export function getStatistics(): Promise<{
  totalCount: number;
  pendingCount: number;
  processedCount: number;
  rejectedCount: number;
  totalAmount: number;
  totalTax: number;
}> {
  return new Promise((resolve, reject) => {
    db.get(`
      SELECT 
        COUNT(*) as totalCount,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pendingCount,
        SUM(CASE WHEN status = 'processed' THEN 1 ELSE 0 END) as processedCount,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejectedCount,
        SUM(totalAmount) as totalAmount,
        SUM(totalTax) as totalTax
      FROM declarations
    `, (err, row: any) => {
      if (err) reject(err);
      else resolve({
        totalCount: row.totalCount || 0,
        pendingCount: row.pendingCount || 0,
        processedCount: row.processedCount || 0,
        rejectedCount: row.rejectedCount || 0,
        totalAmount: row.totalAmount || 0,
        totalTax: row.totalTax || 0
      });
    });
  });
}

export function updateDeclarationStatus(
  declarationId: number,
  status: 'processed' | 'rejected',
  processor: string,
  rejectionReason?: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const processedAt = new Date().toISOString();
    db.run(
      'UPDATE declarations SET status = ?, processor = ?, processedAt = ?, rejectionReason = ? WHERE id = ?',
      [status, processor, processedAt, rejectionReason || null, declarationId],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}
