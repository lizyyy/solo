import { v4 as uuidv4 } from 'uuid';
import { db } from '../database';
import { DelayExchange } from '../types';
import { OperationLogService } from './OperationLogService';
import { TemperatureBoxService } from './TemperatureBoxService';

export class DelayExchangeService {
  static async createExchange(
    boxId: string,
    reason: string,
    reasonType: string,
    delayMinutes: number,
    changedBy: string,
    changedByName: string,
    oldBoxId?: string
  ): Promise<DelayExchange> {
    const affectedRecordIds: string[] = [boxId];

    const exchange: DelayExchange = {
      id: uuidv4(),
      boxId,
      oldBoxId,
      reason,
      reasonType,
      delayMinutes,
      changedBy,
      changedAt: new Date().toISOString(),
      affectedRecordIds,
      status: 'pending'
    };

    await db.run(
      `INSERT INTO delay_exchanges (id, box_id, old_box_id, reason, reason_type, delay_minutes, changed_by, changed_at, affected_record_ids, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        exchange.id,
        exchange.boxId,
        exchange.oldBoxId || null,
        exchange.reason,
        exchange.reasonType,
        exchange.delayMinutes,
        exchange.changedBy,
        exchange.changedAt,
        JSON.stringify(exchange.affectedRecordIds),
        exchange.status
      ]
    );

    await OperationLogService.createLog(
      'create',
      'delay_exchange',
      exchange.id,
      changedBy,
      changedByName,
      null,
      exchange,
      `延误换箱申请: ${reason}`
    );

    return exchange;
  }

  static async approveExchange(
    exchangeId: string,
    reviewedBy: string,
    reviewedByName: string
  ): Promise<DelayExchange> {
    const exchange = await this.getExchange(exchangeId);
    if (!exchange) {
      throw new Error('换箱记录不存在');
    }

    if (exchange.status !== 'pending') {
      throw new Error('该申请已处理');
    }

    const oldExchange = { ...exchange };
    exchange.status = 'approved';
    exchange.reviewedBy = reviewedBy;
    exchange.reviewedAt = new Date().toISOString();

    await db.run(
      `UPDATE delay_exchanges SET status = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?`,
      [exchange.status, exchange.reviewedBy, exchange.reviewedAt, exchangeId]
    );

    if (exchange.oldBoxId) {
      await TemperatureBoxService.updateBoxStatus(
        exchange.oldBoxId,
        'exchanged' as any,
        0,
        reviewedBy,
        reviewedByName
      );
    }

    await OperationLogService.createLog(
      'approve',
      'delay_exchange',
      exchangeId,
      reviewedBy,
      reviewedByName,
      oldExchange,
      exchange,
      '批准延误换箱'
    );

    return exchange;
  }

  static async getExchange(id: string): Promise<DelayExchange | undefined> {
    const row = await db.get<any>(
      `SELECT * FROM delay_exchanges WHERE id = ?`,
      [id]
    );
    return row ? this.mapRowToExchange(row) : undefined;
  }

  static async getExchangesByBox(boxId: string): Promise<DelayExchange[]> {
    const rows = await db.all<any>(
      `SELECT * FROM delay_exchanges WHERE box_id = ? OR old_box_id = ? ORDER BY changed_at DESC`,
      [boxId, boxId]
    );
    return rows.map(row => this.mapRowToExchange(row));
  }

  static async getAllExchanges(): Promise<DelayExchange[]> {
    const rows = await db.all<any>(`SELECT * FROM delay_exchanges ORDER BY changed_at DESC`);
    return rows.map(row => this.mapRowToExchange(row));
  }

  private static mapRowToExchange(row: any): DelayExchange {
    return {
      id: row.id,
      boxId: row.box_id,
      oldBoxId: row.old_box_id,
      reason: row.reason,
      reasonType: row.reason_type,
      delayMinutes: row.delay_minutes,
      changedBy: row.changed_by,
      changedAt: row.changed_at,
      affectedRecordIds: JSON.parse(row.affected_record_ids || '[]'),
      reviewedBy: row.reviewed_by,
      reviewedAt: row.reviewed_at,
      status: row.status
    };
  }
}
