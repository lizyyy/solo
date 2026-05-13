const express = require('express');
const db = require('./database');
const permissionService = require('./services/permissionService');

const router = express.Router();

const {
  getPermissionTypes,
  getPermissionStatus,
  getExtensionStatus,
  isValidPermissionType
} = db;

router.get('/types', (req, res) => {
  res.json({
    success: true,
    data: getPermissionTypes()
  });
});

router.get('/status', (req, res) => {
  res.json({
    success: true,
    data: {
      permissions: getPermissionStatus(),
      extensions: getExtensionStatus()
    }
  });
});

router.post('/permissions', (req, res) => {
  try {
    const permission = permissionService.createPermission(req.body);
    res.status(201).json({
      success: true,
      data: permission
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/permissions', (req, res) => {
  try {
    const { status, applicant, permissionType } = req.query;
    const permissions = permissionService.listPermissions({
      status,
      applicant,
      permissionType
    });
    
    res.json({
      success: true,
      data: permissions
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/permissions/:id', (req, res) => {
  try {
    const permission = permissionService.getPermission(req.params.id);
    if (!permission) {
      return res.status(404).json({
        success: false,
        error: '权限不存在'
      });
    }
    
    res.json({
      success: true,
      data: permission
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/permissions/:id/approve', (req, res) => {
  try {
    const permission = permissionService.approvePermission({
      permissionId: req.params.id,
      approver: req.body.approver,
      comment: req.body.comment
    });
    
    res.json({
      success: true,
      data: permission
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/permissions/:id/reject', (req, res) => {
  try {
    const permission = permissionService.rejectPermission({
      permissionId: req.params.id,
      approver: req.body.approver,
      comment: req.body.comment
    });
    
    res.json({
      success: true,
      data: permission
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/permissions/:id/authorize', (req, res) => {
  try {
    const permission = permissionService.authorizePermission({
      permissionId: req.params.id,
      authorizer: req.body.authorizer
    });
    
    res.json({
      success: true,
      data: permission
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/permissions/:id/revoke', (req, res) => {
  try {
    const permission = permissionService.revokePermission(
      req.params.id,
      req.body.revoker || 'system',
      req.body.reason
    );
    
    res.json({
      success: true,
      data: permission
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/permissions/:id/check-access', (req, res) => {
  try {
    const result = permissionService.checkPermissionAccess(req.params.id);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/permissions/expiring/soon', (req, res) => {
  try {
    const days = parseInt(req.query.days) || 3;
    const permissions = permissionService.listExpiringPermissions(days);
    
    res.json({
      success: true,
      data: permissions,
      filters: { days }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/permissions/expired', (req, res) => {
  try {
    const permissions = permissionService.listExpiredPermissions();
    
    res.json({
      success: true,
      data: permissions
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/scan/expired', (req, res) => {
  try {
    const result = permissionService.scanAndRevokeExpired();
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/extensions', (req, res) => {
  try {
    const extension = permissionService.requestExtension(req.body);
    
    res.status(201).json({
      success: true,
      data: extension
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/extensions/:id', (req, res) => {
  try {
    const extension = permissionService.getExtension(req.params.id);
    if (!extension) {
      return res.status(404).json({
        success: false,
        error: '延期申请不存在'
      });
    }
    
    res.json({
      success: true,
      data: extension
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/extensions/:id/approve', (req, res) => {
  try {
    const extension = permissionService.approveExtension({
      extensionId: req.params.id,
      approver: req.body.approver,
      comment: req.body.comment
    });
    
    res.json({
      success: true,
      data: extension
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/extensions/:id/reject', (req, res) => {
  try {
    const extension = permissionService.rejectExtension({
      extensionId: req.params.id,
      approver: req.body.approver,
      comment: req.body.comment
    });
    
    res.json({
      success: true,
      data: extension
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/query/active', (req, res) => {
  try {
    const permissions = permissionService.listPermissions({
      status: 'authorized'
    });
    
    res.json({
      success: true,
      data: permissions,
      count: permissions.length
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/query/expiring', (req, res) => {
  try {
    const days = parseInt(req.query.days) || 3;
    const permissions = permissionService.listExpiringPermissions(days);
    
    res.json({
      success: true,
      data: permissions,
      count: permissions.length,
      filters: { days }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/query/revoke-records', (req, res) => {
  try {
    const records = permissionService.listRevokeRecords();
    
    res.json({
      success: true,
      data: records,
      count: records.length
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/query/audit', (req, res) => {
  try {
    const { permissionId, action, limit } = req.query;
    const limitNum = limit ? parseInt(limit) : undefined;
    
    const logs = permissionService.getAuditReport({
      permissionId,
      action,
      limit: limitNum
    });
    
    res.json({
      success: true,
      data: logs,
      count: logs.length,
      filters: { permissionId, action, limit: limitNum }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/scan/summary', (req, res) => {
  try {
    const summary = permissionService.getScanSummary();
    
    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/tasks/revokes', (req, res) => {
  try {
    const tasks = permissionService.listPendingRevokeTasks();
    
    res.json({
      success: true,
      data: tasks,
      count: tasks.length
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/', (req, res) => {
  res.json({
    success: true,
    message: '临时权限到期 API',
    endpoints: {
      types: 'GET /api/types - 获取所有权限类型',
      status: 'GET /api/status - 获取状态枚举',
      permissions: {
        create: 'POST /api/permissions - 申请临时权限',
        list: 'GET /api/permissions - 列出权限（支持过滤）',
        get: 'GET /api/permissions/:id - 获取单个权限',
        approve: 'POST /api/permissions/:id/approve - 审批通过',
        reject: 'POST /api/permissions/:id/reject - 审批拒绝',
        authorize: 'POST /api/permissions/:id/authorize - 授权',
        revoke: 'POST /api/permissions/:id/revoke - 回收',
        checkAccess: 'GET /api/permissions/:id/check-access - 检查访问权限'
      },
      extensions: {
        request: 'POST /api/extensions - 申请延期',
        get: 'GET /api/extensions/:id - 获取延期申请',
        approve: 'POST /api/extensions/:id/approve - 审批延期通过',
        reject: 'POST /api/extensions/:id/reject - 审批延期拒绝'
      },
      scan: {
        scan: 'POST /api/scan/expired - 扫描并回收过期权限',
        summary: 'GET /api/scan/summary - 获取扫描汇总'
      },
      query: {
        active: 'GET /api/query/active - 当前有效权限',
        expiring: 'GET /api/query/expiring?days=3 - 即将到期列表',
        revokeRecords: 'GET /api/query/revoke-records - 回收记录',
        audit: 'GET /api/query/audit - 审计报告'
      },
      tasks: {
        revokes: 'GET /api/tasks/revokes - 待办回收任务'
      }
    }
  });
});

module.exports = router;
