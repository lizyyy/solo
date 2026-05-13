const express = require('express');
const router = express.Router();
const { all } = require('../database');

router.get('/export', async (req, res) => {
  try {
    const { assignee, start_date, end_date, module } = req.query;
    
    let sql = `
      SELECT 
        rt.id,
        rt.ticket_no,
        rt.device_id,
        rt.assignee,
        rt.issue_type,
        rt.status,
        rt.priority,
        rt.created_at as ticket_created,
        rt.updated_at as ticket_updated,
        co.order_no,
        co.amount,
        co.status as order_status,
        rp.refund_no,
        rp.amount as refund_amount,
        rp.status as refund_status,
        rp.reviewer,
        rp.review_time,
        ol.operator,
        ol.action,
        ol.created_at as log_time
      FROM repair_tickets rt
      LEFT JOIN charging_orders co ON rt.order_id = co.id
      LEFT JOIN refund_progress rp ON rt.id = rp.ticket_id
      LEFT JOIN operation_logs ol ON rt.id = ol.record_id AND ol.module = 'repair_ticket'
      WHERE 1=1
    `;
    
    const params = [];
    
    if (assignee) {
      sql += ' AND rt.assignee = ?';
      params.push(assignee);
    }
    
    if (start_date) {
      sql += ' AND rt.updated_at >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      sql += ' AND rt.updated_at <= ?';
      params.push(end_date);
    }
    
    if (module) {
      sql += ' AND ol.module = ?';
      params.push(module);
    }
    
    sql += ' ORDER BY rt.updated_at DESC LIMIT 500';
    
    const records = await all(sql, params);
    
    const csvContent = generateCSV(records);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="report_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send('\ufeff' + csvContent);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function generateCSV(records) {
  const headers = [
    '工单编号', '设备ID', '责任人', '问题类型', '工单状态', 
    '优先级', '创建时间', '更新时间', '订单编号', '订单金额',
    '订单状态', '退款单号', '退款金额', '退款状态',
    '复核人', '复核时间', '操作人', '操作', '操作时间'
  ];
  
  const rows = records.map(record => [
    record.ticket_no,
    record.device_id,
    record.assignee || '',
    record.issue_type,
    record.status,
    record.priority,
    record.ticket_created,
    record.ticket_updated,
    record.order_no || '',
    record.amount || '',
    record.order_status || '',
    record.refund_no || '',
    record.refund_amount || '',
    record.refund_status || '',
    record.reviewer || '',
    record.review_time || '',
    record.operator || '',
    record.action || '',
    record.log_time || ''
  ]);
  
  const escapeCSV = (field) => {
    if (field === null || field === undefined) return '';
    const str = String(field);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  };
  
  return [
    headers.map(escapeCSV).join(','),
    ...rows.map(row => row.map(escapeCSV).join(','))
  ].join('\n');
}

router.get('/statistics', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    const ticketStats = await all(`
      SELECT 
        status,
        COUNT(*) as count,
        assignee
      FROM repair_tickets
      WHERE 1=1
      ${start_date ? ' AND created_at >= ?' : ''}
      ${end_date ? ' AND created_at <= ?' : ''}
      GROUP BY status, assignee
    `, [start_date, end_date].filter(Boolean));
    
    const refundStats = await all(`
      SELECT 
        status,
        COUNT(*) as count,
        SUM(amount) as total_amount
      FROM refund_progress
      WHERE 1=1
      ${start_date ? ' AND created_at >= ?' : ''}
      ${end_date ? ' AND created_at <= ?' : ''}
      GROUP BY status
    `, [start_date, end_date].filter(Boolean));
    
    res.json({
      tickets: ticketStats,
      refunds: refundStats
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
