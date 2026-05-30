import { GameRecord, Point, RecordStatus, RecordType } from '../types';
import { generateId } from './curveGenerator';

export const createGameRecord = (
  batchId: string,
  gameId: string,
  functionCardId: string,
  playerPosition: Point,
  slope: number,
  isDifferentiable: boolean,
  speed: number,
  status: RecordStatus = 'normal',
  recordType: RecordType = 'normal'
): GameRecord => {
  const now = Date.now();
  const missingFields = detectMissingFields({
    batchId,
    gameId,
    functionCardId,
    playerPosition,
    slope,
    isDifferentiable,
    speed,
  });

  return {
    id: generateId('rec'),
    batchId,
    gameId,
    functionCardId,
    timestamp: now,
    playerPosition: { ...playerPosition },
    slope,
    isDifferentiable,
    speed,
    status: missingFields.length > 0 ? 'pending' : status,
    recordType,
    missingFields,
    notes: '',
    createdAt: now,
    updatedAt: now,
  };
};

export const detectMissingFields = (data: Record<string, unknown>): string[] => {
  const requiredFields = [
    'batchId',
    'gameId',
    'functionCardId',
    'playerPosition',
    'slope',
    'isDifferentiable',
    'speed',
  ];

  const missing: string[] = [];

  requiredFields.forEach(field => {
    const value = data[field];
    if (value === undefined || value === null || value === '') {
      missing.push(field);
    } else if (field === 'playerPosition') {
      const pos = value as Point;
      if (pos.x === undefined || pos.y === undefined || !isFinite(pos.x) || !isFinite(pos.y)) {
        missing.push(field);
      }
    } else if (field === 'slope') {
      if (!isFinite(value as number)) {
        missing.push(field);
      }
    }
  });

  return missing;
};

export const createLateRecord = (
  originalRecord: GameRecord,
  updatedData: Partial<GameRecord>
): GameRecord => {
  const now = Date.now();
  return {
    ...originalRecord,
    ...updatedData,
    recordType: 'late',
    missingFields: detectMissingFields({
      ...originalRecord,
      ...updatedData,
    }),
    updatedAt: now,
  };
};

export const markRecordAsWithdrawn = (record: GameRecord): GameRecord => {
  return {
    ...record,
    recordType: 'withdrawn',
    status: 'exception',
    notes: record.notes ? `${record.notes}\n[撤回] ${new Date().toISOString()}` : `[撤回] ${new Date().toISOString()}`,
    updatedAt: Date.now(),
  };
};

export const markRecordAsDuplicate = (
  record: GameRecord,
  originalRecordId: string
): GameRecord => {
  return {
    ...record,
    recordType: 'duplicate',
    status: 'pending',
    notes: record.notes
      ? `${record.notes}\n[重复] 原始记录ID: ${originalRecordId}`
      : `[重复] 原始记录ID: ${originalRecordId}`,
    updatedAt: Date.now(),
  };
};

export const updateRecordNotes = (
  record: GameRecord,
  notes: string
): GameRecord => {
  const now = Date.now();
  return {
    ...record,
    notes: record.notes ? `${record.notes}\n[修改] ${now}: ${notes}` : `[备注] ${now}: ${notes}`,
    updatedAt: now,
  };
};

export const confirmRecord = (record: GameRecord): GameRecord => {
  return {
    ...record,
    status: 'normal',
    updatedAt: Date.now(),
  };
};

export const findDuplicateRecords = (
  records: GameRecord[],
  tolerance: number = 0.001
): Map<string, string[]> => {
  const duplicates = new Map<string, string[]>();
  const seen = new Map<string, string>();

  records.forEach(record => {
    const key = `${record.batchId}-${record.functionCardId}-${record.playerPosition.x.toFixed(3)}-${record.playerPosition.y.toFixed(3)}-${record.timestamp}`;

    if (seen.has(key)) {
      const originalId = seen.get(key)!;
      if (!duplicates.has(originalId)) {
        duplicates.set(originalId, []);
      }
      duplicates.get(originalId)!.push(record.id);
    } else {
      seen.set(key, record.id);
    }
  });

  return duplicates;
};

export const filterRecordsByBatch = (
  records: GameRecord[],
  batchId: string
): GameRecord[] => {
  return records.filter(r => r.batchId === batchId);
};

export const filterRecordsByStatus = (
  records: GameRecord[],
  status: RecordStatus
): GameRecord[] => {
  return records.filter(r => r.status === status);
};

export const filterRecordsByType = (
  records: GameRecord[],
  recordType: RecordType
): GameRecord[] => {
  return records.filter(r => r.recordType === recordType);
};

export const getRecordsByFunctionCard = (
  records: GameRecord[],
  functionCardId: string
): GameRecord[] => {
  return records.filter(r => r.functionCardId === functionCardId);
};

export const getPendingRecords = (records: GameRecord[]): GameRecord[] => {
  return records.filter(r => r.status === 'pending' || r.missingFields.length > 0);
};

export const getExceptionRecords = (records: GameRecord[]): GameRecord[] => {
  return records.filter(r => r.status === 'exception');
};

export const getLateRecords = (records: GameRecord[]): GameRecord[] => {
  return records.filter(r => r.recordType === 'late');
};

export const getWithdrawnRecords = (records: GameRecord[]): GameRecord[] => {
  return records.filter(r => r.recordType === 'withdrawn');
};

export const getDuplicateRecords = (records: GameRecord[]): GameRecord[] => {
  return records.filter(r => r.recordType === 'duplicate');
};

export const validateRecord = (record: GameRecord): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!record.batchId) errors.push('缺少批次号');
  if (!record.gameId) errors.push('缺少游戏ID');
  if (!record.functionCardId) errors.push('缺少函数卡ID');
  if (!record.playerPosition || !isFinite(record.playerPosition.x) || !isFinite(record.playerPosition.y)) {
    errors.push('坐标无效');
  }
  if (!isFinite(record.slope)) errors.push('斜率无效');
  if (record.missingFields.length > 0) {
    errors.push(`缺少字段: ${record.missingFields.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

export const formatRecordTimestamp = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

export const getRecordTypeLabel = (type: RecordType): string => {
  const labels: Record<RecordType, string> = {
    normal: '正常',
    late: '晚补',
    withdrawn: '撤回',
    duplicate: '重复',
  };
  return labels[type];
};

export const getRecordStatusLabel = (status: RecordStatus): string => {
  const labels: Record<RecordStatus, string> = {
    normal: '正常',
    pending: '待确认',
    exception: '异常',
  };
  return labels[status];
};
