const express = require('express');
const router = express.Router();
const db = require('../models/database');
const { Parser } = require('json2csv');
const dayjs = require('dayjs');

router.get('/dashboard', (req, res) => {
  const startDate = req.query.startDate || dayjs().subtract(30, 'day').format('YYYY-MM-DD');
  const endDate = req.query.endDate || dayjs().format('YYYY-MM-DD');

  const batchStats = db.prepare(`
    SELECT 
      COUNT(*) as total_batches,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_batches,
      SUM(total_meals) as total_meals,
      SUM(delivered_meals) as delivered_meals,
      SUM(returned_meals) as returned_meals
    FROM delivery_batches
    WHERE delivery_date BETWEEN ? AND ?
  `).get(startDate, endDate);

  const tempStats = db.prepare(`
    SELECT 
      COUNT(*) as total_segments,
      SUM(CASE WHEN ts.is_normal = 0 THEN 1 ELSE 0 END) as abnormal_segments
    FROM temperature_segments ts
    JOIN delivery_batches b ON ts.batch_id = b.id
    WHERE b.delivery_date BETWEEN ? AND ?
  `).get(startDate, endDate);

  const returnStats = db.prepare(`
    SELECT 
      rr.reason_code,
      COUNT(*) as count,
      SUM(rr.meals_returned) as meals_returned
    FROM return_reasons rr
    JOIN sign_receipts sr ON rr.receipt_id = sr.id
    JOIN delivery_batches b ON sr.batch_id = b.id
    WHERE b.delivery_date BETWEEN ? AND ?
    AND rr.status IN ('approved', 'auto_approved')
    GROUP BY rr.reason_code
    ORDER BY count DESC
  `).all(startDate, endDate);

  const compensationStats = db.prepare(`
    SELECT 
      COUNT(*) as total_compensations,
      SUM(CASE WHEN c.status = 'approved' THEN 1 ELSE 0 END) as approved_compensations,
      SUM(CASE WHEN c.status = 'approved' THEN compensation_amount ELSE 0 END) as total_amount
    FROM compensations c
    JOIN delivery_batches b ON c.batch_id = b.id
    WHERE b.delivery_date BETWEEN ? AND ?
  `).get(startDate, endDate);

  const incidentStats = db.prepare(`
    SELECT 
      COUNT(*) as total_incidents,
      SUM(CASE WHEN si.severity = 'high' THEN 1 ELSE 0 END) as high_severity,
      SUM(si.affected_count) as total_affected
    FROM safety_incidents si
    JOIN delivery_batches b ON si.batch_id = b.id
    WHERE b.delivery_date BETWEEN ? AND ?
  `).get(startDate, endDate);

  const dailyTrend = db.prepare(`
    SELECT 
      b.delivery_date,
      COUNT(*) as batches,
      SUM(b.total_meals) as meals,
      SUM(CASE WHEN ts.is_normal = 0 THEN 1 ELSE 0 END) as abnormal_temps
    FROM delivery_batches b
    LEFT JOIN temperature_segments ts ON b.id = ts.batch_id
    WHERE b.delivery_date BETWEEN ? AND ?
    GROUP BY b.delivery_date
    ORDER BY b.delivery_date
  `).all(startDate, endDate);

  res.json({
    success: true,
    data: {
      batchStats,
      tempStats,
      returnStats,
      compensationStats,
      incidentStats,
      dailyTrend
    }
  });
});

router.get('/incidents', (req, res) => {
  const { status, startDate, endDate } = req.query;

  let query = `
    SELECT si.*, db.batch_no, db.delivery_date, db.meal_type
    FROM safety_incidents si
    JOIN delivery_batches db ON si.batch_id = db.id
    WHERE 1=1
  `;
  const params = [];

  if (status) {
    query += ` AND si.status = ?`;
    params.push(status);
  }

  if (startDate && endDate) {
    query += ` AND db.delivery_date BETWEEN ? AND ?`;
    params.push(startDate, endDate);
  }

  query += ` ORDER BY si.created_at DESC`;

  const incidents = db.prepare(query).all(...params);
  res.json({ success: true, data: incidents });
});

router.post('/incidents/:id/close', (req, res) => {
  db.prepare(`
    UPDATE safety_incidents 
    SET status = 'closed', reporter = COALESCE(?, reporter) 
    WHERE id = ?
  `).run(req.body.closed_by || null, req.params.id);

  res.json({ success: true });
});

router.get('/export/batches', (req, res) => {
  const startDate = req.query.startDate || dayjs().subtract(30, 'day').format('YYYY-MM-DD');
  const endDate = req.query.endDate || dayjs().format('YYYY-MM-DD');

  const batches = db.prepare(`
    SELECT 
      batch_no as 批次号,
      delivery_date as 配送日期,
      meal_type as 餐食类型,
      total_meals as 总份数,
      delivered_meals as 已送达,
      returned_meals as 已退回,
      status as 状态,
      distributor as 配送员,
      vehicle_no as 车牌号,
      created_at as 创建时间
    FROM delivery_batches
    WHERE delivery_date BETWEEN ? AND ?
    ORDER BY delivery_date DESC
  `).all(startDate, endDate);

  const parser = new Parser();
  const csv = parser.parse(batches);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="batches_${dayjs().format('YYYYMMDD')}.csv"`);
  res.send('\uFEFF' + csv);
});

router.get('/export/temperature', (req, res) => {
  const startDate = req.query.startDate || dayjs().subtract(30, 'day').format('YYYY-MM-DD');
  const endDate = req.query.endDate || dayjs().format('YYYY-MM-DD');

  const segments = db.prepare(`
    SELECT 
      db.batch_no as 批次号,
      ts.segment_name as 片段名称,
      ts.start_time as 开始时间,
      ts.end_time as 结束时间,
      ts.avg_temp as 平均温度,
      ts.min_temp as 最低温度,
      ts.max_temp as 最高温度,
      CASE WHEN ts.is_normal = 1 THEN '正常' ELSE '异常' END as 状态,
      ts.abnormal_reason as 异常原因
    FROM temperature_segments ts
    JOIN delivery_batches db ON ts.batch_id = db.id
    WHERE db.delivery_date BETWEEN ? AND ?
    ORDER BY db.delivery_date DESC, ts.start_time
  `).all(startDate, endDate);

  const parser = new Parser();
  const csv = parser.parse(segments);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="temperature_${dayjs().format('YYYYMMDD')}.csv"`);
  res.send('\uFEFF' + csv);
});

router.get('/export/compensations', (req, res) => {
  const startDate = req.query.startDate || dayjs().subtract(30, 'day').format('YYYY-MM-DD');
  const endDate = req.query.endDate || dayjs().format('YYYY-MM-DD');

  const compensations = db.prepare(`
    SELECT 
      db.batch_no as 批次号,
      db.delivery_date as 配送日期,
      c.elderly_name as 老人姓名,
      c.compensation_type as 补偿类型,
      c.compensation_amount as 补偿金额,
      c.reason as 补偿原因,
      CASE c.status 
        WHEN 'pending' THEN '待审批' 
        WHEN 'approved' THEN '已通过' 
        WHEN 'rejected' THEN '已拒绝' 
        WHEN 'manual' THEN '人工录入'
        ELSE c.status 
      END as 状态,
      c.approved_by as 审批人,
      c.approval_time as 审批时间,
      c.created_at as 创建时间
    FROM compensations c
    JOIN delivery_batches db ON c.batch_id = db.id
    WHERE db.delivery_date BETWEEN ? AND ?
    ORDER BY db.delivery_date DESC, c.created_at DESC
  `).all(startDate, endDate);

  const parser = new Parser();
  const csv = parser.parse(compensations);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="compensations_${dayjs().format('YYYYMMDD')}.csv"`);
  res.send('\uFEFF' + csv);
});

router.get('/export/incidents', (req, res) => {
  const startDate = req.query.startDate || dayjs().subtract(30, 'day').format('YYYY-MM-DD');
  const endDate = req.query.endDate || dayjs().format('YYYY-MM-DD');

  const incidents = db.prepare(`
    SELECT 
      db.batch_no as 批次号,
      db.delivery_date as 配送日期,
      si.incident_type as 事件类型,
      si.severity as 严重程度,
      si.description as 描述,
      si.affected_count as 受影响人数,
      CASE si.status 
        WHEN 'open' THEN '处理中' 
        WHEN 'closed' THEN '已关闭' 
        ELSE si.status 
      END as 状态,
      si.reporter as 报告人,
      si.created_at as 创建时间
    FROM safety_incidents si
    JOIN delivery_batches db ON si.batch_id = db.id
    WHERE db.delivery_date BETWEEN ? AND ?
    ORDER BY db.delivery_date DESC, si.created_at DESC
  `).all(startDate, endDate);

  const parser = new Parser();
  const csv = parser.parse(incidents);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="incidents_${dayjs().format('YYYYMMDD')}.csv"`);
  res.send('\uFEFF' + csv);
});

module.exports = router;
