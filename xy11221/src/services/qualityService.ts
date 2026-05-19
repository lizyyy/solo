import { db } from '../models/database';
import { RecordStatus, ReviewSummary, SampleRetention, TemperatureLog, DiscardRecord } from '../models/types';

export class QualityService {
  async verifySampleRetention(id: string, verifiedBy: string): Promise<boolean> {
    const result = await db.run(
      `UPDATE sample_retention SET status = ?, updated_at = ? WHERE id = ?`,
      [RecordStatus.VERIFIED, db.now(), id]
    );
    return (result as any).changes > 0;
  }

  async verifyTemperatureLog(id: string, verifiedBy: string): Promise<boolean> {
    const result = await db.run(
      `UPDATE temperature_log SET status = ?, updated_at = ? WHERE id = ?`,
      [RecordStatus.VERIFIED, db.now(), id]
    );
    return (result as any).changes > 0;
  }

  async verifyDiscardRecord(id: string, verifiedBy: string): Promise<boolean> {
    const result = await db.run(
      `UPDATE discard_record SET status = ?, updated_at = ? WHERE id = ?`,
      [RecordStatus.VERIFIED, db.now(), id]
    );
    return (result as any).changes > 0;
  }

  async batchVerifySampleRetention(ids: string[], verifiedBy: string): Promise<{ success: string[]; failed: string[] }> {
    const success: string[] = [];
    const failed: string[] = [];

    for (const id of ids) {
      try {
        const result = await this.verifySampleRetention(id, verifiedBy);
        if (result) {
          success.push(id);
        } else {
          failed.push(id);
        }
      } catch {
        failed.push(id);
      }
    }

    return { success, failed };
  }

  async batchVerifyTemperatureLog(ids: string[], verifiedBy: string): Promise<{ success: string[]; failed: string[] }> {
    const success: string[] = [];
    const failed: string[] = [];

    for (const id of ids) {
      try {
        const result = await this.verifyTemperatureLog(id, verifiedBy);
        if (result) {
          success.push(id);
        } else {
          failed.push(id);
        }
      } catch {
        failed.push(id);
      }
    }

    return { success, failed };
  }

  async getDailyReviewSummary(date: string): Promise<ReviewSummary> {
    const sampleResult = await db.get(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'verified' THEN 1 ELSE 0 END) as verified,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN discarded_at IS NOT NULL THEN 1 ELSE 0 END) as discarded
      FROM sample_retention 
      WHERE date = ?
    `, [date]);

    const tempResult = await db.get(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN is_normal = 1 THEN 1 ELSE 0 END) as normal,
        SUM(CASE WHEN is_normal = 0 THEN 1 ELSE 0 END) as abnormal,
        SUM(CASE WHEN status = 'verified' THEN 1 ELSE 0 END) as verified
      FROM temperature_log 
      WHERE date = ?
    `, [date]);

    const discardResult = await db.get(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'verified' THEN 1 ELSE 0 END) as verified
      FROM discard_record 
      WHERE date = ?
    `, [date]);

    const issues: string[] = [];

    if (tempResult && tempResult.abnormal > 0) {
      issues.push(`发现 ${tempResult.abnormal} 条温度异常记录，请及时处理`);
    }
    if (sampleResult && sampleResult.pending > 0) {
      issues.push(`有 ${sampleResult.pending} 条留样记录待复核`);
    }
    if (tempResult && tempResult.total > 0 && tempResult.verified < tempResult.total) {
      issues.push(`有 ${tempResult.total - tempResult.verified} 条温度记录待复核`);
    }

    return {
      date,
      sampleRetention: {
        total: sampleResult?.total || 0,
        verified: sampleResult?.verified || 0,
        pending: sampleResult?.pending || 0,
        discarded: sampleResult?.discarded || 0
      },
      temperature: {
        total: tempResult?.total || 0,
        normal: tempResult?.normal || 0,
        abnormal: tempResult?.abnormal || 0,
        verified: tempResult?.verified || 0
      },
      discard: {
        total: discardResult?.total || 0,
        verified: discardResult?.verified || 0
      },
      issues
    };
  }

  async getPendingRecords(): Promise<{ samples: SampleRetention[]; temperatures: TemperatureLog[]; discards: DiscardRecord[] }> {
    const samples = await db.all(`SELECT * FROM sample_retention WHERE status = ?`, [RecordStatus.PENDING]);
    const temperatures = await db.all(`SELECT * FROM temperature_log WHERE status = ?`, [RecordStatus.PENDING]);
    const discards = await db.all(`SELECT * FROM discard_record WHERE status = ?`, [RecordStatus.PENDING]);

    return {
      samples: samples.map(this.mapSampleRetention),
      temperatures: temperatures.map(this.mapTemperatureLog),
      discards: discards.map(this.mapDiscardRecord)
    };
  }

  async getFailedRecords(importId?: string): Promise<any[]> {
    let sql = `SELECT * FROM failed_record WHERE is_resolved = 0`;
    const params: string[] = [];
    
    if (importId) {
      sql += ` AND import_id = ?`;
      params.push(importId);
    }
    
    return await db.all(sql, params);
  }

  private mapSampleRetention(row: any): SampleRetention {
    return {
      id: row.id,
      date: row.date,
      dishName: row.dish_name,
      dishType: row.dish_type,
      quantity: row.quantity,
      reservedBy: row.reserved_by,
      reservedAt: row.reserved_at,
      storageLocation: row.storage_location,
      discardDate: row.discard_date,
      discardedBy: row.discarded_by,
      discardedAt: row.discarded_at,
      status: row.status,
      remarks: row.remarks,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapTemperatureLog(row: any): TemperatureLog {
    return {
      id: row.id,
      date: row.date,
      refrigeratorId: row.refrigerator_id,
      refrigeratorName: row.refrigerator_name,
      temperature: row.temperature,
      minTemperature: row.min_temperature,
      maxTemperature: row.max_temperature,
      measuredBy: row.measured_by,
      measuredAt: row.measured_at,
      isNormal: row.is_normal === 1,
      status: row.status,
      remarks: row.remarks,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapDiscardRecord(row: any): DiscardRecord {
    return {
      id: row.id,
      date: row.date,
      itemName: row.item_name,
      itemType: row.item_type,
      quantity: row.quantity,
      unit: row.unit,
      discardReason: row.discard_reason,
      discardedBy: row.discarded_by,
      discardedAt: row.discarded_at,
      status: row.status,
      remarks: row.remarks,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export const qualityService = new QualityService();