const express = require('express');
const router = express.Router();
const { Parser } = require('json2csv');
const { allQuery } = require('../db/database');

router.get('/packages', async (req, res) => {
  try {
    const { status, format = 'csv' } = req.query;
    let sql = `
      SELECT 
        p.tracking_number,
        p.sender_name,
        p.sender_country,
        p.receiver_name,
        p.receiver_address,
        p.weight,
        p.declared_value,
        p.currency,
        p.status,
        p.created_at,
        p.updated_at
      FROM packages p
      WHERE 1=1
    `;
    let params = [];

    if (status) {
      sql += ' AND p.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY p.created_at DESC';

    const packages = await allQuery(sql, params);

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=packages.json');
      return res.json(packages);
    }

    const fields = [
      'tracking_number', 'sender_name', 'sender_country',
      'receiver_name', 'receiver_address', 'weight',
      'declared_value', 'currency', 'status',
      'created_at', 'updated_at'
    ];
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(packages);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=packages.csv');
    res.send('\uFEFF' + csv);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/tickets', async (req, res) => {
  try {
    const { status } = req.query;
    let sql = `
      SELECT 
        t.ticket_number,
        p.tracking_number,
        p.receiver_name,
        t.required_documents,
        t.current_owner,
        t.status,
        t.priority,
        t.created_at,
        t.updated_at
      FROM supplement_tickets t
      LEFT JOIN packages p ON t.package_id = p.id
      WHERE 1=1
    `;
    let params = [];

    if (status) {
      sql += ' AND t.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY t.created_at DESC';

    const tickets = await allQuery(sql, params);

    const fields = [
      'ticket_number', 'tracking_number', 'receiver_name',
      'required_documents', 'current_owner', 'status',
      'priority', 'created_at', 'updated_at'
    ];
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(tickets);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=tickets.csv');
    res.send('\uFEFF' + csv);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/timeline/:packageId', async (req, res) => {
  try {
    const pkg = await allQuery('SELECT * FROM packages WHERE id = ?', [req.params.packageId]);
    const callbacks = await allQuery('SELECT * FROM customs_callbacks WHERE package_id = ? ORDER BY created_at', [req.params.packageId]);
    const tickets = await allQuery('SELECT * FROM supplement_tickets WHERE package_id = ? ORDER BY created_at', [req.params.packageId]);
    const resubmits = await allQuery('SELECT * FROM re_submissions WHERE package_id = ? ORDER BY created_at', [req.params.packageId]);
    const logs = await allQuery('SELECT * FROM operation_logs WHERE package_id = ? ORDER BY created_at', [req.params.packageId]);

    const timeline = [];

    pkg.forEach(p => {
      timeline.push({
        time: p.created_at,
        type: 'package_created',
        title: '包裹创建',
        description: `运单号: ${p.tracking_number}`,
        data: p
      });
    });

    callbacks.forEach(c => {
      timeline.push({
        time: c.created_at,
        type: 'customs_callback',
        title: `海关回调: ${c.callback_type}`,
        description: c.message,
        data: c
      });
    });

    tickets.forEach(t => {
      timeline.push({
        time: t.created_at,
        type: 'ticket_created',
        title: `补资料工单: ${t.ticket_number}`,
        description: `状态: ${t.status}, 优先级: ${t.priority}`,
        data: t
      });
    });

    resubmits.forEach(r => {
      timeline.push({
        time: r.created_at,
        type: 'resubmit',
        title: '退单重提申请',
        description: `审核状态: ${r.review_status}`,
        data: r
      });
    });

    logs.forEach(l => {
      timeline.push({
        time: l.created_at,
        type: 'operation',
        title: `操作: ${l.operation_type}`,
        description: `操作人: ${l.operator}`,
        data: l
      });
    });

    timeline.sort((a, b) => new Date(a.time) - new Date(b.time));

    res.json(timeline);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
