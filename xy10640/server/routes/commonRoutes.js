const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const TimelineService = require('../services/timelineService');
const { all } = require('../database/db');

router.get('/timeline', async (req, res) => {
  try {
    const timeline = await TimelineService.getTimeline(req.query);
    res.json({ success: true, data: timeline });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/export/ayis', async (req, res) => {
  try {
    const ayis = await all('SELECT * FROM ayi_profiles ORDER BY created_at DESC');
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('阿姨档案');
    
    worksheet.columns = [
      { header: '阿姨ID', key: 'ayi_id', width: 20 },
      { header: '姓名', key: 'name', width: 15 },
      { header: '电话', key: 'phone', width: 15 },
      { header: '身份证', key: 'id_card', width: 20 },
      { header: '技能', key: 'skills', width: 30 },
      { header: '经验(年)', key: 'experience_years', width: 12 },
      { header: '状态', key: 'status', width: 12 },
      { header: '创建时间', key: 'created_at', width: 25 }
    ];
    
    worksheet.addRows(ayis);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=ayis.xlsx');
    
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/export/deposits', async (req, res) => {
  try {
    const deposits = await all(`
      SELECT d.*, a.name as ayi_name 
      FROM deposits d 
      LEFT JOIN ayi_profiles a ON d.ayi_id = a.ayi_id 
      ORDER BY d.created_at DESC
    `);
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('保证金记录');
    
    worksheet.columns = [
      { header: '保证金ID', key: 'deposit_id', width: 20 },
      { header: '阿姨姓名', key: 'ayi_name', width: 15 },
      { header: '金额', key: 'amount', width: 12 },
      { header: '支付方式', key: 'payment_method', width: 15 },
      { header: '支付日期', key: 'payment_date', width: 15 },
      { header: '收据号', key: 'receipt_number', width: 20 },
      { header: '状态', key: 'status', width: 12 },
      { header: '复核状态', key: 'review_status', width: 12 },
      { header: '创建时间', key: 'created_at', width: 25 }
    ];
    
    worksheet.addRows(deposits);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=deposits.xlsx');
    
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/export/evaluations', async (req, res) => {
  try {
    const evaluations = await all(`
      SELECT e.*, a.name as ayi_name, c.customer_name 
      FROM customer_evaluations e 
      LEFT JOIN ayi_profiles a ON e.ayi_id = a.ayi_id
      LEFT JOIN customer_requirements c ON e.req_id = c.req_id
      ORDER BY e.created_at DESC
    `);
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('客户评价');
    
    worksheet.columns = [
      { header: '评价ID', key: 'eval_id', width: 20 },
      { header: '阿姨姓名', key: 'ayi_name', width: 15 },
      { header: '客户姓名', key: 'customer_name', width: 15 },
      { header: '综合评分', key: 'overall_rating', width: 12 },
      { header: '态度评分', key: 'attitude_rating', width: 12 },
      { header: '技能评分', key: 'skill_rating', width: 12 },
      { header: '守时评分', key: 'punctuality_rating', width: 12 },
      { header: '是否异常', key: 'is_abnormal', width: 12 },
      { header: '状态', key: 'status', width: 12 },
      { header: '创建时间', key: 'created_at', width: 25 }
    ];
    
    worksheet.addRows(evaluations);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=evaluations.xlsx');
    
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/export/timeline', async (req, res) => {
  try {
    const timeline = await TimelineService.getTimeline();
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('操作时间线');
    
    worksheet.columns = [
      { header: '时间线ID', key: 'timeline_id', width: 20 },
      { header: '操作类型', key: 'operation_type', width: 20 },
      { header: '实体类型', key: 'entity_type', width: 15 },
      { header: '实体ID', key: 'entity_id', width: 20 },
      { header: '状态', key: 'status', width: 12 },
      { header: '结果类型', key: 'result_type', width: 20 },
      { header: '描述', key: 'description', width: 40 },
      { header: '操作人', key: 'operator', width: 15 },
      { header: '失败原因', key: 'failure_reason', width: 30 },
      { header: '操作时间', key: 'created_at', width: 25 }
    ];
    
    worksheet.addRows(timeline);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=timeline.xlsx');
    
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;