import { v4 as uuidv4 } from 'uuid';
import { getDatabase, runSync, getSync, allSync } from '../database';
import { RepairQuote } from '../types';

export class RepairQuoteRepository {
  private get db() {
    return getDatabase();
  }

  async create(data: {
    batchId: string;
    quoteNo: string;
    workshop: string;
    quotedBy: string;
    quoteDate: number;
    totalAmount: number;
    items: string;
    laborCost: number;
    partsCost: number;
    remarks?: string | null;
  }): Promise<RepairQuote> {
    const now = Date.now();
    const id = uuidv4();
    await runSync(this.db, `
      INSERT INTO repair_quotes (
        id, batch_id, quote_no, workshop, quoted_by, quote_date,
        total_amount, items, labor_cost, parts_cost, remarks, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      data.batchId,
      data.quoteNo,
      data.workshop,
      data.quotedBy,
      data.quoteDate,
      data.totalAmount,
      data.items,
      data.laborCost,
      data.partsCost,
      data.remarks || null,
      'pending',
      now,
      now
    ]);
    return this.findById(id) as Promise<RepairQuote>;
  }

  async findById(id: string): Promise<RepairQuote | null> {
    const row = await getSync(this.db, 'SELECT * FROM repair_quotes WHERE id = ?', [id]);
    return row ? this.mapRow(row) : null;
  }

  async findByBatchId(batchId: string): Promise<RepairQuote[]> {
    const rows = await allSync(this.db, 'SELECT * FROM repair_quotes WHERE batch_id = ? ORDER BY created_at DESC', [batchId]);
    return rows.map(row => this.mapRow(row));
  }

  async findByQuoteNo(quoteNo: string): Promise<RepairQuote | null> {
    const row = await getSync(this.db, 'SELECT * FROM repair_quotes WHERE quote_no = ?', [quoteNo]);
    return row ? this.mapRow(row) : null;
  }

  async updateStatus(id: string, status: string): Promise<void> {
    const now = Date.now();
    await runSync(this.db, 'UPDATE repair_quotes SET status = ?, updated_at = ? WHERE id = ?', [status, now, id]);
  }

  async deleteByBatchId(batchId: string): Promise<void> {
    await runSync(this.db, 'DELETE FROM repair_quotes WHERE batch_id = ?', [batchId]);
  }

  private mapRow(row: any): RepairQuote {
    return {
      id: row.id,
      batchId: row.batch_id,
      quoteNo: row.quote_no,
      workshop: row.workshop,
      quotedBy: row.quoted_by,
      quoteDate: row.quote_date,
      totalAmount: row.total_amount,
      items: row.items,
      laborCost: row.labor_cost,
      partsCost: row.parts_cost,
      remarks: row.remarks,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}
