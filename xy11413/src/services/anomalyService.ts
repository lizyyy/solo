import { runQuery, runInsert, runUpdate } from '../database/connection';
import { TABLES } from '../database/schema';
import { AnomalyType, AnomalySeverity } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface AnomalyRecord {
  anomaly_id: string;
  task_id: string;
  anomaly_type: string;
  severity: string;
  description: string;
  related_fact_ids?: string;
  status: string;
  resolution?: string;
  resolved_by?: string;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
}

export const createAnomaly = async (
  taskId: string,
  anomalyType: AnomalyType,
  severity: AnomalySeverity,
  description: string,
  relatedFactIds: string[] = []
): Promise<string> => {
  const anomalyId = `anomaly_${uuidv4().slice(0, 24)}`;
  await runInsert(
    `INSERT INTO ${TABLES.ANOMALY_RECORDS} (
      anomaly_id, task_id, anomaly_type, severity, description, related_fact_ids, status
    ) VALUES (?, ?, ?, ?, ?, ?, 'open')`,
    [
      anomalyId,
      taskId,
      anomalyType,
      severity,
      description,
      relatedFactIds.join(',')
    ]
  );
  return anomalyId;
};

export const getAnomaliesByTaskId = async (taskId: string): Promise<AnomalyRecord[]> => {
  return await runQuery<AnomalyRecord>(
    `SELECT * FROM ${TABLES.ANOMALY_RECORDS} WHERE task_id = ? ORDER BY created_at DESC`,
    [taskId]
  );
};

export const getOpenAnomalies = async (): Promise<AnomalyRecord[]> => {
  return await runQuery<AnomalyRecord>(
    `SELECT * FROM ${TABLES.ANOMALY_RECORDS} WHERE status = 'open' ORDER BY severity DESC, created_at DESC`
  );
};

export const resolveAnomaly = async (
  anomalyId: string,
  resolution: string,
  resolvedBy: string
): Promise<boolean> => {
  const changes = await runUpdate(
    `UPDATE ${TABLES.ANOMALY_RECORDS} 
     SET status = 'resolved', resolution = ?, resolved_by = ?, resolved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE anomaly_id = ?`,
    [resolution, resolvedBy, anomalyId]
  );
  return changes > 0;
};
