const Joi = require('joi');
const { ApiError } = require('./errorHandler');

const sparePartSchema = Joi.object({
  part_code: Joi.string().required().messages({
    'string.empty': '备件编码不能为空',
    'any.required': '备件编码是必填项'
  }),
  part_name: Joi.string().required().messages({
    'string.empty': '备件名称不能为空',
    'any.required': '备件名称是必填项'
  }),
  part_spec: Joi.string().allow('', null),
  part_category: Joi.string().allow('', null),
  unit: Joi.string().required().messages({
    'string.empty': '计量单位不能为空',
    'any.required': '计量单位是必填项'
  }),
  safe_stock_quantity: Joi.number().integer().min(0).required().messages({
    'number.min': '安全库存数量不能为负数',
    'any.required': '安全库存数量是必填项'
  }),
  current_stock: Joi.number().integer().min(0).required().messages({
    'number.min': '当前库存不能为负数',
    'any.required': '当前库存是必填项'
  }),
  in_transit_quantity: Joi.number().integer().min(0).default(0).messages({
    'number.min': '在途数量不能为负数'
  }),
  min_order_quantity: Joi.number().integer().min(1).default(1).messages({
    'number.min': '最小订购数量不能小于1'
  }),
  supplier_name: Joi.string().allow('', null),
  supplier_contact: Joi.string().allow('', null),
  average_daily_consumption: Joi.number().min(0).default(0).messages({
    'number.min': '日均消耗量不能为负数'
  }),
  lead_time_days: Joi.number().integer().min(0).default(7).messages({
    'number.min': '采购周期不能为负数'
  }),
  last_purchase_date: Joi.string().allow('', null),
  last_consumption_date: Joi.string().allow('', null),
  location: Joi.string().allow('', null),
  remarks: Joi.string().allow('', null)
});

const batchImportSchema = Joi.object({
  items: Joi.array().items(sparePartSchema).min(1).required().messages({
    'array.min': '批量导入至少需要一条数据',
    'any.required': 'items数组是必填项'
  }),
  update_mode: Joi.string().valid('skip', 'overwrite', 'merge').default('skip').messages({
    'any.only': '更新模式只能是 skip、overwrite 或 merge'
  })
});

const validateSparePart = (req, res, next) => {
  const { error } = sparePartSchema.validate(req.body, { abortEarly: false });
  if (error) {
    const details = error.details.map(d => ({
      field: d.path.join('.'),
      message: d.message
    }));
    return next(new ApiError(400, '请求参数验证失败', details));
  }
  next();
};

const validateBatchImport = (req, res, next) => {
  const { error } = batchImportSchema.validate(req.body, { abortEarly: false });
  if (error) {
    const details = error.details.map(d => ({
      field: d.path.join('.'),
      message: d.message
    }));
    return next(new ApiError(400, '批量导入参数验证失败', details));
  }
  next();
};

const validateId = (req, res, next) => {
  const { id } = req.params;
  if (!id || isNaN(parseInt(id))) {
    return next(new ApiError(400, '无效的ID参数，必须是数字'));
  }
  next();
};

const validatePartCode = (req, res, next) => {
  const { part_code } = req.params;
  if (!part_code || part_code.trim() === '') {
    return next(new ApiError(400, '备件编码不能为空'));
  }
  next();
};

module.exports = {
  validateSparePart,
  validateBatchImport,
  validateId,
  validatePartCode
};
