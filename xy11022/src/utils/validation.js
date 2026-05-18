const Joi = require('joi');
const moment = require('moment');

const TRANSFER_STATUS = ['pending', 'approved', 'rejected', 'cancelled', 'completed'];

const STATUS_TRANSITIONS = {
  pending: ['approved', 'rejected', 'cancelled'],
  approved: ['completed', 'cancelled'],
  rejected: [],
  cancelled: [],
  completed: []
};

const transferSchema = Joi.object({
  transfer_date: Joi.string().required().pattern(/^\d{4}-\d{2}-\d{2}$/),
  store_id: Joi.string().required(),
  store_name: Joi.string().required(),
  assignor_id: Joi.string().required(),
  assignor_name: Joi.string().required(),
  assignor_phone: Joi.string().required().pattern(/^1[3-9]\d{9}$/),
  assignee_id: Joi.string().required(),
  assignee_name: Joi.string().required(),
  assignee_phone: Joi.string().required().pattern(/^1[3-9]\d{9}$/),
  coach_id: Joi.string().required(),
  coach_name: Joi.string().required(),
  class_package_id: Joi.string().required(),
  class_package_name: Joi.string().required(),
  transfer_class_count: Joi.number().integer().min(1).required(),
  remaining_class_count: Joi.number().integer().min(Joi.ref('transfer_class_count')).required(),
  original_unit_price: Joi.number().min(0).required(),
  transfer_fee: Joi.number().min(0).default(0),
  total_amount: Joi.number().min(0).required(),
  scheduled_class_time: Joi.string().allow(null, ''),
  handler_id: Joi.string().allow(null),
  handler_name: Joi.string().allow(null),
  remark: Joi.string().allow(null, '')
});

const transferUpdateSchema = Joi.object({
  status: Joi.string().valid(...TRANSFER_STATUS).required(),
  handler_id: Joi.string().required(),
  handler_name: Joi.string().required(),
  reject_reason: Joi.string().when('status', {
    is: 'rejected',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  remark: Joi.string().allow(null, '')
});

const querySchema = Joi.object({
  start_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/),
  end_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/),
  status: Joi.string().valid(...TRANSFER_STATUS),
  handler_id: Joi.string(),
  store_id: Joi.string(),
  page: Joi.number().integer().min(1).default(1),
  page_size: Joi.number().integer().min(1).max(100).default(20)
});

const validateTransferData = (data) => {
  const { error, value } = transferSchema.validate(data);
  if (error) {
    return { valid: false, error: error.details[0].message };
  }
  return { valid: true, value };
};

const validateTransferUpdate = (data) => {
  const { error, value } = transferUpdateSchema.validate(data);
  if (error) {
    return { valid: false, error: error.details[0].message };
  }
  return { valid: true, value };
};

const validateQuery = (query) => {
  const { error, value } = querySchema.validate(query);
  if (error) {
    return { valid: false, error: error.details[0].message };
  }
  return { valid: true, value };
};

const isValidStatusTransition = (currentStatus, newStatus) => {
  const allowedTransitions = STATUS_TRANSITIONS[currentStatus] || [];
  return allowedTransitions.includes(newStatus);
};

const generateTransferNo = () => {
  const dateStr = moment().format('YYYYMMDD');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `TR${dateStr}${random}`;
};

module.exports = {
  validateTransferData,
  validateTransferUpdate,
  validateQuery,
  isValidStatusTransition,
  generateTransferNo,
  TRANSFER_STATUS,
  STATUS_TRANSITIONS
};
