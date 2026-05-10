const express = require('express');
const router = express.Router();
const permissionService = require('../services/permissionService');
const auditService = require('../services/auditService');
const logger = require('../logger');

router.post('/check', (req, res) => {
  try {
    const { staff_id, action, amount, category } = req.body;

    if (!staff_id || !action) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数: staff_id, action'
      });
    }

    const staff = permissionService.getStaffById(staff_id);
    if (!staff) {
      return res.status(404).json({
        success: false,
        error: '员工不存在'
      });
    }

    const result = permissionService.checkPermission(staff, action, amount || 0, category);

    res.json({
      success: true,
      data: {
        staff,
        action,
        amount,
        category,
        permission_check: result
      }
    });
  } catch (err) {
    logger.error('权限检查失败', { error: err.message });
    res.status(500).json({
      success: false,
      error: '权限检查失败',
      detail: err.message
    });
  }
});

router.post('/matrix', (req, res) => {
  try {
    const { staff_level, action, is_allowed, category, max_amount } = req.body;
    const operator = { id: req.headers['x-operator-id'] || 'admin' };

    if (!staff_level || !action) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数: staff_level, action'
      });
    }

    const id = permissionService.createPermissionMatrix({
      staff_level,
      action,
      is_allowed,
      category,
      max_amount
    }, operator.id);

    auditService.log('PERMISSION_MATRIX_CREATE', operator, 'permission_matrix', id, 'success', {
      staff_level,
      action,
      is_allowed,
      category,
      max_amount
    });

    res.status(201).json({
      success: true,
      message: '权限矩阵创建成功',
      data: { id }
    });
  } catch (err) {
    logger.error('创建权限矩阵失败', { error: err.message });
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;
