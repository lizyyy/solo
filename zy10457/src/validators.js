const Joi = require('joi');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

function validateInput(options) {
  const schema = Joi.object({
    input: Joi.string()
      .required()
      .custom((value, helpers) => {
        if (!fs.existsSync(value)) {
          return helpers.message(`输入文件不存在: ${path.resolve(value)}`);
        }
        if (!fs.statSync(value).isFile()) {
          return helpers.message(`输入路径不是文件: ${path.resolve(value)}`);
        }
        return value;
      })
      .messages({
        'any.required': '必须指定输入文件路径 (-i, --input)',
      }),

    alerts: Joi.string()
      .allow(null)
      .custom((value, helpers) => {
        if (value && !fs.existsSync(value)) {
          return helpers.message(`告警数据文件不存在: ${path.resolve(value)}`);
        }
        if (value && !fs.statSync(value).isFile()) {
          return helpers.message(`告警数据路径不是文件: ${path.resolve(value)}`);
        }
        return value;
      }),

    output: Joi.string().required().messages({
      'any.required': '必须指定输出目录 (-o, --output)',
    }),

    force: Joi.boolean().default(false),
    strict: Joi.boolean().default(false),
    riskThreshold: Joi.number()
      .integer()
      .min(1)
      .max(365)
      .messages({
        'number.base': '风险阈值必须是数字',
        'number.min': '风险阈值至少为1天',
        'number.max': '风险阈值不能超过365天',
      }),

    matchThreshold: Joi.number()
      .integer()
      .min(0)
      .max(100)
      .messages({
        'number.base': '匹配阈值必须是数字',
        'number.min': '匹配阈值至少为0%',
        'number.max': '匹配阈值不能超过100%',
      }),
  }).unknown(true);

  const { error, value } = schema.validate(options, { abortEarly: false });

  if (error) {
    const errorMessages = error.details.map(d => `  ✗ ${d.message}`).join('\n');
    console.error(chalk.red('\n参数校验失败:\n') + errorMessages + '\n');
    console.error(chalk.gray('使用 --help 查看帮助信息\n'));
    process.exit(1);
  }

  return value;
}

const silenceSchema = Joi.object({
  id: Joi.string().required().messages({
    'any.required': '缺少必要字段: id',
  }),
  status: Joi.object({
    state: Joi.string().valid('active', 'expired', 'pending').required(),
  }).unknown(true).required(),
  startsAt: Joi.alternatives().try(Joi.date(), Joi.string()).required(),
  endsAt: Joi.alternatives().try(Joi.date(), Joi.string()).required(),
  createdAt: Joi.alternatives().try(Joi.date(), Joi.string()).required(),
  createdBy: Joi.string().required().messages({
    'any.required': '缺少必要字段: createdBy (创建人)',
  }),
  comment: Joi.string().allow(''),
  matchers: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().required(),
        value: Joi.string().required(),
        isRegex: Joi.boolean().default(false),
        isEqual: Joi.boolean().default(true),
      })
    )
    .min(1)
    .required()
    .messages({
      'array.min': '静默规则至少需要一个匹配器 (matchers)',
      'any.required': '缺少必要字段: matchers',
    }),
}).unknown(true);

function validateSilenceData(silences) {
  const validSilences = [];
  const validationErrors = [];

  silences.forEach((silence, index) => {
    const { error, value } = silenceSchema.validate(silence, { abortEarly: false });
    
    if (error) {
      validationErrors.push({
        type: 'VALIDATION_ERROR',
        recordIndex: index,
        recordId: silence.id || 'unknown',
        errors: error.details.map(d => d.message),
        rawRecord: silence,
        source: silence.__source || { line: index + 2, position: 'unknown' },
      });
    } else {
      validSilences.push({
        ...value,
        __source: silence.__source,
      });
    }
  });

  return { validSilences, validationErrors };
}

module.exports = {
  validateInput,
  validateSilenceData,
};
