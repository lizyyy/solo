const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../config/database');
const ImportExportService = require('../services/importExportService');

const uploadDir = path.join(__dirname, '..', '..', 'data', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `import-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.csv', '.json'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('只支持 CSV 和 JSON 格式的文件'));
    }
  }
});

router.post('/import/csv', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: '请上传 CSV 文件' });
      return;
    }
    
    const result = await ImportExportService.importArtworksFromCSV(req.file.path);
    
    if (result.imported > 0) {
      const saveResult = await ImportExportService.saveImportedArtworks(result.artworks);
      res.json({
        success: saveResult.success,
        total: saveResult.total,
        success_count: saveResult.successCount,
        error_count: saveResult.errorCount,
        parse_errors: result.errorDetails,
        save_details: saveResult.details
      });
    } else {
      res.status(400).json({
        success: false,
        message: '没有成功解析任何作品数据',
        errors: result.errorDetails
      });
    }
    
    try {
      fs.unlinkSync(req.file.path);
    } catch (cleanupErr) {
      console.warn('清理上传文件失败:', cleanupErr.message);
    }
    
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/import/json', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: '请上传 JSON 文件' });
      return;
    }
    
    const fileContent = fs.readFileSync(req.file.path, 'utf-8');
    const artworks = JSON.parse(fileContent);
    
    if (!Array.isArray(artworks)) {
      res.status(400).json({ error: 'JSON 文件格式错误，应为作品数组' });
      return;
    }
    
    const saveResult = await ImportExportService.saveImportedArtworks(artworks);
    
    res.json({
      success: saveResult.success,
      total: saveResult.total,
      success_count: saveResult.successCount,
      error_count: saveResult.errorCount,
      details: saveResult.details
    });
    
    try {
      fs.unlinkSync(req.file.path);
    } catch (cleanupErr) {
      console.warn('清理上传文件失败:', cleanupErr.message);
    }
    
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/export/artworks/csv', (req, res) => {
  const { status, customer_id, delivery_date_from, delivery_date_to } = req.query;
  
  let query = `
    SELECT a.*,
      c.name as customer_name, c.phone as customer_phone,
      cl.name as clay_name,
      g1.name as glaze_name,
      g2.name as glaze2_name
    FROM artworks a
    LEFT JOIN customers c ON a.customer_id = c.id
    LEFT JOIN clays cl ON a.clay_id = cl.id
    LEFT JOIN glazes g1 ON a.glaze_id = g1.id
    LEFT JOIN glazes g2 ON a.glaze2_id = g2.id
  `;
  
  const conditions = [];
  const params = [];
  
  if (status) {
    conditions.push('a.status = ?');
    params.push(status);
  }
  if (customer_id) {
    conditions.push('a.customer_id = ?');
    params.push(parseInt(customer_id));
  }
  if (delivery_date_from) {
    conditions.push('a.delivery_date >= ?');
    params.push(delivery_date_from);
  }
  if (delivery_date_to) {
    conditions.push('a.delivery_date <= ?');
    params.push(delivery_date_to);
  }
  
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  
  query += ' ORDER BY a.delivery_date ASC, a.created_at DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    const artworks = rows.map(row => ({
      ...row,
      status_label: {
        pending: '待排',
        in_kiln: '已入窑',
        firing: '烧成中',
        out_kiln: '已出窑',
        delivered: '已交付',
        failed: '烧制失败',
        cancelled: '已取消'
      }[row.status] || row.status
    }));
    
    try {
      const csv = ImportExportService.exportArtworksToCSV(artworks);
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="artworks-${Date.now()}.csv"`);
      res.setHeader('BOM', '\ufeff');
      
      res.send('\ufeff' + csv);
    } catch (exportErr) {
      res.status(500).json({ error: exportErr.message });
    }
  });
});

router.get('/export/artworks/json', (req, res) => {
  const { status, customer_id, delivery_date_from, delivery_date_to } = req.query;
  
  let query = `
    SELECT a.*,
      c.name as customer_name, c.phone as customer_phone, c.email as customer_email,
      cl.name as clay_name, cl.type as clay_type, cl.temp_min as clay_temp_min, cl.temp_max as clay_temp_max,
      g1.name as glaze_name, g1.type as glaze_type,
      g2.name as glaze2_name
    FROM artworks a
    LEFT JOIN customers c ON a.customer_id = c.id
    LEFT JOIN clays cl ON a.clay_id = cl.id
    LEFT JOIN glazes g1 ON a.glaze_id = g1.id
    LEFT JOIN glazes g2 ON a.glaze2_id = g2.id
  `;
  
  const conditions = [];
  const params = [];
  
  if (status) {
    conditions.push('a.status = ?');
    params.push(status);
  }
  if (customer_id) {
    conditions.push('a.customer_id = ?');
    params.push(parseInt(customer_id));
  }
  if (delivery_date_from) {
    conditions.push('a.delivery_date >= ?');
    params.push(delivery_date_from);
  }
  if (delivery_date_to) {
    conditions.push('a.delivery_date <= ?');
    params.push(delivery_date_to);
  }
  
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  
  query += ' ORDER BY a.delivery_date ASC, a.created_at DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    try {
      const json = ImportExportService.exportArtworksToJSON(rows);
      
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="artworks-${Date.now()}.json"`);
      
      res.send(json);
    } catch (exportErr) {
      res.status(500).json({ error: exportErr.message });
    }
  });
});

router.get('/templates/csv', (req, res) => {
  const templateData = [
    {
      '作品名称': '示例茶壶',
      '客户名称': '张三',
      '客户电话': '13800138001',
      '泥料名称': '景德镇高白泥',
      '釉料名称': '透明釉',
      '第二层釉料': '',
      '宽度(cm)': '15',
      '高度(cm)': '12',
      '深度(cm)': '15',
      '重量(kg)': '0.8',
      '交付日期': '2026-05-10',
      '备注': '客户定制作品'
    },
    {
      '作品名称': '示例花瓶',
      '客户名称': '李四',
      '客户电话': '',
      '泥料名称': '青瓷泥',
      '釉料名称': '青瓷釉',
      '第二层釉料': '',
      '宽度(cm)': '20',
      '高度(cm)': '35',
      '深度(cm)': '20',
      '重量(kg)': '2.5',
      '交付日期': '2026-05-15',
      '备注': ''
    }
  ];
  
  try {
    const { Parser } = require('json2csv');
    const json2csvParser = new Parser();
    const csv = json2csvParser.parse(templateData);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="artworks-import-template.csv"');
    res.setHeader('BOM', '\ufeff');
    
    res.send('\ufeff' + csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/templates/json', (req, res) => {
  const templateData = [
    {
      "name": "示例茶壶",
      "customer_name": "张三",
      "customer_phone": "13800138001",
      "clay_name": "景德镇高白泥",
      "glaze_name": "透明釉",
      "width": 15,
      "height": 12,
      "depth": 15,
      "weight": 0.8,
      "delivery_date": "2026-05-10",
      "notes": "客户定制作品"
    },
    {
      "name": "示例花瓶",
      "customer_name": "李四",
      "clay_name": "青瓷泥",
      "glaze_name": "青瓷釉",
      "width": 20,
      "height": 35,
      "depth": 20,
      "delivery_date": "2026-05-15"
    }
  ];
  
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="artworks-import-template.json"');
  
  res.send(JSON.stringify(templateData, null, 2));
});

module.exports = router;
