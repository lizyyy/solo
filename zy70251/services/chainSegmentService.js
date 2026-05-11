const { v4: uuidv4 } = require('uuid');
const { run, get, all } = require('../config/database');
const {
  NotFoundError,
  StatusConflictError,
  ValidationError,
  SourceRecordMissingError
} = require('../utils/errors');
const { CHAIN_SEGMENT_STATUS, validateTransition } = require('../utils/statusMachine');
const statusHistoryService = require('./statusHistoryService');

const VALID_SEGMENT_TYPES = ['outbound', 'transfer', 'last_mile'];

async function createChainSegment(data) {
  const {
    batch_id,
    segment_type,
    start_time,
    start_location,
    operator,
    notes
  } = data;

  if (!batch_id) {
    throw new ValidationError('批次ID不能为空', 'batch_id', batch_id);
  }
  if (!segment_type || !VALID_SEGMENT_TYPES.includes(segment_type)) {
    throw new ValidationError(
      `冷链片段类型无效，有效值为: ${VALID_SEGMENT_TYPES.join(', ')}`,
      'segment_type',
      segment_type
    );
  }
  if (!start_time) {
    throw new ValidationError('开始时间不能为空', 'start_time', start_time);
  }
  if (!start_location || start_location.trim() === '') {
    throw new ValidationError('开始位置不能为空', 'start_location', start_location);
  }

  const batch = await get('SELECT id, status FROM batches WHERE id = ?', [batch_id]);
  if (!batch) {
    throw new SourceRecordMissingError('批次', batch_id, '冷链片段', 'new');
  }

  const activeSegment = await get(
    `SELECT id, segment_type, status FROM chain_segments
     WHERE batch_id = ? AND status = ?`,
    [batch_id, CHAIN_SEGMENT_STATUS.IN_PROGRESS]
  );

  if (activeSegment) {
    throw new StatusConflictError(
      '冷链片段',
      activeSegment.id,
      CHAIN_SEGMENT_STATUS.IN_PROGRESS,
      [CHAIN_SEGMENT_STATUS.COMPLETED],
      `创建新片段 (存在未完成的 ${activeSegment.segment_type} 片段)`
    );
  }

  const id = uuidv4();
  const status = CHAIN_SEGMENT_STATUS.IN_PROGRESS;

  await run(
    `INSERT INTO chain_segments 
     (id, batch_id, segment_type, start_time, start_location, operator, status, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, batch_id, segment_type, start_time, start_location, operator, status, notes]
  );

  await statusHistoryService.recordStatusChange('chain_segment', id, null, status, operator, `创建冷链片段: ${segment_type}`);

  return getChainSegmentById(id);
}

async function getChainSegmentById(id) {
  return get('SELECT * FROM chain_segments WHERE id = ?', [id]);
}

async function getChainSegmentsByBatch(batchId) {
  const batch = await get('SELECT id FROM batches WHERE id = ?', [batchId]);
  if (!batch) {
    throw new NotFoundError('批次', batchId);
  }

  return all(
    `SELECT * FROM chain_segments 
     WHERE batch_id = ? 
     ORDER BY start_time ASC`,
    [batchId]
  );
}

async function getAllChainSegments(filters = {}) {
  let sql = 'SELECT cs.*, b.batch_number FROM chain_segments cs LEFT JOIN batches b ON cs.batch_id = b.id WHERE 1=1';
  const params = [];

  if (filters.status) {
    sql += ' AND cs.status = ?';
    params.push(filters.status);
  }
  if (filters.segment_type) {
    sql += ' AND cs.segment_type = ?';
    params.push(filters.segment_type);
  }
  if (filters.batch_id) {
    sql += ' AND cs.batch_id = ?';
    params.push(filters.batch_id);
  }

  sql += ' ORDER BY cs.start_time DESC';

  return all(sql, params);
}

async function completeChainSegment(segmentId, data, operator = null) {
  const segment = await getChainSegmentById(segmentId);
  
  if (!segment) {
    throw new NotFoundError('冷链片段', segmentId);
  }

  if (segment.status !== CHAIN_SEGMENT_STATUS.IN_PROGRESS) {
    throw new StatusConflictError(
      '冷链片段',
      segmentId,
      segment.status,
      [CHAIN_SEGMENT_STATUS.IN_PROGRESS],
      '完成冷链片段'
    );
  }

  const {
    end_time,
    end_location,
    temperature_min,
    temperature_max,
    temperature_avg,
    notes
  } = data;

  if (!end_time) {
    throw new ValidationError('结束时间不能为空', 'end_time', end_time);
  }
  if (!end_location || end_location.trim() === '') {
    throw new ValidationError('结束位置不能为空', 'end_location', end_location);
  }

  if (new Date(end_time) < new Date(segment.start_time)) {
    throw new ValidationError('结束时间不能早于开始时间', 'end_time', end_time);
  }

  await run(
    `UPDATE chain_segments 
     SET end_time = ?,
         end_location = ?,
         temperature_min = ?,
         temperature_max = ?,
         temperature_avg = ?,
         status = ?,
         notes = COALESCE(?, notes)
     WHERE id = ?`,
    [end_time, end_location, temperature_min, temperature_max, temperature_avg, 
     CHAIN_SEGMENT_STATUS.COMPLETED, notes, segmentId]
  );

  await statusHistoryService.recordStatusChange(
    'chain_segment',
    segmentId,
    segment.status,
    CHAIN_SEGMENT_STATUS.COMPLETED,
    operator,
    '冷链片段完成'
  );

  return getChainSegmentById(segmentId);
}

async function verifyColdChain(batchId) {
  const segments = await getChainSegmentsByBatch(batchId);
  
  if (segments.length === 0) {
    return {
      verified: false,
      reason: '批次没有任何冷链记录',
      details: { segmentCount: 0 }
    };
  }

  const incompleteSegments = segments.filter(
    s => s.status !== CHAIN_SEGMENT_STATUS.COMPLETED
  );

  if (incompleteSegments.length > 0) {
    return {
      verified: false,
      reason: '存在未完成的冷链片段',
      details: {
        incompleteCount: incompleteSegments.length,
        incompleteSegments: incompleteSegments.map(s => ({
          id: s.id,
          segment_type: s.segment_type,
          status: s.status
        }))
      }
    };
  }

  const temperatureIssues = segments.filter(s => {
    if (s.temperature_min !== null && s.temperature_min < -25) return true;
    if (s.temperature_max !== null && s.temperature_max > 8) return true;
    return false;
  });

  return {
    verified: temperatureIssues.length === 0,
    reason: temperatureIssues.length > 0 
      ? '存在温度超出范围的冷链片段' 
      : '冷链验证通过',
    details: {
      segmentCount: segments.length,
      temperatureIssueCount: temperatureIssues.length,
      segments: segments.map(s => ({
        id: s.id,
        segment_type: s.segment_type,
        start_time: s.start_time,
        end_time: s.end_time,
        temperature_min: s.temperature_min,
        temperature_max: s.temperature_max,
        temperature_avg: s.temperature_avg,
        isInRange: !(s.temperature_min !== null && s.temperature_min < -25) &&
                   !(s.temperature_max !== null && s.temperature_max > 8)
      }))
    }
  };
}

module.exports = {
  createChainSegment,
  getChainSegmentById,
  getChainSegmentsByBatch,
  getAllChainSegments,
  completeChainSegment,
  verifyColdChain,
  VALID_SEGMENT_TYPES
};
