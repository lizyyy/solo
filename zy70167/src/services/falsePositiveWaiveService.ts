import { v4 as uuidv4 } from 'uuid';
import moment from 'moment';
import db from '../database/init';
import { FalsePositiveWaive } from '../types';
import { getRuleVersionById } from './ruleVersionService';
import { getBatchById } from './batchRecalculationService';
import { logOperation } from './operationLogService';

export interface CreateWaiveRequest {
  ruleVersionId: string;
  batchId: string;
  reason: string;
  waivedBy: string;
  affectedRows?: number;
}

function mapRowToWaive(row: {
  id: string;
  rule_version_id: string;
  batch_id: string;
  reason: string;
  waived_by: string;
  waived_at: string;
  affected_rows: number;
}): FalsePositiveWaive {
  return {
    id: row.id,
    ruleVersionId: row.rule_version_id,
    batchId: row.batch_id,
    reason: row.reason,
    waivedBy: row.waived_by,
    waivedAt: row.waived_at,
    affectedRows: row.affected_rows,
  };
}

export async function createFalsePositiveWaive(
  request: CreateWaiveRequest
): Promise<FalsePositiveWaive> {
  const ruleVersion = await getRuleVersionById(request.ruleVersionId);
  if (!ruleVersion) {
    throw new Error(`规则版本不存在: ${request.ruleVersionId}`);
  }

  const batch = await getBatchById(request.batchId);
  if (!batch) {
    throw new Error(`批次不存在: ${request.batchId}`);
  }

  if (batch.ruleVersionId !== request.ruleVersionId) {
    throw new Error(`批次不属于该规则版本`);
  }

  if (batch.status !== 'SUCCESS') {
    throw new Error(`仅成功完成的批次可以申请误报豁免。当前批次状态: ${batch.status}`);
  }

  if (!request.reason || request.reason.trim().length === 0) {
    throw new Error('误报豁免原因不能为空');
  }

  const now = moment().toISOString();
  const id = uuidv4();
  const affectedRows = request.affectedRows || 0;

  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO false_positive_waives (
        id, rule_version_id, batch_id, reason, waived_by, waived_at, affected_rows
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        request.ruleVersionId,
        request.batchId,
        request.reason,
        request.waivedBy,
        now,
        affectedRows,
      ],
      async (err) => {
        if (err) return reject(err);

        await logOperation(
          'WAIVE',
          'FalsePositiveWaive',
          id,
          `误报豁免 - 批次日期: ${batch.batchDate}, 影响行数: ${affectedRows}, 原因: ${request.reason}`,
          request.waivedBy,
          {
            metadata: {
              ruleId: ruleVersion.ruleId,
              ruleVersion: ruleVersion.version,
              batchDate: batch.batchDate,
              affectedRows,
              reason: request.reason,
            },
          }
        );

        db.get(`SELECT * FROM false_positive_waives WHERE id = ?`, [id], (queryErr, row) => {
          if (queryErr) return reject(queryErr);
          if (!row) return reject(new Error('创建失败'));
          resolve(mapRowToWaive(row as never));
        });
      }
    );
  });
}

export async function getWaiveById(id: string): Promise<FalsePositiveWaive | null> {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM false_positive_waives WHERE id = ?`, [id], (err, row) => {
      if (err) return reject(err);
      if (!row) return resolve(null);
      resolve(mapRowToWaive(row as never));
    });
  });
}

export async function listWaivesByRuleVersion(
  ruleVersionId: string,
  options?: {
    page?: number;
    pageSize?: number;
  }
): Promise<{ waives: FalsePositiveWaive[]; total: number }> {
  const page = options?.page || 1;
  const pageSize = options?.pageSize || 20;
  const offset = (page - 1) * pageSize;

  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.get<{ total: number }>(
        `SELECT COUNT(*) as total FROM false_positive_waives WHERE rule_version_id = ?`,
        [ruleVersionId],
        (err, countResult) => {
          if (err) return reject(err);

          db.all(
            `SELECT * FROM false_positive_waives WHERE rule_version_id = ? ORDER BY waived_at DESC LIMIT ? OFFSET ?`,
            [ruleVersionId, pageSize, offset],
            (queryErr, rows) => {
              if (queryErr) return reject(queryErr);
              const waives = (rows as never[]).map((row) => mapRowToWaive(row));
              resolve({
                waives,
                total: countResult?.total || 0,
              });
            }
          );
        }
      );
    });
  });
}

export async function listWaivesByBatch(
  batchId: string
): Promise<FalsePositiveWaive[]> {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM false_positive_waives WHERE batch_id = ? ORDER BY waived_at DESC`,
      [batchId],
      (err, rows) => {
        if (err) return reject(err);
        const waives = (rows as never[]).map((row) => mapRowToWaive(row));
        resolve(waives);
      }
    );
  });
}
