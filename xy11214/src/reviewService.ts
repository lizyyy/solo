import { format } from 'date-fns';
import { run, all, get, InspectionRecord, SensorAlert, BatchResult } from './database';

export async function getPendingReviews(): Promise<InspectionRecord[]> {
  return all<InspectionRecord>(`
    SELECT * FROM inspection_records 
    WHERE reviewStatus = 'pending'
    ORDER BY inspectionDate DESC
  `);
}

export async function getInspectionById(id: number): Promise<InspectionRecord | undefined> {
  return get<InspectionRecord>('SELECT * FROM inspection_records WHERE id = ?', [id]);
}

export async function reviewInspection(id: number, reviewedBy: string, newStatus?: InspectionRecord['reviewStatus'], remarks?: string): Promise<boolean> {
  const record = await getInspectionById(id);
  if (!record) return false;

  const reviewStatus = newStatus || 'reviewed';
  const now = format(new Date(), 'yyyy-MM-dd HH:mm:ss');

  const result = await run(`
    UPDATE inspection_records 
    SET reviewStatus = ?, reviewedBy = ?, reviewedAt = ?, remarks = COALESCE(?, remarks), updatedAt = ?
    WHERE id = ?
  `, [reviewStatus, reviewedBy, now, remarks || null, now, id]);
  return result.changes > 0;
}

export async function batchReview(ids: number[], reviewedBy: string, newStatus?: InspectionRecord['reviewStatus']): Promise<BatchResult<number>> {
  const success: number[] = [];
  const failed: BatchResult<number>['failed'] = [];

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    try {
      const result = await reviewInspection(id, reviewedBy, newStatus);
      if (result) {
        success.push(id);
      } else {
        failed.push({
          rowNumber: i + 1,
          data: id,
          error: '记录不存在',
          suggestion: '请检查ID是否正确'
        });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '复核失败';
      failed.push({
        rowNumber: i + 1,
        data: id,
        error: errorMsg,
        suggestion: '请重试或检查数据库连接'
      });
    }
  }

  return { success, failed };
}

export async function getUnacknowledgedAlerts(): Promise<SensorAlert[]> {
  return all<SensorAlert>(`
    SELECT * FROM sensor_alerts 
    WHERE isAcknowledged = 0
    ORDER BY alertTime DESC
  `);
}

export async function acknowledgeAlert(id: number, acknowledgedBy: string): Promise<boolean> {
  const now = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
  const result = await run(`
    UPDATE sensor_alerts 
    SET isAcknowledged = 1, acknowledgedBy = ?, acknowledgedAt = ?
    WHERE id = ?
  `, [acknowledgedBy, now, id]);
  return result.changes > 0;
}

export async function batchAcknowledgeAlerts(ids: number[], acknowledgedBy: string): Promise<BatchResult<number>> {
  const success: number[] = [];
  const failed: BatchResult<number>['failed'] = [];

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    try {
      const result = await acknowledgeAlert(id, acknowledgedBy);
      if (result) {
        success.push(id);
      } else {
        failed.push({
          rowNumber: i + 1,
          data: id,
          error: '告警不存在',
          suggestion: '请检查ID是否正确'
        });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '确认失败';
      failed.push({
        rowNumber: i + 1,
        data: id,
        error: errorMsg,
        suggestion: '请重试或检查数据库连接'
      });
    }
  }

  return { success, failed };
}

export async function getAllInspections(status?: InspectionRecord['status'], reviewStatus?: InspectionRecord['reviewStatus']): Promise<InspectionRecord[]> {
  let query = 'SELECT * FROM inspection_records';
  const conditions: string[] = [];
  const params: any[] = [];

  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }
  if (reviewStatus) {
    conditions.push('reviewStatus = ?');
    params.push(reviewStatus);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  query += ' ORDER BY inspectionDate DESC';

  return all<InspectionRecord>(query, params);
}

export async function getAllAlerts(alertLevel?: SensorAlert['alertLevel'], isAcknowledged?: boolean): Promise<SensorAlert[]> {
  let query = 'SELECT * FROM sensor_alerts';
  const conditions: string[] = [];
  const params: any[] = [];

  if (alertLevel) {
    conditions.push('alertLevel = ?');
    params.push(alertLevel);
  }
  if (isAcknowledged !== undefined) {
    conditions.push('isAcknowledged = ?');
    params.push(isAcknowledged ? 1 : 0);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  query += ' ORDER BY alertTime DESC';

  return all<SensorAlert>(query, params);
}
