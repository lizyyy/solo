import type { HitRecord, AccountFreeze, HitStatus } from '../types';
import { runQuery, getQuery, allQuery } from '../db';
import { generateId, now, auditLog, snakeToCamel, snakeToCamelAll } from '../utils';

export const hasActiveFreeze = async (accountId: string): Promise<boolean> => {
  const row = await getQuery(
    `SELECT COUNT(*) as cnt FROM account_freezes 
     WHERE account_id = ? AND status = 'frozen'`,
    [accountId]
  );
  return row.cnt > 0;
};

export const getActiveFreeze = async (accountId: string): Promise<AccountFreeze | null> => {
  const row = await getQuery(
    `SELECT * FROM account_freezes 
     WHERE account_id = ? AND status = 'frozen' 
     ORDER BY created_at DESC LIMIT 1`,
    [accountId]
  );
  return row ? (snakeToCamel(row) as AccountFreeze) : null;
};

export const createHitRecord = async (
  listVersionId: string,
  accountId: string,
  transactionId: string,
  matchReason: string,
  matchScore: number,
  createdBy: string
): Promise<{ hitRecord: HitRecord; freeze: AccountFreeze | null; isRepeatHit: boolean }> => {
  const activeFreeze = await getActiveFreeze(accountId);
  const isRepeatHit = !!activeFreeze;

  const hitId = generateId();
  const createdAt = now();
  
  await runQuery(
    `INSERT INTO hit_records 
     (id, list_version_id, account_id, transaction_id, match_reason, match_score, 
      status, current_block, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'pending_review', 'review', ?, ?, ?)`,
    [hitId, listVersionId, accountId, transactionId, matchReason, matchScore, createdBy, createdAt, createdAt]
  );

  await auditLog(
    'hit_recorded',
    'hit_record',
    hitId,
    createdBy,
    {
      listVersionId,
      accountId,
      transactionId,
      matchReason,
      matchScore,
      isRepeatHit,
      note: isRepeatHit 
        ? '检测到重复命中，账户已存在活跃冻结，本次记录仅留存不重复冻结' 
        : '首次命中，将启动冻结流程'
    }
  );

  let freeze: AccountFreeze | null = null;
  if (!isRepeatHit) {
    const freezeId = generateId();
    const freezeReason = `交易命中反洗钱名单（匹配原因: ${matchReason}，分数: ${matchScore}）`;
    
    await runQuery(
      `INSERT INTO account_freezes 
       (id, hit_record_id, account_id, freeze_reason, status, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'frozen', ?, ?, ?)`,
      [freezeId, hitId, accountId, freezeReason, createdBy, createdAt, createdAt]
    );

    await auditLog(
      'freeze_created',
      'account_freeze',
      freezeId,
      createdBy,
      {
        hitRecordId: hitId,
        accountId,
        freezeReason,
        note: '账户已冻结，等待人工复核'
      }
    );

    freeze = await getFreezeById(freezeId);
  }

  const hitRecord = await getHitRecordById(hitId);
  
  return { hitRecord, freeze, isRepeatHit };
};

export const getHitRecordById = async (id: string): Promise<HitRecord> => {
  const row = await getQuery(`SELECT * FROM hit_records WHERE id = ?`, [id]);
  return snakeToCamel(row) as HitRecord;
};

export const getFreezeById = async (id: string): Promise<AccountFreeze> => {
  const row = await getQuery(`SELECT * FROM account_freezes WHERE id = ?`, [id]);
  return snakeToCamel(row) as AccountFreeze;
};

export const getHitRecordsByAccount = async (accountId: string): Promise<HitRecord[]> => {
  const rows = await allQuery(
    `SELECT * FROM hit_records WHERE account_id = ? ORDER BY created_at DESC`,
    [accountId]
  );
  return snakeToCamelAll(rows) as HitRecord[];
};

export const getFreezesByAccount = async (accountId: string): Promise<AccountFreeze[]> => {
  const rows = await allQuery(
    `SELECT * FROM account_freezes WHERE account_id = ? ORDER BY created_at DESC`,
    [accountId]
  );
  return snakeToCamelAll(rows) as AccountFreeze[];
};

export const getAllHitRecords = async (status?: HitStatus): Promise<HitRecord[]> => {
  let sql = `SELECT * FROM hit_records`;
  const params: any[] = [];
  
  if (status) {
    sql += ` WHERE status = ?`;
    params.push(status);
  }
  sql += ` ORDER BY created_at DESC`;
  
  const rows = await allQuery(sql, params);
  return snakeToCamelAll(rows) as HitRecord[];
};

export const getAllFreezes = async (): Promise<AccountFreeze[]> => {
  const rows = await allQuery(`SELECT * FROM account_freezes ORDER BY created_at DESC`);
  return snakeToCamelAll(rows) as AccountFreeze[];
};

export const getFreezeByHitRecordId = async (hitRecordId: string): Promise<AccountFreeze | null> => {
  const row = await getQuery(
    `SELECT * FROM account_freezes WHERE hit_record_id = ?`,
    [hitRecordId]
  );
  return row ? (snakeToCamel(row) as AccountFreeze) : null;
};

export const updateHitRecordStatus = async (
  hitId: string,
  status: HitStatus,
  currentBlock: string
): Promise<void> => {
  await runQuery(
    `UPDATE hit_records SET status = ?, current_block = ?, updated_at = ? WHERE id = ?`,
    [status, currentBlock, now(), hitId]
  );
};
