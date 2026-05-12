import db from '../database/db';
import { v4 as uuidv4 } from 'uuid';
import DriverDAO from './driver.dao';

export interface Penalty {
  id: string;
  violationId: string;
  driverId: string;
  pointsDeducted: number;
  fineAmount: number;
  isRolledBack: boolean;
  rolledBackAt?: string;
  rollbackReason?: string;
  createdAt: string;
}

export class PenaltyDAO {
  static getByViolationId(violationId: string): Penalty | undefined {
    const stmt = db.prepare(`
      SELECT 
        id, violation_id as violationId, driver_id as driverId,
        points_deducted as pointsDeducted, fine_amount as fineAmount,
        is_rolled_back as isRolledBack, rolled_back_at as rolledBackAt,
        rollback_reason as rollbackReason, created_at as createdAt
      FROM penalties WHERE violation_id = ?
    `);
    const row = stmt.get(violationId) as Penalty | undefined;
    if (row) {
      row.isRolledBack = Boolean(row.isRolledBack);
    }
    return row;
  }

  static create(data: Omit<Penalty, 'id' | 'isRolledBack' | 'createdAt'>): Penalty {
    return db.transaction(() => {
      const id = uuidv4();
      const now = new Date().toISOString();
      const stmt = db.prepare(`
        INSERT INTO penalties (
          id, violation_id, driver_id, points_deducted, fine_amount, 
          is_rolled_back, created_at
        ) VALUES (?, ?, ?, ?, ?, 0, ?)
      `);
      stmt.run(id, data.violationId, data.driverId, data.pointsDeducted, data.fineAmount, now);

      const driver = DriverDAO.getById(data.driverId);
      if (driver) {
        const newRemainingPoints = Math.max(0, driver.remainingPoints - data.pointsDeducted);
        DriverDAO.update(data.driverId, { remainingPoints: newRemainingPoints });
      }

      return this.getByViolationId(data.violationId)!;
    })();
  }

  static rollback(violationId: string, reason: string, operator: string): Penalty | null {
    return db.transaction(() => {
      const penalty = this.getByViolationId(violationId);
      if (!penalty || penalty.isRolledBack) return null;

      const now = new Date().toISOString();
      const stmt = db.prepare(`
        UPDATE penalties 
        SET is_rolled_back = 1, rolled_back_at = ?, rollback_reason = ?
        WHERE violation_id = ?
      `);
      stmt.run(now, reason, violationId);

      const driver = DriverDAO.getById(penalty.driverId);
      if (driver) {
        const newRemainingPoints = Math.min(driver.totalPoints, driver.remainingPoints + penalty.pointsDeducted);
        DriverDAO.update(penalty.driverId, { remainingPoints: newRemainingPoints });
      }

      return this.getByViolationId(violationId) || null;
    })();
  }
}

export default PenaltyDAO;
