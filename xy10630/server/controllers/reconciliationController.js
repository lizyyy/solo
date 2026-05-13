const db = require('../models/database');
const { v4: uuidv4 } = require('uuid');
const { Parser } = require('json2csv');

const getReconciliations = (req, res) => {
  const { status, canteen_id, recon_date, page = 1, pageSize = 20 } = req.query;
  let query = 'SELECT * FROM canteen_reconciliation WHERE 1=1';
  const params = [];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  if (canteen_id) {
    query += ' AND canteen_id = ?';
    params.push(canteen_id);
  }
  if (recon_date) {
    query += ' AND recon_date = ?';
    params.push(recon_date);
  }

  const offset = (page - 1) * pageSize;
  query += ' ORDER BY recon_date DESC LIMIT ? OFFSET ?';
  params.push(parseInt(pageSize), offset);

  db.all(query, params, (err, records) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    db.get('SELECT COUNT(*) as total FROM canteen_reconciliation', (err, result) => {
      res.json({ success: true, data: records, total: result.total });
    });
  });
};

const createReconciliation = (req, res) => {
  const { canteen_id, canteen_name, recon_date, total_transactions, total_amount, operator, remark } = req.body;
  const reconId = uuidv4();

  db.get(`SELECT COUNT(*) as count, SUM(amount) as system_amount 
    FROM offline_transactions 
    WHERE canteen_id = ? AND DATE(tx_time) = ? AND status = 'completed'`,
    [canteen_id, recon_date],
    (err, result) => {
      if (err) return res.status(500).json({ success: false, message: err.message });

      const systemAmount = result.system_amount || 0;
      const difference = total_amount - systemAmount;

      db.run(`INSERT INTO canteen_reconciliation 
        (recon_id, canteen_id, canteen_name, recon_date, total_transactions, total_amount, system_amount, difference, status, operator, remark)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [reconId, canteen_id, canteen_name, recon_date, total_transactions, total_amount, systemAmount, difference, 
         difference === 0 ? 'matched' : 'mismatch', operator, remark],
        function(err) {
          if (err) return res.status(500).json({ success: false, message: err.message });
          res.status(201).json({ 
            success: true, 
            message: '对账记录创建成功', 
            data: { recon_id: reconId, difference, status: difference === 0 ? 'matched' : 'mismatch' }
          });
        }
      );
    }
  );
};

const exportData = (req, res) => {
  const { type, start_date, end_date, canteen_id, card_id } = req.query;

  let query = '';
  let params = [];
  let fields = [];
  let fileName = '';

  switch (type) {
    case 'transactions':
      query = 'SELECT * FROM offline_transactions WHERE 1=1';
      if (start_date) { query += ' AND tx_time >= ?'; params.push(start_date); }
      if (end_date) { query += ' AND tx_time <= ?'; params.push(end_date); }
      if (canteen_id) { query += ' AND canteen_id = ?'; params.push(canteen_id); }
      if (card_id) { query += ' AND card_id = ?'; params.push(card_id); }
      fields = ['tx_id', 'card_id', 'amount', 'canteen_name', 'device_id', 'tx_time', 'status', 'remark'];
      fileName = 'transactions.csv';
      break;
    case 'recharge':
      query = 'SELECT * FROM recharge_orders WHERE 1=1';
      if (start_date) { query += ' AND created_at >= ?'; params.push(start_date); }
      if (end_date) { query += ' AND created_at <= ?'; params.push(end_date); }
      if (card_id) { query += ' AND card_id = ?'; params.push(card_id); }
      fields = ['order_id', 'card_id', 'amount', 'recharge_type', 'status', 'operator', 'created_at'];
      fileName = 'recharge_orders.csv';
      break;
    case 'duplicate':
      query = `SELECT dd.*, c.student_name 
        FROM duplicate_deductions dd 
        JOIN cards c ON dd.card_id = c.card_id 
        WHERE 1=1`;
      if (start_date) { query += ' AND detected_time >= ?'; params.push(start_date); }
      if (end_date) { query += ' AND detected_time <= ?'; params.push(end_date); }
      fields = ['dedup_id', 'card_id', 'student_name', 'status', 'confidence', 'detected_time', 'handler', 'handle_result'];
      fileName = 'duplicate_deductions.csv';
      break;
    case 'audit':
      query = 'SELECT * FROM audit_logs WHERE 1=1';
      if (start_date) { query += ' AND created_at >= ?'; params.push(start_date); }
      if (end_date) { query += ' AND created_at <= ?'; params.push(end_date); }
      fields = ['log_id', 'operation_type', 'entity_type', 'entity_id', 'operator', 'result', 'fail_reason', 'created_at'];
      fileName = 'audit_logs.csv';
      break;
    default:
      return res.status(400).json({ success: false, message: '不支持的导出类型' });
  }

  db.all(query, params, (err, data) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    
    try {
      const json2csvParser = new Parser({ fields });
      const csv = json2csvParser.parse(data);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(csv);
    } catch (error) {
      res.status(500).json({ success: false, message: '导出失败' });
    }
  });
};

const getAuditLogs = (req, res) => {
  const { operation_type, entity_type, operator, page = 1, pageSize = 20 } = req.query;
  let query = 'SELECT * FROM audit_logs WHERE 1=1';
  const params = [];

  if (operation_type) {
    query += ' AND operation_type = ?';
    params.push(operation_type);
  }
  if (entity_type) {
    query += ' AND entity_type = ?';
    params.push(entity_type);
  }
  if (operator) {
    query += ' AND operator = ?';
    params.push(operator);
  }

  const offset = (page - 1) * pageSize;
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(pageSize), offset);

  db.all(query, params, (err, logs) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    db.get('SELECT COUNT(*) as total FROM audit_logs', (err, result) => {
      res.json({ success: true, data: logs, total: result.total });
    });
  });
};

const getFreezeLogs = (req, res) => {
  const { card_id, operation_type, page = 1, pageSize = 20 } = req.query;
  let query = 'SELECT * FROM freeze_logs WHERE 1=1';
  const params = [];

  if (card_id) {
    query += ' AND card_id = ?';
    params.push(card_id);
  }
  if (operation_type) {
    query += ' AND operation_type = ?';
    params.push(operation_type);
  }

  const offset = (page - 1) * pageSize;
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(pageSize), offset);

  db.all(query, params, (err, logs) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    db.get('SELECT COUNT(*) as total FROM freeze_logs', (err, result) => {
      res.json({ success: true, data: logs, total: result.total });
    });
  });
};

const getDashboardStats = (req, res) => {
  const stats = {};
  
  db.get('SELECT COUNT(*) as count, SUM(amount) as amount FROM offline_transactions WHERE DATE(tx_time) = DATE("now")', (err, result) => {
    stats.today_transactions = result.count || 0;
    stats.today_amount = result.amount || 0;

    db.get('SELECT COUNT(*) as count FROM cards', (err, result) => {
      stats.total_cards = result.count || 0;

      db.get('SELECT COUNT(*) as count FROM duplicate_deductions WHERE status = "detected"', (err, result) => {
        stats.pending_duplicates = result.count || 0;

        db.get('SELECT COUNT(*) as count FROM refund_records WHERE status = "pending"', (err, result) => {
          stats.pending_refunds = result.count || 0;
          res.json({ success: true, data: stats });
        });
      });
    });
  });
};

module.exports = {
  getReconciliations,
  createReconciliation,
  exportData,
  getAuditLogs,
  getFreezeLogs,
  getDashboardStats
};
