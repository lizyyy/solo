const express = require('express');
const { asyncHandler, NotFoundError } = require('../middleware/errorHandler');
const db = require('../utils/database');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  const {
    page = 1,
    pageSize = 20,
    action,
    module,
    operator,
    status,
    start_time,
    end_time
  } = req.query;

  let sql = `SELECT * FROM audit_logs WHERE 1=1`;
  const params = [];
  const countParams = [];

  if (action) {
    sql += ` AND action = ?`;
    params.push(action);
    countParams.push(action);
  }

  if (module) {
    sql += ` AND module = ?`;
    params.push(module);
    countParams.push(module);
  }

  if (operator) {
    sql += ` AND operator LIKE ?`;
    const likePattern = `%${operator}%`;
    params.push(likePattern);
    countParams.push(likePattern);
  }

  if (status) {
    sql += ` AND status = ?`;
    params.push(status);
    countParams.push(status);
  }

  if (start_time) {
    sql += ` AND created_at >= ?`;
    params.push(start_time);
    countParams.push(start_time);
  }

  if (end_time) {
    sql += ` AND created_at <= ?`;
    params.push(end_time);
    countParams.push(end_time);
  }

  const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
  const countResult = await db.get(countSql, countParams);

  sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));

  const list = await db.all(sql, params);

  res.json({
    success: true,
    data: list,
    pagination: {
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      total: countResult.total,
      totalPages: Math.ceil(countResult.total / parseInt(pageSize))
    }
  });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const log = await db.get(
    `SELECT * FROM audit_logs WHERE id = ?`,
    [req.params.id]
  );

  if (!log) {
    throw new NotFoundError('审计日志不存在');
  }

  res.json({
    success: true,
    data: log
  });
}));

router.get('/actions/types', asyncHandler(async (req, res) => {
  const types = [
    { value: 'create', label: '创建' },
    { value: 'update', label: '更新' },
    { value: 'delete', label: '删除' },
    { value: 'import', label: '导入' },
    { value: 'export', label: '导出' },
    { value: 'check', label: '核验' },
    { value: 'pass', label: '放行' },
    { value: 'reject', label: '拒绝' },
    { value: 'query', label: '查询' }
  ];

  res.json({
    success: true,
    data: types
  });
}));

router.get('/modules/types', asyncHandler(async (req, res) => {
  const types = [
    { value: 'visitor', label: '访客管理' },
    { value: 'license_plate', label: '车牌管理' },
    { value: 'blacklist', label: '黑名单管理' },
    { value: 'gate', label: '门禁管理' },
    { value: 'system', label: '系统管理' }
  ];

  res.json({
    success: true,
    data: types
  });
}));

module.exports = router;
