const Joi = require('joi');

const exemptionSchema = Joi.object({
  datasetName: Joi.string().required().messages({
    'string.empty': '数据集名称不能为空',
    'any.required': '数据集名称是必填项'
  }),
  datasetCode: Joi.string().required().messages({
    'string.empty': '数据集编码不能为空',
    'any.required': '数据集编码是必填项'
  }),
  fieldName: Joi.string().required().messages({
    'string.empty': '字段名称不能为空',
    'any.required': '字段名称是必填项'
  }),
  fieldAlias: Joi.string().allow(null, ''),
  fieldPath: Joi.string().allow(null, ''),
  exemptionReason: Joi.string().required().min(10).messages({
    'string.empty': '豁免原因不能为空',
    'string.min': '豁免原因至少需要10个字符',
    'any.required': '豁免原因是必填项'
  }),
  approver: Joi.string().required().messages({
    'string.empty': '审批人不能为空',
    'any.required': '审批人是必填项'
  }),
  approverEmail: Joi.string().email().allow(null, ''),
  expireDate: Joi.date().greater('now').required().messages({
    'date.greater': '到期时间必须大于当前时间',
    'any.required': '到期时间是必填项'
  }),
  createdBy: Joi.string().required().messages({
    'string.empty': '创建人不能为空',
    'any.required': '创建人是必填项'
  }),
  isNestedJson: Joi.boolean().default(false),
  metadata: Joi.object().allow(null)
});

const exportCheckSchema = Joi.object({
  exportId: Joi.string().required().messages({
    'any.required': '导出任务ID是必填项'
  }),
  datasetCode: Joi.string().required().messages({
    'any.required': '数据集编码是必填项'
  }),
  fields: Joi.array().items(Joi.string()).min(1).required().messages({
    'array.min': '至少需要指定一个导出字段',
    'any.required': '导出字段列表是必填项'
  }),
  exportedBy: Joi.string().required().messages({
    'any.required': '导出人是必填项'
  })
});

const validateExemption = (req, res, next) => {
  const { error } = exemptionSchema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({
      success: false,
      message: '参数验证失败',
      errors: error.details.map(d => ({
        field: d.path.join('.'),
        message: d.message
      }))
    });
  }
  next();
};

const validateExportCheck = (req, res, next) => {
  const { error } = exportCheckSchema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({
      success: false,
      message: '参数验证失败',
      errors: error.details.map(d => ({
        field: d.path.join('.'),
        message: d.message
      }))
    });
  }
  next();
};

module.exports = {
  validateExemption,
  validateExportCheck,
  exemptionSchema
};
