import db from '../models/database';
import { MatchStatus, MatchDetail, ImportResult } from '../types';
import { randomUUID } from 'crypto';

export class MatchService {
  private generateId(): string {
    return randomUUID();
  }

  async createEntry(entryData: {
    entryTime: Date;
    photoUrl: string;
    parkingSpot: string;
    plateNumber?: string;
  }): Promise<string> {
    const id = this.generateId();
    const stmt = db.prepare(`
      INSERT INTO entry_records (id, entry_time, photo_url, parking_spot, plate_number)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(id, entryData.entryTime.toISOString(), entryData.photoUrl, entryData.parkingSpot, entryData.plateNumber || null);
    return id;
  }

  async createPayment(paymentData: {
    paymentTime: Date;
    amount: number;
    paymentMethod: string;
    transactionId: string;
  }): Promise<string> {
    const id = this.generateId();
    const stmt = db.prepare(`
      INSERT INTO payment_records (id, payment_time, amount, payment_method, transaction_id)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(id, paymentData.paymentTime.toISOString(), paymentData.amount, paymentData.paymentMethod, paymentData.transactionId);
    return id;
  }

  async createMatch(matchData: {
    entryId: string;
    paymentId: string;
    manualNote?: string;
    matchedBy?: string;
  }): Promise<string> {
    const id = this.generateId();
    const now = new Date().toISOString();

    const entryExists = db.prepare('SELECT id FROM entry_records WHERE id = ?').get(matchData.entryId);
    if (!entryExists) {
      throw new Error(`Entry record not found: ${matchData.entryId}`);
    }

    const paymentExists = db.prepare('SELECT id FROM payment_records WHERE id = ?').get(matchData.paymentId);
    if (!paymentExists) {
      throw new Error(`Payment record not found: ${matchData.paymentId}`);
    }

    const existingMatch = db.prepare('SELECT id FROM match_records WHERE entry_id = ? AND payment_id = ?').get(matchData.entryId, matchData.paymentId);
    if (existingMatch) {
      throw new Error('This entry-payment pair already exists');
    }

    const stmt = db.prepare(`
      INSERT INTO match_records (id, entry_id, payment_id, status, manual_note, matched_by, matched_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, matchData.entryId, matchData.paymentId, MatchStatus.PENDING, matchData.manualNote || null, matchData.matchedBy || null, null, now, now);

    await this.addHistory(id, undefined, MatchStatus.PENDING, matchData.matchedBy, '创建匹配记录');

    return id;
  }

  async updateStatus(matchId: string, newStatus: MatchStatus, changedBy?: string, changeNote?: string): Promise<void> {
    const match = db.prepare('SELECT status FROM match_records WHERE id = ?').get(matchId) as any;
    if (!match) {
      throw new Error(`Match record not found: ${matchId}`);
    }

    const previousStatus = match.status;

    db.prepare('UPDATE match_records SET status = ?, updated_at = ? WHERE id = ?').run(
      newStatus,
      new Date().toISOString(),
      matchId
    );

    await this.addHistory(matchId, previousStatus as MatchStatus, newStatus, changedBy, changeNote || '状态变更');
  }

  async addManualNote(matchId: string, note: string, changedBy?: string): Promise<void> {
    const match = db.prepare('SELECT manual_note FROM match_records WHERE id = ?').get(matchId) as any;
    if (!match) {
      throw new Error(`Match record not found: ${matchId}`);
    }

    const existingNote = match.manual_note || '';
    const newNote = existingNote ? `${existingNote}\n${new Date().toISOString()}: ${note}` : `${new Date().toISOString()}: ${note}`;

    db.prepare('UPDATE match_records SET manual_note = ?, updated_at = ? WHERE id = ?').run(
      newNote,
      new Date().toISOString(),
      matchId
    );

    await this.addHistory(matchId, undefined, undefined, changedBy, `添加备注: ${note}`);
  }

  private async addHistory(
    matchId: string,
    previousStatus: MatchStatus | undefined,
    newStatus: MatchStatus | undefined,
    changedBy?: string,
    changeNote?: string
  ): Promise<void> {
    const id = this.generateId();
    const stmt = db.prepare(`
      INSERT INTO match_histories (id, match_id, previous_status, new_status, changed_by, change_note)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, matchId, previousStatus || null, newStatus || null, changedBy || null, changeNote || null);
  }

  async getMatchList(params: {
    status?: MatchStatus;
    page?: number;
    pageSize?: number;
  }): Promise<{ list: any[]; total: number }> {
    const { status, page = 1, pageSize = 20 } = params;
    const offset = (page - 1) * pageSize;

    let whereClause = '';
    const queryParams: any[] = [];

    if (status) {
      whereClause = 'WHERE m.status = ?';
      queryParams.push(status);
    }

    const countStmt = db.prepare(`
      SELECT COUNT(*) as total
      FROM match_records m
      ${whereClause}
    `);
    const { total } = countStmt.get(...queryParams) as any;

    const listStmt = db.prepare(`
      SELECT 
        m.id,
        m.status,
        m.manual_note,
        m.matched_by,
        m.matched_at,
        m.created_at,
        m.updated_at,
        e.id as entry_id,
        e.entry_time,
        e.photo_url,
        e.parking_spot,
        e.plate_number,
        p.id as payment_id,
        p.payment_time,
        p.amount,
        p.payment_method,
        p.transaction_id
      FROM match_records m
      JOIN entry_records e ON m.entry_id = e.id
      JOIN payment_records p ON m.payment_id = p.id
      ${whereClause}
      ORDER BY m.created_at DESC
      LIMIT ? OFFSET ?
    `);
    const list = listStmt.all(...queryParams, pageSize, offset);

    return {
      list: list.map((row: any) => this.transformMatchRow(row)),
      total
    };
  }

  async getMatchDetail(matchId: string): Promise<MatchDetail> {
    const matchStmt = db.prepare(`
      SELECT 
        m.id,
        m.status,
        m.manual_note,
        m.matched_by,
        m.matched_at,
        m.created_at,
        m.updated_at,
        e.id as entry_id,
        e.entry_time,
        e.photo_url,
        e.parking_spot,
        e.plate_number,
        p.id as payment_id,
        p.payment_time,
        p.amount,
        p.payment_method,
        p.transaction_id
      FROM match_records m
      JOIN entry_records e ON m.entry_id = e.id
      JOIN payment_records p ON m.payment_id = p.id
      WHERE m.id = ?
    `);
    const match = matchStmt.get(matchId) as any;

    if (!match) {
      throw new Error(`Match record not found: ${matchId}`);
    }

    const historyStmt = db.prepare(`
      SELECT * FROM match_histories WHERE match_id = ? ORDER BY created_at DESC
    `);
    const histories = historyStmt.all(matchId);

    const paymentMatchesStmt = db.prepare(`
      SELECT 
        m2.id,
        m2.status,
        e2.entry_time,
        e2.parking_spot
      FROM match_records m2
      JOIN entry_records e2 ON m2.entry_id = e2.id
      WHERE m2.payment_id = ? AND m2.id != ?
    `);
    const otherMatches = paymentMatchesStmt.all(match.payment_id, matchId);

    return {
      ...this.transformMatchRow(match),
      entry: {
        id: match.entry_id,
        entryTime: new Date(match.entry_time),
        photoUrl: match.photo_url,
        parkingSpot: match.parking_spot,
        plateNumber: match.plate_number,
        createdAt: new Date(match.created_at)
      },
      payment: {
        id: match.payment_id,
        paymentTime: new Date(match.payment_time),
        amount: match.amount,
        paymentMethod: match.payment_method,
        transactionId: match.transaction_id,
        createdAt: new Date(match.created_at)
      },
      histories: histories.map((h: any) => ({
        id: h.id,
        matchId: h.match_id,
        previousStatus: h.previous_status,
        newStatus: h.new_status,
        changedBy: h.changed_by,
        changeNote: h.change_note,
        createdAt: new Date(h.created_at)
      })),
      otherMatchesForPayment: otherMatches
    } as MatchDetail & { otherMatchesForPayment: any[] };
  }

  async getMatchHistories(matchId: string): Promise<any[]> {
    const stmt = db.prepare(`
      SELECT * FROM match_histories WHERE match_id = ? ORDER BY created_at DESC
    `);
    return stmt.all(matchId);
  }

  async batchImport(records: Array<{
    entryTime: string;
    photoUrl: string;
    parkingSpot: string;
    plateNumber?: string;
    paymentTime: string;
    amount: number;
    paymentMethod: string;
    transactionId: string;
    manualNote?: string;
  }>): Promise<ImportResult> {
    const result: ImportResult = {
      success: 0,
      failed: 0,
      errors: []
    };

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      try {
        if (!record.entryTime || !record.photoUrl || !record.parkingSpot) {
          throw new Error('缺少入场必填字段: entryTime, photoUrl, parkingSpot');
        }
        if (!record.paymentTime || !record.amount || !record.paymentMethod || !record.transactionId) {
          throw new Error('缺少支付必填字段: paymentTime, amount, paymentMethod, transactionId');
        }

        let entryId: string;
        const existingEntry = db.prepare('SELECT id FROM entry_records WHERE photo_url = ? AND entry_time = ?').get(
          record.photoUrl,
          new Date(record.entryTime).toISOString()
        ) as any;
        
        if (existingEntry) {
          entryId = existingEntry.id;
        } else {
          entryId = await this.createEntry({
            entryTime: new Date(record.entryTime),
            photoUrl: record.photoUrl,
            parkingSpot: record.parkingSpot,
            plateNumber: record.plateNumber
          });
        }

        let paymentId: string;
        const existingPayment = db.prepare('SELECT id FROM payment_records WHERE transaction_id = ?').get(record.transactionId) as any;
        
        if (existingPayment) {
          paymentId = existingPayment.id;
        } else {
          paymentId = await this.createPayment({
            paymentTime: new Date(record.paymentTime),
            amount: record.amount,
            paymentMethod: record.paymentMethod,
            transactionId: record.transactionId
          });
        }

        try {
          await this.createMatch({
            entryId,
            paymentId,
            manualNote: record.manualNote
          });
          result.success++;
        } catch (e: any) {
          if (e.message.includes('already exists')) {
            result.success++;
          } else {
            throw e;
          }
        }
      } catch (error: any) {
        result.failed++;
        result.errors.push({
          row: i + 1,
          message: error.message,
          data: record
        });
      }
    }

    return result;
  }

  async exportData(params: { status?: MatchStatus } = {}): Promise<any[]> {
    const { status } = params;

    let whereClause = '';
    const queryParams: any[] = [];

    if (status) {
      whereClause = 'WHERE m.status = ?';
      queryParams.push(status);
    }

    const stmt = db.prepare(`
      SELECT 
        m.id as match_id,
        m.status,
        m.manual_note,
        m.matched_by,
        m.matched_at,
        m.created_at as match_created_at,
        e.id as entry_id,
        e.entry_time,
        e.photo_url,
        e.parking_spot,
        e.plate_number,
        p.id as payment_id,
        p.payment_time,
        p.amount,
        p.payment_method,
        p.transaction_id,
        (
          SELECT GROUP_CONCAT(m2.id || ':' || m2.status, '; ')
          FROM match_records m2
          WHERE m2.payment_id = p.id AND m2.id != m.id
        ) as duplicate_matches
      FROM match_records m
      JOIN entry_records e ON m.entry_id = e.id
      JOIN payment_records p ON m.payment_id = p.id
      ${whereClause}
      ORDER BY m.created_at DESC
    `);

    const rows = stmt.all(...queryParams);
    return rows.map((row: any) => ({
      匹配ID: row.match_id,
      状态: row.status,
      人工备注: row.manual_note,
      匹配人: row.matched_by,
      匹配时间: row.matched_at,
      入场ID: row.entry_id,
      入场时间: row.entry_time,
      入场照片: row.photo_url,
      车位: row.parking_spot,
      车牌号: row.plate_number,
      支付ID: row.payment_id,
      支付时间: row.payment_time,
      支付金额: row.amount,
      支付方式: row.payment_method,
      交易单号: row.transaction_id,
      重复匹配: row.duplicate_matches || ''
    }));
  }

  private transformMatchRow(row: any) {
    return {
      id: row.id,
      status: row.status,
      manualNote: row.manual_note,
      matchedBy: row.matched_by,
      matchedAt: row.matched_at ? new Date(row.matched_at) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      entry: {
        id: row.entry_id,
        entryTime: new Date(row.entry_time),
        photoUrl: row.photo_url,
        parkingSpot: row.parking_spot,
        plateNumber: row.plate_number
      },
      payment: {
        id: row.payment_id,
        paymentTime: new Date(row.payment_time),
        amount: row.amount,
        paymentMethod: row.payment_method,
        transactionId: row.transaction_id
      }
    };
  }
}

export default new MatchService();
