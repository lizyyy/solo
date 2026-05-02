const express = require('express');
const router = express.Router();
const planStateMachine = require('../services/plan-state-machine');
const conflictChecker = require('../services/conflict-checker');
const timeRules = require('../services/time-rules');

/**
 * 封锁计划管理 API
 */

/**
 * 获取计划列表
 */
router.get('/', (req, res) => {
  try {
    const { status, line_id, start_time_from, start_time_to, is_emergency, limit, offset } = req.query;
    
    const options = {};
    if (status) options.status = status;
    if (line_id) options.line_id = line_id;
    if (start_time_from) options.start_time_from = start_time_from;
    if (start_time_to) options.start_time_to = start_time_to;
    if (is_emergency !== undefined) options.is_emergency = is_emergency === 'true';
    if (limit) options.limit = parseInt(limit);
    if (offset) options.offset = parseInt(offset);
    
    const plans = planStateMachine.getPlans(options);
    
    res.json({
      success: true,
      data: plans,
      count: plans.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取单个计划
 */
router.get('/:id', (req, res) => {
  try {
    const plan = planStateMachine.getPlanById(req.params.id);
    if (!plan) {
      return res.status(404).json({
        success: false,
        error: '计划不存在'
      });
    }
    res.json({
      success: true,
      data: plan
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 创建计划
 */
router.post('/', (req, res) => {
  try {
    const { line_id, work_type, start_time, end_time, section_ids } = req.body;
    
    if (!line_id || !work_type || !start_time || !end_time || !section_ids) {
      return res.status(400).json({
        success: false,
        error: '缺少必要字段: line_id, work_type, start_time, end_time, section_ids'
      });
    }
    
    const plan = planStateMachine.createPlan(req.body);
    
    res.status(201).json({
      success: true,
      data: plan,
      message: '计划创建成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 更新计划
 */
router.put('/:id', (req, res) => {
  try {
    const plan = planStateMachine.updatePlan(req.params.id, req.body);
    res.json({
      success: true,
      data: plan,
      message: '计划更新成功'
    });
  } catch (error) {
    if (error.message.includes('不存在')) {
      res.status(404).json({
        success: false,
        error: error.message
      });
    } else {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
});

/**
 * 删除计划
 */
router.delete('/:id', (req, res) => {
  try {
    planStateMachine.deletePlan(req.params.id);
    res.json({
      success: true,
      message: '计划删除成功'
    });
  } catch (error) {
    if (error.message.includes('不存在')) {
      res.status(404).json({
        success: false,
        error: error.message
      });
    } else {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
});

// ==================== 状态流转 ====================

/**
 * 提交计划审批
 */
router.post('/:id/submit', (req, res) => {
  try {
    const plan = planStateMachine.submitPlan(req.params.id);
    res.json({
      success: true,
      data: plan,
      message: '计划已提交审批'
    });
  } catch (error) {
    if (error.message.includes('不存在')) {
      res.status(404).json({
        success: false,
        error: error.message
      });
    } else {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
});

/**
 * 审批通过计划
 */
router.post('/:id/approve', (req, res) => {
  try {
    const { notes } = req.body;
    const plan = planStateMachine.approvePlan(req.params.id, notes);
    res.json({
      success: true,
      data: plan,
      message: '计划已审批通过'
    });
  } catch (error) {
    if (error.message.includes('不存在')) {
      res.status(404).json({
        success: false,
        error: error.message
      });
    } else if (error.message.includes('冲突')) {
      res.status(409).json({
        success: false,
        error: error.message,
        code: 'CONFLICT_DETECTED'
      });
    } else {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
});

/**
 * 拒绝计划
 */
router.post('/:id/reject', (req, res) => {
  try {
    const { reason } = req.body;
    const plan = planStateMachine.rejectPlan(req.params.id, reason);
    res.json({
      success: true,
      data: plan,
      message: '计划已拒绝'
    });
  } catch (error) {
    if (error.message.includes('不存在')) {
      res.status(404).json({
        success: false,
        error: error.message
      });
    } else {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
});

/**
 * 撤销计划
 */
router.post('/:id/cancel', (req, res) => {
  try {
    const { reason } = req.body;
    const plan = planStateMachine.cancelPlan(req.params.id, reason);
    res.json({
      success: true,
      data: plan,
      message: '计划已撤销'
    });
  } catch (error) {
    if (error.message.includes('不存在')) {
      res.status(404).json({
        success: false,
        error: error.message
      });
    } else {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
});

// ==================== 冲突检查 ====================

/**
 * 检查计划冲突
 */
router.post('/:id/check-conflicts', (req, res) => {
  try {
    const plan = planStateMachine.getPlanById(req.params.id);
    if (!plan) {
      return res.status(404).json({
        success: false,
        error: '计划不存在'
      });
    }
    
    const result = conflictChecker.performFullCheck(plan);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取计划冲突检查历史
 */
router.get('/:id/conflict-history', (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const history = conflictChecker.getPlanConflictHistory(req.params.id, parseInt(limit));
    
    res.json({
      success: true,
      data: history,
      count: history.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 检查夜间窗口
 */
router.post('/validate-night-window', (req, res) => {
  try {
    const { start_time, end_time, first_train_time } = req.body;
    
    if (!start_time || !end_time) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数: start_time, end_time'
      });
    }
    
    const result = timeRules.validateNightWindow(
      { start: start_time, end: end_time },
      { first_train_time }
    );
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 检查时间重叠
 */
router.post('/check-time-overlap', (req, res) => {
  try {
    const { periods } = req.body;
    
    if (!periods || !Array.isArray(periods) || periods.length < 2) {
      return res.status(400).json({
        success: false,
        error: '请提供至少两个时间段进行检查'
      });
    }
    
    const overlaps = timeRules.checkMultipleTimeOverlaps(periods);
    
    res.json({
      success: true,
      data: {
        has_overlaps: overlaps.length > 0,
        overlaps: overlaps
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== 版本历史 ====================

/**
 * 获取计划版本历史
 */
router.get('/:id/versions', (req, res) => {
  try {
    const versions = planStateMachine.getPlanVersions(req.params.id);
    
    res.json({
      success: true,
      data: versions,
      count: versions.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取状态流转信息
 */
router.get('/status/transitions', (req, res) => {
  res.json({
    success: true,
    data: {
      states: planStateMachine.PLAN_STATES,
      transitions: planStateMachine.STATE_TRANSITIONS
    }
  });
});

module.exports = router;
