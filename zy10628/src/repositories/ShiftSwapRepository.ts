import sqlite3 from 'sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { Database } from '../database/Database';
import { ShiftSwap, ShiftSwapStatus, ShiftSwapHistory } from '../types';

export class ShiftSwapRepository {
  private db: sqlite3.Database;

  constructor(db: sqlite3.Database) {
    this.db = db;
  }

  async create(swap: Omit<ShiftSwap, 'id' | 'createdAt' | 'updatedAt'>): Promise<ShiftSwap> {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    const sql = `
      INSERT INTO shift_swaps (
        id, original_shift_id, original_driver_id, new_driver_id,
        swap_reason, reason_detail, status, conflict_reason,
        confirmed_by_id, confirmed_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await Database.run(this.db, sql, [
      id, swap.originalShiftId, swap.originalDriverId, swap.newDriverId,
      swap.swapReason, swap.reasonDetail || null, swap.status,
      swap.conflictReason || null, swap.confirmedById || null,
      swap.confirmedAt || null, now, now
    ]);

    return this.findById(id) as Promise<ShiftSwap>;
  }

  async findById(id: string): Promise<ShiftSwap | undefined> {
    const sql = `
      SELECT 
        id, original_shift_id as originalShiftId,
        original_driver_id as originalDriverId,
        new_driver_id as newDriverId,
        swap_reason as swapReason,
        reason_detail as reasonDetail,
        status,
        conflict_reason as conflictReason,
        confirmed_by_id as confirmedById,
        confirmed_at as confirmedAt,
        created_at as createdAt,
        updated_at as updatedAt
      FROM shift_swaps WHERE id = ?
    `;
    return Database.get<ShiftSwap>(this.db, sql, [id]);
  }

  async findAll(filters?: {
    status?: ShiftSwapStatus;
    originalDriverId?: string;
    newDriverId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<ShiftSwap[]> {
    let sql = `
      SELECT 
        id, original_shift_id as originalShiftId,
        original_driver_id as originalDriverId,
        new_driver_id as newDriverId,
        swap_reason as swapReason,
        reason_detail as reasonDetail,
        status,
        conflict_reason as conflictReason,
        confirmed_by_id as confirmedById,
        confirmed_at as confirmedAt,
        created_at as createdAt,
        updated_at as updatedAt
      FROM shift_swaps
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (filters?.status) {
      sql += ` AND status = ?`;
      params.push(filters.status);
    }
    if (filters?.originalDriverId) {
      sql += ` AND original_driver_id = ?`;
      params.push(filters.originalDriverId);
    }
    if (filters?.newDriverId) {
      sql += ` AND new_driver_id = ?`;
      params.push(filters.newDriverId);
    }
    if (filters?.startDate) {
      sql += ` AND created_at >= ?`;
      params.push(filters.startDate);
    }
    if (filters?.endDate) {
      sql += ` AND created_at <= ?`;
      params.push(filters.endDate);
    }

    sql += ` ORDER BY created_at DESC`;

    return Database.all<ShiftSwap>(this.db, sql, params);
  }

  async updateStatus(
    id: string,
    status: ShiftSwapStatus,
    conflictReason?: string,
    confirmedById?: string
  ): Promise<ShiftSwap | undefined> {
    const now = new Date().toISOString();
    
    let sql = `UPDATE shift_swaps SET status = ?, updated_at = ?`;
    const params: unknown[] = [status, now];

    if (conflictReason) {
      sql += `, conflict_reason = ?`;
      params.push(conflictReason);
    }
    if (confirmedById) {
      sql += `, confirmed_by_id = ?, confirmed_at = ?`;
      params.push(confirmedById, now);
    }

    sql += ` WHERE id = ?`;
    params.push(id);

    await Database.run(this.db, sql, params);
    return this.findById(id);
  }

  async addHistory(history: Omit<ShiftSwapHistory, 'id' | 'changedAt'>): Promise<ShiftSwapHistory> {
    const id = uuidv4();
    const now = new Date().toISOString();

    const sql = `
      INSERT INTO shift_swap_history (
        id, swap_id, previous_status, new_status,
        changed_by, change_reason, changed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    await Database.run(this.db, sql, [
      id, history.swapId, history.previousStatus,
      history.newStatus, history.changedBy,
      history.changeReason || null, now
    ]);

    return { ...history, id, changedAt: now };
  }

  async getHistory(swapId: string): Promise<ShiftSwapHistory[]> {
    const sql = `
      SELECT 
        id, swap_id as swapId,
        previous_status as previousStatus,
        new_status as newStatus,
        changed_by as changedBy,
        change_reason as changeReason,
        changed_at as changedAt
      FROM shift_swap_history
      WHERE swap_id = ?
      ORDER BY changed_at DESC
    `;
    return Database.all<ShiftSwapHistory>(this.db, sql, [swapId]);
  }

  async findConflicts(newDriverId: string, shiftDate: string, startTime: string, endTime: string): Promise<ShiftSwap[]> {
    const sql = `
      SELECT 
        ss.id, ss.original_shift_id as originalShiftId,
        ss.original_driver_id as originalDriverId,
        ss.new_driver_id as newDriverId,
        ss.swap_reason as swapReason,
        ss.status
      FROM shift_swaps ss
      JOIN shifts s ON ss.original_shift_id = s.id
      WHERE ss.new_driver_id = ?
        AND s.shift_date = ?
        AND ss.status IN ('pending_confirm', 'swapped')
        AND (
          (s.start_time <= ? AND s.end_time >= ?)
          OR (s.start_time <= ? AND s.end_time >= ?)
          OR (s.start_time >= ? AND s.end_time <= ?)
        )
    `;

    return Database.all<ShiftSwap>(this.db, sql, [
      newDriverId, shiftDate, startTime, startTime, endTime, endTime, startTime, endTime
    ]);
  }
}
