const Joi = require('joi');
const { HAZARD_STATUS, HAZARD_LEVEL } = require('./constants');

const hazardSchema = Joi.object({
  hazardCode: Joi.string().required().messages({
    'string.empty': '隐患编号不能为空',
    'any.required': '隐患编号是必填项'
  }),
  title: Joi.string().required().messages({
    'string.empty': '隐患标题不能为空',
    'any.required': '隐患标题是必填项'
  }),
  description: Joi.string().allow('').optional(),
  location: Joi.string().required().messages({
    'string.empty': '隐患位置不能为空',
    'any.required': '隐患位置是必填项'
  }),
  level: Joi.string().valid(...Object.values(HAZARD_LEVEL)).required().messages({
    'any.only': `隐患级别必须是: ${Object.values(HAZARD_LEVEL).join(', ')}`,
    'any.required': '隐患级别是必填项'
  }),
  discoverDate: Joi.date().required().messages({
    'date.base': '发现日期格式不正确',
    'any.required': '发现日期是必填项'
  }),
  discoverer: Joi.string().required().messages({
    'string.empty': '发现人不能为空',
    'any.required': '发现人是必填项'
  }),
  department: Joi.string().optional().allow(''),
  responsiblePerson: Joi.string().optional().allow(''),
  deadline: Joi.date().optional().allow(null),
  status: Joi.string().valid(...Object.values(HAZARD_STATUS)).default(HAZARD_STATUS.NEW)
});

const photoSchema = Joi.object({
  photoId: Joi.string().required(),
  hazardCode: Joi.string().required(),
  photoType: Joi.string().valid('inspection', 'rectification', 'review').required(),
  filePath: Joi.string().required(),
  uploadDate: Joi.date().required(),
  uploader: Joi.string().required(),
  description: Joi.string().optional().allow('')
});

const reviewSchema = Joi.object({
  reviewId: Joi.string().required(),
  hazardCode: Joi.string().required(),
  reviewer: Joi.string().required(),
  reviewDate: Joi.date().required(),
  result: Joi.string().valid('pass', 'fail', 'reopen').required(),
  comments: Joi.string().optional().allow(''),
  nextReviewDate: Joi.date().optional().allow(null)
});

function validateHazard(data) {
  const result = hazardSchema.validate(data, { abortEarly: false });
  return {
    isValid: !result.error,
    errors: result.error ? result.error.details.map(d => ({
      field: d.path.join('.'),
      message: d.message
    })) : [],
    value: result.value
  };
}

function validatePhoto(data) {
  const result = photoSchema.validate(data, { abortEarly: false });
  return {
    isValid: !result.error,
    errors: result.error ? result.error.details.map(d => ({
      field: d.path.join('.'),
      message: d.message
    })) : [],
    value: result.value
  };
}

function validateReview(data) {
  const result = reviewSchema.validate(data, { abortEarly: false });
  return {
    isValid: !result.error,
    errors: result.error ? result.error.details.map(d => ({
      field: d.path.join('.'),
      message: d.message
    })) : [],
    value: result.value
  };
}

function suggestFix(field, message) {
  const suggestions = {
    'hazardCode': '请填写有效的隐患编号，如: HZ-2024-001',
    'title': '请填写简洁明确的隐患标题',
    'location': '请填写具体的隐患位置信息',
    'level': `请选择正确的隐患级别: low/medium/high/critical`,
    'discoverDate': '请使用正确的日期格式，如: 2024-01-15',
    'discoverer': '请填写发现人姓名',
    'deadline': '请使用正确的日期格式，如: 2024-01-30',
    'responsiblePerson': '请填写整改责任人姓名',
    'status': `请选择正确的状态: ${Object.values(HAZARD_STATUS).join(', ')}`
  };
  return suggestions[field] || '请检查该字段格式是否正确';
}

module.exports = {
  validateHazard,
  validatePhoto,
  validateReview,
  suggestFix,
  hazardSchema,
  photoSchema,
  reviewSchema
};
