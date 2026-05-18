const Joi = require('joi');
const moment = require('moment');

const STATUS_FLOWABLE = 'flowable';
const STATUS_PENDING = 'pending';
const STATUS_APPROVED = 'approved';
const STATUS_RESTORED = 'restored';

const VALID_STATUSES = [STATUS_FLOWABLE, STATUS_PENDING, STATUS_APPROVED, STATUS_RESTORED];

const STATUS_TRANSITIONS = {
  [STATUS_FLOWABLE]: [STATUS_PENDING],
  [STATUS_PENDING]: [STATUS_APPROVED, STATUS_FLOWABLE],
  [STATUS_APPROVED]: [STATUS_RESTORED],
  [STATUS_RESTORED]: []
};

const noFlySchema = Joi.object({
  route_id: Joi.string().required().messages({
    'string.empty': '航线ID不能为空',
    'any.required': '航线ID是必填项'
  }),
  drone_id: Joi.string().allow(null, ''),
  start_time: Joi.date().iso().required().messages({
    'date.base': '开始时间必须是有效的日期时间',
    'date.format': '开始时间必须是ISO格式',
    'any.required': '开始时间是必填项'
  }),
  end_time: Joi.date().iso().greater(Joi.ref('start_time')).required().messages({
    'date.base': '结束时间必须是有效的日期时间',
    'date.format': '结束时间必须是ISO格式',
    'date.greater': '结束时间必须晚于开始时间',
    'any.required': '结束时间是必填项'
  }),
  applicant_id: Joi.string().required().messages({
    'string.empty': '申请人ID不能为空',
    'any.required': '申请人ID是必填项'
  }),
  reason: Joi.string().min(5).max(500).required().messages({
    'string.empty': '禁飞原因不能为空',
    'string.min': '禁飞原因至少需要5个字符',
    'string.max': '禁飞原因不能超过500个字符',
    'any.required': '禁飞原因是必填项'
  }),
  cancel_older_tasks: Joi.boolean().default(true),
  status: Joi.string().valid(...VALID_STATUSES).default(STATUS_PENDING)
});

const statusChangeSchema = Joi.object({
  status: Joi.string().valid(...VALID_STATUSES).required().messages({
    'any.only': `状态必须是以下值之一: ${VALID_STATUSES.join(', ')}`,
    'any.required': '状态是必填项'
  }),
  operator: Joi.string().required().messages({
    'string.empty': '操作人不能为空',
    'any.required': '操作人是必填项'
  }),
  remark: Joi.string().max(200).allow('')
});

function validateNoFlyRecord(data) {
  const { error, value } = noFlySchema.validate(data, { abortEarly: false });
  if (error) {
    return {
      isValid: false,
      errors: error.details.map(d => d.message)
    };
  }
  return { isValid: true, value };
}

function validateStatusChange(currentStatus, newStatus, data) {
  const { error, value } = statusChangeSchema.validate(data, { abortEarly: false });
  if (error) {
    return {
      isValid: false,
      errors: error.details.map(d => d.message)
    };
  }

  const allowedTransitions = STATUS_TRANSITIONS[currentStatus] || [];
  if (!allowedTransitions.includes(newStatus)) {
    return {
      isValid: false,
      errors: [`不允许从 ${currentStatus} 状态变更为 ${newStatus} 状态`]
    };
  }

  return { isValid: true, value };
}

function validateTimeOverlap(existingRecords, newRecord, excludeId = null) {
  const conflicts = [];
  
  for (const record of existingRecords) {
    if (excludeId && record.id === excludeId) continue;
    if (record.status === STATUS_RESTORED || record.status === STATUS_FLOWABLE) continue;
    if (record.route_id !== newRecord.route_id) continue;
    
    const existingStart = moment(record.start_time);
    const existingEnd = moment(record.end_time);
    const newStart = moment(newRecord.start_time);
    const newEnd = moment(newRecord.end_time);

    if (newStart.isBefore(existingEnd) && newEnd.isAfter(existingStart)) {
      conflicts.push({
        id: record.id,
        start_time: record.start_time,
        end_time: record.end_time,
        status: record.status,
        overlap: calculateOverlap(existingStart, existingEnd, newStart, newEnd)
      });
    }
  }

  return conflicts;
}

function calculateOverlap(start1, end1, start2, end2) {
  const overlapStart = moment.max(start1, start2);
  const overlapEnd = moment.min(end1, end2);
  return overlapEnd.diff(overlapStart, 'minutes');
}

function validateImportRow(row, rowNumber, referenceData) {
  const errors = [];
  const { routes, drones, applicants } = referenceData;

  if (!row.route_code || !routes.find(r => r.code === row.route_code)) {
    errors.push(`航线代码 ${row.route_code} 不存在或无效`);
  }

  if (row.drone_code && !drones.find(d => d.code === row.drone_code)) {
    errors.push(`无人机代码 ${row.drone_code} 不存在`);
  }

  if (!row.applicant_name || !applicants.find(a => a.name === row.applicant_name)) {
    errors.push(`申请人 ${row.applicant_name} 不存在`);
  }

  if (!row.start_time || !moment(row.start_time, moment.ISO_8601, true).isValid()) {
    errors.push('开始时间格式无效，需要ISO格式');
  }

  if (!row.end_time || !moment(row.end_time, moment.ISO_8601, true).isValid()) {
    errors.push('结束时间格式无效，需要ISO格式');
  }

  if (row.start_time && row.end_time) {
    const start = moment(row.start_time);
    const end = moment(row.end_time);
    if (end.isSameOrBefore(start)) {
      errors.push('结束时间必须晚于开始时间');
    }
  }

  if (!row.reason || row.reason.length < 5) {
    errors.push('禁飞原因不能为空且至少需要5个字符');
  }

  return {
    rowNumber,
    isValid: errors.length === 0,
    errors,
    rowData: row
  };
}

module.exports = {
  STATUS_FLOWABLE,
  STATUS_PENDING,
  STATUS_APPROVED,
  STATUS_RESTORED,
  VALID_STATUSES,
  STATUS_TRANSITIONS,
  validateNoFlyRecord,
  validateStatusChange,
  validateTimeOverlap,
  validateImportRow
};