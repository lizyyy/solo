const Joi = require('joi');
const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const schemas = {
  barcode: Joi.object({
    barcode: Joi.string().required().pattern(/^[A-Z0-9-]+$/).message('条码格式不正确，只能包含大写字母、数字和连字符'),
    sample_type: Joi.string().required(),
    patient_info: Joi.string().allow(''),
    created_by: Joi.string().required()
  }),

  sampling: Joi.object({
    barcode: Joi.string().required(),
    sampling_time: Joi.date().iso().required(),
    sampler: Joi.string().required(),
    clinic_name: Joi.string().required(),
    patient_name: Joi.string().allow(''),
    patient_id: Joi.string().allow(''),
    sample_type: Joi.string().allow(''),
    notes: Joi.string().allow('')
  }),

  transportBatch: Joi.object({
    transporter: Joi.string().required(),
    departure_time: Joi.date().iso().required(),
    expected_arrival_time: Joi.date().iso().allow(null),
    origin_clinic: Joi.string().required(),
    destination_lab: Joi.string().required(),
    sample_barcodes: Joi.array().items(Joi.string()).min(1).required()
  }),

  receiveSample: Joi.object({
    barcode: Joi.string().required(),
    batch_code: Joi.string().allow(''),
    receiver: Joi.string().required(),
    received_time: Joi.date().iso().required(),
    receiving_lab: Joi.string().allow('')
  }),

  rejectSample: Joi.object({
    barcode: Joi.string().required(),
    rejection_reason_code: Joi.string().required(),
    rejection_note: Joi.string().allow(''),
    operator: Joi.string().required()
  }),

  amendment: Joi.object({
    transfer_record_id: Joi.string().required(),
    requester: Joi.string().required(),
    requested_changes: Joi.object().required(),
    reason: Joi.string().required()
  }),

  approveAmendment: Joi.object({
    amendment_id: Joi.string().required(),
    approver: Joi.string().required(),
    approval_notes: Joi.string().allow(''),
    approved: Joi.boolean().required()
  })
};

function validate(schemaName) {
  return (req, res, next) => {
    const schema = schemas[schemaName];
    if (!schema) {
      return res.status(500).json({ error: '验证模式不存在' });
    }
    
    const { error } = schema.validate(req.body);
    if (error) {
      logException(req.path, req.body, error.details[0].message, '验证失败');
      return res.status(400).json({ 
        error: error.details[0].message,
        field: error.details[0].path[0]
      });
    }
    next();
  };
}

function logException(endpoint, input, errorMessage, result) {
  const id = uuidv4();
  db.run(
    `INSERT INTO exception_logs (id, api_endpoint, original_input, error_message, processing_result)
     VALUES (?, ?, ?, ?, ?)`,
    [id, endpoint, JSON.stringify(input), errorMessage, result],
    (err) => {
      if (err) console.error('记录异常日志失败:', err);
    }
  );
}

module.exports = { validate, logException };
