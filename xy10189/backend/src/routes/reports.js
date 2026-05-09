const express = require('express');
const router = express.Router();
const getDB = require('../config/database');
const creditService = require('../services/creditService');

router.get('/credit-history', async (req, res) => {
  const { customer_id, limit = 100 } = req.query;
  const result = await creditService.getCreditHistory(customer_id, parseInt(limit));
  res.json(result);
});

router.get('/risk-alerts', async (req, res) => {
  const { limit = 50, unread_only } = req.query;
  const result = await creditService.getRiskAlerts(parseInt(limit), unread_only === 'true');
  res.json(result);
});

router.post('/risk-alerts/:id/read', async (req, res) => {
  const result = await creditService.markAlertAsRead(req.params.id);
  res.json(result);
});

router.get('/statistics', async (req, res) => {
  const db = getDB();
  const totalCustomers = (await db.prepare('SELECT COUNT(*) as count FROM customers').get()).count || 0;
  const totalOrders = (await db.prepare('SELECT COUNT(*) as count FROM orders').get()).count || 0;
  const totalReturns = (await db.prepare('SELECT COUNT(*) as count FROM returns').get()).count || 0;
  const pendingAdjustments = (await db.prepare('SELECT COUNT(*) as count FROM credit_adjustments WHERE approval_status = "pending"').get()).count || 0;

  const creditStats = await db.prepare(`
    SELECT 
      COALESCE(SUM(total_credit_limit), 0) as total_limit,
      COALESCE(SUM(used_credit), 0) as total_used,
      COALESCE(SUM(available_credit), 0) as total_available
    FROM customers
  `).get();

  const highRiskCustomers = (await db.prepare('SELECT COUNT(*) as count FROM customers WHERE risk_level = "high"').get()).count || 0;
  const mediumRiskCustomers = (await db.prepare('SELECT COUNT(*) as count FROM customers WHERE risk_level = "medium"').get()).count || 0;
  const lowRiskCustomers = (await db.prepare('SELECT COUNT(*) as count FROM customers WHERE risk_level = "low"').get()).count || 0;

  const unreadAlerts = (await db.prepare('SELECT COUNT(*) as count FROM risk_alerts WHERE is_read = 0').get()).count || 0;

  res.json({
    success: true,
    data: {
      overview: {
        total_customers: totalCustomers,
        total_orders: totalOrders,
        total_returns: totalReturns,
        pending_adjustments: pendingAdjustments,
        unread_alerts: unreadAlerts
      },
      credit_summary: {
        total_limit: creditStats.total_limit || 0,
        total_used: creditStats.total_used || 0,
        total_available: creditStats.total_available || 0,
        usage_ratio: creditStats.total_limit > 0 ? (creditStats.total_used / creditStats.total_limit) * 100 : 0
      },
      risk_distribution: {
        high: highRiskCustomers,
        medium: mediumRiskCustomers,
        low: lowRiskCustomers
      }
    }
  });
});

router.get('/export/credit-history', async (req, res) => {
  const db = getDB();
  const { customer_id } = req.query;
  
  let query = 'SELECT * FROM credit_history';
  const params = [];

  if (customer_id) {
    query += ' WHERE customer_id = ?';
    params.push(customer_id);
  }
  query += ' ORDER BY created_at DESC';

  const history = await db.prepare(query).all(...params);

  const typeMap = {
    'order_occupy': '订单占用',
    'return_release': '退货释放',
    'credit_adjustment': '额度调额'
  };

  let csv = '\ufeff';
  csv += '客户ID,客户名称,交易类型,交易单号,变动金额,变动前可用,变动后可用,变动前已用,变动后已用,操作人,备注,操作时间\n';

  for (const record of history) {
    csv += [
      record.customer_id,
      record.customer_name,
      typeMap[record.transaction_type] || record.transaction_type,
      record.transaction_no,
      record.change_amount,
      record.before_available,
      record.after_available,
      record.before_used,
      record.after_used,
      record.operator,
      (record.remark || '').replace(/,/g, '，'),
      record.created_at
    ].join(',') + '\n';
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=credit-history-${Date.now()}.csv`);
  res.send(csv);
});

router.get('/export/customers', async (req, res) => {
  const db = getDB();
  const customers = await db.prepare('SELECT * FROM customers ORDER BY name').all();

  const statusMap = {
    'normal': '正常',
    'overdrawn': '超限'
  };

  const riskMap = {
    'low': '低风险',
    'medium': '中风险',
    'high': '高风险'
  };

  let csv = '\ufeff';
  csv += '客户ID,客户编码,客户名称,行业,联系人,联系电话,地址,总额度,可用额度,已用额度,使用率,信用状态,风险等级,创建时间\n';

  for (const customer of customers) {
    const usageRatio = customer.total_credit_limit > 0 ? ((customer.used_credit / customer.total_credit_limit) * 100).toFixed(2) + '%' : '0%';
    csv += [
      customer.id,
      customer.code,
      customer.name,
      (customer.industry || '').replace(/,/g, '，'),
      (customer.contact_person || ''),
      (customer.contact_phone || ''),
      (customer.address || '').replace(/,/g, '，'),
      customer.total_credit_limit,
      customer.available_credit,
      customer.used_credit,
      usageRatio,
      statusMap[customer.credit_status] || customer.credit_status,
      riskMap[customer.risk_level] || customer.risk_level,
      customer.created_at
    ].join(',') + '\n';
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=customers-${Date.now()}.csv`);
  res.send(csv);
});

module.exports = router;
