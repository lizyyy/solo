import { getDb } from '../database';
import { ChargingSession, ChargeType } from '../types';
import { v4 as uuidv4 } from 'uuid';

export class ChargingSessionRepository {
  private db = getDb();

  create(session: Omit<ChargingSession, 'id'> & { id?: string }): ChargingSession {
    const id = session.id || uuidv4();
    this.db.run(`
      INSERT INTO charging_sessions (id, user_id, station_id, connector_id, charge_type, start_time, end_time, total_requested_kwh, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      session.userId,
      session.stationId,
      session.connectorId,
      session.chargeType,
      session.startTime.toISOString(),
      session.endTime?.toISOString() || null,
      session.totalRequestedKwh,
      session.status,
    ]);
    return { ...session, id };
  }

  findById(id: string): ChargingSession | null {
    const stmt = this.db.prepare('SELECT * FROM charging_sessions WHERE id = ?');
    stmt.bind([id]);
    if (stmt.step()) {
      const row = stmt.getAsObject() as any;
      stmt.free();
      return this.mapRowToSession(row);
    }
    stmt.free();
    return null;
  }

  findByUserId(userId: string): ChargingSession[] {
    const results: ChargingSession[] = [];
    const stmt = this.db.prepare('SELECT * FROM charging_sessions WHERE user_id = ?');
    stmt.bind([userId]);
    while (stmt.step()) {
      const row = stmt.getAsObject() as any;
      results.push(this.mapRowToSession(row));
    }
    stmt.free();
    return results;
  }

  update(session: ChargingSession): void {
    this.db.run(`
      UPDATE charging_sessions
      SET user_id = ?, station_id = ?, connector_id = ?, charge_type = ?, start_time = ?, end_time = ?, total_requested_kwh = ?, status = ?
      WHERE id = ?
    `, [
      session.userId,
      session.stationId,
      session.connectorId,
      session.chargeType,
      session.startTime.toISOString(),
      session.endTime?.toISOString() || null,
      session.totalRequestedKwh,
      session.status,
      session.id,
    ]);
  }

  private mapRowToSession(row: any): ChargingSession {
    return {
      id: row.id,
      userId: row.user_id,
      stationId: row.station_id,
      connectorId: row.connector_id,
      chargeType: row.charge_type as ChargeType,
      startTime: new Date(row.start_time),
      endTime: row.end_time ? new Date(row.end_time) : null,
      totalRequestedKwh: row.total_requested_kwh,
      status: row.status as 'ACTIVE' | 'INTERRUPTED' | 'COMPLETED',
    };
  }
}
