const Joi = require('joi');
const { LAB_TOLERANCE } = require('../config');

const paperBatchSchema = Joi.object({
  batchNo: Joi.string().required().max(50),
  paperType: Joi.string().required().max(100),
  supplier: Joi.string().max(100).allow(null, ''),
  weight: Joi.number().positive().allow(null),
  receiveDate: Joi.date().allow(null),
  quantity: Joi.number().integer().min(0).allow(null),
  remark: Joi.string().allow(null, ''),
  createdBy: Joi.string().max(50).allow(null, '')
});

const printBatchSchema = Joi.object({
  batchNo: Joi.string().required().max(50),
  productName: Joi.string().required().max(200),
  paperBatchNo: Joi.string().max(50).allow(null, ''),
  printDate: Joi.date().allow(null),
  quantity: Joi.number().integer().min(0).allow(null),
  targetL: Joi.number().allow(null),
  targetA: Joi.number().allow(null),
  targetB: Joi.number().allow(null),
  responsible: Joi.string().max(50).allow(null, ''),
  remark: Joi.string().allow(null, '')
});

const labRecordSchema = Joi.object({
  printBatchNo: Joi.string().required().max(50),
  samplePoint: Joi.string().max(50).allow(null, ''),
  measureL: Joi.number().required(),
  measureA: Joi.number().required(),
  measureB: Joi.number().required(),
  measureTime: Joi.date().allow(null),
  measuredBy: Joi.string().max(50).allow(null, ''),
  remark: Joi.string().allow(null, '')
});

const reworkRecordSchema = Joi.object({
  printBatchNo: Joi.string().required().max(50),
  reason: Joi.string().required(),
  action: Joi.string().allow(null, ''),
  reworkQuantity: Joi.number().integer().min(0).allow(null),
  reworkDate: Joi.date().allow(null),
  operator: Joi.string().max(50).allow(null, ''),
  remark: Joi.string().allow(null, '')
});

const validate = (schema, data) => {
  const { error, value } = schema.validate(data, { abortEarly: false });
  if (error) {
    return {
      isValid: false,
      errors: error.details.map(d => ({
        field: d.path.join('.'),
        message: d.message
      }))
    };
  }
  return { isValid: true, value };
};

const calculateLabDelta = (target, measure) => {
  const deltaL = parseFloat((measure.L - target.L).toFixed(2));
  const deltaA = parseFloat((measure.A - target.A).toFixed(2));
  const deltaB = parseFloat((measure.B - target.B).toFixed(2));
  const deltaE = parseFloat(Math.sqrt(
    Math.pow(deltaL, 2) + Math.pow(deltaA, 2) + Math.pow(deltaB, 2)
  ).toFixed(2));

  const isPassed = Math.abs(deltaL) <= LAB_TOLERANCE.L &&
                   Math.abs(deltaA) <= LAB_TOLERANCE.A &&
                   Math.abs(deltaB) <= LAB_TOLERANCE.B;

  return { deltaL, deltaA, deltaB, deltaE, isPassed };
};

module.exports = {
  paperBatchSchema,
  printBatchSchema,
  labRecordSchema,
  reworkRecordSchema,
  validate,
  calculateLabDelta
};
