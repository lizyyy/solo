import { db } from '../database';
import { v4 as uuidv4 } from 'uuid';
import { ViolationFragment, ViolationStatus, OperationSource, ConflictInfo, ReviewHistory } from '../types';

const rowToFragment = (row: any): ViolationFragment => ({
  id: row.id,
  roomId: row.room_id,
  roomName: row.room_name,
  anchorName: row.anchor_name,
  fragmentStartTime: row.fragment_start_time,
  fragmentEndTime: row.fragment_end_time,
  violationTag: row.violation_tag,
  violationDescription: row.violation_description,
  detectModel: row.detect_model,
  confidence: row.confidence,
  status: row.status as ViolationStatus,
  reviewerId: row.reviewer_id,
  reviewerName: row.reviewer_name,
  reviewComment: row.review_comment,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  hasConflict: !!row.has_conflict,
  conflictInfo: row.conflict_info ? JSON.parse(row.conflict_info) : undefined,
});

const rowToHistory = (row: any): ReviewHistory => ({
  id: row.id,
  fragmentId: row.fragment_id,
  operationType: row.operation_type,
  operationSource: row.operation_source as OperationSource,
  operatorId: row.operator_id,
  operatorName: row.operator_name,
  oldStatus: row.old_status as ViolationStatus,
  newStatus: row.new_status as ViolationStatus,
  comment: row.comment,
  changedFields: row.changed_fields,
  createdAt: row.created_at,
});

const runQuery = (sql: string, params: any[] = []): Promise<any> => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

const getQuery = (sql: string, params: any[] = []): Promise<any> => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const allQuery = (sql: string, params: any[] = []): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const detectConflict = async (
  roomId: string,
  startTime: number,
  endTime: number,
  excludeId?: string
): Promise<ConflictInfo | null> => {
  const overlapThreshold = 3000;
  const rows = await allQuery(
    `SELECT id, detect_model, violation_tag, confidence
     FROM violation_fragments
     WHERE room_id = ?
       AND id != ?
       AND fragment_start_time < ?
       AND fragment_end_time > ?`,
    [roomId, excludeId || '', endTime - overlapThreshold, startTime + overlapThreshold]
  );

  if (rows.length === 0) return null;

  return {
    type: 'multiple_model_conflict',
    reason: `该片段与 ${rows.length} 条其他模型检测结果时间重叠，可能存在多模型重复告警`,
    overlappingRecords: rows.map((r: any) => ({
      id: r.id,
      detectModel: r.detect_model,
      violationTag: r.violation_tag,
      confidence: r.confidence,
    })),
  };
};

const addHistory = async (
  fragmentId: string,
  operationType: string,
  source: OperationSource,
  operatorId: string,
  operatorName: string,
  oldStatus?: ViolationStatus,
  newStatus?: ViolationStatus,
  comment?: string,
  changedFields?: string
) => {
  await runQuery(
    `INSERT INTO review_history (id, fragment_id, operation_type, operation_source, operator_id, operator_name, old_status, new_status, comment, changed_fields, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uuidv4(),
      fragmentId,
      operationType,
      source,
      operatorId,
      operatorName,
      oldStatus,
      newStatus,
      comment,
      changedFields,
      Date.now(),
    ]
  );
};

export const createFragment = async (
  data: Omit<ViolationFragment, 'id' | 'createdAt' | 'updatedAt' | 'hasConflict' | 'conflictInfo' | 'status' | 'reviewerId' | 'reviewerName' | 'reviewComment'>,
  operatorId: string,
  operatorName: string,
  source: OperationSource = 'api'
): Promise<ViolationFragment> => {
  const id = uuidv4();
  const now = Date.now();
  const status: ViolationStatus = 'pending';

  const conflict = await detectConflict(data.roomId, data.fragmentStartTime, data.fragmentEndTime, id);

  await runQuery(
    `INSERT INTO violation_fragments (
      id, room_id, room_name, anchor_name, fragment_start_time, fragment_end_time,
      violation_tag, violation_description, detect_model, confidence, status,
      created_at, updated_at, has_conflict, conflict_info
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.roomId,
      data.roomName,
      data.anchorName,
      data.fragmentStartTime,
      data.fragmentEndTime,
      data.violationTag,
      data.violationDescription,
      data.detectModel,
      data.confidence,
      status,
      now,
      now,
      conflict ? 1 : 0,
      conflict ? JSON.stringify(conflict) : null,
    ]
  );

  await addHistory(id, 'create', source, operatorId, operatorName, undefined, status, '创建违规片段记录');

  return getFragmentById(id) as Promise<ViolationFragment>;
};

export const getFragmentById = async (id: string): Promise<ViolationFragment | undefined> => {
  const row = await getQuery('SELECT * FROM violation_fragments WHERE id = ?', [id]);
  return row ? rowToFragment(row) : undefined;
};

export const listFragments = async (params: {
  status?: ViolationStatus;
  roomId?: string;
  hasConflict?: boolean;
  page?: number;
  pageSize?: number;
}): Promise<{ data: ViolationFragment[]; total: number }> => {
  const { status, roomId, hasConflict, page = 1, pageSize = 20 } = params;
  let whereConditions: string[] = [];
  let queryParams: any[] = [];

  if (status) {
    whereConditions.push('status = ?');
    queryParams.push(status);
  }
  if (roomId) {
    whereConditions.push('room_id = ?');
    queryParams.push(roomId);
  }
  if (hasConflict !== undefined) {
    whereConditions.push('has_conflict = ?');
    queryParams.push(hasConflict ? 1 : 0);
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

  const countRow: any = await getQuery(
    `SELECT COUNT(*) as total FROM violation_fragments ${whereClause}`,
    queryParams
  );

  const offset = (page - 1) * pageSize;
  const rows = await allQuery(
    `SELECT * FROM violation_fragments ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...queryParams, pageSize, offset]
  );

  return {
    data: rows.map(rowToFragment),
    total: countRow.total,
  };
};

export const updateStatus = async (
  id: string,
  newStatus: ViolationStatus,
  operatorId: string,
  operatorName: string,
  source: OperationSource = 'manual',
  comment?: string
): Promise<ViolationFragment> => {
  const fragment = await getFragmentById(id);
  if (!fragment) throw new Error('Fragment not found');

  const now = Date.now();

  await runQuery(
    `UPDATE violation_fragments
     SET status = ?, reviewer_id = ?, reviewer_name = ?, review_comment = ?, updated_at = ?
     WHERE id = ?`,
    [newStatus, operatorId, operatorName, comment, now, id]
  );

  await addHistory(
    id,
    'status_change',
    source,
    operatorId,
    operatorName,
    fragment.status,
    newStatus,
    comment,
    JSON.stringify({ status: { old: fragment.status, new: newStatus } })
  );

  return getFragmentById(id) as Promise<ViolationFragment>;
};

export const getFragmentHistory = async (fragmentId: string): Promise<ReviewHistory[]> => {
  const rows = await allQuery(
    'SELECT * FROM review_history WHERE fragment_id = ? ORDER BY created_at DESC',
    [fragmentId]
  );
  return rows.map(rowToHistory);
};

export const exportFragments = async (params: {
  status?: ViolationStatus;
  roomId?: string;
}): Promise<ViolationFragment[]> => {
  let whereConditions: string[] = [];
  let queryParams: any[] = [];

  if (params.status) {
    whereConditions.push('status = ?');
    queryParams.push(params.status);
  }
  if (params.roomId) {
    whereConditions.push('room_id = ?');
    queryParams.push(params.roomId);
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
  const rows = await allQuery(
    `SELECT * FROM violation_fragments ${whereClause} ORDER BY created_at DESC`,
    queryParams
  );

  return rows.map(rowToFragment);
};

export const batchImport = async (
  records: any[],
  operatorId: string,
  operatorName: string
): Promise<{ successIds: string[]; failed: { index: number; error: string; data: any }[] }> => {
  const successIds: string[] = [];
  const failed: { index: number; error: string; data: any }[] = [];

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    try {
      if (!record.roomId || !record.roomName || !record.anchorName) {
        throw new Error('缺少直播间或主播信息');
      }
      if (!record.fragmentStartTime || !record.fragmentEndTime) {
        throw new Error('缺少片段时间信息');
      }
      if (!record.violationTag || !record.detectModel) {
        throw new Error('缺少违规标签或检测模型信息');
      }
      if (record.fragmentStartTime >= record.fragmentEndTime) {
        throw new Error('片段开始时间不能晚于结束时间');
      }

      const fragment = await createFragment(
        {
          roomId: record.roomId,
          roomName: record.roomName,
          anchorName: record.anchorName,
          fragmentStartTime: record.fragmentStartTime,
          fragmentEndTime: record.fragmentEndTime,
          violationTag: record.violationTag,
          violationDescription: record.violationDescription,
          detectModel: record.detectModel,
          confidence: record.confidence || 0.8,
        },
        operatorId,
        operatorName,
        'import'
      );
      successIds.push(fragment.id);
    } catch (e: any) {
      failed.push({ index: i, error: e.message, data: record });
    }
  }

  return { successIds, failed };
};
