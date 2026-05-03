const Joi = require('joi');
const { AppError } = require('./errorHandler');
const { ERROR_CODES, SPLIT_TYPES, STATUS_MAP } = require('../config/constants');

class Validation {
  // 通用校验
  static schemas = {
    // 室友相关
    flatmateCreate: Joi.object({
      name: Joi.string().min(1).max(50).required()
        .messages({
          'string.empty': '姓名不能为空',
          'string.max': '姓名最多50个字符',
        }),
      email: Joi.string().email().allow(null, '').optional(),
      phone: Joi.string().pattern(/^1[3-9]\d{9}$/).allow(null, '').optional(),
      is_admin: Joi.boolean().default(false),
    }),

    flatmateUpdate: Joi.object({
      name: Joi.string().min(1).max(50).optional(),
      email: Joi.string().email().allow(null, '').optional(),
      phone: Joi.string().pattern(/^1[3-9]\d{9}$/).allow(null, '').optional(),
      is_admin: Joi.boolean().optional(),
      status: Joi.string().valid('active', 'inactive', 'left').optional(),
    }),

    // 账单相关
    billCreate: Joi.object({
      title: Joi.string().min(1).max(200).required()
        .messages({
          'string.empty': '账单标题不能为空',
          'string.max': '账单标题最多200个字符',
        }),
      description: Joi.string().allow('').optional(),
      category: Joi.string()
        .valid('utility', 'supplies', 'rent', 'service', 'other')
        .default('other'),
      total_amount: Joi.number().positive().precision(2).required()
        .messages({
          'number.positive': '账单金额必须大于0',
        }),
      split_type: Joi.string()
        .valid(...Object.values(SPLIT_TYPES))
        .required()
        .messages({
          'any.only': '无效的分摊方式',
        }),
      due_date: Joi.date().greater('now').allow(null).optional(),
      advanced_by_id: Joi.number().integer().positive().optional(),
      split_config: Joi.object().when('split_type', {
        is: Joi.string().valid(SPLIT_TYPES.RATIO, SPLIT_TYPES.SPECIFIC),
        then: Joi.object().required(),
        otherwise: Joi.object().optional(),
      }),
      notes: Joi.string().allow('').optional(),
    }),

    billSplitConfig: {
      equal: Joi.object({
        // 均摊不需要额外配置
      }),
      ratio: Joi.object({
        ratios: Joi.array().items(
          Joi.object({
            flatmate_id: Joi.number().integer().positive().required(),
            ratio: Joi.number().positive().max(1).required(),
          })
        ).min(1).required(),
      }),
      specific: Joi.object({
        assignments: Joi.array().items(
          Joi.object({
            flatmate_id: Joi.number().integer().positive().required(),
            amount: Joi.number().positive().precision(2).required(),
          })
        ).min(1).required(),
      }),
      advance: Joi.object({
        // 垫付需要 advanced_by_id
      }),
    },

    // 付款相关
    paymentCreate: Joi.object({
      bill_id: Joi.number().integer().positive().required(),
      split_rule_id: Joi.number().integer().positive().optional(),
      amount: Joi.number().positive().precision(2).required()
        .messages({
          'number.positive': '付款金额必须大于0',
        }),
      use_points: Joi.boolean().default(false),
      points_to_use: Joi.number().integer().min(0).default(0),
      payment_method: Joi.string()
        .valid('cash', 'wechat', 'alipay', 'transfer', 'points', 'other')
        .default('other'),
      transaction_id: Joi.string().allow('').optional(),
      receiver_id: Joi.number().integer().positive().optional(),
      notes: Joi.string().allow('').optional(),
    }),

    paymentConfirm: Joi.object({
      payment_id: Joi.number().integer().positive().required(),
    }),

    // 家务任务相关
    taskCreate: Joi.object({
      title: Joi.string().min(1).max(200).required()
        .messages({
          'string.empty': '任务标题不能为空',
          'string.max': '任务标题最多200个字符',
        }),
      description: Joi.string().allow('').optional(),
      category: Joi.string()
        .valid('cleaning', 'shopping', 'maintenance', 'trash', 'laundry', 'other')
        .default('other'),
      assigned_to_id: Joi.number().integer().positive().optional(),
      points_reward: Joi.number().integer().min(0).default(10),
      points_penalty: Joi.number().integer().min(0).default(5),
      priority: Joi.string().valid('low', 'medium', 'high').default('medium'),
      due_date: Joi.date().allow(null).optional(),
      is_recurring: Joi.boolean().default(false),
      recurrence_pattern: Joi.string()
        .valid('daily', 'weekly', 'biweekly', 'monthly')
        .when('is_recurring', {
          is: true,
          then: Joi.required(),
        }),
      recurrence_days: Joi.array().items(
        Joi.string().valid('Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday')
      ).optional(),
      notes: Joi.string().allow('').optional(),
    }),

    taskComplete: Joi.object({
      proof_image_url: Joi.string().uri().allow('').optional(),
    }),

    // 争议相关
    disputeCreate: Joi.object({
      dispute_type: Joi.string()
        .valid('bill', 'payment', 'chore', 'point')
        .required(),
      bill_id: Joi.number().integer().positive()
        .when('dispute_type', {
          is: 'bill',
          then: Joi.required(),
        }),
      split_rule_id: Joi.number().integer().positive().optional(),
      payment_id: Joi.number().integer().positive()
        .when('dispute_type', {
          is: 'payment',
          then: Joi.required(),
        }),
      task_id: Joi.number().integer().positive()
        .when('dispute_type', {
          is: 'chore',
          then: Joi.required(),
        }),
      title: Joi.string().min(1).max(200).required(),
      description: Joi.string().min(1).required(),
      priority: Joi.string().valid('low', 'medium', 'high').default('medium'),
      proposed_solution: Joi.string().allow('').optional(),
      evidence_image_urls: Joi.array().items(Joi.string().uri()).optional(),
      notes: Joi.string().allow('').optional(),
    }),

    disputeResolve: Joi.object({
      resolution: Joi.string().min(1).required(),
      requires_balance_recalculation: Joi.boolean().default(false),
      new_split_rules: Joi.array().items(
        Joi.object({
          flatmate_id: Joi.number().integer().positive().required(),
          amount: Joi.number().positive().precision(2).required(),
          ratio: Joi.number().positive().max(1).optional(),
          split_type: Joi.string().valid(...Object.values(SPLIT_TYPES)).optional(),
        })
      ).optional(),
      reject_payment: Joi.boolean().optional(),
      rejection_reason: Joi.string().allow('').optional(),
      confirm_payment: Joi.boolean().optional(),
      mark_as_completed: Joi.boolean().optional(),
      mark_as_missed: Joi.boolean().optional(),
      point_adjustment: Joi.number().integer().optional(),
      flatmate_id: Joi.number().integer().positive().optional(),
      notes: Joi.string().allow('').optional(),
    }),

    // 通知相关
    notificationMarkRead: Joi.object({
      notification_id: Joi.number().integer().positive().required(),
    }),

    // 导出相关
    exportOptions: Joi.object({
      start_date: Joi.date().allow(null).optional(),
      end_date: Joi.date().allow(null).optional(),
      include_bills: Joi.boolean().default(true),
      include_payments: Joi.boolean().default(true),
      include_flatmates: Joi.boolean().default(true),
      include_chores: Joi.boolean().default(true),
      include_points: Joi.boolean().default(true),
      include_disputes: Joi.boolean().default(true),
      summary_only: Joi.boolean().default(false),
    }),

    // 分页和查询参数
    pagination: Joi.object({
      limit: Joi.number().integer().min(1).max(100).default(20),
      offset: Joi.number().integer().min(0).default(0),
      status: Joi.string().optional(),
      category: Joi.string().optional(),
      start_date: Joi.date().optional(),
      end_date: Joi.date().optional(),
    }),
  };

  static validate(schema) {
    return (req, res, next) => {
      const { error, value } = schema.validate(req.body, {
        abortEarly: false,
        allowUnknown: true,
        stripUnknown: true,
      });

      if (error) {
        const errorDetails = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
        }));

        return next(
          new AppError(
            '输入参数验证失败',
            400,
            ERROR_CODES.INVALID_INPUT,
            { details: errorDetails }
          )
        );
      }

      // 将验证后的值放回 req.body
      req.body = value;
      next();
    };
  }

  static validateQuery(schema) {
    return (req, res, next) => {
      const { error, value } = schema.validate(req.query, {
        abortEarly: false,
        allowUnknown: true,
        stripUnknown: true,
      });

      if (error) {
        const errorDetails = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
        }));

        return next(
          new AppError(
            '查询参数验证失败',
            400,
            ERROR_CODES.INVALID_INPUT,
            { details: errorDetails }
          )
        );
      }

      // 将验证后的值放回 req.query
      req.query = value;
      next();
    };
  }

  // 预定义的校验中间件
  static validateFlatmateCreate = this.validate(this.schemas.flatmateCreate);
  static validateFlatmateUpdate = this.validate(this.schemas.flatmateUpdate);
  static validateBillCreate = this.validate(this.schemas.billCreate);
  static validatePaymentCreate = this.validate(this.schemas.paymentCreate);
  static validatePaymentConfirm = this.validate(this.schemas.paymentConfirm);
  static validateTaskCreate = this.validate(this.schemas.taskCreate);
  static validateTaskComplete = this.validate(this.schemas.taskComplete);
  static validateDisputeCreate = this.validate(this.schemas.disputeCreate);
  static validateDisputeResolve = this.validate(this.schemas.disputeResolve);
  static validateNotificationMarkRead = this.validate(this.schemas.notificationMarkRead);
  static validateExportOptions = this.validate(this.schemas.exportOptions);
  static validatePagination = this.validateQuery(this.schemas.pagination);
}

module.exports = Validation;
