const Joi = require('joi');
const RiskService = require('../services/riskService');

const createRiskSchema = Joi.object({
  project_code: Joi.string().required().messages({
    'string.empty': '项目编号不能为空',
    'any.required': '项目编号是必填项'
  }),
  risk_description: Joi.string().required().messages({
    'string.empty': '风险描述不能为空',
    'any.required': '风险描述是必填项'
  }),
  owner: Joi.string().required().messages({
    'string.empty': '责任人不能为空',
    'any.required': '责任人是必填项'
  }),
  action_plan: Joi.string().allow('').optional(),
  close_condition: Joi.string().allow('').optional(),
  report: Joi.string().allow('').optional(),
  created_by: Joi.string().required().messages({
    'string.empty': '创建人不能为空',
    'any.required': '创建人是必填项'
  })
});

const transitionStatusSchema = Joi.object({
  to_status: Joi.string().valid(...Object.values(RiskService.getStatuses())).required().messages({
    'any.only': '无效的状态值',
    'any.required': '目标状态是必填项'
  }),
  action_by: Joi.string().required().messages({
    'string.empty': '操作人不能为空',
    'any.required': '操作人是必填项'
  }),
  comment: Joi.string().allow('').optional(),
  evidence: Joi.string().allow('').optional()
});

const manualCorrectionSchema = Joi.object({
  project_code: Joi.string().optional(),
  risk_description: Joi.string().optional(),
  owner: Joi.string().optional(),
  action_plan: Joi.string().allow('').optional(),
  close_condition: Joi.string().allow('').optional(),
  report: Joi.string().allow('').optional(),
  corrected_by: Joi.string().required().messages({
    'string.empty': '修正人不能为空',
    'any.required': '修正人是必填项'
  })
});

const resolveFailedOperationSchema = Joi.object({
  resolved_by: Joi.string().required().messages({
    'string.empty': '处理人不能为空',
    'any.required': '处理人是必填项'
  }),
  resolution_notes: Joi.string().required().messages({
    'string.empty': '处理说明不能为空',
    'any.required': '处理说明是必填项'
  }),
  final_conclusion: Joi.string().allow('').optional()
});

const validateCreateRisk = (req, res, next) => {
  const { error } = createRiskSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: error.details[0].message
    });
  }
  next();
};

const validateTransitionStatus = (req, res, next) => {
  const { error } = transitionStatusSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: error.details[0].message
    });
  }
  next();
};

const validateManualCorrection = (req, res, next) => {
  const { error } = manualCorrectionSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: error.details[0].message
    });
  }
  next();
};

const validateResolveFailedOperation = (req, res, next) => {
  const { error } = resolveFailedOperationSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: error.details[0].message
    });
  }
  next();
};

module.exports = {
  validateCreateRisk,
  validateTransitionStatus,
  validateManualCorrection,
  validateResolveFailedOperation
};
