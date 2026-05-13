const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { Parser } = require('json2csv');

router.get('/export', (req, res) => {
  const { type, start_date, end_date, handled_by, status } = req.query;
  
  let query, fields, filename;
  
  if (type === 'exceptions') {
    query = `
      SELECT 
        e.id,
        e.type,
        e.description,
        e.status,
        e.priority,
        e.assigned_to,
        e.handled_by,
        e.handled_at,
        e.resolution,
        e.created_at
      FROM exceptions e
      WHERE 1=1
    `;
    fields = ['id', 'type', 'description', 'status', 'priority', 'assigned_to', 'handled_by', 'handled_at', 'resolution', 'created_at'];
    filename = `异常报表_${new Date().toISOString().slice(0, 10)}.csv`;
  } else if (type === 'redeliveries') {
    query = `
      SELECT 
        rd.id,
        sub.name as subscriber_name,
        n.name as newspaper_name,
        dc.delivery_date,
        dc.issue_number,
        rd.reason,
        rd.new_delivery_date,
        rd.status,
        rd.handled_by,
        rd.handled_at,
        rd.created_at
      FROM re_deliveries rd
      JOIN delivery_calendar dc ON rd.delivery_id = dc.id
      JOIN subscriptions s ON dc.subscription_id = s.id
      JOIN subscribers sub ON s.subscriber_id = sub.id
      JOIN newspapers n ON s.newspaper_id = n.id
      WHERE 1=1
    `;
    fields = ['id', 'subscriber_name', 'newspaper_name', 'delivery_date', 'issue_number', 'reason', 'new_delivery_date', 'status', 'handled_by', 'handled_at', 'created_at'];
    filename = `补投报表_${new Date().toISOString().slice(0, 10)}.csv`;
  } else if (type === 'pauses') {
    query = `
      SELECT 
        pr.id,
        sub.name as subscriber_name,
        n.name as newspaper_name,
        pr.request_date,
        pr.start_date,
        pr.end_date,
        pr.reason,
        pr.status,
        pr.created_by,
        pr.approved_by,
        pr.approved_at,
        pr.created_at
      FROM pause_requests pr
      JOIN subscriptions s ON pr.subscription_id = s.id
      JOIN subscribers sub ON s.subscriber_id = sub.id
      JOIN newspapers n ON s.newspaper_id = n.id
      WHERE 1=1
    `;
    fields = ['id', 'subscriber_name', 'newspaper_name', 'request_date', 'start_date', 'end_date', 'reason', 'status', 'created_by', 'approved_by', 'approved_at', 'created_at'];
    filename = `暂停报表_${new Date().toISOString().slice(0, 10)}.csv`;
  } else {
    query = `
      SELECT 
        s.id,
        sub.name as subscriber_name,
        n.name as newspaper_name,
        s.total_issues,
        s.remaining_issues,
        s.start_date,
        s.end_date,
        s.status,
        s.created_at
      FROM subscriptions s
      JOIN subscribers sub ON s.subscriber_id = sub.id
      JOIN newspapers n ON s.newspaper_id = n.id
      WHERE 1=1
    `;
    fields = ['id', 'subscriber_name', 'newspaper_name', 'total_issues', 'remaining_issues', 'start_date', 'end_date', 'status', 'created_at'];
    filename = `订阅报表_${new Date().toISOString().slice(0, 10)}.csv`;
  }
  
  const params = [];
  
  if (start_date) {
    query += ' AND created_at >= ?';
    params.push(start_date);
  }
  if (end_date) {
    query += ' AND created_at <= ?';
    params.push(end_date + ' 23:59:59');
  }
  if (handled_by) {
    query += ' AND handled_by = ?';
    params.push(handled_by);
  }
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    try {
      const parser = new Parser({ fields });
      const csv = parser.parse(rows);
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(200).end('\uFEFF' + csv);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
});

router.get('/summary', (req, res) => {
  db.serialize(() => {
    const result = {};
    
    db.get(`SELECT COUNT(*) as total_subscriptions FROM subscriptions`, (err, row) => {
      result.total_subscriptions = row.total_subscriptions;
    });
    
    db.get(`SELECT COUNT(*) as active_subscriptions FROM subscriptions WHERE status = 'active'`, (err, row) => {
      result.active_subscriptions = row.active_subscriptions;
    });
    
    db.get(`SELECT COUNT(*) as paused_subscriptions FROM subscriptions WHERE status = 'paused'`, (err, row) => {
      result.paused_subscriptions = row.paused_subscriptions;
    });
    
    db.get(`SELECT COUNT(*) as pending_pauses FROM pause_requests WHERE status = 'pending'`, (err, row) => {
      result.pending_pauses = row.pending_pauses;
    });
    
    db.get(`SELECT COUNT(*) as pending_redeliveries FROM re_deliveries WHERE status = 'pending'`, (err, row) => {
      result.pending_redeliveries = row.pending_redeliveries;
    });
    
    db.get(`SELECT COUNT(*) as open_exceptions FROM exceptions WHERE status = 'open'`, (err, row) => {
      result.open_exceptions = row.open_exceptions;
      res.json(result);
    });
  });
});

module.exports = router;
