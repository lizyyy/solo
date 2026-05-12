const Joi = require('joi');

function validateSubmissionData(data, versionFields) {
  const errors = [];
  const validData = {};

  for (const field of versionFields) {
    if (field.deleted) continue;
    
    const fieldValue = data[field.name];
    const fieldExists = data.hasOwnProperty(field.name);

    if (field.required && !fieldExists) {
      errors.push({
        field: field.name,
        message: `字段 '${field.label}' (${field.name}) 是必填项`
      });
      continue;
    }

    if (fieldExists && fieldValue !== undefined && fieldValue !== null) {
      const validationResult = validateFieldType(fieldValue, field);
      if (!validationResult.valid) {
        errors.push({
          field: field.name,
          message: validationResult.message
        });
        continue;
      }

      if (field.validation && Object.keys(field.validation).length > 0) {
        const ruleResult = applyValidationRules(fieldValue, field);
        if (!ruleResult.valid) {
          errors.push({
            field: field.name,
            message: ruleResult.message
          });
          continue;
        }
      }

      validData[field.name] = fieldValue;
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors,
    data: validData
  };
}

function validateFieldType(value, field) {
  switch (field.type) {
    case 'text':
    case 'textarea':
      if (typeof value !== 'string') {
        return { valid: false, message: `字段 '${field.label}' 必须是字符串` };
      }
      break;

    case 'number':
      if (typeof value !== 'number' || isNaN(value)) {
        return { valid: false, message: `字段 '${field.label}' 必须是数字` };
      }
      break;

    case 'email':
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (typeof value !== 'string' || !emailRegex.test(value)) {
        return { valid: false, message: `字段 '${field.label}' 必须是有效的邮箱地址` };
      }
      break;

    case 'date':
      if (value instanceof Date) {
        if (isNaN(value.getTime())) {
          return { valid: false, message: `字段 '${field.label}' 必须是有效的日期` };
        }
      } else if (typeof value === 'string') {
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          return { valid: false, message: `字段 '${field.label}' 必须是有效的日期` };
        }
      } else {
        return { valid: false, message: `字段 '${field.label}' 必须是有效的日期` };
      }
      break;

    case 'select':
      if (field.options && field.options.length > 0) {
        if (!field.options.includes(value)) {
          return { valid: false, message: `字段 '${field.label}' 必须是选项之一: ${field.options.join(', ')}` };
        }
      }
      break;

    case 'checkbox':
      if (typeof value !== 'boolean') {
        return { valid: false, message: `字段 '${field.label}' 必须是布尔值` };
      }
      break;

    default:
      return { valid: false, message: `未知的字段类型: ${field.type}` };
  }

  return { valid: true };
}

function applyValidationRules(value, field) {
  const rules = field.validation;

  if (rules.minLength !== undefined) {
    if (typeof value === 'string' && value.length < rules.minLength) {
      return { valid: false, message: `字段 '${field.label}' 最小长度为 ${rules.minLength}` };
    }
  }

  if (rules.maxLength !== undefined) {
    if (typeof value === 'string' && value.length > rules.maxLength) {
      return { valid: false, message: `字段 '${field.label}' 最大长度为 ${rules.maxLength}` };
    }
  }

  if (rules.min !== undefined) {
    if (typeof value === 'number' && value < rules.min) {
      return { valid: false, message: `字段 '${field.label}' 最小值为 ${rules.min}` };
    }
  }

  if (rules.max !== undefined) {
    if (typeof value === 'number' && value > rules.max) {
      return { valid: false, message: `字段 '${field.label}' 最大值为 ${rules.max}` };
    }
  }

  if (rules.pattern !== undefined) {
    const regex = new RegExp(rules.pattern);
    if (typeof value === 'string' && !regex.test(value)) {
      return { valid: false, message: `字段 '${field.label}' 格式不正确` };
    }
  }

  return { valid: true };
}

function validateFieldDefinition(field) {
  const schema = Joi.object({
    name: Joi.string().required().pattern(/^[a-zA-Z_][a-zA-Z0-9_]*$/).messages({
      'string.pattern.base': '字段名必须以字母或下划线开头，只能包含字母、数字和下划线'
    }),
    type: Joi.string().valid('text', 'number', 'email', 'date', 'select', 'checkbox', 'textarea').required(),
    label: Joi.string().required(),
    required: Joi.boolean().optional(),
    validation: Joi.object().optional(),
    options: Joi.array().items(Joi.string()).optional(),
    migrationNote: Joi.string().optional()
  });

  return schema.validate(field);
}

module.exports = {
  validateSubmissionData,
  validateFieldType,
  applyValidationRules,
  validateFieldDefinition
};