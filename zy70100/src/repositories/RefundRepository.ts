import { getDb } from '../database';
import {
  RefundRequest,
  RefundRecord,
  RefundHistory,
  RefundStatus,
  RejectStage,
  InterruptionReason,
} from '../types';
import { v4 as uuidv4 } from 'uuid';

export class RefundRepository {
  private db = getDb();

  createRequest(request: Omit<RefundRequest, 'id'> & { id?: string }): RefundRequest {
    const id = request.id || uuidv4();
    this.db.run(`
      INSERT INTO refund_requests (id, session_id, request_id, interruption_reason, interruption_time, description, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      request.sessionId,
      request.requestId,
      request.interruptionReason,
      request.interruptionTime.toISOString(),
      request.description,
      request.createdAt.toISOString(),
    ]);
    return { ...request, id };
  }

  findRequestByRequestId(requestId: string): RefundRequest | null {
    const stmt = this.db.prepare('SELECT * FROM refund_requests WHERE request_id = ?');
    stmt.bind([requestId]);
    if (stmt.step()) {
      const row = stmt.getAsObject() as any;
      stmt.free();
      return this.mapRowToRequest(row);
    }
    stmt.free();
    return null;
  }

  createRecord(record: Omit<RefundRecord, 'id'> & { id?: string }): RefundRecord {
    const id = record.id || uuidv4();
    const now = new Date();
    this.db.run(`
      INSERT INTO refund_records (id, request_id, session_id, status, current_stage, energy_refund_amount, service_refund_amount, total_refund_amount, callback_count, last_callback_at, last_callback_response, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      record.requestId,
      record.sessionId,
      record.status,
      record.currentStage,
      record.energyRefundAmount,
      record.serviceRefundAmount,
      record.totalRefundAmount,
      record.callbackCount,
      record.lastCallbackAt?.toISOString() || null,
      record.lastCallbackResponse,
      now.toISOString(),
      now.toISOString(),
    ]);
    return { ...record, id, createdAt: now, updatedAt: now };
  }

  findRecordByRequestId(requestId: string): RefundRecord | null {
    const stmt = this.db.prepare('SELECT * FROM refund_records WHERE request_id = ?');
    stmt.bind([requestId]);
    if (stmt.step()) {
      const row = stmt.getAsObject() as any;
      stmt.free();
      return this.mapRowToRecord(row);
    }
    stmt.free();
    return null;
  }

  findRecordById(id: string): RefundRecord | null {
    const stmt = this.db.prepare('SELECT * FROM refund_records WHERE id = ?');
    stmt.bind([id]);
    if (stmt.step()) {
      const row = stmt.getAsObject() as any;
      stmt.free();
      return this.mapRowToRecord(row);
    }
    stmt.free();
    return null;
  }

  updateRecord(record: RefundRecord): void {
    this.db.run(`
      UPDATE refund_records
      SET status = ?, current_stage = ?, energy_refund_amount = ?, service_refund_amount = ?, total_refund_amount = ?, callback_count = ?, last_callback_at = ?, last_callback_response = ?, updated_at = ?
      WHERE id = ?
    `, [
      record.status,
      record.currentStage,
      record.energyRefundAmount,
      record.serviceRefundAmount,
      record.totalRefundAmount,
      record.callbackCount,
      record.lastCallbackAt?.toISOString() || null,
      record.lastCallbackResponse,
      new Date().toISOString(),
      record.id,
    ]);
  }

  createHistory(history: Omit<RefundHistory, 'id'> & { id?: string }): RefundHistory {
    const id = history.id || uuidv4();
    this.db.run(`
      INSERT INTO refund_history (id, refund_record_id, status, stage, message, operator, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      history.refundRecordId,
      history.status,
      history.stage,
      history.message,
      history.operator,
      history.createdAt.toISOString(),
    ]);
    return { ...history, id };
  }

  findHistoryByRecordId(refundRecordId: string): RefundHistory[] {
    const results: RefundHistory[] = [];
    const stmt = this.db.prepare('SELECT * FROM refund_history WHERE refund_record_id = ? ORDER BY created_at DESC, id DESC');
    stmt.bind([refundRecordId]);
    while (stmt.step()) {
      const row = stmt.getAsObject() as any;
      results.push(this.mapRowToHistory(row));
    }
    stmt.free();
    return results;
  }

  findLatestHistoryByRecordId(refundRecordId: string): RefundHistory | null {
    const stmt = this.db.prepare('SELECT * FROM refund_history WHERE refund_record_id = ? ORDER BY created_at DESC, id DESC LIMIT 1');
    stmt.bind([refundRecordId]);
    if (stmt.step()) {
      const row = stmt.getAsObject() as any;
      stmt.free();
      return this.mapRowToHistory(row);
    }
    stmt.free();
    return null;
  }

  private mapRowToRequest(row: any): RefundRequest {
    return {
      id: row.id,
      sessionId: row.session_id,
      requestId: row.request_id,
      interruptionReason: row.interruption_reason as InterruptionReason,
      interruptionTime: new Date(row.interruption_time),
      description: row.description,
      createdAt: new Date(row.created_at),
    };
  }

  private mapRowToRecord(row: any): RefundRecord {
    return {
      id: row.id,
      requestId: row.request_id,
      sessionId: row.session_id,
      status: row.status as RefundStatus,
      currentStage: row.current_stage as RejectStage | null,
      energyRefundAmount: row.energy_refund_amount,
      serviceRefundAmount: row.service_refund_amount,
      totalRefundAmount: row.total_refund_amount,
      callbackCount: row.callback_count,
      lastCallbackAt: row.last_callback_at ? new Date(row.last_callback_at) : null,
      lastCallbackResponse: row.last_callback_response,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapRowToHistory(row: any): RefundHistory {
    return {
      id: row.id,
      refundRecordId: row.refund_record_id,
      status: row.status as RefundStatus,
      stage: row.stage as RejectStage | null,
      message: row.message,
      operator: row.operator,
      createdAt: new Date(row.created_at),
    };
  }
}
