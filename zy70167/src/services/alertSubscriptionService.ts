import { v4 as uuidv4 } from 'uuid';
import moment from 'moment';
import db from '../database/init';
import { AlertSubscription, AlertSubscriptionStatus } from '../types';
import { getRuleVersionById } from './ruleVersionService';
import { logOperation } from './operationLogService';

export interface CreateSubscriptionRequest {
  ruleVersionId: string;
  subscriberId: string;
  subscriberName: string;
  email: string;
  operator: string;
}

export interface UpdateSubscriptionRequest {
  email?: string;
  subscriberName?: string;
  operator: string;
}

function mapRowToSubscription(row: {
  id: string;
  rule_version_id: string;
  subscriber_id: string;
  subscriber_name: string;
  email: string;
  status: string;
  created_at: string;
  last_notified_at?: string;
  error_message?: string;
}): AlertSubscription {
  return {
    id: row.id,
    ruleVersionId: row.rule_version_id,
    subscriberId: row.subscriber_id,
    subscriberName: row.subscriber_name,
    email: row.email,
    status: row.status as AlertSubscriptionStatus,
    createdAt: row.created_at,
    lastNotifiedAt: row.last_notified_at,
    errorMessage: row.error_message,
  };
}

export async function createSubscription(
  request: CreateSubscriptionRequest
): Promise<AlertSubscription> {
  const ruleVersion = await getRuleVersionById(request.ruleVersionId);
  if (!ruleVersion) {
    throw new Error(`规则版本不存在: ${request.ruleVersionId}`);
  }

  if (ruleVersion.status !== 'PUBLISHED') {
    throw new Error(
      `仅已发布的规则可以创建告警订阅。当前规则状态: ${ruleVersion.status}`
    );
  }

  const existing = await getSubscriptionBySubscriber(
    request.ruleVersionId,
    request.subscriberId
  );
  if (existing) {
    if (existing.status === 'ACTIVE') {
      throw new Error(`订阅者 ${request.subscriberId} 已订阅该规则版本`);
    }
    return reactivateSubscription(existing.id, request.operator);
  }

  const now = moment().toISOString();
  const id = uuidv4();

  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO alert_subscriptions (
        id, rule_version_id, subscriber_id, subscriber_name, email, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        request.ruleVersionId,
        request.subscriberId,
        request.subscriberName,
        request.email,
        'ACTIVE',
        now,
      ],
      async (err) => {
        if (err) {
          if ((err as { code?: string })?.code === 'SQLITE_CONSTRAINT') {
            return reject(new Error(`订阅者 ${request.subscriberId} 已订阅该规则版本`));
          }
          return reject(err);
        }

        await logOperation(
          'SUBSCRIBE',
          'AlertSubscription',
          id,
          `创建告警订阅 - 订阅者: ${request.subscriberName}`,
          request.operator,
          {
            toStatus: 'ACTIVE',
            metadata: {
              ruleId: ruleVersion.ruleId,
              ruleVersion: ruleVersion.version,
              subscriberId: request.subscriberId,
              email: request.email,
            },
          }
        );

        db.get(`SELECT * FROM alert_subscriptions WHERE id = ?`, [id], (queryErr, row) => {
          if (queryErr) return reject(queryErr);
          if (!row) return reject(new Error('创建失败'));
          resolve(mapRowToSubscription(row as never));
        });
      }
    );
  });
}

export async function getSubscriptionById(
  id: string
): Promise<AlertSubscription | null> {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM alert_subscriptions WHERE id = ?`, [id], (err, row) => {
      if (err) return reject(err);
      if (!row) return resolve(null);
      resolve(mapRowToSubscription(row as never));
    });
  });
}

export async function getSubscriptionBySubscriber(
  ruleVersionId: string,
  subscriberId: string
): Promise<AlertSubscription | null> {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM alert_subscriptions WHERE rule_version_id = ? AND subscriber_id = ?`,
      [ruleVersionId, subscriberId],
      (err, row) => {
        if (err) return reject(err);
        if (!row) return resolve(null);
        resolve(mapRowToSubscription(row as never));
      }
    );
  });
}

export async function listSubscriptionsByRuleVersion(
  ruleVersionId: string,
  options?: {
    page?: number;
    pageSize?: number;
    status?: AlertSubscriptionStatus;
  }
): Promise<{ subscriptions: AlertSubscription[]; total: number }> {
  const page = options?.page || 1;
  const pageSize = options?.pageSize || 20;
  const offset = (page - 1) * pageSize;

  const conditions: string[] = ['rule_version_id = ?'];
  const params: (string | number)[] = [ruleVersionId];

  if (options?.status) {
    conditions.push('status = ?');
    params.push(options.status);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.get<{ total: number }>(
        `SELECT COUNT(*) as total FROM alert_subscriptions ${whereClause}`,
        params,
        (err, countResult) => {
          if (err) return reject(err);

          const listParams = [...params, pageSize, offset];
          db.all(
            `SELECT * FROM alert_subscriptions ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            listParams,
            (queryErr, rows) => {
              if (queryErr) return reject(queryErr);
              const subscriptions = (rows as never[]).map((row) => mapRowToSubscription(row));
              resolve({
                subscriptions,
                total: countResult?.total || 0,
              });
            }
          );
        }
      );
    });
  });
}

export async function updateSubscription(
  id: string,
  request: UpdateSubscriptionRequest
): Promise<AlertSubscription> {
  const existing = await getSubscriptionById(id);
  if (!existing) {
    throw new Error(`订阅不存在: ${id}`);
  }

  const updates: string[] = [];
  const params: (string | number)[] = [];

  if (request.email) {
    updates.push('email = ?');
    params.push(request.email);
  }
  if (request.subscriberName) {
    updates.push('subscriber_name = ?');
    params.push(request.subscriberName);
  }

  if (updates.length === 0) {
    return existing;
  }

  params.push(id);

  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE alert_subscriptions SET ${updates.join(', ')} WHERE id = ?`,
      params,
      async (err) => {
        if (err) return reject(err);

        await logOperation(
          'UPDATE',
          'AlertSubscription',
          id,
          `更新告警订阅信息`,
          request.operator
        );

        const updated = await getSubscriptionById(id);
        if (!updated) return reject(new Error('更新失败'));
        resolve(updated);
      }
    );
  });
}

export async function cancelSubscription(
  id: string,
  operator: string
): Promise<AlertSubscription> {
  const existing = await getSubscriptionById(id);
  if (!existing) {
    throw new Error(`订阅不存在: ${id}`);
  }

  if (existing.status !== 'ACTIVE') {
    throw new Error(`订阅状态不是 ACTIVE，当前状态: ${existing.status}`);
  }

  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE alert_subscriptions SET status = ? WHERE id = ?`,
      ['INACTIVE', id],
      async (err) => {
        if (err) return reject(err);

        await logOperation(
          'UNSUBSCRIBE',
          'AlertSubscription',
          id,
          `取消告警订阅`,
          operator,
          {
            fromStatus: 'ACTIVE',
            toStatus: 'INACTIVE',
            metadata: { subscriberName: existing.subscriberName },
          }
        );

        const updated = await getSubscriptionById(id);
        if (!updated) return reject(new Error('操作失败'));
        resolve(updated);
      }
    );
  });
}

export async function reactivateSubscription(
  id: string,
  operator: string
): Promise<AlertSubscription> {
  const existing = await getSubscriptionById(id);
  if (!existing) {
    throw new Error(`订阅不存在: ${id}`);
  }

  if (existing.status === 'ACTIVE') {
    throw new Error('订阅已是激活状态');
  }

  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE alert_subscriptions SET status = ? WHERE id = ?`,
      ['ACTIVE', id],
      async (err) => {
        if (err) return reject(err);

        await logOperation(
          'SUBSCRIBE',
          'AlertSubscription',
          id,
          `重新激活告警订阅`,
          operator,
          {
            fromStatus: existing.status,
            toStatus: 'ACTIVE',
            metadata: { subscriberName: existing.subscriberName },
          }
        );

        const updated = await getSubscriptionById(id);
        if (!updated) return reject(new Error('操作失败'));
        resolve(updated);
      }
    );
  });
}

export async function recordNotificationSuccess(
  id: string
): Promise<AlertSubscription> {
  const existing = await getSubscriptionById(id);
  if (!existing) {
    throw new Error(`订阅不存在: ${id}`);
  }

  const now = moment().toISOString();

  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE alert_subscriptions SET status = ?, last_notified_at = ?, error_message = ? WHERE id = ?`,
      ['ACTIVE', now, null, id],
      async (err) => {
        if (err) return reject(err);

        const updated = await getSubscriptionById(id);
        if (!updated) return reject(new Error('操作失败'));
        resolve(updated);
      }
    );
  });
}

export async function recordNotificationError(
  id: string,
  errorMessage: string
): Promise<AlertSubscription> {
  const existing = await getSubscriptionById(id);
  if (!existing) {
    throw new Error(`订阅不存在: ${id}`);
  }

  const now = moment().toISOString();

  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE alert_subscriptions SET status = ?, error_message = ?, last_notified_at = ? WHERE id = ?`,
      ['ERROR', errorMessage, now, id],
      async (err) => {
        if (err) return reject(err);

        const updated = await getSubscriptionById(id);
        if (!updated) return reject(new Error('操作失败'));
        resolve(updated);
      }
    );
  });
}
