const express = require('express');
const router = express.Router();
const Joi = require('joi');

const riskEventService = require('../services/riskEventService');
const stateMachineService = require('../services/stateMachineService');
const exportService = require('../services/exportService');

const createEventSchema = Joi.object({
  account_no: Joi.string().required(),
  username: Joi.string().optional(),
  department: Joi.string().optional(),
  role: Joi.string().optional(),
  event_type: Joi.string().optional(),
  ip_address: Joi.string().required(),
  ip_blacklisted: Joi.boolean().optional(),
  location: Joi.object({
    country: Joi.string().optional(),
    province: Joi.string().optional(),
    city: Joi.string().optional(),
    district: Joi.string().optional(),
    latitude: Joi.number().optional(),
    longitude: Joi.number().optional(),
    isp: Joi.string().optional()
  }).optional(),
  device_fingerprint: Joi.object({
    fingerprint_hash: Joi.string().required(),
    user_agent: Joi.string().optional(),
    screen_resolution: Joi.string().optional(),
    timezone: Joi.string().optional(),
    language: Joi.string().optional(),
    platform: Joi.string().optional(),
    canvas_fingerprint: Joi.string().optional(),
    webgl_fingerprint: Joi.string().optional(),
    fonts: Joi.string().optional(),
    plugins: Joi.string().optional(),
    ip_address: Joi.string().optional()
  }).required()
});

const transitionSchema = Joi.object({
  new_status: Joi.string().required(),
  operator: Joi.string().optional(),
  operator_type: Joi.string().optional(),
  reason: Joi.string().optional()
});

const dispositionSchema = Joi.object({
  action_type: Joi.string().required(),
  operator: Joi.string().optional(),
  operator_type: Joi.string().optional(),
  reason: Joi.string().optional()
});

const reviewSchema = Joi.object({
  reviewer: Joi.string().required(),
  review_result: Joi.string().required(),
  review_comment: Joi.string().optional(),
  is_false_positive: Joi.boolean().optional()
});

const manualCorrectSchema = Joi.object({
  risk_score: Joi.number().optional(),
  risk_level: Joi.string().optional(),
  event_type: Joi.string().optional(),
  operator: Joi.string().optional(),
  reason: Joi.string().optional()
});

const exceptionSchema = Joi.object({
  failure_reason: Joi.string().required(),
  operator: Joi.string().optional()
});

router.post('/', async (req, res) => {
  try {
    const { error, value } = createEventSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: '参数验证失败',
        details: error.details
      });
    }

    const event = await riskEventService.createRiskEvent(value);
    res.status(201).json({
      success: true,
      data: event
    });
  } catch (err) {
    console.error('创建风险事件失败:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

router.get('/', async (req, res) => {
  try {
    const filters = {
      account_no: req.query.account_no,
      risk_level: req.query.risk_level,
      status: req.query.status,
      start_time: req.query.start_time ? parseInt(req.query.start_time) : undefined,
      end_time: req.query.end_time ? parseInt(req.query.end_time) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit) : undefined
    };

    const events = await riskEventService.queryRiskEvents(filters);
    res.json({
      success: true,
      data: events
    });
  } catch (err) {
    console.error('查询风险事件失败:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const event = await riskEventService.getRiskEventDetail(req.params.id);
    if (!event) {
      return res.status(404).json({
        success: false,
        error: '风险事件不存在'
      });
    }
    res.json({
      success: true,
      data: event
    });
  } catch (err) {
    console.error('获取风险事件详情失败:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

router.get('/:id/history', async (req, res) => {
  try {
    const history = await riskEventService.getEventHistory(req.params.id);
    res.json({
      success: true,
      data: history
    });
  } catch (err) {
    console.error('获取历史记录失败:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

router.get('/:id/dispositions', async (req, res) => {
  try {
    const dispositions = await riskEventService.getDispositionActions(req.params.id);
    res.json({
      success: true,
      data: dispositions
    });
  } catch (err) {
    console.error('获取处置动作失败:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

router.get('/:id/review', async (req, res) => {
  try {
    const review = await riskEventService.getReviewConclusion(req.params.id);
    res.json({
      success: true,
      data: review
    });
  } catch (err) {
    console.error('获取复核结论失败:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

router.post('/:id/transition', async (req, res) => {
  try {
    const { error, value } = transitionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: '参数验证失败',
        details: error.details
      });
    }

    const result = await stateMachineService.transitionStatus(
      req.params.id,
      value.new_status,
      value.operator || 'system',
      value.operator_type || 'system',
      value.reason
    );

    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    console.error('状态转换失败:', err);
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

router.post('/:id/disposition', async (req, res) => {
  try {
    const { error, value } = dispositionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: '参数验证失败',
        details: error.details
      });
    }

    const result = await stateMachineService.applyDisposition(
      req.params.id,
      value.action_type,
      value.operator || 'system',
      value.operator_type || 'system',
      value.reason
    );

    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    console.error('执行处置动作失败:', err);
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

router.post('/:id/review', async (req, res) => {
  try {
    const { error, value } = reviewSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: '参数验证失败',
        details: error.details
      });
    }

    const result = await stateMachineService.submitReview(
      req.params.id,
      value.reviewer,
      value.review_result,
      value.review_comment,
      value.is_false_positive
    );

    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    console.error('提交复核结论失败:', err);
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

router.post('/:id/manual-correct', async (req, res) => {
  try {
    const { error, value } = manualCorrectSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: '参数验证失败',
        details: error.details
      });
    }

    const result = await riskEventService.manualCorrect(
      req.params.id,
      value,
      value.operator || 'system',
      value.reason
    );

    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    console.error('人工修正失败:', err);
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

router.post('/:id/exception', async (req, res) => {
  try {
    const { error, value } = exceptionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: '参数验证失败',
        details: error.details
      });
    }

    const result = await riskEventService.handleException(
      req.params.id,
      value.failure_reason,
      value.operator || 'system'
    );

    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    console.error('异常处理失败:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

router.get('/export/csv', async (req, res) => {
  try {
    const filters = {
      account_no: req.query.account_no,
      risk_level: req.query.risk_level,
      status: req.query.status,
      start_time: req.query.start_time ? parseInt(req.query.start_time) : undefined,
      end_time: req.query.end_time ? parseInt(req.query.end_time) : undefined
    };

    const csv = await exportService.exportToCSV(filters);
    const filename = `risk_events_export_${Date.now()}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + csv);
  } catch (err) {
    console.error('导出CSV失败:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

router.get('/:id/export/detail', async (req, res) => {
  try {
    const detail = await exportService.getExportDetail(req.params.id);
    if (!detail) {
      return res.status(404).json({
        success: false,
        error: '风险事件不存在'
      });
    }
    res.json({
      success: true,
      data: detail
    });
  } catch (err) {
    console.error('导出详情失败:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

router.get('/meta/statuses', (req, res) => {
  res.json({
    success: true,
    data: stateMachineService.STATUS_TRANSITIONS
  });
});

router.get('/meta/dispositions', (req, res) => {
  res.json({
    success: true,
    data: stateMachineService.DISPOSITION_ACTIONS
  });
});

router.get('/meta/review-results', (req, res) => {
  res.json({
    success: true,
    data: stateMachineService.REVIEW_RESULTS
  });
});

router.get('/meta/export-fields', (req, res) => {
  res.json({
    success: true,
    data: exportService.EXPORT_FIELDS
  });
});

module.exports = router;
