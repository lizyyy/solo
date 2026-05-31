import { getDb } from '../db/database.js';
import type { ViscosityEstimate, JudgmentStep } from '../../shared/types.js';
import { v4 as uuidv4 } from 'uuid';

export class ViscosityEstimateRepository {
  private db = getDb();

  findByBatchId(batchId: string): ViscosityEstimate[] {
    const rows = this.db
      .prepare('SELECT * FROM viscosity_estimates WHERE batch_id = ? ORDER BY timestamp ASC')
      .all(batchId) as any[];
    return rows.map(this.mapRowToViscosityEstimate);
  }

  findById(id: string): ViscosityEstimate | null {
    const row = this.db
      .prepare('SELECT * FROM viscosity_estimates WHERE id = ?')
      .get(id) as any;
    return row ? this.mapRowToViscosityEstimate(row) : null;
  }

  create(data: {
    batchId: string;
    timestamp: string;
    viscosity: number | null;
    unit: string;
    judgment: ViscosityEstimate['judgment'];
    judgmentReason: string;
    judgmentSteps: JudgmentStep[];
    nextSteps: string[];
    rawCalculation: Record<string, any>;
    algorithmVersion: string;
  }): ViscosityEstimate {
    const id = uuidv4();
    this.db
      .prepare(
        `INSERT INTO viscosity_estimates (id, batch_id, timestamp, viscosity, unit, judgment, judgment_reason, judgment_steps, next_steps, raw_calculation, algorithm_version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        data.batchId,
        data.timestamp,
        data.viscosity,
        data.unit,
        data.judgment,
        data.judgmentReason,
        JSON.stringify(data.judgmentSteps),
        JSON.stringify(data.nextSteps),
        JSON.stringify(data.rawCalculation),
        data.algorithmVersion
      );
    return this.findById(id)!;
  }

  private mapRowToViscosityEstimate(row: any): ViscosityEstimate {
    return {
      id: row.id,
      batchId: row.batch_id,
      timestamp: row.timestamp,
      viscosity: row.viscosity,
      unit: row.unit,
      judgment: row.judgment,
      judgmentReason: row.judgment_reason,
      judgmentSteps: JSON.parse(row.judgment_steps),
      nextSteps: JSON.parse(row.next_steps),
      rawCalculation: JSON.parse(row.raw_calculation),
      algorithmVersion: row.algorithm_version,
    };
  }
}
