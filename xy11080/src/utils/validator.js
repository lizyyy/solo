const Joi = require('joi');
const moment = require('moment');
const { POOL_TYPES, TIME_SLOTS, COMPENSATION_TYPES } = require('./constants');

const recordSchema = Joi.object({
  record_no: Joi.string().required().messages({
    'string.empty': '记录编号不能为空',
    'any.required': '记录编号是必填字段'
  }),
  pool_name: Joi.string().required().messages({
    'string.empty': '游泳馆名称不能为空',
    'any.required': '游泳馆名称是必填字段'
  }),
  pool_no: Joi.string().required().messages({
    'string.empty': '泳池编号不能为空',
    'any.required': '泳池编号是必填字段'
  }),
  pool_type: Joi.string().valid(...POOL_TYPES).required().messages({
    'any.only': `泳池类型必须是：${POOL_TYPES.join('、')}`,
    'any.required': '泳池类型是必填字段'
  }),
  record_date: Joi.string().custom((value, helpers) => {
    if (!moment(value, 'YYYY-MM-DD', true).isValid()) {
      return helpers.error('date.invalid');
    }
    return value;
  }).required().messages({
    'date.invalid': '日期格式必须是YYYY-MM-DD',
    'any.required': '记录日期是必填字段'
  }),
  time_slot: Joi.string().valid(...TIME_SLOTS).required().messages({
    'any.only': `时段必须是：${TIME_SLOTS.join('、')}`,
    'any.required': '时段是必填字段'
  }),
  time_slot_start: Joi.string().required().messages({
    'any.required': '时段开始时间是必填字段'
  }),
  time_slot_end: Joi.string().required().messages({
    'any.required': '时段结束时间是必填字段'
  }),
  standard_temp_min: Joi.number().min(20).max(40).required().messages({
    'number.min': '标准最低水温不能低于20℃',
    'number.max': '标准最低水温不能高于40℃',
    'any.required': '标准最低水温是必填字段'
  }),
  standard_temp_max: Joi.number().min(20).max(40).required().messages({
    'number.min': '标准最高水温不能低于20℃',
    'number.max': '标准最高水温不能高于40℃',
    'any.required': '标准最高水温是必填字段'
  }),
  actual_temp: Joi.number().min(20).max(40).required().messages({
    'number.min': '实际水温不能低于20℃',
    'number.max': '实际水温不能高于40℃',
    'any.required': '实际水温是必填字段'
  }),
  measure_time: Joi.string().required().messages({
    'any.required': '测量时间是必填字段'
  }),
  measure_person: Joi.string().required().messages({
    'any.required': '测量人是必填字段'
  }),
  is_temp_compliant: Joi.number().valid(0, 1).required().messages({
    'any.only': '是否达标必须是0或1',
    'any.required': '是否达标是必填字段'
  }),
  affected_periods: Joi.string().allow('').optional(),
  course_id: Joi.string().allow('').optional(),
  course_name: Joi.string().allow('').optional(),
  coach_name: Joi.string().allow('').optional(),
  registered_count: Joi.number().integer().min(0).default(0),
  attended_count: Joi.number().integer().min(0).default(0),
  need_compensation: Joi.number().valid(0, 1).default(0),
  compensation_type: Joi.string().valid(...COMPENSATION_TYPES).allow('').optional(),
  compensation_amount: Joi.number().min(0).default(0),
  compensation_quantity: Joi.number().integer().min(0).default(0),
  compensation_table_version: Joi.string().allow('').optional(),
  is_compensation_consistent: Joi.number().valid(0, 1).default(1)
});

function validateRecord(data) {
  const { error, value } = recordSchema.validate(data, { abortEarly: false });
  if (error) {
    return {
      valid: false,
      errors: error.details.map(detail => detail.message)
    };
  }
  return { valid: true, data: value };
}

function validateStatusTransition(oldStatus, newStatus, statusFlow) {
  if (!oldStatus) return true;
  const allowedNextStatuses = statusFlow[oldStatus] || [];
  return allowedNextStatuses.includes(newStatus);
}

module.exports = {
  validateRecord,
  validateStatusTransition
};