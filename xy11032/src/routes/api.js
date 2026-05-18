const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { 登记借用, 登记归还, 批量补录借还, 登记消毒 } = require('../services/lending-service');
const { 检查借还一致性, 检查借用前置条件 } = require('../services/validation-service');
const { 查询借还明细, 导出JSON, 导出CSV, 保存导出文件 } = require('../services/export-service');

router.get('/health', (req, res) => {
  res.json({ 状态: '正常', 服务: '牙科器材库器械借用归还系统', 时间: new Date().toISOString() });
});

router.post('/borrow', async (req, res) => {
  const 结果 = await 登记借用(req.body);
  res.json(结果);
});

router.post('/return', async (req, res) => {
  const 结果 = await 登记归还(req.body);
  res.json(结果);
});

router.post('/batch-import', async (req, res) => {
  const { 记录列表 } = req.body;
  if (!Array.isArray(记录列表)) {
    return res.json({ 成功: false, 消息: '记录列表必须是数组' });
  }
  const 结果 = await 批量补录借还(记录列表);
  res.json(结果);
});

router.post('/sterilize', async (req, res) => {
  const 结果 = await 登记消毒(req.body);
  res.json(结果);
});

router.get('/check-consistency', async (req, res) => {
  const 结果 = await 检查借还一致性();
  res.json(结果);
});

router.get('/check-borrow/:器械编号', async (req, res) => {
  const 结果 = await 检查借用前置条件(req.params.器械编号);
  res.json(结果);
});

router.get('/records', async (req, res) => {
  const 结果 = await 查询借还明细(req.query);
  res.json(结果);
});

router.get('/export/json', async (req, res) => {
  const jsonData = await 导出JSON(req.query);
  const 文件名 = `牙科器材借还记录_${new Date().toISOString().split('T')[0]}`;
  const 文件信息 = 保存导出文件(jsonData, 文件名, 'json');
  res.json({
    消息: '导出成功',
    文件信息,
    数据: JSON.parse(jsonData)
  });
});

router.get('/export/csv', async (req, res) => {
  const csvData = await 导出CSV(req.query);
  const 文件名 = `牙科器材借还记录_${new Date().toISOString().split('T')[0]}`;
  const 文件信息 = 保存导出文件(csvData, 文件名, 'csv');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${文件名}.csv"`);
  res.send(csvData);
});

router.get('/equipment', async (req, res) => {
  const 器械列表 = await db.prepare(`SELECT * FROM 器械档案 ORDER BY 器械编号`).all();
  res.json({
    总数: 器械列表.length,
    列表: 器械列表
  });
});

router.get('/equipment/:编号', async (req, res) => {
  const 器械 = await db.prepare(`SELECT * FROM 器械档案 WHERE 器械编号 = ?`).get(req.params.编号);
  if (!器械) {
    return res.json({ 消息: '器械不存在' });
  }
  const 借还记录 = await db.prepare(`
    SELECT * FROM 借还明细 WHERE 器械编号 = ? ORDER BY 借用日期时间 DESC LIMIT 10
  `).all(req.params.编号);
  res.json({ 器械信息: 器械, 近期借还记录: 借还记录 });
});

router.get('/stats', async (req, res) => {
  const 借用中 = await db.prepare(`SELECT COUNT(*) as count FROM 器械档案 WHERE 当前状态 = '借用中'`).get();
  const 待消毒 = await db.prepare(`SELECT COUNT(*) as count FROM 器械档案 WHERE 当前状态 = '待消毒'`).get();
  const 在库 = await db.prepare(`SELECT COUNT(*) as count FROM 器械档案 WHERE 当前状态 = '在库'`).get();
  const 本月借用 = await db.prepare(`
    SELECT COUNT(*) as count FROM 借还明细 
    WHERE strftime('%Y-%m', 借用日期时间) = strftime('%Y-%m', 'now')
  `).get();

  res.json({
    统计时间: new Date().toISOString(),
    借用中: 借用中.count,
    待消毒: 待消毒.count,
    在库: 在库.count,
    本月借用次数: 本月借用.count
  });
});

module.exports = router;
