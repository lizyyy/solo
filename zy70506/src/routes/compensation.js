const express = require('express');
const Joi = require('joi');
const { Parser } = require('json2csv');
const CompensationService = require('../services/compensationService');

const router = express.Router();

const createSchema = Joi.object({
  approval_no: Joi.string().required().messages({
    'string.empty': '审批单号不能为空',
    'any.required': '审批单号是必填项'
  }),
  business_order_no: Joi.string().required().messages({
    'string.empty': '业务单据号不能为空',
    'any.required': '业务单据号是必填项'
  }),
  callback_event: Joi.string().required().messages({
    'string.empty': '回调事件不能为空',
    'any.required': '回调事件是必填项'
  }),
  compensation_action: Joi.string().required().messages({
    'string.empty': '补偿动作不能为空',
    'any.required': '补偿动作是必填项'
  }),
  raw_input: Joi.object().optional(),
  created_by: Joi.string().required().messages({
    'string.empty': '创建人不能为空',
    'any.required': '创建人是必填项'
  }),
  max_retry: Joi.number().integer().min(1).max(10).default(3)
});

const startSchema = Joi.object({
  operator: Joi.string().required().messages({
    'string.empty': '操作人不能为空',
    'any.required': '操作人是必填项'
  })
});

const processSchema = Joi.object({
  processing_evidence: Joi.object().required().messages({
    'any.required': '处理依据是必填项'
  })
});

const manualFixSchema = Joi.object({
  handled_by: Joi.string().required().messages({
    'string.empty': '处理人不能为空',
    'any.required': '处理人是必填项'
  }),
  final_conclusion: Joi.object().required().messages({
    'any.required': '最终结论是必填项'
  }),
  raw_input_override: Joi.object().optional()
});

const cancelSchema = Joi.object({
  operator: Joi.string().required(),
  reason: Joi.string().required()
});

const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: '参数验证失败',
      details: error.details.map(d => ({
        field: d.path.join('.'),
        message: d.message
      }))
    });
  }
  next();
};

router.post('/', validate(createSchema), async (req, res) => {
  try {
    const result = await CompensationService.createCompensation(req.body);
    res.status(201).json({
      code: 'SUCCESS',
      message: '补偿记录创建成功',
      data: result
    });
  } catch (err) {
    handleError(res, err);
  }
});

router.get('/', async (req, res) => {
  try {
    const result = await CompensationService.queryCompensations(req.query);
    res.json({
      code: 'SUCCESS',
      message: '查询成功',
      data: result.list,
      pagination: result.pagination
    });
  } catch (err) {
    handleError(res, err);
  }
});

router.get('/export', async (req, res) => {
  try {
    const data = await CompensationService.exportCompensations(req.query);
    const parser = new Parser();
    const csv = parser.parse(data);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="compensation_${Date.now()}.csv"`);
    res.send('\uFEFF' + csv);
  } catch (err) {
    handleError(res, err);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await CompensationService.getCompensationById(req.params.id);
    if (!result) {
      return res.status(404).json({
        code: 'NOT_FOUND',
        message: '补偿记录不存在'
      });
    }
    res.json({
      code: 'SUCCESS',
      message: '查询成功',
      data: result
    });
  } catch (err) {
    handleError(res, err);
  }
});

router.get('/:id/logs', async (req, res) => {
  try {
    const logs = await CompensationService.getLogs(req.params.id);
    res.json({
      code: 'SUCCESS',
      message: '查询成功',
      data: logs
    });
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/identify-gap', async (req, res) => {
  try {
    const gaps = await CompensationService.identifyGap(req.body.approvals || []);
    res.json({
      code: 'SUCCESS',
      message: '缺口识别完成',
      data: gaps,
      gap_count: gaps.length
    });
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/:id/start', validate(startSchema), async (req, res) => {
  try {
    const result = await CompensationService.startCompensation(req.params.id, req.body.operator);
    res.json({
      code: 'SUCCESS',
      message: '补偿开始执行',
      data: result
    });
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/:id/process', validate(processSchema), async (req, res) => {
  try {
    const result = await CompensationService.processCompensation(req.params.id, req.body.processing_evidence);
    res.json({
      code: 'SUCCESS',
      message: '补偿处理完成',
      data: result
    });
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/:id/manual-fix', validate(manualFixSchema), async (req, res) => {
  try {
    const result = await CompensationService.manualFix(req.params.id, req.body);
    res.json({
      code: 'SUCCESS',
      message: '人工修正完成',
      data: result
    });
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/:id/cancel', validate(cancelSchema), async (req, res) => {
  try {
    const result = await CompensationService.cancelCompensation(req.params.id, req.body.operator, req.body.reason);
    res.json({
      code: 'SUCCESS',
      message: '补偿已取消',
      data: result
    });
  } catch (err) {
    handleError(res, err);
  }
});

router.get('/constants/status', (req, res) => {
  res.json({
    code: 'SUCCESS',
    data: CompensationService.STATUS
  });
});

function handleError(res, err) {
  if (err.code && err.message) {
    const statusMap = {
      'NOT_FOUND': 404,
      'DUPLICATE_COMPENSATION': 409,
      'COMPENSATION_IN_PROGRESS': 409,
      'INVALID_STATUS_TRANSITION': 400,
      'MAX_RETRY_EXCEEDED': 400,
      'INVALID_STATUS': 400
    };
    res.status(statusMap[err.code] || 400).json({
      code: err.code,
      message: err.message,
      details: err.details || null
    });
  } else {
    console.error(err);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: '服务器内部错误',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
}

module.exports = router;