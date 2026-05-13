
const express = require('express');
const { db } = require('../database');

const router = express.Router();

// 获取操作日志
router.get('/logs', (req, res) => {
  try {
    let query = 'SELECT * FROM operation_logs WHERE 1=1';
    const params = [];
    
    if (req.query.module_name) {
      query += ' AND module_name = ?';
      params.push(req.query.module_name);
    }
    if (req.query.operator) {
      query += ' AND operator = ?';
      params.push(req.query.operator);
    }
    
    query += ' ORDER BY created_at DESC LIMIT 100';
    
    const logs = db.prepare(query).all(...params);
    
    // 解析 details 字段
    for (const log of logs) {
      log.details = JSON.parse(log.details || '{}');
    }
    
    res.json(logs);
  } catch (error) {
    console.error('获取操作日志失败:', error);
    res.status(500).json({ error: '获取操作日志失败' });
  }
});

// 获取修改历史
router.get('/history/:module/:id', (req, res) => {
  try {
    const history = db.prepare(`
      SELECT * FROM change_history 
      WHERE module_name = ? AND record_id = ? 
      ORDER BY changed_at DESC
    `).all(req.params.module, req.params.id);
    
    // 解析 old_value 和 new_value
    for (const h of history) {
      h.old_value = JSON.parse(h.old_value || 'null');
      h.new_value = JSON.parse(h.new_value || 'null');
    }
    
    res.json(history);
  } catch (error) {
    console.error('获取修改历史失败:', error);
    res.status(500).json({ error: '获取修改历史失败' });
  }
});

// 导出数据（按责任人和处理时间筛选）
router.get('/export', (req, res) => {
  try {
    const { operator, start_date, end_date, type } = req.query;
    
    let exportData = {};
    
    // 构建时间条件
    const dateConditions = [];
    const dateParams = [];
    
    if (start_date) {
      dateConditions.push('created_at >= ?');
      dateParams.push(start_date);
    }
    if (end_date) {
      dateConditions.push('created_at <= ?');
      dateParams.push(end_date + 'T23:59:59.999Z');
    }
    
    const whereClause = dateConditions.length > 0 ? ' AND ' + dateConditions.join(' AND ') : '';
    
    // 根据类型导出不同数据
    if (!type || type === 'all' || type === 'costs') {
      let costQuery = 'SELECT * FROM store_costs WHERE 1=1';
      const costParams = [...dateParams];
      
      if (operator) {
        costQuery += ' AND created_by = ?';
        costParams.push(operator);
      }
      
      costQuery += whereClause + ' ORDER BY created_at DESC';
      exportData.storeCosts = db.prepare(costQuery).all(...costParams);
    }
    
    if (!type || type === 'all' || type === 'logs') {
      let logQuery = 'SELECT * FROM operation_logs WHERE 1=1';
      const logParams = [...dateParams];
      
      if (operator) {
        logQuery += ' AND operator = ?';
        logParams.push(operator);
      }
      
      logQuery += whereClause + ' ORDER BY created_at DESC';
      exportData.operationLogs = db.prepare(logQuery).all(...logParams);
      
      for (const log of exportData.operationLogs) {
        log.details = JSON.parse(log.details || '{}');
      }
    }
    
    if (!type || type === 'all' || type === 'reviews') {
      let reviewQuery = 'SELECT * FROM review_records WHERE 1=1';
      const reviewParams = [...dateParams];
      
      if (operator) {
        reviewQuery += ' AND reviewer = ?';
        reviewParams.push(operator);
      }
      
      reviewQuery = reviewQuery.replace('WHERE 1=1', 'WHERE reviewed_at IS NOT NULL');
      if (start_date) {
        reviewQuery += ' AND reviewed_at >= ?';
        reviewParams.push(start_date);
      }
      if (end_date) {
        reviewQuery += ' AND reviewed_at <= ?';
        reviewParams.push(end_date + 'T23:59:59.999Z');
      }
      
      reviewQuery += ' ORDER BY reviewed_at DESC';
      exportData.reviewRecords = db.prepare(reviewQuery).all(...reviewParams);
    }
    
    res.json({
      exportMetadata: {
        exportedAt: new Date().toISOString(),
        filters: {
          operator: operator || '全部',
          startDate: start_date || '未指定',
          endDate: end_date || '未指定',
          type: type || '全部'
        }
      },
      ...exportData
    });
  } catch (error) {
    console.error('导出数据失败:', error);
    res.status(500).json({ error: '导出数据失败' });
  }
});

// 获取待复核列表
router.get('/pending-reviews', (req, res) => {
  try {
    const pendingItems = [];
    
    // 待审核的替代料确认
    const pendingSubstitutions = db.prepare(`
      SELECT 
        'substitution' as type,
        id,
        original_ingredient_name as title,
        reason,
        created_at,
        created_by
      FROM substitution_confirmations
      WHERE status = 'pending'
      ORDER BY created_at DESC
    `).all();
    
    // 待验收的退料
    const pendingReturns = db.prepare(`
      SELECT 
        'return' as type,
        id,
        ingredient_name as title,
        reason,
        created_at,
        created_by
      FROM return_acceptances
      WHERE status = 'pending'
      ORDER BY created_at DESC
    `).all();
    
    pendingItems.push(...pendingSubstitutions, ...pendingReturns);
    pendingItems.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    res.json(pendingItems);
  } catch (error) {
    console.error('获取待复核列表失败:', error);
    res.status(500).json({ error: '获取待复核列表失败' });
  }
});

module.exports = router;
