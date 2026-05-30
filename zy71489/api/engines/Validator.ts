import type { Track, BadDataRecord } from '../../shared/types.js';
import { v4 as uuidv4 } from 'uuid';

interface ValidatorContext {
  sourceFile: string;
  importSession: string;
}

interface VoteRow {
  trackId?: string;
  trackName?: string;
  voterId?: string;
  voterName?: string;
  votedAt?: string;
  [key: string]: any;
}

interface CopyrightRow {
  trackId?: string;
  trackName?: string;
  status?: string;
  expiredAt?: string;
  licenseNumber?: string;
  [key: string]: any;
}

export function validateVoteRow(
  row: VoteRow,
  lineNumber: number,
  context: ValidatorContext
): BadDataRecord | null {
  const errors: string[] = [];

  if (!row.trackId && !row.trackName) {
    errors.push('trackId 或 trackName 至少需要一个');
  }

  if (row.votedAt) {
    const date = new Date(row.votedAt);
    if (isNaN(date.getTime())) {
      errors.push('votedAt 日期格式无效');
    }
  } else {
    errors.push('votedAt 为必填字段');
  }

  if (errors.length === 0) {
    return null;
  }

  return {
    id: uuidv4(),
    sourceFile: context.sourceFile,
    lineNumber,
    rawContent: JSON.stringify(row),
    errorType: 'missing_field',
    errorMessage: errors.join('; '),
    detectedAt: new Date().toISOString(),
    importSession: context.importSession,
  };
}

export function validateCopyrightRow(
  row: CopyrightRow,
  lineNumber: number,
  context: ValidatorContext
): BadDataRecord | null {
  const errors: string[] = [];
  const validStatuses = ['active', 'expired', 'pending', 'restricted'];

  if (!row.trackId && !row.trackName) {
    errors.push('trackId 或 trackName 至少需要一个');
  }

  if (!row.status) {
    errors.push('status 为必填字段');
  } else if (!validStatuses.includes(row.status)) {
    errors.push(`status 必须是 ${validStatuses.join(', ')} 之一`);
  }

  if (row.status === 'expired' && !row.expiredAt) {
    errors.push('expired 状态需要提供 expiredAt');
  }

  if (row.expiredAt) {
    const date = new Date(row.expiredAt);
    if (isNaN(date.getTime())) {
      errors.push('expiredAt 日期格式无效');
    }
  }

  if (errors.length === 0) {
    return null;
  }

  let errorType: BadDataRecord['errorType'] = 'missing_field';
  if (errors.some((e) => e.includes('格式'))) {
    errorType = 'invalid_format';
  }

  return {
    id: uuidv4(),
    sourceFile: context.sourceFile,
    lineNumber,
    rawContent: JSON.stringify(row),
    errorType,
    errorMessage: errors.join('; '),
    detectedAt: new Date().toISOString(),
    importSession: context.importSession,
  };
}

export function validateTrack(
  track: Partial<Track>,
  lineNumber: number,
  context: ValidatorContext
): BadDataRecord | null {
  const errors: string[] = [];

  if (!track.id) {
    errors.push('id 为必填字段');
  }

  if (!track.name) {
    errors.push('name 为必填字段');
  }

  if (!track.artist) {
    errors.push('artist 为必填字段');
  }

  if (track.duration === undefined) {
    errors.push('duration 为必填字段');
  } else if (typeof track.duration !== 'number' || track.duration <= 0) {
    errors.push('duration 必须是大于 0 的数字');
  }

  if (track.staminaLevel === undefined) {
    errors.push('staminaLevel 为必填字段');
  } else if (![1, 2, 3, 4, 5].includes(track.staminaLevel)) {
    errors.push('staminaLevel 必须是 1-5 之间的整数');
  }

  if (errors.length === 0) {
    return null;
  }

  let errorType: BadDataRecord['errorType'] = 'missing_field';
  if (errors.some((e) => e.includes('duration'))) {
    errorType = 'invalid_duration';
  } else if (errors.some((e) => e.includes('必须是') || e.includes('格式'))) {
    errorType = 'invalid_format';
  }

  return {
    id: uuidv4(),
    sourceFile: context.sourceFile,
    lineNumber,
    rawContent: JSON.stringify(track),
    errorType,
    errorMessage: errors.join('; '),
    detectedAt: new Date().toISOString(),
    importSession: context.importSession,
  };
}
