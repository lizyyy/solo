import express from 'express';
import db from './database';
import { DistributionService } from './services/DistributionService';
import { createObjectCsvWriter } from 'csv-writer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// 家庭管理
router.get('/families', (req, res) => {
  const { status } = req.query;
  let query = 'SELECT * FROM families';
  const params: any[] = [];
  
  if (status) {
    query += ' WHERE status = ?';
    params.push(status);
  }
  query += ' ORDER BY createdAt DESC';
  
  const families = db.prepare(query).all(...params);
  res.json(families);
});

router.get('/families/:id', (req, res) => {
  const family = db.prepare('SELECT * FROM families WHERE id = ?').get(req.params.id);
  if (!family) {
    return res.status(404).json({ error: '家庭不存在' });
  }
  res.json(family);
});

router.post('/families', (req, res) => {
  const { familyId, name, members, address, phone } = req.body;
  
  const existing = db.prepare('SELECT id FROM families WHERE familyId = ?').get(familyId);
  if (existing) {
    return res.status(400).json({ error: '家庭编号已存在' });
  }

  const stmt = db.prepare(`
    INSERT INTO families (familyId, name, members, address, phone, status, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
  `);
  
  const now = new Date().toISOString();
  const result = stmt.run(familyId, name, members || 1, address, phone, now, now);
  
  res.json({ id: result.lastInsertRowid, familyId, name });
});

router.put('/families/:id/approve', (req, res) => {
  const { reviewer, remarks } = req.body;
  
  db.prepare(`
    UPDATE families 
    SET status = 'approved', reviewer = ?, reviewTime = ?, remarks = ?, updatedAt = ?
    WHERE id = ?
  `).run(reviewer || '系统', new Date().toISOString(), remarks, new Date().toISOString(), req.params.id);
  
  res.json({ success: true });
});

router.put('/families/:id/reject', (req, res) => {
  const { reviewer, remarks } = req.body;
  
  db.prepare(`
    UPDATE families 
    SET status = 'rejected', reviewer = ?, reviewTime = ?, remarks = ?, updatedAt = ?
    WHERE id = ?
  `).run(reviewer || '系统', new Date().toISOString(), remarks, new Date().toISOString(), req.params.id);
  
  res.json({ success: true });
});

// 物资管理
router.get('/materials', (req, res) => {
  const materials = db.prepare('SELECT * FROM materials ORDER BY createdAt DESC').all();
  res.json(materials);
});

router.post('/materials', (req, res) => {
  const { code, name, unit, description } = req.body;
  
  const stmt = db.prepare(`
    INSERT INTO materials (code, name, unit, description, createdAt)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  const result = stmt.run(code, name, unit, description, new Date().toISOString());
  res.json({ id: result.lastInsertRowid, code, name });
});

// 批次管理
router.get('/batches', (req, res) => {
  const batches = db.prepare(`
    SELECT b.*, m.name as materialName, m.unit as materialUnit
    FROM batches b
    JOIN materials m ON b.materialId = m.id
    ORDER BY b.createdAt DESC
  `).all();
  res.json(batches);
});

router.post('/batches', (req, res) => {
  const { code, name, materialId, quantity, cycleDays, startTime, endTime } = req.body;
  
  const stmt = db.prepare(`
    INSERT INTO batches (code, name, materialId, quantity, cycleDays, startTime, endTime, status, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)
  `);
  
  const result = stmt.run(code, name, materialId, quantity, cycleDays || 30, startTime, endTime, new Date().toISOString());
  const batchId = result.lastInsertRowid as number;
  
  db.prepare(`
    INSERT INTO inventory (materialId, batchId, totalQuantity, availableQuantity, updatedAt)
    VALUES (?, ?, ?, ?, ?)
  `).run(materialId, batchId, quantity, quantity, new Date().toISOString());
  
  res.json({ id: batchId, code, name });
});

router.put('/batches/:id/close', (req, res) => {
  db.prepare("UPDATE batches SET status = 'closed' WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

// 发放管理
router.get('/distributions', (req, res) => {
  const { status, needReview, familyId } = req.query;
  let query = `
    SELECT d.*, f.name as familyName, f.familyId, m.name as materialName, b.name as batchName
    FROM distributions d
    JOIN families f ON d.familyId = f.id
    JOIN batches b ON d.batchId = b.id
    JOIN materials m ON b.materialId = m.id
  `;
  const params: any[] = [];
  const conditions: string[] = [];
  
  if (status) {
    conditions.push('d.status = ?');
    params.push(status);
  }
  if (needReview === 'true') {
    conditions.push('d.needReview = 1');
  }
  if (familyId) {
    conditions.push('d.familyId = ?');
    params.push(familyId);
  }
  
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  query += ' ORDER BY d.createdAt DESC';
  
  const distributions = db.prepare(query).all(...params);
  res.json(distributions);
});

router.get('/distributions/:id', (req, res) => {
  const distribution = db.prepare(`
    SELECT d.*, f.name as familyName, f.familyId, m.name as materialName, b.name as batchName
    FROM distributions d
    JOIN families f ON d.familyId = f.id
    JOIN batches b ON d.batchId = b.id
    JOIN materials m ON b.materialId = m.id
    WHERE d.id = ?
  `).get(req.params.id);
  
  if (!distribution) {
    return res.status(404).json({ error: '发放记录不存在' });
  }
  
  const history = DistributionService.getDistributionHistory(parseInt(req.params.id));
  res.json({ ...distribution, history });
});

router.get('/distributions/family/:familyId', (req, res) => {
  const history = DistributionService.getFamilyDistributionHistory(parseInt(req.params.familyId));
  res.json(history);
});

router.post('/distributions', (req, res) => {
  const result = DistributionService.createDistribution({
    ...req.body,
    operator: req.body.operator || '志愿者'
  });
  res.json(result);
});

router.put('/distributions/:id/approve', (req, res) => {
  const result = DistributionService.approveDistribution(
    parseInt(req.params.id),
    req.body.operator || '志愿者',
    req.body.quantity
  );
  res.json(result);
});

router.put('/distributions/:id/reject', (req, res) => {
  const result = DistributionService.rejectDistribution(
    parseInt(req.params.id),
    req.body.operator || '志愿者',
    req.body.reason
  );
  res.json(result);
});

router.post('/distributions/:id/return', (req, res) => {
  const result = DistributionService.returnDistribution(
    parseInt(req.params.id),
    req.body.quantity,
    req.body.reason,
    req.body.operator || '志愿者'
  );
  res.json(result);
});

// 库存管理
router.get('/inventory', (req, res) => {
  const inventory = db.prepare(`
    SELECT i.*, m.name as materialName, m.unit as materialUnit, b.name as batchName
    FROM inventory i
    JOIN materials m ON i.materialId = m.id
    JOIN batches b ON i.batchId = b.id
    ORDER BY i.updatedAt DESC
  `).all();
  res.json(inventory);
});

// 看板数据
router.get('/dashboard/stats', (req, res) => {
  const familyStats = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
    FROM families
  `).get() as any;

  const distributionStats = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'distributed' THEN 1 ELSE 0 END) as distributed,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) as blocked,
      SUM(CASE WHEN needReview = 1 AND reviewStatus = 'pending' THEN 1 ELSE 0 END) as needReview
    FROM distributions
  `).get() as any;

  const inventoryStats = db.prepare(`
    SELECT 
      SUM(totalQuantity) as total,
      SUM(distributedQuantity) as distributed,
      SUM(availableQuantity) as available
    FROM inventory
  `).get() as any;

  res.json({
    families: familyStats,
    distributions: distributionStats,
    inventory: inventoryStats
  });
});

router.get('/dashboard/recent', (req, res) => {
  const recent = db.prepare(`
    SELECT d.*, f.name as familyName, m.name as materialName
    FROM distributions d
    JOIN families f ON d.familyId = f.id
    JOIN batches b ON d.batchId = b.id
    JOIN materials m ON b.materialId = m.id
    ORDER BY d.createdAt DESC
    LIMIT 10
  `).all();
  
  res.json(recent);
});

// 导出库存CSV
router.get('/export/inventory', async (req, res) => {
  const inventory = db.prepare(`
    SELECT i.*, m.name as materialName, m.code as materialCode, m.unit, b.name as batchName, b.code as batchCode
    FROM inventory i
    JOIN materials m ON i.materialId = m.id
    JOIN batches b ON i.batchId = b.id
  `).all() as any[];

  const exportDir = path.join(__dirname, '..', 'exports');
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  const filename = `inventory_${new Date().toISOString().split('T')[0]}.csv`;
  const filepath = path.join(exportDir, filename);

  const csvWriter = createObjectCsvWriter({
    path: filepath,
    header: [
      { id: 'materialCode', title: '物资编码' },
      { id: 'materialName', title: '物资名称' },
      { id: 'batchCode', title: '批次编码' },
      { id: 'batchName', title: '批次名称' },
      { id: 'unit', title: '单位' },
      { id: 'totalQuantity', title: '总数量' },
      { id: 'distributedQuantity', title: '已发放' },
      { id: 'returnedQuantity', title: '已退回' },
      { id: 'availableQuantity', title: '可用库存' }
    ]
  });

  await csvWriter.writeRecords(inventory);

  res.download(filepath, filename);
});

// 退回记录
router.get('/returns', (req, res) => {
  const returns = db.prepare(`
    SELECT r.*, d.distributionNo, f.name as familyName, m.name as materialName
    FROM return_records r
    JOIN distributions d ON r.distributionId = d.id
    JOIN families f ON d.familyId = f.id
    JOIN batches b ON d.batchId = b.id
    JOIN materials m ON b.materialId = m.id
    ORDER BY r.createdAt DESC
  `).all();
  res.json(returns);
});

router.put('/returns/:id/restore', (req, res) => {
  const returnRecord = db.prepare('SELECT * FROM return_records WHERE id = ?').get(req.params.id) as any;
  if (!returnRecord) {
    return res.status(404).json({ error: '退回记录不存在' });
  }

  const result = DistributionService.restoreInventory(
    returnRecord.distributionId,
    returnRecord.quantity,
    req.body.operator || '系统'
  );
  res.json(result);
});

export default router;
