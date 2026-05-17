const Joi = require('joi');
const { STATUS, EMOTIONS, VALID_QUEUES } = require('./constants');

const ticketSchema = Joi.object({
  session_id: Joi.string().required().messages({
    'string.empty': '会话编号不能为空',
    'any.required': '会话编号是必填项'
  }),
  bot_tag: Joi.string().required().messages({
    'string.empty': '机器人标签不能为空',
    'any.required': '机器人标签是必填项'
  }),
  human_queue: Joi.string().valid(...VALID_QUEUES).required().messages({
    'string.empty': '人工队列不能为空',
    'any.required': '人工队列是必填项',
    'any.only': `人工队列必须是以下值之一: ${VALID_QUEUES.join(', ')}`
  }),
  customer_emotion: Joi.string().valid(...EMOTIONS).required().messages({
    'string.empty': '客户情绪不能为空',
    'any.required': '客户情绪是必填项',
    'any.only': `客户情绪必须是以下值之一: ${EMOTIONS.join(', ')}`
  }),
  status: Joi.string().valid(...Object.values(STATUS)).optional()
});

const statusUpdateSchema = Joi.object({
  status: Joi.string().valid(...Object.values(STATUS)).required().messages({
    'string.empty': '状态不能为空',
    'any.required': '状态是必填项',
    'any.only': `状态必须是以下值之一: ${Object.values(STATUS).join(', ')}`
  }),
  operator: Joi.string().optional().default('system'),
  remark: Joi.string().optional()
});

const importRowSchema = Joi.object({
  session_id: Joi.string().required(),
  bot_tag: Joi.string().required(),
  human_queue: Joi.string().valid(...VALID_QUEUES).required(),
  customer_emotion: Joi.string().valid(...EMOTIONS).required()
});

function validateTicket(data) {
  return ticketSchema.validate(data, { abortEarly: false });
}

function validateStatusUpdate(data) {
  return statusUpdateSchema.validate(data, { abortEarly: false });
}

function validateImportRow(data, rowNumber) {
  const result = importRowSchema.validate(data, { abortEarly: false });
  return {
    isValid: !result.error,
    errors: result.error ? result.error.details.map(d => ({
      field: d.path.join('.'),
      message: d.message
    })) : [],
    rowNumber,
    data
  };
}

module.exports = {
  validateTicket,
  validateStatusUpdate,
  validateImportRow
};
