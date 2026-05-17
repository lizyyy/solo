const express = require('express');
const { Parser } = require('json2csv');
const permissionService = require('../services/permissionService');

const router = express.Router();

router.get('/temp-permissions', async (req, res) => {
  try {
    const { user_id, status, package_id } = req.query;
    const filters = {};
    if (user_id) filters.user_id = user_id;
    if (status) filters.status = status;
    if (package_id) filters.package_id = package_id;

    const list = await permissionService.listTempPermissions(filters);
    res.json({
      success: true,
      data: list
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/temp-permissions/:id', async (req, res) => {
  try {
    const detail = await permissionService.getTempPermissionDetail(req.params.id);
    if (!detail) {
      return res.status(404).json({
        success: false,
        error: '权限申请不存在'
      });
    }
    res.json({
      success: true,
      data: detail
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/temp-permissions/:id/history', async (req, res) => {
  try {
    const history = await permissionService.getHistory(req.params.id);
    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/temp-permissions', async (req, res) => {
  try {
    const { user_id, package_id, reason, valid_from, valid_to, applied_by } = req.body;

    if (!user_id || !package_id || !reason || !valid_from || !valid_to || !applied_by) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数: user_id, package_id, reason, valid_from, valid_to, applied_by'
      });
    }

    const result = await permissionService.applyTempPermission(
      user_id,
      package_id,
      reason,
      valid_from,
      valid_to,
      applied_by
    );

    res.status(201).json({
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

router.post('/temp-permissions/:id/confirm', async (req, res) => {
  try {
    const { confirmed_by } = req.body;
    if (!confirmed_by) {
      return res.status(400).json({
        success: false,
        error: '缺少 confirmed_by 参数'
      });
    }

    const result = await permissionService.confirmTempPermission(req.params.id, confirmed_by);
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

router.post('/temp-permissions/:id/revoke', async (req, res) => {
  try {
    const { revoked_by, revoked_reason } = req.body;
    if (!revoked_by || !revoked_reason) {
      return res.status(400).json({
        success: false,
        error: '缺少 revoked_by 或 revoked_reason 参数'
      });
    }

    const result = await permissionService.revokeTempPermission(req.params.id, revoked_by, revoked_reason);
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

router.post('/temp-permissions/batch-import', async (req, res) => {
  try {
    const { records, operator } = req.body;
    if (!records || !Array.isArray(records)) {
      return res.status(400).json({
        success: false,
        error: 'records 必须是数组'
      });
    }
    if (!operator) {
      return res.status(400).json({
        success: false,
        error: '缺少 operator 参数'
      });
    }

    const result = await permissionService.batchImport(records, operator);
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

router.get('/temp-permissions/export/csv', async (req, res) => {
  try {
    const data = await permissionService.exportToCSV();
    const json2csvParser = new Parser();
    const csv = json2csvParser.parse(data);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="temp-permissions-${Date.now()}.csv"`);
    res.send('\uFEFF' + csv);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/users', async (req, res) => {
  try {
    const users = await permissionService.listUsers();
    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/packages', async (req, res) => {
  try {
    const packages = await permissionService.listPackages();
    res.json({
      success: true,
      data: packages
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
