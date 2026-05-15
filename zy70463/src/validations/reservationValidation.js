const Joi = require('joi');

const machineLabelSchema = Joi.object({
  name: Joi.string().required(),
  value: Joi.string().required()
});

const createReservationSchema = Joi.object({
  applicant: Joi.string().required(),
  applicantDepartment: Joi.string().required(),
  purpose: Joi.string().required(),
  pressureTestResource: Joi.object({
    cpu: Joi.number().positive().required(),
    memory: Joi.number().positive().required(),
    memoryUnit: Joi.string().valid('GB', 'MB').required(),
    instances: Joi.number().integer().positive().required(),
    description: Joi.string().optional()
  }).required(),
  machineLabels: Joi.array().items(machineLabelSchema).required(),
  drillWindow: Joi.object({
    start: Joi.date().iso().required(),
    end: Joi.date().iso().greater(Joi.ref('start')).required()
  }).required()
});

const approveReservationSchema = Joi.object({
  approver: Joi.string().required(),
  comment: Joi.string().optional()
});

const releaseReservationSchema = Joi.object({
  releasedBy: Joi.string().required(),
  reason: Joi.string().optional()
});

const queryConflictsSchema = Joi.object({
  start: Joi.date().iso().required(),
  end: Joi.date().iso().greater(Joi.ref('start')).required(),
  machineLabels: Joi.array().items(machineLabelSchema).optional()
});

module.exports = {
  createReservationSchema,
  approveReservationSchema,
  releaseReservationSchema,
  queryConflictsSchema
};
