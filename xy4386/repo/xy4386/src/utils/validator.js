const Joi = require('joi');
const config = require('../config');

const warehouseDataSchema = Joi.object({
  warehouseId: Joi.string().required(),
  warehouseName: Joi.string().required(),
  measurements: Joi.array().items(
    Joi.object({
      timestamp: Joi.string().required(),
      oxygen: Joi.number().required(),
      temperature: Joi.number().required(),
      humidity: Joi.number().required()
    })
  ).required()
});

const accessControlRepairSchema = Joi.object({
  repairId: Joi.string().required(),
  warehouseId: Joi.string().required(),
  repairDate: Joi.string().required(),
  description: Joi.string().required(),
  status: Joi.string().valid('open', 'in_progress', 'closed').required(),
  assignee: Joi.string(),
  closedDate: Joi.string().allow(null)
});

const retrievalTaskSchema = Joi.object({
  taskId: Joi.string().required(),
  warehouseId: Joi.string().required(),
  date: Joi.string().required(),
  rackId: Joi.string().required(),
  personnel: Joi.array().items(
    Joi.object({
      id: Joi.string().required(),
      name: Joi.string().required(),
      qualification: Joi.string().required()
    })
  ).required()
});

const reviewSchema = Joi.object({
  reviewId: Joi.string().required(),
  riskId: Joi.string().required(),
  reviewerId: Joi.string().required(),
  reviewerName: Joi.string().required(),
  decision: Joi.string().valid('confirm', 'dismiss', 'escalate').required(),
  comments: Joi.string().required(),
  timestamp: Joi.string().required()
});

function validateWarehouseData(data) {
  const { error, value } = warehouseDataSchema.validate(data);
  if (error) {
    return { valid: false, error: error.details[0].message };
  }
  return { valid: true, value };
}

function validateAccessControlRepair(data) {
  const { error, value } = accessControlRepairSchema.validate(data);
  if (error) {
    return { valid: false, error: error.details[0].message };
  }
  return { valid: true, value };
}

function validateRetrievalTask(data) {
  const { error, value } = retrievalTaskSchema.validate(data);
  if (error) {
    return { valid: false, error: error.details[0].message };
  }
  return { valid: true, value };
}

function validateReview(data) {
  const { error, value } = reviewSchema.validate(data);
  if (error) {
    return { valid: false, error: error.details[0].message };
  }
  return { valid: true, value };
}

function validatePersonnelQualification(qualification) {
  const validQualifications = config.personnel.validQualifications;
  return validQualifications.includes(qualification);
}

function validateTemperature(value) {
  const { min, max } = config.risk.temperature;
  return value >= min && value <= max;
}

function validateHumidity(value) {
  const { min, max } = config.risk.humidity;
  return value >= min && value <= max;
}

function validateOxygenLevel(value) {
  return value >= config.risk.oxygen.minAcceptableValue;
}

module.exports = {
  validateWarehouseData,
  validateAccessControlRepair,
  validateRetrievalTask,
  validateReview,
  validatePersonnelQualification,
  validateTemperature,
  validateHumidity,
  validateOxygenLevel
};
