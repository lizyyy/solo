import db from '../connection';
import { HistoryRecord } from '../../types';
import { generateId } from '../../utils/validators';

export class HistoryRepository {
  async addRecord(certificateId: string, action: string, details?: string, actor?: string): Promise<void> {
    const id = generateId();
    const now = new Date().toISOString();
    
    await db.run(`
      INSERT INTO history (id, certificate_id, action, details, timestamp, actor)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [id, certificateId, action, details || null, now, actor || null]);
  }

  async findByCertificateId(certificateId: string, limit: number = 50): Promise<HistoryRecord[]> {
    const results = await db.all(`
      SELECT * FROM history 
      WHERE certificate_id = ? 
      ORDER BY timestamp DESC 
      LIMIT ?
    `, [certificateId, limit]);
    
    return results.map(row => ({
      id: (row as any).id,
      certificateId: (row as any).certificate_id,
      action: (row as any).action,
      details: (row as any).details,
      timestamp: (row as any).timestamp,
      actor: (row as any).actor
    }));
  }

  async findAll(limit: number = 100): Promise<HistoryRecord[]> {
    const results = await db.all(`
      SELECT * FROM history 
      ORDER BY timestamp DESC 
      LIMIT ?
    `, [limit]);
    
    return results.map(row => ({
      id: (row as any).id,
      certificateId: (row as any).certificate_id,
      action: (row as any).action,
      details: (row as any).details,
      timestamp: (row as any).timestamp,
      actor: (row as any).actor
    }));
  }

  async findByDateRange(startDate: string, endDate: string): Promise<HistoryRecord[]> {
    const results = await db.all(`
      SELECT * FROM history 
      WHERE timestamp >= ? AND timestamp <= ?
      ORDER BY timestamp DESC
    `, [startDate, endDate]);
    
    return results.map(row => ({
      id: (row as any).id,
      certificateId: (row as any).certificate_id,
      action: (row as any).action,
      details: (row as any).details,
      timestamp: (row as any).timestamp,
      actor: (row as any).actor
    }));
  }

  async findByAction(action: string, limit: number = 50): Promise<HistoryRecord[]> {
    const results = await db.all(`
      SELECT * FROM history 
      WHERE action = ?
      ORDER BY timestamp DESC 
      LIMIT ?
    `, [action, limit]);
    
    return results.map(row => ({
      id: (row as any).id,
      certificateId: (row as any).certificate_id,
      action: (row as any).action,
      details: (row as any).details,
      timestamp: (row as any).timestamp,
      actor: (row as any).actor
    }));
  }

  async getRecentActions(days: number = 7): Promise<{ action: string; count: number }[]> {
    const date = new Date();
    date.setDate(date.getDate() - days);
    
    return await db.all(`
      SELECT action, COUNT(*) as count 
      FROM history 
      WHERE timestamp >= ?
      GROUP BY action
      ORDER BY count DESC
    `, [date.toISOString()]);
  }
}

export default new HistoryRepository();
