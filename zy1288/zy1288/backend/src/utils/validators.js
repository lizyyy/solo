const Joi = require('joi');
const moment = require('moment');
const { STATUS_FLOW, COURSES, RESPONSIBLES } = require('../database/database');

const phoneRegex = /^1[3-9]\d{9}$/;

const validatePhone = (phone) => {
  return phoneRegex.test(phone);
};

const validateAppointmentTime = (time) => {
  if (!time) return false;
  const parsed = moment(time, ['YYYY-MM-DD HH:mm', 'YYYY-MM-DDTHH:mm:ss'], true);
  return parsed.isValid();
};

const validateStatusFlow = (oldStatus, newStatus) => {
  if (oldStatus === newStatus) return true;
  const allowedTransitions = STATUS_FLOW[oldStatus];
  return allowedTransitions && allowedTransitions.includes(newStatus);
};

const getValidStatuses = Object.keys(STATUS_FLOW);

const leadCreateSchema = Joi.object({
  name: Joi.string()
    .min(1)
    .max(50)
    .required()
    .messages({
      'string.base': '姓名必须是字符串',
      'string.empty': '姓名不能为空',
      'string.min': '姓名至少1个字符',
      'string.max': '姓名不能超过50个字符',
      'any.required': '姓名是必填项'
    }),
  phone: Joi.string()
    .pattern(phoneRegex)
    .required()
    .messages({
      'string.base': '手机号必须是字符串',
      'string.pattern.base': '请输入有效的11位手机号',
      'any.required': '手机号是必填项'
    }),
  course: Joi.string()
    .valid(...COURSES)
    .required()
    .messages({
      'string.base': '课程必须是字符串',
      'any.only': '请选择有效的课程',
      'any.required': '课程是必填项'
    }),
  appointment_time: Joi.string()
    .custom((value, helpers) => {
      if (!validateAppointmentTime(value)) {
        return helpers.message('请输入有效的预约时间，格式: YYYY-MM-DD HH:mm');
      }
      return value;
    })
    .required()
    .messages({
      'string.base': '预约时间必须是字符串',
      'any.required': '预约时间是必填项'
    }),
  status: Joi.string()
    .valid(...getValidStatuses)
    .default('new')
    .messages({
      'string.base': '状态必须是字符串',
      'any.only': '请选择有效的状态'
    }),
  responsible: Joi.string()
    .valid(...RESPONSIBLES)
    .required()
    .messages({
      'string.base': '负责人必须是字符串',
      'any.only': '请选择有效的负责人',
      'any.required': '负责人是必填项'
    }),
  notes: Joi.string()
    .max(1000)
    .allow('')
    .allow(null)
    .messages({
      'string.base': '备注必须是字符串',
      'string.max': '备注不能超过1000个字符'
    })
});

const leadUpdateSchema = Joi.object({
  name: Joi.string()
    .min(1)
    .max(50)
    .messages({
      'string.base': '姓名必须是字符串',
      'string.empty': '姓名不能为空',
      'string.min': '姓名至少1个字符',
      'string.max': '姓名不能超过50个字符'
    }),
  phone: Joi.string()
    .pattern(phoneRegex)
    .messages({
      'string.base': '手机号必须是字符串',
      'string.pattern.base': '请输入有效的11位手机号'
    }),
  course: Joi.string()
    .valid(...COURSES)
    .messages({
      'string.base': '课程必须是字符串',
      'any.only': '请选择有效的课程'
    }),
  appointment_time: Joi.string()
    .custom((value, helpers) => {
      if (!validateAppointmentTime(value)) {
        return helpers.message('请输入有效的预约时间，格式: YYYY-MM-DD HH:mm');
      }
      return value;
    })
    .messages({
      'string.base': '预约时间必须是字符串'
    }),
  status: Joi.string()
    .valid(...getValidStatuses)
    .messages({
      'string.base': '状态必须是字符串',
      'any.only': '请选择有效的状态'
    }),
  responsible: Joi.string()
    .valid(...RESPONSIBLES)
    .messages({
      'string.base': '负责人必须是字符串',
      'any.only': '请选择有效的负责人'
    }),
  notes: Joi.string()
    .max(1000)
    .allow('')
    .allow(null)
    .messages({
      'string.base': '备注必须是字符串',
      'string.max': '备注不能超过1000个字符'
    })
}).min(1).messages({
  'object.min': '至少需要修改一个字段'
});

const filterSchema = Joi.object({
  status: Joi.string()
    .valid(...getValidStatuses, '')
    .allow(''),
  responsible: Joi.string()
    .valid(...RESPONSIBLES, '')
    .allow(''),
  page: Joi.number()
    .integer()
    .min(1)
    .default(1),
  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(20)
});

const validateCreateLead = (data) => {
  return leadCreateSchema.validate(data, { abortEarly: false });
};

const validateUpdateLead = (data) => {
  return leadUpdateSchema.validate(data, { abortEarly: false });
};

const validateFilters = (data) => {
  return filterSchema.validate(data, { abortEarly: false });
};

module.exports = {
  validatePhone,
  validateAppointmentTime,
  validateStatusFlow,
  validateCreateLead,
  validateUpdateLead,
  validateFilters,
  getValidStatuses,
  COURSES,
  RESPONSIBLES
};
