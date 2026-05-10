const express = require('express');
const router = express.Router();
const fileTaskService = require('../services/fileTaskService');
const auditService = require('../services/auditService');
const rulesEngine = require('../services/rulesEngine');

const getActor = (req) => req.headers['x-actor'] || 'system';

router.post('/review-false-positive', async (req, res) => {
  try {
    const { reviewId, isApproved, comment } = req.body;
    
    if (!reviewId || typeof isApproved === 'undefined') {
      return res.status(400).json({
        success: false,
        code: 'MISSING_PARAMS',
        message: '请提供审核编号和审核结果'
      });
    }
    
    const actor = getActor(req);
    const result = await fileTaskService.reviewFalsePositive(
      reviewId,
      actor,
      isApproved,
      comment || ''
    );
    
    res.json({
      success: true,
      code: result.isApproved ? 'FALSE_POSITIVE_APPROVED' : 'FALSE_POSITIVE_REJECTED',
      message: result.message,
      data: {
        reviewId: result.reviewId,
        taskId: result.taskId,
        isApproved: result.isApproved
      }
    });
  } catch (err) {
    console.error('审核误报失败:', err);
    
    if (err.message.includes('不存在')) {
      return res.status(404).json({
        success: false,
        code: 'REVIEW_NOT_FOUND',
        message: err.message
      });
    }
    
    if (err.message.includes('已处理')) {
      return res.status(400).json({
        success: false,
        code: 'ALREADY_REVIEWED',
        message: err.message
      });
    }
    
    res.status(500).json({
      success: false,
      code: 'REVIEW_FAILED',
      message: '审核失败',
      error: err.message
    });
  }
});

router.get('/audit/trail/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const trail = await auditService.getTaskAuditTrail(taskId);
    
    const actionDescriptions = {
      task_created: '文件任务创建',
      scan_started: '开始扫描',
      scan_completed_safe: '扫描完成（安全）',
      scan_completed_threat: '扫描完成（发现威胁）',
      download_attempt: '尝试下载',
      download_blocked: '下载被拦截',
      download_allowed: '下载被允许',
      false_positive_requested: '提交误报申请',
      false_positive_approved: '误报审核通过',
      false_positive_rejected: '误报审核被拒绝',
      rule_evaluated: '规则评估'
    };
    
    res.json({
      success: true,
      code: 'AUDIT_TRAIL_FOUND',
      message: `共查询到 ${trail.length} 条审计记录`,
      data: trail.map((item, idx) => ({
        sequence: idx + 1,
        action: item.action,
        actionDescription: actionDescriptions[item.action] || item.action,
        actor: item.actor,
        oldStatus: item.old_status,
        newStatus: item.new_status,
        ruleApplied: item.rule_applied,
        details: item.details,
        time: item.created_at
      }))
    });
  } catch (err) {
    console.error('查询审计轨迹失败:', err);
    res.status(500).json({
      success: false,
      code: 'AUDIT_QUERY_FAILED',
      message: '查询审计轨迹失败',
      error: err.message
    });
  }
});

router.get('/audit/query', async (req, res) => {
  try {
    const { taskId, action, actor, startTime, endTime, ruleApplied, limit } = req.query;
    
    const filters = {};
    if (taskId) filters.taskId = taskId;
    if (action) filters.action = action;
    if (actor) filters.actor = actor;
    if (startTime) filters.startTime = startTime;
    if (endTime) filters.endTime = endTime;
    if (ruleApplied) filters.ruleApplied = ruleApplied;
    if (limit) filters.limit = parseInt(limit, 10);
    
    const logs = await auditService.queryAuditLogs(filters);
    
    const actionDescriptions = {
      task_created: '文件任务创建',
      scan_started: '开始扫描',
      scan_completed_safe: '扫描完成（安全）',
      scan_completed_threat: '扫描完成（发现威胁）',
      download_attempt: '尝试下载',
      download_blocked: '下载被拦截',
      download_allowed: '下载被允许',
      false_positive_requested: '提交误报申请',
      false_positive_approved: '误报审核通过',
      false_positive_rejected: '误报审核被拒绝',
      rule_evaluated: '规则评估'
    };
    
    res.json({
      success: true,
      code: 'AUDIT_LOGS_FOUND',
      message: `共查询到 ${logs.length} 条审计记录`,
      data: logs.map(item => ({
        taskId: item.task_id,
        action: item.action,
        actionDescription: actionDescriptions[item.action] || item.action,
        actor: item.actor,
        oldStatus: item.old_status,
        newStatus: item.new_status,
        ruleApplied: item.rule_applied,
        details: item.details,
        time: item.created_at
      }))
    });
  } catch (err) {
    console.error('查询审计日志失败:', err);
    res.status(500).json({
      success: false,
      code: 'AUDIT_QUERY_FAILED',
      message: '查询审计日志失败',
      error: err.message
    });
  }
});

router.get('/rules', async (req, res) => {
  try {
    const rules = await rulesEngine.getAllRules();
    
    res.json({
      success: true,
      code: 'RULES_FOUND',
      message: `共查询到 ${rules.length} 条规则，按优先级从高到低排列`,
      data: rules.map(r => ({
        ruleId: r.id,
        ruleName: r.rule_name,
        description: r.description,
        ruleType: r.rule_type,
        priority: r.priority,
        isActive: r.is_active === 1,
        conditions: r.conditions,
        action: r.action,
        createdAt: r.created_at,
        updatedAt: r.updated_at
      }))
    });
  } catch (err) {
    console.error('查询规则失败:', err);
    res.status(500).json({
      success: false,
      code: 'RULE_QUERY_FAILED',
      message: '查询规则失败',
      error: err.message
    });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const stats = await fileTaskService.getTaskStats();
    
    const statusDescriptions = {
      pending: '等待扫描',
      scanning: '扫描中',
      safe: '安全文件',
      quarantined: '已隔离',
      reviewing: '审核中',
      unquarantined: '已放行（误报）'
    };
    
    const formattedStats = Object.entries(stats).map(([status, count]) => ({
      status,
      statusDescription: statusDescriptions[status] || status,
      count
    }));
    
    const total = Object.values(stats).reduce((sum, count) => sum + count, 0);
    
    res.json({
      success: true,
      code: 'STATS_FOUND',
      message: `统计信息 - 共 ${total} 个文件任务`,
      data: {
        total,
        byStatus: formattedStats
      }
    });
  } catch (err) {
    console.error('查询统计失败:', err);
    res.status(500).json({
      success: false,
      code: 'STATS_QUERY_FAILED',
      message: '查询统计失败',
      error: err.message
    });
  }
});

router.get('/false-positive-reviews', async (req, res) => {
  try {
    const { taskId, requester, reviewDecision } = req.query;
    
    const filters = {};
    if (taskId) filters.taskId = taskId;
    if (requester) filters.requester = requester;
    if (reviewDecision) filters.reviewDecision = reviewDecision;
    
    const reviews = await fileTaskService.getFalsePositiveReviews(filters);
    
    const decisionDescriptions = {
      approved: '审核通过',
      rejected: '审核拒绝'
    };
    
    res.json({
      success: true,
      code: 'REVIEWS_FOUND',
      message: `共查询到 ${reviews.length} 条误报审核记录`,
      data: reviews.map(r => ({
        reviewId: r.id,
        taskId: r.task_id,
        requester: r.requester,
        reason: r.reason,
        reviewer: r.reviewer,
        reviewComment: r.review_comment,
        reviewDecision: r.review_decision,
        reviewDecisionDescription: r.review_decision 
          ? decisionDescriptions[r.review_decision] 
          : '待审核',
        createdAt: r.created_at,
        reviewedAt: r.reviewed_at
      }))
    });
  } catch (err) {
    console.error('查询误报审核记录失败:', err);
    res.status(500).json({
      success: false,
      code: 'REVIEW_QUERY_FAILED',
      message: '查询误报审核记录失败',
      error: err.message
    });
  }
});

module.exports = router;
