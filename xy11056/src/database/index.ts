import Database from 'better-sqlite3';
import { RepairFundInvoice } from '../types';

const DB_PATH = './repair_fund_invoice.db';

export class InvoiceDatabase {
  private db: Database.Database;

  constructor() {
    this.db = new Database(DB_PATH);
  }

  init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS repair_fund_invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoiceNo TEXT NOT NULL UNIQUE,
        communityName TEXT NOT NULL,
        ownerName TEXT NOT NULL,
        houseNumber TEXT NOT NULL,
        repairItem TEXT NOT NULL,
        paymentAmount REAL NOT NULL,
        invoiceAmount REAL NOT NULL,
        invoiceDate TEXT NOT NULL,
        handler TEXT NOT NULL,
        reviewer TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('pending', 'approved', 'rejected')),
        remark TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  findAll(): RepairFundInvoice[] {
    const stmt = this.db.prepare('SELECT * FROM repair_fund_invoices ORDER BY createdAt DESC');
    return stmt.all() as RepairFundInvoice[];
  }

  findById(id: number): RepairFundInvoice | undefined {
    const stmt = this.db.prepare('SELECT * FROM repair_fund_invoices WHERE id = ?');
    return stmt.get(id) as RepairFundInvoice | undefined;
  }

  findByInvoiceNo(invoiceNo: string): RepairFundInvoice | undefined {
    const stmt = this.db.prepare('SELECT * FROM repair_fund_invoices WHERE invoiceNo = ?');
    return stmt.get(invoiceNo) as RepairFundInvoice | undefined;
  }

  create(invoice: Omit<RepairFundInvoice, 'id' | 'createdAt' | 'updatedAt'>): RepairFundInvoice {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO repair_fund_invoices 
      (invoiceNo, communityName, ownerName, houseNumber, repairItem, paymentAmount, invoiceAmount, invoiceDate, handler, reviewer, status, remark, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      invoice.invoiceNo,
      invoice.communityName,
      invoice.ownerName,
      invoice.houseNumber,
      invoice.repairItem,
      invoice.paymentAmount,
      invoice.invoiceAmount,
      invoice.invoiceDate,
      invoice.handler,
      invoice.reviewer,
      invoice.status,
      invoice.remark || null,
      now,
      now
    );

    return {
      ...invoice,
      id: result.lastInsertRowid as number,
      createdAt: now,
      updatedAt: now
    };
  }

  update(id: number, invoice: Partial<RepairFundInvoice>): RepairFundInvoice | undefined {
    const existing = this.findById(id);
    if (!existing) {
      return undefined;
    }

    const updated = { ...existing, ...invoice, updatedAt: new Date().toISOString() };
    const stmt = this.db.prepare(`
      UPDATE repair_fund_invoices 
      SET communityName = ?, ownerName = ?, houseNumber = ?, repairItem = ?, 
          paymentAmount = ?, invoiceAmount = ?, invoiceDate = ?, handler = ?, 
          reviewer = ?, status = ?, remark = ?, updatedAt = ?
      WHERE id = ?
    `);
    
    stmt.run(
      updated.communityName,
      updated.ownerName,
      updated.houseNumber,
      updated.repairItem,
      updated.paymentAmount,
      updated.invoiceAmount,
      updated.invoiceDate,
      updated.handler,
      updated.reviewer,
      updated.status,
      updated.remark || null,
      updated.updatedAt,
      id
    );

    return updated;
  }

  delete(id: number): boolean {
    const stmt = this.db.prepare('DELETE FROM repair_fund_invoices WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  getSummaryAmount(): number {
    const stmt = this.db.prepare('SELECT SUM(invoiceAmount) as total FROM repair_fund_invoices');
    const result = stmt.get() as { total: number | null };
    return result.total || 0;
  }

  clearAll(): void {
    this.db.exec('DELETE FROM repair_fund_invoices');
  }

  close(): void {
    this.db.close();
  }
}

export const db = new InvoiceDatabase();
