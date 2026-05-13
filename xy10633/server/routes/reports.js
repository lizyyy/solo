const express = require('express');
const router = express.Router();
const db = require('../database/db');
const XLSX = require('xlsx');

router.get('/summary', (req, res) => {
  const { start_month, end_month, handled_by } = req.query;
  let query = `SELECT 
    bill_month,
    COUNT(*) as bill_count,
    SUM(total_amount) as total_amount,
    SUM(paid_amount) as paid_amount,
    SUM(unpaid_amount) as unpaid_amount,
    SUM(CASE WHEN has_exception = 1 THEN 1 ELSE 0 END) as exception_count
    FROM bills 
    WHERE 1=1`;
  const params = [];
  
  if (start_month) {
    query += ' AND bill_month >= ?';
    params.push(start_month);
  }
  if (end_month) {
    query += ' AND bill_month <= ?';
    params.push(end_month);
  }
  query += ' GROUP BY bill_month ORDER BY bill_month DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});

router.get('/unpaid-summary', (req, res) => {
  db.all(`SELECT 
    t.name as tenant_name,
    c.room_no,
    COUNT(b.id) as unpaid_bills,
    SUM(b.unpaid_amount) as total_unpaid
    FROM bills b
    LEFT JOIN contracts c ON b.contract_id = c.id
    LEFT JOIN tenants t ON c.tenant_id = t.id
    WHERE b.unpaid_amount > 0
    GROUP BY t.id, c.room_no
    ORDER BY total_unpaid DESC`, (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});

router.get('/export', (req, res) => {
  const { start_month, end_month, handled_by, status } = req.query;
  let query = `SELECT 
    b.bill_month,
    t.name as tenant_name,
    c.room_no,
    b.water_usage,
    b.water_amount,
    b.electric_usage,
    b.electric_amount,
    b.device_amount,
    b.total_amount,
    b.paid_amount,
    b.unpaid_amount,
    b.status,
    b.has_exception,
    b.exception_desc,
    b.handled_by,
    b.handled_at,
    b.created_at
    FROM bills b
    LEFT JOIN contracts c ON b.contract_id = c.id
    LEFT JOIN tenants t ON c.tenant_id = t.id
    WHERE 1=1`;
  const params = [];
  
  if (start_month) {
    query += ' AND b.bill_month >= ?';
    params.push(start_month);
  }
  if (end_month) {
    query += ' AND b.bill_month <= ?';
    params.push(end_month);
  }
  if (handled_by) {
    query += ' AND b.handled_by = ?';
    params.push(handled_by);
  }
  if (status) {
    query += ' AND b.status = ?';
    params.push(status);
  }
  query += ' ORDER BY b.bill_month DESC, t.name';
  
  db.all(query, params, (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else {
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '账单明细');
      
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=utility_bills_${new Date().toISOString().slice(0,10)}.xlsx`);
      res.send(excelBuffer);
    }
  });
});

router.get('/operators', (req, res) => {
  db.all(`SELECT DISTINCT handled_by as operator FROM bills WHERE handled_by IS NOT NULL UNION SELECT DISTINCT operator FROM audit_logs`, (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows.map(r => r.operator).filter(Boolean));
  });
});

module.exports = router;
