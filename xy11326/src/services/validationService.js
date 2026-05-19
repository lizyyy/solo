const Joi = require('joi');
const Operator = require('../models/Operator');
const Tractor = require('../models/Tractor');

const workRecordSchema = Joi.object({
  operatorName: Joi.string().required().messages({
    'any.required': '机手姓名不能为空',
    'string.empty': '机手姓名不能为空'
  }),
  tractorPlate: Joi.string().required().messages({
    'any.required': '拖拉机牌号不能为空',
    'string.empty': '拖拉机牌号不能为空'
  }),
  workDate: Joi.date().iso().required().messages({
    'any.required': '作业日期不能为空',
    'date.format': '作业日期格式不正确，请使用 YYYY-MM-DD 格式'
  }),
  workType: Joi.string().valid('耕地', '播种', '收割', '运输', '其他').required().messages({
    'any.required': '作业类型不能为空',
    'any.only': '作业类型必须是：耕地、播种、收割、运输、其他'
  }),
  fieldName: Joi.string().allow('', null),
  hours: Joi.number().min(0).allow(null, '').messages({
    'number.min': '作业时长不能为负数'
  }),
  acres: Joi.number().min(0).allow(null, '').messages({
    'number.min': '作业亩数不能为负数'
  }),
  fuelConsumption: Joi.number().min(0).allow(null, '').messages({
    'number.min': '油耗不能为负数'
  }),
  remarks: Joi.string().allow('', null)
});

const validateWorkRecord = async (data) => {
  const errors = [];
  
  const { error, value } = workRecordSchema.validate(data, { abortEarly: false });
  
  if (error) {
    error.details.forEach(detail => {
      errors.push({
        field: detail.path[0],
        message: detail.message
      });
    });
  }
  
  if (data.operatorName) {
    const operator = await Operator.findByName(data.operatorName);
    if (!operator) {
      errors.push({
        field: 'operatorName',
        message: `机手 "${data.operatorName}" 不存在，请先添加机手信息`
      });
    }
  }
  
  if (data.tractorPlate) {
    const tractor = await Tractor.findByPlateNumber(data.tractorPlate);
    if (!tractor) {
      errors.push({
        field: 'tractorPlate',
        message: `拖拉机 "${data.tractorPlate}" 不存在，请先添加拖拉机信息`
      });
    }
  }
  
  const hours = parseFloat(data.hours) || 0;
  const acres = parseFloat(data.acres) || 0;
  const fuel = parseFloat(data.fuelConsumption) || 0;
  
  if (hours === 0 && acres === 0 && fuel === 0) {
    errors.push({
      field: 'billing',
      message: '小时数、亩数、油耗至少需要填写一项用于计费'
    });
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    data: value
  };
};

const parseNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
};

module.exports = {
  validateWorkRecord,
  parseNumber
};
