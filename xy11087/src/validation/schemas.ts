import Joi from 'joi';
import { ReplenishmentAbnormalType, ReplenishmentAbnormalStatus } from '../types';

export const importRowSchema = Joi.object({
  abnormalNo: Joi.string().required().messages({
    'any.required': '异常单号不能为空',
    'string.empty': '异常单号不能为空'
  }),
  machineId: Joi.string().required().messages({
    'any.required': '机器ID不能为空',
    'string.empty': '机器ID不能为空'
  }),
  machineName: Joi.string().required().messages({
    'any.required': '机器名称不能为空',
    'string.empty': '机器名称不能为空'
  }),
  pointId: Joi.string().required().messages({
    'any.required': '点位ID不能为空',
    'string.empty': '点位ID不能为空'
  }),
  pointName: Joi.string().required().messages({
    'any.required': '点位名称不能为空',
    'string.empty': '点位名称不能为空'
  }),
  pointAddress: Joi.string().required().messages({
    'any.required': '点位地址不能为空',
    'string.empty': '点位地址不能为空'
  }),
  channelNo: Joi.string().required().messages({
    'any.required': '货道号不能为空',
    'string.empty': '货道号不能为空'
  }),
  channelName: Joi.string().required().messages({
    'any.required': '货道名称不能为空',
    'string.empty': '货道名称不能为空'
  }),
  productSku: Joi.string().required().messages({
    'any.required': '商品SKU不能为空',
    'string.empty': '商品SKU不能为空'
  }),
  productName: Joi.string().required().messages({
    'any.required': '商品名称不能为空',
    'string.empty': '商品名称不能为空'
  }),
  actualProductSku: Joi.string().allow(null, ''),
  actualProductName: Joi.string().allow(null, ''),
  abnormalType: Joi.string().valid(...Object.values(ReplenishmentAbnormalType)).required().messages({
    'any.required': '异常类型不能为空',
    'any.only': `异常类型必须是以下值之一: ${Object.values(ReplenishmentAbnormalType).join(', ')}`
  }),
  abnormalTypeDesc: Joi.string().required().messages({
    'any.required': '异常类型描述不能为空',
    'string.empty': '异常类型描述不能为空'
  }),
  abnormalStatus: Joi.string().valid(...Object.values(ReplenishmentAbnormalStatus)).required().messages({
    'any.required': '异常状态不能为空',
    'any.only': `异常状态必须是以下值之一: ${Object.values(ReplenishmentAbnormalStatus).join(', ')}`
  }),
  expectedQty: Joi.number().integer().min(0).required().messages({
    'any.required': '期望补货数量不能为空',
    'number.base': '期望补货数量必须是数字',
    'number.integer': '期望补货数量必须是整数',
    'number.min': '期望补货数量不能小于0'
  }),
  actualQty: Joi.number().integer().min(0).required().messages({
    'any.required': '实际补货数量不能为空',
    'number.base': '实际补货数量必须是数字',
    'number.integer': '实际补货数量必须是整数',
    'number.min': '实际补货数量不能小于0'
  }),
  diffQty: Joi.number().integer().required().messages({
    'any.required': '补货差异数量不能为空',
    'number.base': '补货差异数量必须是数字',
    'number.integer': '补货差异数量必须是整数'
  }),
  replenishmentTime: Joi.date().required().messages({
    'any.required': '补货时间不能为空',
    'date.base': '补货时间格式不正确'
  }),
  operatorId: Joi.string().required().messages({
    'any.required': '操作人ID不能为空',
    'string.empty': '操作人ID不能为空'
  }),
  operatorName: Joi.string().required().messages({
    'any.required': '操作人姓名不能为空',
    'string.empty': '操作人姓名不能为空'
  }),
  handlerId: Joi.string().allow(null, ''),
  handlerName: Joi.string().allow(null, ''),
  remark: Joi.string().allow(null, '')
});

export const addRemarkSchema = Joi.object({
  abnormalNo: Joi.string().required().messages({
    'any.required': '异常单号不能为空',
    'string.empty': '异常单号不能为空'
  }),
  remark: Joi.string().required().messages({
    'any.required': '备注内容不能为空',
    'string.empty': '备注内容不能为空'
  }),
  operatorId: Joi.string().required().messages({
    'any.required': '操作人ID不能为空',
    'string.empty': '操作人ID不能为空'
  }),
  operatorName: Joi.string().required().messages({
    'any.required': '操作人姓名不能为空',
    'string.empty': '操作人姓名不能为空'
  })
});

export const statusUpdateSchema = Joi.object({
  abnormalNo: Joi.string().required(),
  targetStatus: Joi.string().valid(...Object.values(ReplenishmentAbnormalStatus)).required(),
  operatorId: Joi.string().required(),
  operatorName: Joi.string().required(),
  remark: Joi.string().allow(null, '')
});
