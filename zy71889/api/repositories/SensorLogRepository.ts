import { getDb } from '../db/database.js';
import type { SensorLog } from '../../shared/types.js';
import { v4 as uuidv4 } from 'uuid';

export class SensorLogRepository {
  private db = getDb();

  findByBatchId(batchId: string): SensorLog[] {
    const rows = this.db
      .prepare('SELECT * FROM sensor_logs WHERE batch_id = ? ORDER BY timestamp ASC')
      .all(batchId) as any[];
    return rows.map(this.mapRowToSensorLog);
  }

  findById(id: string): SensorLog | null {
    const row = this.db
      .prepare('SELECT * FROM sensor_logs WHERE id = ?')
      .get(id) as any;
    return row ? this.mapRowToSensorLog(row) : null;
  }

  create(data: {
    batchId: string;
    timestamp: string;
    temperature: number | null;
    sphereDiameter: number | null;
    fallTime: number | null;
    fallDistance: number | null;
    rawData: Record<string, any> | null;
  }): SensorLog {
    const id = uuidv4();
    this.db
      .prepare(
        `INSERT INTO sensor_logs (id, batch_id, timestamp, temperature, sphere_diameter, fall_time, fall_distance, raw_data)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        data.batchId,
        data.timestamp,
        data.temperature,
        data.sphereDiameter,
        data.fallTime,
        data.fallDistance,
        data.rawData ? JSON.stringify(data.rawData) : null
      );
    return this.findById(id)!;
  }

  private mapRowToSensorLog(row: any): SensorLog {
    return {
      id: row.id,
      batchId: row.batch_id,
      timestamp: row.timestamp,
      temperature: row.temperature,
      sphereDiameter: row.sphere_diameter,
      fallTime: row.fall_time,
      fallDistance: row.fall_distance,
      rawData: row.raw_data ? JSON.parse(row.raw_data) : null,
    };
  }
}
