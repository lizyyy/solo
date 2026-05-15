const Joi = require('joi');

const issueSchema = Joi.object({
  batchId: Joi.string().required(),
  issuerId: Joi.string().required(),
  issuerName: Joi.string().required(),
  executorId: Joi.string().required(),
  executorName: Joi.string().required(),
  expireAt: Joi.date().required(),
  rollbackAction: Joi.string().required(),
  scope: Joi.array().items(Joi.string()).default([]),
  metadata: Joi.object().default({})
});

const verifySchema = Joi.object({
  tokenId: Joi.string().required(),
  operatorId: Joi.string().required(),
  operatorName: Joi.string().required(),
  requestScope: Joi.array().items(Joi.string()).optional()
});

const executeSchema = Joi.object({
  tokenId: Joi.string().required(),
  operatorId: Joi.string().required(),
  operatorName: Joi.string().required(),
  requestScope: Joi.array().items(Joi.string()).optional()
});

const revokeSchema = Joi.object({
  tokenId: Joi.string().required(),
  reason: Joi.string().required(),
  operatorId: Joi.string().required(),
  operatorName: Joi.string().required()
});

const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      errorCode: 'INVALID_PARAMS',
      errorMessage: error.details[0].message
    });
  }
  next();
};

module.exports = {
  validateIssue: validate(issueSchema),
  validateVerify: validate(verifySchema),
  validateExecute: validate(executeSchema),
  validateRevoke: validate(revokeSchema)
};
