import Joi from 'joi';
import { ReviewStatus } from '../types';

export const createBatchSchema = Joi.object({
  batchName: Joi.string().required().messages({
    'string.empty': '批次名称不能为空',
    'any.required': '批次名称是必填项'
  }),
  modelName: Joi.string().required().messages({
    'string.empty': '模型名称不能为空',
    'any.required': '模型名称是必填项'
  }),
  evaluationType: Joi.string().required().messages({
    'string.empty': '评测类型不能为空',
    'any.required': '评测类型是必填项'
  }),
  createdBy: Joi.string().required().messages({
    'string.empty': '创建人不能为空',
    'any.required': '创建人是必填项'
  })
});

export const createSampleSchema = Joi.object({
  batchId: Joi.string().uuid().required().messages({
    'string.guid': '批次ID必须是有效的UUID',
    'any.required': '批次ID是必填项'
  }),
  content: Joi.string().required().messages({
    'string.empty': '样本内容不能为空',
    'any.required': '样本内容是必填项'
  }),
  originalScore: Joi.number().min(0).max(100).required().messages({
    'number.base': '原始分数必须是数字',
    'number.min': '原始分数不能小于0',
    'number.max': '原始分数不能大于100',
    'any.required': '原始分数是必填项'
  }),
  modelOutput: Joi.string().required().messages({
    'string.empty': '模型输出不能为空',
    'any.required': '模型输出是必填项'
  }),
  expectedOutput: Joi.string().optional(),
  metadata: Joi.object().optional()
});

export const createReviewSchema = Joi.object({
  sampleId: Joi.string().uuid().required().messages({
    'string.guid': '样本ID必须是有效的UUID',
    'any.required': '样本ID是必填项'
  }),
  batchId: Joi.string().uuid().required().messages({
    'string.guid': '批次ID必须是有效的UUID',
    'any.required': '批次ID是必填项'
  }),
  reviewerId: Joi.string().required().messages({
    'string.empty': '改判人ID不能为空',
    'any.required': '改判人ID是必填项'
  }),
  reviewerName: Joi.string().required().messages({
    'string.empty': '改判人姓名不能为空',
    'any.required': '改判人姓名是必填项'
  }),
  reviewOpinion: Joi.string().required().messages({
    'string.empty': '复核意见不能为空',
    'any.required': '复核意见是必填项'
  }),
  revisedScore: Joi.number().min(0).max(100).optional().messages({
    'number.base': '改判分数必须是数字',
    'number.min': '改判分数不能小于0',
    'number.max': '改判分数不能大于100'
  }),
  processingBasis: Joi.string().optional(),
  rawInput: Joi.any().optional()
});

export const updateReviewStatusSchema = Joi.object({
  status: Joi.string().valid(...Object.values(ReviewStatus)).required().messages({
    'any.only': '无效的状态值',
    'any.required': '状态是必填项'
  }),
  updatedBy: Joi.string().required().messages({
    'string.empty': '操作人不能为空',
    'any.required': '操作人是必填项'
  })
});

export const manualCorrectionSchema = Joi.object({
  revisedScore: Joi.number().min(0).max(100).required().messages({
    'number.base': '改判分数必须是数字',
    'number.min': '改判分数不能小于0',
    'number.max': '改判分数不能大于100',
    'any.required': '改判分数是必填项'
  }),
  reviewOpinion: Joi.string().required().messages({
    'string.empty': '复核意见不能为空',
    'any.required': '复核意见是必填项'
  }),
  reviewerId: Joi.string().required().messages({
    'string.empty': '改判人ID不能为空',
    'any.required': '改判人ID是必填项'
  }),
  reviewerName: Joi.string().required().messages({
    'string.empty': '改判人姓名不能为空',
    'any.required': '改判人姓名是必填项'
  }),
  processingBasis: Joi.string().optional()
});

export const exportReportSchema = Joi.object({
  batchId: Joi.string().uuid().required().messages({
    'string.guid': '批次ID必须是有效的UUID',
    'any.required': '批次ID是必填项'
  }),
  format: Joi.string().valid('json', 'csv').default('json').messages({
    'any.only': '导出格式仅支持json或csv'
  }),
  generatedBy: Joi.string().required().messages({
    'string.empty': '导出人不能为空',
    'any.required': '导出人是必填项'
  })
});
