const express = require('express');
const router = express.Router();
const fileTaskService = require('../services/fileTaskService');
const auditService = require('../services/auditService');
const rulesEngine = require('../services/rulesEngine');
const { DOWNLOAD_PERMISSION } = require('../config/constants');

const getActor = (req) => req.headers['x-actor'] || 'system';

router.post('/create', async (req, res) => {
  try {
    const { fileName, fileSize, fileHash, businessId } = req.body;
    
    if (!fileName || !fileSize || !businessId) {
      return res.status(400).json({
        success: false,
        code: 'MISSING_PARAMS',
        message: '请提供文件名、文件大小和业务标识'
      });
    }
    
    const actor = getActor(req);
    const task = await fileTaskService.createTask(
      { fileName, fileSize, fileHash, businessId },
      actor
    );
    
    res.json({
      success: true,
      code: 'TASK_CREATED',
      message: `文件任务已创建，任务ID: ${task.id}`,
      data: {
        taskId: task.id,
        fileName: task.file_name,
        status: task.status,
        statusDescription: '等待开始扫描'
      }
    });
  } catch (err) {
    console.error('创建任务失败:', err);
    res.status(500).json({
      success: false,
      code: 'CREATE_TASK_FAILED',
      message: '创建文件任务失败',
      error: err.message
    });
  }
});

router.get('/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const task = await fileTaskService.getTask(taskId);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        code: 'TASK_NOT_FOUND',
        message: '任务不存在'
      });
    }
    
    const statusDescriptions = {
      pending: '等待开始扫描',
      scanning: '正在扫描中',
      safe: '扫描完成，文件安全',
      quarantined: '发现病毒，已隔离',
      reviewing: '误报审核中',
      unquarantined: '误报审核通过，已解除隔离'
    };
    
    res.json({
      success: true,
      code: 'TASK_FOUND',
      message: `查询成功 - ${statusDescriptions[task.status] || task.status}`,
      data: {
        taskId: task.id,
        fileName: task.file_name,
        fileSize: task.file_size,
        businessId: task.business_id,
        status: task.status,
        statusDescription: statusDescriptions[task.status] || task.status,
        scanEngine: task.scan_engine,
        threatType: task.threat_type,
        threatDetails: task.threat_details,
        createdAt: task.created_at,
        updatedAt: task.updated_at
      }
    });
  } catch (err) {
    console.error('查询任务失败:', err);
    res.status(500).json({
      success: false,
      code: 'QUERY_TASK_FAILED',
      message: '查询任务失败',
      error: err.message
    });
  }
});

router.post('/:taskId/scan-callback', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { isSafe, engine, threatType, threatDetails } = req.body;
    
    if (typeof isSafe === 'undefined') {
      return res.status(400).json({
        success: false,
        code: 'MISSING_SCAN_RESULT',
        message: '请提供扫描结果 isSafe'
      });
    }
    
    const actor = getActor(req);
    const result = await fileTaskService.processScanCallback(
      taskId,
      { isSafe, engine, threatType, threatDetails },
      actor
    );
    
    res.json({
      success: true,
      code: result.isSafe ? 'SCAN_COMPLETED_SAFE' : 'SCAN_COMPLETED_THREAT',
      message: result.message,
      data: {
        taskId: result.taskId,
        oldStatus: result.oldStatus,
        newStatus: result.newStatus,
        isSafe: result.isSafe
      }
    });
  } catch (err) {
    console.error('处理扫描回调失败:', err);
    
    if (err.message.includes('任务不存在')) {
      return res.status(404).json({
        success: false,
        code: 'TASK_NOT_FOUND',
        message: err.message
      });
    }
    
    res.status(500).json({
      success: false,
      code: 'SCAN_CALLBACK_FAILED',
      message: '处理扫描回调失败',
      error: err.message
    });
  }
});

router.post('/:taskId/check-download', async (req, res) => {
  try {
    const { taskId } = req.params;
    const actor = getActor(req);
    
    const result = await fileTaskService.checkDownloadPermission(taskId, actor);
    
    const permissionDescriptions = {
      [DOWNLOAD_PERMISSION.ALLOWED]: '允许下载',
      [DOWNLOAD_PERMISSION.BLOCKED]: '禁止下载',
      [DOWNLOAD_PERMISSION.REQUIRES_REVIEW]: '需要审核'
    };
    
    res.json({
      success: true,
      code: `DOWNLOAD_${result.permission.toUpperCase()}`,
      message: result.reason,
      data: {
        taskId,
        permission: result.permission,
        permissionDescription: permissionDescriptions[result.permission] || result.permission,
        ruleApplied: result.rule_applied,
        ruleDescription: result.rule_description
      }
    });
  } catch (err) {
    console.error('检查下载权限失败:', err);
    res.status(500).json({
      success: false,
      code: 'CHECK_DOWNLOAD_FAILED',
      message: '检查下载权限失败',
      error: err.message
    });
  }
});

router.post('/:taskId/request-false-positive', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { reason } = req.body;
    
    if (!reason) {
      return res.status(400).json({
        success: false,
        code: 'MISSING_REASON',
        message: '请提供误报申请理由'
      });
    }
    
    const actor = getActor(req);
    const result = await fileTaskService.requestFalsePositiveReview(taskId, actor, reason);
    
    res.json({
      success: true,
      code: 'FALSE_POSITIVE_REQUESTED',
      message: result.message,
      data: {
        reviewId: result.reviewId,
        taskId: result.taskId
      }
    });
  } catch (err) {
    console.error('提交误报申请失败:', err);
    
    if (err.message.includes('任务不存在')) {
      return res.status(404).json({
        success: false,
        code: 'TASK_NOT_FOUND',
        message: err.message
      });
    }
    
    if (err.message.includes('只有已隔离')) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_STATUS',
        message: err.message
      });
    }
    
    res.status(500).json({
      success: false,
      code: 'FALSE_POSITIVE_REQUEST_FAILED',
      message: '提交误报申请失败',
      error: err.message
    });
  }
});

router.get('/business/:businessId', async (req, res) => {
  try {
    const { businessId } = req.params;
    const tasks = await fileTaskService.getTasksByBusinessId(businessId);
    
    const statusDescriptions = {
      pending: '等待扫描',
      scanning: '扫描中',
      safe: '安全',
      quarantined: '已隔离',
      reviewing: '审核中',
      unquarantined: '已放行'
    };
    
    res.json({
      success: true,
      code: 'TASKS_FOUND',
      message: `共查询到 ${tasks.length} 个文件任务`,
      data: tasks.map(t => ({
        taskId: t.id,
        fileName: t.file_name,
        status: t.status,
        statusDescription: statusDescriptions[t.status] || t.status,
        createdAt: t.created_at
      }))
    });
  } catch (err) {
    console.error('查询业务任务失败:', err);
    res.status(500).json({
      success: false,
      code: 'QUERY_BUSINESS_TASKS_FAILED',
      message: '查询业务任务失败',
      error: err.message
    });
  }
});

module.exports = router;
