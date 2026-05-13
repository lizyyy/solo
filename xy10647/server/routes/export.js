const express = require('express');
const router = express.Router();
const XLSX = require('xlsx');
const db = require('../database');

router.get('/problems', (req, res) => {
  const { rectifier, start_date, end_date, store_id, status } = req.query;
  
  let query = `
    SELECT 
      p.id,
      p.store_name,
      p.category,
      p.description,
      p.severity,
      p.points_deducted,
      p.deadline,
      p.status,
      p.rectifier,
      p.created_at as problem_created,
      ip.title as inspection_title,
      r.description as rectification_description,
      r.completed_at as rectification_completed,
      rv.result as review_result,
      rv.reviewed_at,
      rv.comment as review_comment
    FROM problems p
    LEFT JOIN inspection_plans ip ON p.inspection_id = ip.id
    LEFT JOIN rectifications r ON p.id = r.problem_id
    LEFT JOIN reviews rv ON p.id = rv.problem_id
    WHERE 1=1
  `;
  
  const params = [];
  
  if (rectifier) {
    query += ` AND p.rectifier = ?`;
    params.push(rectifier);
  }
  if (store_id) {
    query += ` AND p.store_id = ?`;
    params.push(store_id);
  }
  if (status) {
    query += ` AND p.status = ?`;
    params.push(status);
  }
  if (start_date) {
    query += ` AND p.created_at >= ?`;
    params.push(start_date);
  }
  if (end_date) {
    query += ` AND p.created_at <= ?`;
    params.push(end_date);
  }
  query += ` ORDER BY p.created_at DESC`;
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '问题记录');
      
      const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=problems-export.xlsx');
      res.send(buffer);
    }
  });
});

router.get('/stores/ranking', (req, res) => {
  db.all(`SELECT * FROM stores ORDER BY total_score DESC`, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      const ranking = rows.map((store, index) => ({
        排名: index + 1,
        门店名称: store.name,
        门店地址: store.address,
        店长: store.manager,
        联系电话: store.manager_phone,
        总分: store.total_score,
        创建时间: store.created_at
      }));
      
      const ws = XLSX.utils.json_to_sheet(ranking);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '门店排名');
      
      const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=stores-ranking.xlsx');
      res.send(buffer);
    }
  });
});

router.get('/penalties', (req, res) => {
  const { handler, start_date, end_date, store_id } = req.query;
  
  let query = `SELECT * FROM penalty_records WHERE 1=1`;
  const params = [];
  
  if (handler) {
    query += ` AND handler = ?`;
    params.push(handler);
  }
  if (store_id) {
    query += ` AND store_id = ?`;
    params.push(store_id);
  }
  if (start_date) {
    query += ` AND created_at >= ?`;
    params.push(start_date);
  }
  if (end_date) {
    query += ` AND created_at <= ?`;
    params.push(end_date);
  }
  query += ` ORDER BY created_at DESC`;
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '扣分记录');
      
      const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=penalties-export.xlsx');
      res.send(buffer);
    }
  });
});

module.exports = router;
