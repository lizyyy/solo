const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

const generateId = () => uuidv4();
const now = () => moment().toISOString();

const DatasetVersionSchema = Joi.object({
  dataset_name: Joi.string().required(),
  version: Joi.string().required(),
  publisher: Joi.string().required(),
  change_summary: Joi.string().required(),
  change_details: Joi.string().optional()
});

const DownstreamProjectSchema = Joi.object({
  project_name: Joi.string().required(),
  owner: Joi.string().required(),
  contact_email: Joi.string().email().optional(),
  description: Joi.string().optional()
});

const AcknowledgmentSchema = Joi.object({
  dataset_version_id: Joi.string().required(),
  project_id: Joi.string().required(),
  assignee: Joi.string().required(),
  deadline: Joi.string().isoDate().optional()
});

const AcknowledgeSchema = Joi.object({
  acknowledgment_note: Joi.string().optional()
});

const RollbackRequestSchema = Joi.object({
  dataset_version_id: Joi.string().required(),
  project_id: Joi.string().required(),
  requester: Joi.string().required(),
  reason: Joi.string().required()
});

const RollbackApprovalSchema = Joi.object({
  approver: Joi.string().required(),
  approval_note: Joi.string().optional(),
  approved: Joi.boolean().required()
});

const ManualCorrectionSchema = Joi.object({
  operator: Joi.string().required(),
  correction_reason: Joi.string().required(),
  updates: Joi.object().required()
});

module.exports = {
  generateId,
  now,
  DatasetVersionSchema,
  DownstreamProjectSchema,
  AcknowledgmentSchema,
  AcknowledgeSchema,
  RollbackRequestSchema,
  RollbackApprovalSchema,
  ManualCorrectionSchema
};
