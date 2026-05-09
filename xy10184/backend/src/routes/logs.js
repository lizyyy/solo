const express = require('express');
const { Parser } = require('json2csv');
const db = require('../database');
const { authMiddleware, requireRoles } = require('../middleware/auth');
const { getLogs, logActions, logModules, createLog } = require('../utils/logger');

const router = express.Router();

router.get('/', authMiddleware, requireRoles('admin'), (req, res) => {
  const { 
    user_id, 
    action, 
    module, 
    start_time, 
    end_time,
    page = 1, 
    pageSize = 20 
  } = req.query;
  
  const filters = {};
  if (user_id) filters.userId = Number(user_id);
  if (action) filters.action = action;
  if (module) filters.module = module;
  if (start_time) filters.startTime = start_time;
  if (end_time) filters.endTime = end_time;
  
  const result = getLogs(filters, Number(page), Number(pageSize));
  
  res.json(result);
});

router.get('/export', authMiddleware, requireRoles('admin'), (req, res) => {
  const { user_id, action, module, start_time, end_time } = req.query;
  
  const filters = {};
  if (user_id) filters.userId = Number(user_id);
  if (action) filters.action = action;
  if (module) filters.module = module;
  if (start_time) filters.startTime = start_time;
  if (end_time) filters.endTime = end_time;
  
  let whereClause = 'WHERE 1=1';
  const params = [];
  
  if (filters.userId) {
    whereClause += ' AND user_id = ?';
    params.push(filters.userId);
  }
  
  if (filters.action) {
    whereClause += ' AND action = ?';
    params.push(filters.action);
  }
  
  if (filters.module) {
    whereClause += ' AND module = ?';
    params.push(filters.module);
  }
  
  if (filters.startTime) {
    whereClause += ' AND created_at >= ?';
    params.push(filters.startTime);
  }
  
  if (filters.endTime) {
    whereClause += ' AND created_at <= ?';
    params.push(filters.endTime);
  }
  
  const logs = db.prepare(`
    SELECT id, user_name, action, module, target_id, detail, ip, created_at
    FROM operation_logs
    ${whereClause}
    ORDER BY created_at DESC
  `).all(...params);
  
  const fields = [
    { label: 'ID', value: 'id' },
    { label: '操作人', value: 'user_name' },
    { label: '操作类型', value: 'action' },
    { label: '模块', value: 'module' },
    { label: '目标ID', value: 'target_id' },
    { label: '详情', value: 'detail' },
    { label: 'IP地址', value: 'ip' },
    { label: '操作时间', value: 'created_at' }
  ];
  
  const json2csvParser = new Parser({ fields });
  const csv = json2csvParser.parse(logs);
  
  createLog(req, 'EXPORT', logModules.EXPORT, `导出操作日志 ${logs.length} 条`);
  
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=operation_logs_${Date.now()}.csv`);
  res.send('\uFEFF' + csv);
});

router.get('/constants', authMiddleware, (req, res) => {
  res.json({
    actions: Object.entries(logActions).map(([key, value]) => ({
      value,
      label: value
    })),
    modules: Object.entries(logModules).map(([key, value]) => ({
      value,
      label: value
    }))
  });
});

module.exports = router;
