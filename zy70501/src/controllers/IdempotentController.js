const Joi = require('joi');
const IdempotentMediationService = require('../services/IdempotentMediationService');
const { STATUS } = require('../models/IdempotentRequest');

const createSchema = Joi.object({
  request_no: Joi.string().required().messages({
    'any.required': '请求号不能为空',
    'string.empty': '请求号不能为空'
  }),
  business_type: Joi.string().required().messages({
    'any.required': '业务类型不能为空',
    'string.empty': '业务类型不能为空'
  }),
  idempotent_key: Joi.string().required().messages({
    'any.required': '幂等键不能为空',
    'string.empty': '幂等键不能为空'
  }),
  time_window: Joi.number().integer().min(1).default(600).messages({
    'number.min': '时间窗口不能小于1秒'
  }),
  payload: Joi.object().required().messages({
    'any.required': '载荷不能为空'
  })
});

const statusSchema = Joi.object({
  status: Joi.string().valid(...Object.values(STATUS)).required().messages({
    'any.required': '状态不能为空',
    'any.only': `状态必须是: ${Object.values(STATUS).join(', ')}`
  }),
  result: Joi.any().optional(),
  operator: Joi.string().default('system')
});

const exceptionSchema = Joi.object({
  exception_info: Joi.any().required().messages({
    'any.required': '异常信息不能为空'
  }),
  operator: Joi.string().default('system')
});

const manualCorrectionSchema = Joi.object({
  status: Joi.string().valid(...Object.values(STATUS)).optional(),
  result: Joi.any().optional(),
  reason: Joi.string().required().messages({
    'any.required': '修正原因不能为空'
  }),
  processing_basis: Joi.string().optional(),
  final_conclusion: Joi.string().optional(),
  operator: Joi.string().required().messages({
    'any.required': '操作人不能为空'
  })
});

const listSchema = Joi.object({
  business_type: Joi.string().optional(),
  status: Joi.string().valid(...Object.values(STATUS)).optional(),
  page: Joi.number().integer().min(1).default(1),
  page_size: Joi.number().integer().min(1).max(100).default(20)
});

const exportSchema = Joi.object({
  business_type: Joi.string().optional(),
  status: Joi.string().valid(...Object.values(STATUS)).optional(),
  start_time: Joi.number().integer().optional(),
  end_time: Joi.number().integer().optional(),
  export_type: Joi.string().valid('requests', 'mediation', 'both').default('both')
});

class IdempotentController {
  static async createRequest(req, res) {
    try {
      const { error, value } = createSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: error.details[0].message,
          errors: error.details
        });
      }

      const result = await IdempotentMediationService.createRequest(value);

      if (!result.success && result.code === 'DUPLICATE_REQUEST_NO') {
        return res.status(409).json(result);
      }

      res.status(201).json(result);
    } catch (err) {
      console.error('创建请求失败:', err);
      res.status(500).json({
        success: false,
        code: 'INTERNAL_ERROR',
        message: '服务器内部错误',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  }

  static async getRequest(req, res) {
    try {
      const { request_no } = req.params;
      const result = await IdempotentMediationService.getRequest(request_no);

      if (!result.success) {
        return res.status(404).json(result);
      }

      res.json(result);
    } catch (err) {
      console.error('查询请求失败:', err);
      res.status(500).json({
        success: false,
        code: 'INTERNAL_ERROR',
        message: '服务器内部错误'
      });
    }
  }

  static async updateStatus(req, res) {
    try {
      const { request_no } = req.params;
      const { error, value } = statusSchema.validate(req.body);

      if (error) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: error.details[0].message,
          errors: error.details
        });
      }

      const result = await IdempotentMediationService.updateStatus(
        request_no,
        value.status,
        value.result,
        value.operator
      );

      if (!result.success) {
        return res.status(404).json(result);
      }

      res.json(result);
    } catch (err) {
      console.error('更新状态失败:', err);
      res.status(500).json({
        success: false,
        code: 'INTERNAL_ERROR',
        message: '服务器内部错误'
      });
    }
  }

  static async handleException(req, res) {
    try {
      const { request_no } = req.params;
      const { error, value } = exceptionSchema.validate(req.body);

      if (error) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: error.details[0].message,
          errors: error.details
        });
      }

      const result = await IdempotentMediationService.handleException(
        request_no,
        value.exception_info,
        value.operator
      );

      if (!result.success) {
        return res.status(404).json(result);
      }

      res.json(result);
    } catch (err) {
      console.error('异常处理失败:', err);
      res.status(500).json({
        success: false,
        code: 'INTERNAL_ERROR',
        message: '服务器内部错误'
      });
    }
  }

  static async manualCorrection(req, res) {
    try {
      const { request_no } = req.params;
      const { error, value } = manualCorrectionSchema.validate(req.body);

      if (error) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: error.details[0].message,
          errors: error.details
        });
      }

      const result = await IdempotentMediationService.manualCorrection(
        request_no,
        value,
        value.operator
      );

      if (!result.success) {
        return res.status(404).json(result);
      }

      res.json(result);
    } catch (err) {
      console.error('人工修正失败:', err);
      res.status(500).json({
        success: false,
        code: 'INTERNAL_ERROR',
        message: '服务器内部错误'
      });
    }
  }

  static async listRequests(req, res) {
    try {
      const { error, value } = listSchema.validate(req.query);

      if (error) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: error.details[0].message,
          errors: error.details
        });
      }

      const filters = {
        business_type: value.business_type,
        status: value.status
      };

      const result = await IdempotentMediationService.listRequests(
        filters,
        value.page,
        value.page_size
      );

      res.json(result);
    } catch (err) {
      console.error('查询请求列表失败:', err);
      res.status(500).json({
        success: false,
        code: 'INTERNAL_ERROR',
        message: '服务器内部错误'
      });
    }
  }

  static async listMediationRecords(req, res) {
    try {
      const { page = 1, page_size = 20, action, operator } = req.query;

      const filters = { action, operator };
      const result = await IdempotentMediationService.listMediationRecords(
        filters,
        parseInt(page),
        parseInt(page_size)
      );

      res.json(result);
    } catch (err) {
      console.error('查询调停记录失败:', err);
      res.status(500).json({
        success: false,
        code: 'INTERNAL_ERROR',
        message: '服务器内部错误'
      });
    }
  }

  static async exportData(req, res) {
    try {
      const { error, value } = exportSchema.validate(req.query);

      if (error) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: error.details[0].message,
          errors: error.details
        });
      }

      const filters = {
        business_type: value.business_type,
        status: value.status,
        start_time: value.start_time,
        end_time: value.end_time
      };

      const result = await IdempotentMediationService.exportData(
        filters,
        value.export_type
      );

      res.json(result);
    } catch (err) {
      console.error('导出数据失败:', err);
      res.status(500).json({
        success: false,
        code: 'INTERNAL_ERROR',
        message: '服务器内部错误'
      });
    }
  }
}

module.exports = IdempotentController;
