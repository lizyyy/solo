import express from 'express';
import { get, run, all } from './database';
import { DistributionService } from './services/DistributionService';
import { createObjectCsvWriter } from 'csv-writer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

router.get('/families', async (req, res) => {
  const { status } = req.query;
  let query = 'SELECT * FROM families';
  const params: any[] = [];
  
  if (status) {
    query += ' WHERE status = ?';
    params.push(status);
  }
  query += ' ORDER BY createdAt DESC';
  
  const families = await all(query, params);
  res.json(families);
});

router.get('/families/:id', async (req, res) => {
  const family = await get('SELECT * FROM families WHERE id = ?', [req.params.id]);
  if (!family) {
    return res.status(404).json({ error: '家庭不存在' });
  }
  res.json(family);
});

router.post('/families', async (req, res) => {
  const { familyId, name, members, address, phone } = req.body;
  
  const existing = await get('SELECT id FROM families WHERE familyId = ?', [familyId]);
  if (existing) {
    return res.status(400).json({ error: '家庭编号已存在' });
  }

  const now = new Date().toISOString();
  const result = await run(`
    INSERT INTO families (familyId, name, members, address, phone, status, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
  `, [familyId, name, members || 1, address, phone, now, now]);
  
  res.json({ id: result.lastID, familyId, name });
});

router.put('/families/:id/approve', async (req, res) => {
  const { reviewer, remarks } = req.body;
  
  await run(`
    UPDATE families 
    SET status = 'approved', reviewer = ?, reviewTime = ?, remarks = ?, updatedAt = ?
    WHERE id = ?
  `, [reviewer || '系统', new Date().toISOString(), remarks, new Date().toISOString(), req.params.id]);
  
  res.json({ success: true });
});

router.put('/families/:id/reject', async (req, res) => {
  const { reviewer, remarks } = req.body;
  
  await run(`
    UPDATE families 
    SET status = 'rejected', reviewer = ?, reviewTime = ?, remarks = ?, updatedAt = ?
    WHERE id = ?
  `, [reviewer || '系统', new Date().toISOString(), remarks, new Date().toISOString(), req.params.id]);
  
  res.json({ success: true });
});

router.get('/materials', async (req, res) => {
  const materials = await all('SELECT * FROM materials ORDER BY createdAt DESC');
  res.json(materials);
});

router.post('/materials', async (req, res) => {
  const { code, name, unit, description } = req.body;
  
  const result = await run(`
    INSERT INTO materials (code, name, unit, description, createdAt)
    VALUES (?, ?, ?, ?, ?)
  `, [code, name, unit, description, new Date().toISOString()]);
  
  res.json({ id: result.lastID, code, name });
});

router.get('/batches', async (req, res) => {
  const batches = await all(`
    SELECT b.*, m.name as materialName, m.unit as materialUnit
    FROM batches b
    JOIN materials m ON b.materialId = m.id
    ORDER BY b.createdAt DESC
  `);
  res.json(batches);
});

router.post('/batches', async (req, res) => {
  const { code, name, materialId, quantity, cycleDays, startTime, endTime } = req.body;
  
  const batchResult = await run(`
    INSERT INTO batches (code, name, materialId, quantity, cycleDays, startTime, endTime, status, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)
  `, [code, name, materialId, quantity, cycleDays || 30, startTime, endTime, new Date().toISOString()]);
  
  await run(`
    INSERT INTO inventory (materialId, batchId, totalQuantity, availableQuantity, updatedAt)
    VALUES (?, ?, ?, ?, ?)
  `, [materialId, batchResult.lastID, quantity, quantity, new Date().toISOString()]);
  
  res.json({ id: batchResult.lastID, code, name });
});

router.put('/batches/:id/close', async (req, res) => {
  await run("UPDATE batches SET status = 'closed' WHERE id = ?", [req.params.id]);
  res.json({ success: true });
});

router.get('/distributions', async (req, res) => {
  const { status, needReview, familyId } = req.query;
  let query = `
    SELECT d.*, f.name as familyName, m.name as materialName, b.name as batchName
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
  
  const distributions = await all(query, params);
  res.json(distributions);
});

router.get('/distributions/:id', async (req, res) => {
  const distribution = await get(`
    SELECT d.*, f.name as familyName, m.name as materialName, b.name as batchName
    FROM distributions d
    JOIN families f ON d.familyId = f.id
    JOIN batches b ON d.batchId = b.id
    JOIN materials m ON b.materialId = m.id
    WHERE d.id = ?
  `, [req.params.id]);
  
  if (!distribution) {
    return res.status(404).json({ error: '发放记录不存在' });
  }
  
  const history = await DistributionService.getDistributionHistory(parseInt(req.params.id));
  res.json({ ...distribution, history });
});

router.get('/distributions/family/:familyId', async (req, res) => {
  const history = await DistributionService.getFamilyDistributionHistory(parseInt(req.params.familyId));
  res.json(history);
});

router.post('/distributions', async (req, res) => {
  const result = await DistributionService.createDistribution({
    ...req.body,
    operator: req.body.operator || '志愿者'
  });
  res.json(result);
});

router.put('/distributions/:id/approve', async (req, res) => {
  const result = await DistributionService.approveDistribution(
    parseInt(req.params.id),
    req.body.operator || '志愿者',
    req.body.quantity
  );
  res.json(result);
});

router.put('/distributions/:id/reject', async (req, res) => {
  const result = await DistributionService.rejectDistribution(
    parseInt(req.params.id),
    req.body.operator || '志愿者',
    req.body.reason
  );
  res.json(result);
});

router.post('/distributions/:id/return', async (req, res) => {
  const result = await DistributionService.returnDistribution(
    parseInt(req.params.id),
    req.body.quantity,
    req.body.reason,
    req.body.operator || '志愿者'
  );
  res.json(result);
});

router.get('/inventory', async (req, res) => {
  const inventory = await all(`
    SELECT i.*, m.name as materialName, m.unit as materialUnit, b.name as batchName
    FROM inventory i
    JOIN materials m ON i.materialId = m.id
    JOIN batches b ON i.batchId = b.id
    ORDER BY i.updatedAt DESC
  `);
  res.json(inventory);
});

router.get('/dashboard/stats', async (req, res) => {
  const familyStats = await get(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
    FROM families
  `) as any;

  const distributionStats = await get(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'distributed' THEN 1 ELSE 0 END) as distributed,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) as blocked,
      SUM(CASE WHEN needReview = 1 AND reviewStatus = 'pending' THEN 1 ELSE 0 END) as needReview
    FROM distributions
  `) as any;

  const inventoryStats = await get(`
    SELECT 
      SUM(totalQuantity) as total,
      SUM(distributedQuantity) as distributed,
      SUM(availableQuantity) as available
    FROM inventory
  `) as any;

  res.json({
    families: familyStats,
    distributions: distributionStats,
    inventory: inventoryStats
  });
});

router.get('/dashboard/recent', async (req, res) => {
  const recent = await all(`
    SELECT d.*, f.name as familyName, m.name as materialName
    FROM distributions d
    JOIN families f ON d.familyId = f.id
    JOIN batches b ON d.batchId = b.id
    JOIN materials m ON b.materialId = m.id
    ORDER BY d.createdAt DESC
    LIMIT 10
  `);
  
  res.json(recent);
});

router.get('/export/inventory', async (req, res) => {
  const inventory = await all(`
    SELECT i.*, m.name as materialName, m.code as materialCode, m.unit, b.name as batchName, b.code as batchCode
    FROM inventory i
    JOIN materials m ON i.materialId = m.id
    JOIN batches b ON i.batchId = b.id
  `) as any[];

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

router.get('/returns', async (req, res) => {
  const returns = await all(`
    SELECT r.*, d.distributionNo, f.name as familyName, m.name as materialName
    FROM return_records r
    JOIN distributions d ON r.distributionId = d.id
    JOIN families f ON d.familyId = f.id
    JOIN batches b ON d.batchId = b.id
    JOIN materials m ON b.materialId = m.id
    ORDER BY r.createdAt DESC
  `);
  res.json(returns);
});

router.put('/returns/:id/restore', async (req, res) => {
  const returnRecord = await get('SELECT * FROM return_records WHERE id = ?', [req.params.id]) as any;
  if (!returnRecord) {
    return res.status(404).json({ error: '退回记录不存在' });
  }

  const result = await DistributionService.restoreInventory(
    returnRecord.distributionId,
    returnRecord.quantity,
    req.body.operator || '系统'
  );
  res.json(result);
});

export default router;
