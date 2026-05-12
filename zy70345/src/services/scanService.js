const { db } = require('../database');
const { v4: uuidv4 } = require('uuid');

const scanUserData = (customerId) => {
  const results = [];

  const profiles = db.prepare(`
    SELECT * FROM mock_user_profiles WHERE customer_id = ?
  `).all(customerId);
  
  profiles.forEach(profile => {
    results.push({
      data_type: 'user_profile',
      record_id: profile.id,
      record_summary: `用户: ${profile.name} (${profile.email})`
    });
  });

  const orders = db.prepare(`
    SELECT * FROM mock_orders WHERE customer_id = ?
  `).all(customerId);
  
  orders.forEach(order => {
    results.push({
      data_type: 'order',
      record_id: order.id,
      record_summary: `订单: ${order.order_number}, 金额: ¥${order.amount}, 日期: ${order.order_date}`
    });
  });

  const tickets = db.prepare(`
    SELECT * FROM mock_support_tickets WHERE customer_id = ?
  `).all(customerId);
  
  tickets.forEach(ticket => {
    results.push({
      data_type: 'ticket',
      record_id: ticket.id,
      record_summary: `工单: ${ticket.ticket_number}, 主题: ${ticket.subject}, 状态: ${ticket.status}`
    });
  });

  const marketing = db.prepare(`
    SELECT * FROM mock_marketing_records WHERE customer_id = ?
  `).all(customerId);
  
  marketing.forEach(record => {
    results.push({
      data_type: 'marketing',
      record_id: record.id,
      record_summary: `营销活动: ${record.campaign_name}, 订阅时间: ${record.subscribed_at}`
    });
  });

  const logs = db.prepare(`
    SELECT * FROM mock_log_indexes WHERE customer_id = ?
  `).all(customerId);
  
  logs.forEach(log => {
    results.push({
      data_type: 'log',
      record_id: log.id,
      record_summary: `日志: ${log.log_type}, 内容: ${log.log_content}`
    });
  });

  return results;
};

const saveScanResults = (requestId, scannedData) => {
  const insertScanResult = db.prepare(`
    INSERT INTO scan_results (id, request_id, data_type, record_id, record_summary, can_delete, retention_reason, retention_category)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  scannedData.forEach(item => {
    insertScanResult.run(
      uuidv4(),
      requestId,
      item.data_type,
      item.record_id,
      item.record_summary,
      0,
      null,
      null
    );
  });

  return db.prepare(`SELECT COUNT(*) as count FROM scan_results WHERE request_id = ?`).get(requestId);
};

const getScanResultsByRequest = (requestId) => {
  return db.prepare(`
    SELECT * FROM scan_results WHERE request_id = ?
  `).all(requestId);
};

module.exports = {
  scanUserData,
  saveScanResults,
  getScanResultsByRequest
};
