const Joi = require('joi');
const dayjs = require('dayjs');

/**
 * 数据校验器
 * 用于验证导入数据的格式和业务规则
 */

// 日期格式校验
const dateSchema = Joi.string().custom((value, helpers) => {
  if (!value) return value;
  
  // 支持多种日期格式
  const formats = [
    'YYYY-MM-DD',
    'YYYY/MM/DD',
    'YYYY.MM.DD',
    'DD-MM-YYYY',
    'DD/MM/YYYY',
    'DD.MM.YYYY',
    'YYYY年MM月DD日'
  ];
  
  for (const format of formats) {
    if (dayjs(value, format, true).isValid()) {
      return value;
    }
  }
  
  return helpers.message('日期格式无效，支持格式: YYYY-MM-DD, YYYY/MM/DD 等');
}, '日期格式校验');

// 器材台账数据校验schema
const equipmentSchema = Joi.object({
  equipment_code: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .required()
    .messages({
      'string.empty': '器材编号不能为空',
      'any.required': '器材编号是必填项'
    }),
  
  batch_number: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .required()
    .messages({
      'string.empty': '批次号不能为空',
      'any.required': '批次号是必填项'
    }),
  
  equipment_type: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .required()
    .messages({
      'string.empty': '器材类型不能为空',
      'any.required': '器材类型是必填项'
    }),
  
  model: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .required()
    .messages({
      'string.empty': '型号不能为空',
      'any.required': '型号是必填项'
    }),
  
  manufacturer: Joi.string()
    .trim()
    .min(1)
    .max(200)
    .required()
    .messages({
      'string.empty': '生产厂家不能为空',
      'any.required': '生产厂家是必填项'
    }),
  
  production_date: dateSchema.allow(null, '').optional(),
  purchase_date: dateSchema.allow(null, '').optional(),
  expiration_date: dateSchema.allow(null, '').optional(),
  
  location: Joi.string()
    .trim()
    .max(200)
    .allow(null, '')
    .optional(),
  
  status: Joi.string()
    .trim()
    .valid('normal', 'faulty', 'maintenance', 'scrapped', 'pending')
    .default('normal')
    .optional(),
  
  is_scrapped: Joi.number()
    .valid(0, 1)
    .default(0)
    .optional()
});

// 巡检记录数据校验schema
const inspectionSchema = Joi.object({
  equipment_code: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .required()
    .messages({
      'string.empty': '器材编号不能为空',
      'any.required': '器材编号是必填项'
    }),
  
  inspection_date: dateSchema
    .required()
    .messages({
      'any.required': '巡检日期是必填项'
    }),
  
  inspector: Joi.string()
    .trim()
    .max(100)
    .allow(null, '')
    .optional(),
  
  status: Joi.string()
    .trim()
    .valid('normal', 'good', 'faulty', 'needs_repair', 'warning')
    .default('normal')
    .optional(),
  
  pressure_status: Joi.string()
    .trim()
    .valid('normal', 'high', 'low', 'unknown')
    .allow(null, '')
    .optional(),
  
  hose_status: Joi.string()
    .trim()
    .valid('good', 'cracked', 'leaking', 'missing', 'unknown')
    .allow(null, '')
    .optional(),
  
  nozzle_status: Joi.string()
    .trim()
    .valid('good', 'clogged', 'damaged', 'missing', 'unknown')
    .allow(null, '')
    .optional(),
  
  safety_pin_status: Joi.string()
    .trim()
    .valid('intact', 'missing', 'damaged', 'unknown')
    .allow(null, '')
    .optional(),
  
  appearance_status: Joi.string()
    .trim()
    .valid('good', 'dented', 'rusted', 'damaged', 'unknown')
    .allow(null, '')
    .optional(),
  
  weight_status: Joi.string()
    .trim()
    .valid('normal', 'underweight', 'overweight', 'unknown')
    .allow(null, '')
    .optional(),
  
  maintenance_suggestion: Joi.string()
    .trim()
    .max(500)
    .allow(null, '')
    .optional(),
  
  next_inspection_date: dateSchema.allow(null, '').optional()
});

// 召回清单数据校验schema
const recallSchema = Joi.object({
  recall_code: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .required()
    .messages({
      'string.empty': '召回编号不能为空',
      'any.required': '召回编号是必填项'
    }),
  
  manufacturer: Joi.string()
    .trim()
    .min(1)
    .max(200)
    .required()
    .messages({
      'string.empty': '生产厂家不能为空',
      'any.required': '生产厂家是必填项'
    }),
  
  recall_reason: Joi.string()
    .trim()
    .min(1)
    .max(1000)
    .required()
    .messages({
      'string.empty': '召回原因不能为空',
      'any.required': '召回原因是必填项'
    }),
  
  recall_date: dateSchema
    .default(() => dayjs().format('YYYY-MM-DD'))
    .optional(),
  
  deadline_date: dateSchema
    .required()
    .messages({
      'any.required': '整改期限是必填项'
    }),
  
  affected_batches: Joi.array()
    .items(Joi.string().trim().min(1).max(100))
    .min(1)
    .required()
    .messages({
      'array.min': '涉及批次不能为空',
      'any.required': '涉及批次是必填项'
    }),
  
  priority: Joi.string()
    .trim()
    .valid('low', 'medium', 'high', 'critical')
    .default('medium')
    .optional(),
  
  status: Joi.string()
    .trim()
    .valid('active', 'completed', 'closed', 'cancelled')
    .default('active')
    .optional()
});

// 派工单数据校验schema
const workOrderSchema = Joi.object({
  recall_match_id: Joi.string()
    .trim()
    .required()
    .messages({
      'any.required': '召回匹配ID是必填项'
    }),
  
  order_code: Joi.string()
    .trim()
    .max(100)
    .optional(),
  
  assigned_to: Joi.string()
    .trim()
    .max(100)
    .allow(null, '')
    .optional(),
  
  assigned_date: dateSchema.allow(null, '').optional(),
  
  deadline_date: dateSchema
    .required()
    .messages({
      'any.required': '整改期限是必填项'
    }),
  
  status: Joi.string()
    .trim()
    .valid('created', 'assigned', 'in_progress', 'completed', 'cancelled')
    .default('created')
    .optional(),
  
  actual_completion_date: dateSchema.allow(null, '').optional(),
  
  notes: Joi.string()
    .trim()
    .max(1000)
    .allow(null, '')
    .optional()
});

/**
 * 校验器材台账数据
 * @param {Object} data - 器材数据
 * @returns {Promise<{valid: boolean, errors: Array, value: Object}>}
 */
async function validateEquipment(data) {
  try {
    const value = await equipmentSchema.validateAsync(data, {
      abortEarly: false,
      convert: true
    });
    return { valid: true, errors: [], value };
  } catch (error) {
    const errors = error.details ? 
      error.details.map(detail => detail.message) : 
      [error.message];
    return { valid: false, errors, value: data };
  }
}

/**
 * 批量校验器材台账数据
 * @param {Array} dataList - 器材数据列表
 * @returns {Promise<{isValid: boolean, validData: Array, invalidData: Array, errors: Array, validCount: number, invalidCount: number}>}
 */
async function validateEquipmentBatch(dataList) {
  const valid = [];
  const invalid = [];
  const errors = [];
  
  for (let i = 0; i < dataList.length; i++) {
    const result = await validateEquipment(dataList[i]);
    if (result.valid) {
      valid.push(result.value);
    } else {
      invalid.push({
        index: i,
        data: dataList[i],
        errors: result.errors
      });
      errors.push(...result.errors.map(e => `第${i + 1}条: ${e}`));
    }
  }
  
  return {
    isValid: errors.length === 0,
    validData: valid,
    invalidData: invalid,
    errors: errors,
    validCount: valid.length,
    invalidCount: invalid.length
  };
}

/**
 * 校验巡检记录数据
 * @param {Object} data - 巡检记录数据
 * @returns {Promise<{valid: boolean, errors: Array, value: Object}>}
 */
async function validateInspection(data) {
  try {
    const value = await inspectionSchema.validateAsync(data, {
      abortEarly: false,
      convert: true
    });
    return { valid: true, errors: [], value };
  } catch (error) {
    const errors = error.details ? 
      error.details.map(detail => detail.message) : 
      [error.message];
    return { valid: false, errors, value: data };
  }
}

/**
 * 批量校验巡检记录数据
 * @param {Array} dataList - 巡检记录列表
 * @returns {Promise<{isValid: boolean, validData: Array, invalidData: Array, errors: Array, validCount: number, invalidCount: number}>}
 */
async function validateInspectionBatch(dataList) {
  const valid = [];
  const invalid = [];
  const errors = [];
  
  for (let i = 0; i < dataList.length; i++) {
    const result = await validateInspection(dataList[i]);
    if (result.valid) {
      valid.push(result.value);
    } else {
      invalid.push({
        index: i,
        data: dataList[i],
        errors: result.errors
      });
      errors.push(...result.errors.map(e => `第${i + 1}条: ${e}`));
    }
  }
  
  return {
    isValid: errors.length === 0,
    validData: valid,
    invalidData: invalid,
    errors: errors,
    validCount: valid.length,
    invalidCount: invalid.length
  };
}

/**
 * 校验召回清单数据
 * @param {Object} data - 召回清单数据
 * @returns {Promise<{valid: boolean, errors: Array, value: Object}>}
 */
async function validateRecall(data) {
  try {
    const value = await recallSchema.validateAsync(data, {
      abortEarly: false,
      convert: true
    });
    return { valid: true, errors: [], value };
  } catch (error) {
    const errors = error.details ? 
      error.details.map(detail => detail.message) : 
      [error.message];
    return { valid: false, errors, value: data };
  }
}

/**
 * 批量校验召回清单数据
 * @param {Array} dataList - 召回清单列表
 * @returns {Promise<{isValid: boolean, validData: Array, invalidData: Array, errors: Array, validCount: number, invalidCount: number}>}
 */
async function validateRecallBatch(dataList) {
  const valid = [];
  const invalid = [];
  const errors = [];
  
  for (let i = 0; i < dataList.length; i++) {
    const result = await validateRecall(dataList[i]);
    if (result.valid) {
      valid.push(result.value);
    } else {
      invalid.push({
        index: i,
        data: dataList[i],
        errors: result.errors
      });
      errors.push(...result.errors.map(e => `第${i + 1}条: ${e}`));
    }
  }
  
  return {
    isValid: errors.length === 0,
    validData: valid,
    invalidData: invalid,
    errors: errors,
    validCount: valid.length,
    invalidCount: invalid.length
  };
}

/**
 * 校验派工单数据
 * @param {Object} data - 派工单数据
 * @returns {Promise<{valid: boolean, errors: Array, value: Object}>}
 */
async function validateWorkOrder(data) {
  try {
    const value = await workOrderSchema.validateAsync(data, {
      abortEarly: false,
      convert: true
    });
    return { valid: true, errors: [], value };
  } catch (error) {
    const errors = error.details ? 
      error.details.map(detail => detail.message) : 
      [error.message];
    return { valid: false, errors, value: data };
  }
}

module.exports = {
  validateEquipment,
  validateEquipmentBatch,
  validateInspection,
  validateInspectionBatch,
  validateRecall,
  validateRecallBatch,
  validateWorkOrder,
  schemas: {
    equipmentSchema,
    inspectionSchema,
    recallSchema,
    workOrderSchema
  }
};
