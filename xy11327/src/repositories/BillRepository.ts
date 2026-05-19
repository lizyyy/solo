import { v4 as uuidv4 } from 'uuid';
import { Bill } from '../types';
import { DatabaseManager } from '../database/Database';

export class BillRepository {
  private dbManager: DatabaseManager;

  constructor(dbManager?: DatabaseManager) {
    this.dbManager = dbManager || DatabaseManager.getInstance();
  }

  public findByBillNo(billNo: string): Bill | null {
    const db = this.dbManager.getConnection();
    const row = db.prepare('SELECT * FROM bills WHERE bill_no = ?').get(billNo);
    return row ? this.mapToBill(row) : null;
  }

  public findById(id: string): Bill | null {
    const db = this.dbManager.getConnection();
    const row = db.prepare('SELECT * FROM bills WHERE id = ?').get(id);
    return row ? this.mapToBill(row) : null;
  }

  public findAll(filters?: { status?: string; operatorName?: string }): Bill[] {
    const db = this.dbManager.getConnection();
    let sql = 'SELECT * FROM bills WHERE 1=1';
    const params: any[] = [];

    if (filters?.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters?.operatorName) {
      sql += ' AND operator_name LIKE ?';
      params.push(`%${filters.operatorName}%`);
    }
    sql += ' ORDER BY created_at DESC';

    const rows = db.prepare(sql).all(...params);
    return rows.map(row => this.mapToBill(row));
  }

  public insert(bill: Bill, recordIds: { id: string; amount: number }[]): Bill {
    const db = this.dbManager.getConnection();
    const id = bill.id || uuidv4();
    const now = new Date().toISOString();

    this.dbManager.transaction(() => {
      db.prepare(`
        INSERT INTO bills (
          id, bill_no, operator_name, operator_id_card, operator_phone,
          period_start, period_end, total_amount, record_count, status,
          created_at, issued_at, paid_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        bill.billNo,
        bill.operatorName,
        bill.operatorIdCard || null,
        bill.operatorPhone || null,
        bill.periodStart,
        bill.periodEnd,
        bill.totalAmount,
        bill.recordCount,
        bill.status,
        now,
        bill.issuedAt || null,
        bill.paidAt || null
      );

      const insertItem = db.prepare(`
        INSERT INTO bill_items (id, bill_id, record_id, amount) VALUES (?, ?, ?, ?)
      `);
      for (const item of recordIds) {
        insertItem.run(uuidv4(), id, item.id, item.amount);
      }
    });

    return { ...bill, id, createdAt: now };
  }

  public updateStatus(id: string, status: Bill['status']): boolean {
    const db = this.dbManager.getConnection();
    const now = new Date().toISOString();
    
    const updates: string[] = ['status = ?', 'updated_at = ?'];
    const params: any[] = [status, now];

    if (status === 'issued') {
      updates.push('issued_at = ?');
      params.push(now);
    }
    if (status === 'paid') {
      updates.push('paid_at = ?');
      params.push(now);
    }
    params.push(id);

    const result = db.prepare(`UPDATE bills SET ${updates.join(', ')} WHERE id = ?`)
      .run(...params);
    return result.changes > 0;
  }

  public getBillRecordIds(billId: string): string[] {
    const db = this.dbManager.getConnection();
    const rows = db.prepare('SELECT record_id FROM bill_items WHERE bill_id = ?').all(billId);
    return rows.map((row: any) => row.record_id);
  }

  private mapToBill(row: any): Bill {
    return {
      id: row.id,
      billNo: row.bill_no,
      operatorName: row.operator_name,
      operatorIdCard: row.operator_id_card,
      operatorPhone: row.operator_phone,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      totalAmount: row.total_amount,
      recordCount: row.record_count,
      status: row.status,
      createdAt: row.created_at,
      issuedAt: row.issued_at,
      paidAt: row.paid_at
    };
  }
}
