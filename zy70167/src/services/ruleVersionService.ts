import { v4 as uuidv4 } from 'uuid';
import moment from 'moment';
import db from '../database/init';
import { RuleVersion, RuleVersionStatus } from '../types';
import {
  validateRuleVersionTransition,
  getStatusDescription,
  getValidTransitions,
} from '../utils/stateMachine';
import { logOperation } from './operationLogService';

export interface CreateRuleVersionRequest {
  ruleId: string;
  ruleName: string;
  content: string;
  description?: string;
  createdBy: string;
}

export interface UpdateRuleVersionRequest {
  ruleName?: string;
  content?: string;
  description?: string;
  updatedBy: string;
}

export interface SubmitApprovalRequest {
  operator: string;
  comment?: string;
}

export interface ApproveRequest {
  operator: string;
  comment?: string;
}

export interface RejectRequest {
  operator: string;
  reason: string;
}

export interface PublishRequest {
  operator: string;
  comment?: string;
}

export interface ArchiveRequest {
  operator: string;
  reason?: string;
}

function mapRowToRuleVersion(row: {
  id: string;
  rule_id: string;
  rule_name: string;
  version: number;
  status: string;
  content: string;
  description?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  approved_by?: string;
  approved_at?: string;
  published_at?: string;
}): RuleVersion {
  return {
    id: row.id,
    ruleId: row.rule_id,
    ruleName: row.rule_name,
    version: row.version,
    status: row.status as RuleVersionStatus,
    content: row.content,
    description: row.description,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    publishedAt: row.published_at,
  };
}

export async function createRuleVersion(
  request: CreateRuleVersionRequest
): Promise<RuleVersion> {
  const now = moment().toISOString();

  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.get<{ max_version: number }>(
        `SELECT MAX(version) as max_version FROM rule_versions WHERE rule_id = ?`,
        [request.ruleId],
        (err, result) => {
          if (err) return reject(err);

          const nextVersion = (result?.max_version || 0) + 1;
          const id = uuidv4();

          db.run(
            `INSERT INTO rule_versions (
              id, rule_id, rule_name, version, status, content, description,
              created_by, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              id,
              request.ruleId,
              request.ruleName,
              nextVersion,
              'DRAFT',
              request.content,
              request.description,
              request.createdBy,
              now,
              now,
            ],
            async (insertErr) => {
              if (insertErr) return reject(insertErr);

              await logOperation(
                'CREATE',
                'RuleVersion',
                id,
                `创建规则版本 v${nextVersion}`,
                request.createdBy,
                {
                  toStatus: 'DRAFT',
                  metadata: {
                    ruleId: request.ruleId,
                    ruleName: request.ruleName,
                    version: nextVersion,
                  },
                }
              );

              db.get(
                `SELECT * FROM rule_versions WHERE id = ?`,
                [id],
                (queryErr, row) => {
                  if (queryErr) return reject(queryErr);
                  if (!row) return reject(new Error('创建失败，未找到记录'));
                  resolve(mapRowToRuleVersion(row as never));
                }
              );
            }
          );
        }
      );
    });
  });
}

export async function getRuleVersionById(id: string): Promise<RuleVersion | null> {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM rule_versions WHERE id = ?`, [id], (err, row) => {
      if (err) return reject(err);
      if (!row) return resolve(null);
      resolve(mapRowToRuleVersion(row as never));
    });
  });
}

export async function getLatestRuleVersion(ruleId: string): Promise<RuleVersion | null> {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM rule_versions WHERE rule_id = ? ORDER BY version DESC LIMIT 1`,
      [ruleId],
      (err, row) => {
        if (err) return reject(err);
        if (!row) return resolve(null);
        resolve(mapRowToRuleVersion(row as never));
      }
    );
  });
}

export async function listRuleVersions(
  ruleId?: string,
  options?: {
    page?: number;
    pageSize?: number;
    status?: RuleVersionStatus;
  }
): Promise<{ versions: RuleVersion[]; total: number }> {
  const page = options?.page || 1;
  const pageSize = options?.pageSize || 20;
  const offset = (page - 1) * pageSize;

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (ruleId) {
    conditions.push('rule_id = ?');
    params.push(ruleId);
  }
  if (options?.status) {
    conditions.push('status = ?');
    params.push(options.status);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.get<{ total: number }>(
        `SELECT COUNT(*) as total FROM rule_versions ${whereClause}`,
        params,
        (err, countResult) => {
          if (err) return reject(err);

          const listParams = [...params, pageSize, offset];
          db.all(
            `SELECT * FROM rule_versions ${whereClause} ORDER BY version DESC LIMIT ? OFFSET ?`,
            listParams,
            (queryErr, rows) => {
              if (queryErr) return reject(queryErr);
              const versions = (rows as never[]).map((row) => mapRowToRuleVersion(row));
              resolve({
                versions,
                total: countResult?.total || 0,
              });
            }
          );
        }
      );
    });
  });
}

export async function updateRuleVersion(
  id: string,
  request: UpdateRuleVersionRequest
): Promise<RuleVersion> {
  const existing = await getRuleVersionById(id);
  if (!existing) {
    throw new Error(`规则版本不存在: ${id}`);
  }

  if (existing.status !== 'DRAFT' && existing.status !== 'REJECTED') {
    throw new Error(`仅草稿或已拒绝状态可以编辑。当前状态: ${existing.status}`);
  }

  const now = moment().toISOString();
  const updates: string[] = [];
  const params: (string | number)[] = [];

  if (request.ruleName) {
    updates.push('rule_name = ?');
    params.push(request.ruleName);
  }
  if (request.content) {
    updates.push('content = ?');
    params.push(request.content);
  }
  if (request.description !== undefined) {
    updates.push('description = ?');
    params.push(request.description);
  }

  if (updates.length === 0) {
    return existing;
  }

  updates.push('updated_at = ?');
  params.push(now, id);

  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE rule_versions SET ${updates.join(', ')} WHERE id = ?`,
      params,
      async (err) => {
        if (err) return reject(err);

        await logOperation(
          'UPDATE',
          'RuleVersion',
          id,
          `更新规则版本 v${existing.version}`,
          request.updatedBy,
          {
            fromStatus: existing.status,
            toStatus: existing.status,
          }
        );

        const updated = await getRuleVersionById(id);
        if (!updated) return reject(new Error('更新失败'));
        resolve(updated);
      }
    );
  });
}

export async function submitForApproval(
  id: string,
  request: SubmitApprovalRequest
): Promise<RuleVersion> {
  const existing = await getRuleVersionById(id);
  if (!existing) {
    throw new Error(`规则版本不存在: ${id}`);
  }

  const transitionError = validateRuleVersionTransition(
    existing.status,
    'PENDING_APPROVAL'
  );
  if (transitionError) {
    throw new Error(transitionError.message);
  }

  const now = moment().toISOString();

  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE rule_versions SET status = ?, updated_at = ? WHERE id = ?`,
      ['PENDING_APPROVAL', now, id],
      async (err) => {
        if (err) return reject(err);

        await logOperation(
          'SUBMIT',
          'RuleVersion',
          id,
          `提交审批 v${existing.version}${request.comment ? ` - ${request.comment}` : ''}`,
          request.operator,
          {
            fromStatus: existing.status,
            toStatus: 'PENDING_APPROVAL',
            metadata: { comment: request.comment },
          }
        );

        const updated = await getRuleVersionById(id);
        if (!updated) return reject(new Error('操作失败'));
        resolve(updated);
      }
    );
  });
}

export async function approveRuleVersion(
  id: string,
  request: ApproveRequest
): Promise<RuleVersion> {
  const existing = await getRuleVersionById(id);
  if (!existing) {
    throw new Error(`规则版本不存在: ${id}`);
  }

  const transitionError = validateRuleVersionTransition(existing.status, 'APPROVED');
  if (transitionError) {
    throw new Error(transitionError.message);
  }

  const now = moment().toISOString();

  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE rule_versions SET status = ?, updated_at = ?, approved_by = ?, approved_at = ? WHERE id = ?`,
      ['APPROVED', now, request.operator, now, id],
      async (err) => {
        if (err) return reject(err);

        await logOperation(
          'APPROVE',
          'RuleVersion',
          id,
          `审批通过 v${existing.version}${request.comment ? ` - ${request.comment}` : ''}`,
          request.operator,
          {
            fromStatus: existing.status,
            toStatus: 'APPROVED',
            metadata: { comment: request.comment },
          }
        );

        const updated = await getRuleVersionById(id);
        if (!updated) return reject(new Error('操作失败'));
        resolve(updated);
      }
    );
  });
}

export async function rejectRuleVersion(
  id: string,
  request: RejectRequest
): Promise<RuleVersion> {
  const existing = await getRuleVersionById(id);
  if (!existing) {
    throw new Error(`规则版本不存在: ${id}`);
  }

  const transitionError = validateRuleVersionTransition(existing.status, 'REJECTED');
  if (transitionError) {
    throw new Error(transitionError.message);
  }

  const now = moment().toISOString();

  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE rule_versions SET status = ?, updated_at = ? WHERE id = ?`,
      ['REJECTED', now, id],
      async (err) => {
        if (err) return reject(err);

        await logOperation(
          'REJECT',
          'RuleVersion',
          id,
          `审批拒绝 v${existing.version} - ${request.reason}`,
          request.operator,
          {
            fromStatus: existing.status,
            toStatus: 'REJECTED',
            metadata: { reason: request.reason },
          }
        );

        const updated = await getRuleVersionById(id);
        if (!updated) return reject(new Error('操作失败'));
        resolve(updated);
      }
    );
  });
}

export async function publishRuleVersion(
  id: string,
  request: PublishRequest
): Promise<RuleVersion> {
  const existing = await getRuleVersionById(id);
  if (!existing) {
    throw new Error(`规则版本不存在: ${id}`);
  }

  const transitionError = validateRuleVersionTransition(existing.status, 'PUBLISHED');
  if (transitionError) {
    throw new Error(transitionError.message);
  }

  const now = moment().toISOString();

  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE rule_versions SET status = ?, updated_at = ?, published_at = ? WHERE id = ?`,
      ['PUBLISHED', now, now, id],
      async (err) => {
        if (err) return reject(err);

        await logOperation(
          'PUBLISH',
          'RuleVersion',
          id,
          `发布规则 v${existing.version}${request.comment ? ` - ${request.comment}` : ''}`,
          request.operator,
          {
            fromStatus: existing.status,
            toStatus: 'PUBLISHED',
            metadata: { comment: request.comment },
          }
        );

        const updated = await getRuleVersionById(id);
        if (!updated) return reject(new Error('操作失败'));
        resolve(updated);
      }
    );
  });
}

export async function archiveRuleVersion(
  id: string,
  request: ArchiveRequest
): Promise<RuleVersion> {
  const existing = await getRuleVersionById(id);
  if (!existing) {
    throw new Error(`规则版本不存在: ${id}`);
  }

  const transitionError = validateRuleVersionTransition(existing.status, 'ARCHIVED');
  if (transitionError) {
    throw new Error(transitionError.message);
  }

  const now = moment().toISOString();

  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE rule_versions SET status = ?, updated_at = ? WHERE id = ?`,
      ['ARCHIVED', now, id],
      async (err) => {
        if (err) return reject(err);

        await logOperation(
          'ARCHIVE',
          'RuleVersion',
          id,
          `归档规则 v${existing.version}${request.reason ? ` - ${request.reason}` : ''}`,
          request.operator,
          {
            fromStatus: existing.status,
            toStatus: 'ARCHIVED',
            metadata: { reason: request.reason },
          }
        );

        const updated = await getRuleVersionById(id);
        if (!updated) return reject(new Error('操作失败'));
        resolve(updated);
      }
    );
  });
}

export function getRuleVersionStatusInfo(status: RuleVersionStatus) {
  return {
    status,
    description: getStatusDescription(status),
    allowedTransitions: getValidTransitions(status).map((s) => ({
      status: s,
      description: getStatusDescription(s),
    })),
  };
}
