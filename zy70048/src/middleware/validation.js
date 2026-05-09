const Joi = require('joi');
const { ValidationError } = require('../utils/errors');

const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, {
      abortEarly: false,
      allowUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      
      throw new ValidationError(
        '请求参数验证失败',
        { validationErrors: errors }
      );
    }

    next();
  };
};

const lineStopSchema = Joi.object({
  lineCode: Joi.string().min(1).max(50).required().label('产线编号'),
  lineName: Joi.string().max(100).optional().label('产线名称'),
  stopTime: Joi.date().optional().label('停线时间'),
  operator: Joi.string().min(1).max(50).required().label('操作人'),
  initialDescription: Joi.string().optional().label('初始描述'),
  estimatedDuration: Joi.number().integer().min(0).optional().label('预估时长')
});

const reasonSchema = Joi.object({
  category: Joi.string()
    .valid('EQUIPMENT', 'MATERIAL', 'PERSONNEL', 'OTHER')
    .required().label('原因类别'),
  subCategory: Joi.string().max(100).optional().label('子类别'),
  source: Joi.string().min(1).max(50).required().label('记录来源'),
  reporter: Joi.string().min(1).max(50).required().label('报告人'),
  description: Joi.string().min(1).required().label('原因描述'),
  evidence: Joi.string().optional().label('证据'),
  timestamp: Joi.date().optional().label('记录时间'),
  confidence: Joi.number().min(0).max(1).optional().label('置信度')
});

const reasonConfirmSchema = Joi.object({
  operator: Joi.string().min(1).max(50).required().label('操作人'),
  isPrimary: Joi.boolean().optional().label('是否为主要原因')
});

const reasonRejectSchema = Joi.object({
  operator: Joi.string().min(1).max(50).required().label('操作人'),
  rejectReason: Joi.string().min(1).required().label('拒绝原因')
});

const responsibilitySchema = Joi.object({
  responsibleDepartment: Joi.string().min(1).max(100).required().label('责任部门'),
  responsiblePerson: Joi.string().min(1).max(50).required().label('责任人'),
  reason: Joi.string().min(1).required().label('责任原因'),
  severity: Joi.string()
    .valid('MINOR', 'MEDIUM', 'MAJOR', 'CRITICAL')
    .optional().label('严重程度'),
  correctiveAction: Joi.string().optional().label('纠正措施'),
  preventiveAction: Joi.string().optional().label('预防措施'),
  confirmedBy: Joi.string().min(1).max(50).required().label('确认人'),
  confirmedAt: Joi.date().optional().label('确认时间')
});

const recoveryStartSchema = Joi.object({
  operator: Joi.string().min(1).max(50).required().label('操作人'),
  actions: Joi.string().min(1).required().label('复产措施'),
  verificationItems: Joi.array().items(Joi.object()).optional().label('验证项目'),
  startTime: Joi.date().optional().label('开始时间')
});

const recoveryUpdateSchema = Joi.object({
  actions: Joi.string().optional().label('复产措施'),
  verificationItems: Joi.array().items(Joi.object()).optional().label('验证项目'),
  status: Joi.string()
    .valid('IN_PROGRESS', 'VERIFYING')
    .optional().label('状态')
});

const recoveryCompleteSchema = Joi.object({
  operator: Joi.string().min(1).max(50).required().label('操作人'),
  remarks: Joi.string().optional().label('备注'),
  endTime: Joi.date().optional().label('结束时间')
});

const recoveryFailSchema = Joi.object({
  operator: Joi.string().min(1).max(50).required().label('操作人'),
  failureReason: Joi.string().min(1).required().label('失败原因'),
  endTime: Joi.date().optional().label('结束时间')
});

const reportCreateSchema = Joi.object({
  summary: Joi.string().min(1).required().label('事件概述'),
  rootCause: Joi.string().min(1).required().label('根因分析'),
  impactAnalysis: Joi.string().optional().label('影响分析'),
  correctiveActions: Joi.string().min(1).required().label('纠正措施'),
  preventiveActions: Joi.string().min(1).required().label('预防措施'),
  learnedLessons: Joi.string().optional().label('经验教训'),
  preparedBy: Joi.string().min(1).max(50).required().label('起草人'),
  preparedAt: Joi.date().optional().label('起草时间')
});

const reportUpdateSchema = Joi.object({
  summary: Joi.string().optional().label('事件概述'),
  rootCause: Joi.string().optional().label('根因分析'),
  impactAnalysis: Joi.string().optional().label('影响分析'),
  correctiveActions: Joi.string().optional().label('纠正措施'),
  preventiveActions: Joi.string().optional().label('预防措施'),
  learnedLessons: Joi.string().optional().label('经验教训')
});

const reportSubmitSchema = Joi.object({
  operator: Joi.string().min(1).max(50).required().label('操作人')
});

const reportApproveSchema = Joi.object({
  operator: Joi.string().min(1).max(50).required().label('审批人'),
  comments: Joi.string().optional().label('审批意见')
});

const reportRejectSchema = Joi.object({
  operator: Joi.string().min(1).max(50).required().label('审批人'),
  rejectReason: Joi.string().min(1).required().label('拒绝原因')
});

const appealSchema = Joi.object({
  operator: Joi.string().min(1).max(50).required().label('操作人'),
  appealReason: Joi.string().min(1).required().label('申诉原因')
});

module.exports = {
  validate,
  lineStopSchema,
  reasonSchema,
  reasonConfirmSchema,
  reasonRejectSchema,
  responsibilitySchema,
  recoveryStartSchema,
  recoveryUpdateSchema,
  recoveryCompleteSchema,
  recoveryFailSchema,
  reportCreateSchema,
  reportUpdateSchema,
  reportSubmitSchema,
  reportApproveSchema,
  reportRejectSchema,
  appealSchema
};
