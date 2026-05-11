import express from 'express';
import db from '../database';
import multer from 'multer';
import csv from 'csv-parser';
import fs from 'fs';
import path from 'path';

const router = express.Router();
const upload = multer({ dest: path.join(__dirname, '../../uploads') });

router.get('/', async (req, res) => {
  const { status, courier_company_id, start_date, end_date, keyword } = req.query;
  let query = `
    SELECT p.*, c.name as courier_company_name, c.code as courier_company_code
    FROM packages p
    JOIN courier_companies c ON p.courier_company_id = c.id
    WHERE 1=1
  `;
  const params: any[] = [];
  
  if (status) {
    query += ' AND p.status = ?';
    params.push(status);
  }
  if (courier_company_id) {
    query += ' AND p.courier_company_id = ?';
    params.push(courier_company_id);
  }
  if (start_date) {
    query += ' AND p.scan_time >= ?';
    params.push(start_date);
  }
  if (end_date) {
    query += ' AND p.scan_time <= ?';
    params.push(end_date);
  }
  if (keyword) {
    query += ' AND (p.tracking_number LIKE ? OR p.recipient_name LIKE ? OR p.recipient_phone LIKE ?)';
    const likeKeyword = `%${keyword}%`;
    params.push(likeKeyword, likeKeyword, likeKeyword);
  }
  query += ' ORDER BY p.scan_time DESC';
  
  try {
    const packages = await db.all(query, params);
    res.json(packages);
  } catch (error) {
    res.status(500).json({ error: '查询包裹列表失败', details: (error as Error).message });
  }
});

router.get('/stats', async (req, res) => {
  const { courier_company_id, start_date, end_date } = req.query;
  let query = `
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
      SUM(CASE WHEN status = 'returned' THEN 1 ELSE 0 END) as returned,
      SUM(COALESCE(total_fee, 0)) as total_fee,
      SUM(COALESCE(delivery_fee, 0)) as delivery_fee_total,
      SUM(COALESCE(return_fee, 0)) as return_fee_total,
      SUM(COALESCE(storage_fee, 0)) as storage_fee_total
    FROM packages
    WHERE 1=1
  `;
  const params: any[] = [];
  
  if (courier_company_id) {
    query += ' AND courier_company_id = ?';
    params.push(courier_company_id);
  }
  if (start_date) {
    query += ' AND scan_time >= ?';
    params.push(start_date);
  }
  if (end_date) {
    query += ' AND scan_time <= ?';
    params.push(end_date);
  }
  
  try {
    const stats = await db.get(query, params) || {
      total: 0, pending: 0, delivered: 0, returned: 0,
      total_fee: 0, delivery_fee_total: 0, return_fee_total: 0, storage_fee_total: 0
    };
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: '查询统计数据失败', details: (error as Error).message });
  }
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const pkg = await db.get(`
      SELECT p.*, c.name as courier_company_name, c.code as courier_company_code,
             c.delivery_fee as company_delivery_fee, c.return_fee as company_return_fee, c.storage_fee_per_day as company_storage_fee
      FROM packages p
      JOIN courier_companies c ON p.courier_company_id = c.id
      WHERE p.id = ?
    `, [id]);
    if (!pkg) {
      return res.status(404).json({ error: '包裹不存在' });
    }
    res.json(pkg);
  } catch (error) {
    res.status(500).json({ error: '查询包裹详情失败', details: (error as Error).message });
  }
});

router.post('/', async (req, res) => {
  const { tracking_number, courier_company_id, recipient_name, recipient_phone, notes } = req.body;
  
  if (!tracking_number || !courier_company_id || !recipient_name) {
    return res.status(400).json({ error: '运单号、快递公司和收件人姓名为必填项' });
  }
  
  try {
    const existing = await db.get('SELECT * FROM packages WHERE tracking_number = ?', [tracking_number]);
    if (existing) {
      return res.status(400).json({ error: '该运单号已存在' });
    }
    
    const company = await db.get('SELECT * FROM courier_companies WHERE id = ?', [courier_company_id]);
    if (!company) {
      return res.status(400).json({ error: '快递公司不存在' });
    }

    const result = await db.run(`
      INSERT INTO packages (tracking_number, courier_company_id, recipient_name, recipient_phone, notes, delivery_fee)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [tracking_number, courier_company_id, recipient_name, recipient_phone, notes, (company as any).delivery_fee]);
    
    const newPackage = await db.get('SELECT * FROM packages WHERE id = ?', [result.lastID]);
    res.status(201).json(newPackage);
  } catch (error) {
    res.status(500).json({ error: '创建包裹失败', details: (error as Error).message });
  }
});

router.post('/scan', async (req, res) => {
  const { tracking_number } = req.body;
  
  if (!tracking_number) {
    return res.status(400).json({ error: '运单号为必填项' });
  }
  
  try {
    const pkg = await db.get(`
      SELECT p.*, c.name as courier_company_name, c.code as courier_company_code
      FROM packages p
      JOIN courier_companies c ON p.courier_company_id = c.id
      WHERE p.tracking_number = ?
    `, [tracking_number]);
    
    if (!pkg) {
      return res.status(404).json({ error: '未找到该运单号的包裹', tracking_number });
    }
    
    res.json(pkg);
  } catch (error) {
    res.status(500).json({ error: '扫描包裹失败', details: (error as Error).message });
  }
});

router.patch('/:id/deliver', async (req, res) => {
  const { id } = req.params;
  try {
    const pkg = await db.get('SELECT * FROM packages WHERE id = ?', [id]);
    if (!pkg) {
      return res.status(404).json({ error: '包裹不存在' });
    }
    
    if ((pkg as any).status === 'delivered') {
      return res.status(400).json({ error: '该包裹已签收，不可重复签收' });
    }
    
    if ((pkg as any).status === 'returned') {
      return res.status(400).json({ error: '该包裹已退件，不可签收' });
    }
    
    const deliveryTime = new Date().toISOString();
    await db.run(`
      UPDATE packages
      SET status = 'delivered', delivery_time = ?, total_fee = delivery_fee
      WHERE id = ?
    `, [deliveryTime, id]);
    
    const updatedPackage = await db.get(`
      SELECT p.*, c.name as courier_company_name
      FROM packages p
      JOIN courier_companies c ON p.courier_company_id = c.id
      WHERE p.id = ?
    `, [id]);
    res.json(updatedPackage);
  } catch (error) {
    res.status(500).json({ error: '签收包裹失败', details: (error as Error).message });
  }
});

router.patch('/:id/return', async (req, res) => {
  const { id } = req.params;
  try {
    const pkg = await db.get('SELECT * FROM packages WHERE id = ?', [id]);
    if (!pkg) {
      return res.status(404).json({ error: '包裹不存在' });
    }
    
    if ((pkg as any).status === 'delivered') {
      return res.status(400).json({ error: '该包裹已签收，不可退件' });
    }
    
    if ((pkg as any).status === 'returned') {
      return res.status(400).json({ error: '该包裹已退件，不可重复退件' });
    }
    
    const company = await db.get('SELECT * FROM courier_companies WHERE id = ?', [(pkg as any).courier_company_id]);
    const returnTime = new Date().toISOString();
    const scanTime = new Date((pkg as any).scan_time);
    const now = new Date();
    const retentionDays = Math.max(0, Math.floor((now.getTime() - scanTime.getTime()) / (1000 * 60 * 60 * 24)));
    
    let retentionRule = await db.get(`
      SELECT * FROM retention_rules
      WHERE courier_company_id = ? OR is_global = 1
      ORDER BY is_global ASC
    `, [(pkg as any).courier_company_id]);
    
    const freeDays = retentionRule ? (retentionRule as any).free_days : 3;
    const storageFeePerDay = retentionRule ? (retentionRule as any).storage_fee_per_day : (company as any).storage_fee_per_day;
    const storageFee = Math.max(0, (retentionDays - freeDays) * storageFeePerDay);
    const totalFee = (company as any).return_fee + storageFee;
    
    await db.run(`
      UPDATE packages
      SET status = 'returned', return_time = ?, retention_days = ?, return_fee = ?, storage_fee = ?, total_fee = ?
      WHERE id = ?
    `, [returnTime, retentionDays, (company as any).return_fee, storageFee, totalFee, id]);
    
    const updatedPackage = await db.get(`
      SELECT p.*, c.name as courier_company_name
      FROM packages p
      JOIN courier_companies c ON p.courier_company_id = c.id
      WHERE p.id = ?
    `, [id]);
    res.json(updatedPackage);
  } catch (error) {
    res.status(500).json({ error: '退件处理失败', details: (error as Error).message });
  }
});

router.post('/import', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '请上传CSV文件' });
  }
  
  const results: any[] = [];
  const errors: any[] = [];
  let successCount = 0;
  let errorCount = 0;
  
  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      for (const item of results) {
        try {
          const trackingNumber = item.tracking_number || item['运单号'];
          const companyCode = item.courier_company_code || item['快递公司编码'];
          const recipientName = item.recipient_name || item['收件人姓名'];
          const recipientPhone = item.recipient_phone || item['收件人电话'] || '';
          const notes = item.notes || item['备注'] || '';
          
          if (!trackingNumber || !companyCode || !recipientName) {
            errorCount++;
            errors.push({ row: results.indexOf(item) + 2, error: '缺少必填字段' });
            continue;
          }
          
          const company = await db.get('SELECT * FROM courier_companies WHERE code = ?', [companyCode]);
          if (!company) {
            errorCount++;
            errors.push({ row: results.indexOf(item) + 2, error: `快递公司编码不存在: ${companyCode}` });
            continue;
          }
          
          const existing = await db.get('SELECT * FROM packages WHERE tracking_number = ?', [trackingNumber]);
          if (existing) {
            errorCount++;
            errors.push({ row: results.indexOf(item) + 2, error: `运单号已存在: ${trackingNumber}` });
            continue;
          }
          
          await db.run(`
            INSERT INTO packages (tracking_number, courier_company_id, recipient_name, recipient_phone, notes, delivery_fee)
            VALUES (?, ?, ?, ?, ?, ?)
          `, [trackingNumber, (company as any).id, recipientName, recipientPhone, notes, (company as any).delivery_fee]);
          successCount++;
        } catch (err) {
          errorCount++;
          errors.push({ row: results.indexOf(item) + 2, error: (err as Error).message });
        }
      }
      
      try {
        fs.unlinkSync(req.file.path);
        res.json({
          success: true,
          successCount,
          errorCount,
          totalCount: results.length,
          errors
        });
      } catch (error) {
        fs.unlinkSync(req.file.path);
        res.status(500).json({ error: '导入失败', details: (error as Error).message });
      }
    });
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const pkg = await db.get('SELECT * FROM packages WHERE id = ?', [id]);
    if (!pkg) {
      return res.status(404).json({ error: '包裹不存在' });
    }
    
    if ((pkg as any).status === 'delivered' || (pkg as any).status === 'returned') {
      return res.status(400).json({ error: '已处理的包裹不可删除' });
    }
    
    await db.run('DELETE FROM packages WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: '删除包裹失败', details: (error as Error).message });
  }
});

export default router;
