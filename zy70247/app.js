const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');
const { Parser } = require('json2csv');

const { equipmentService, classService, reservationService } = require('./services');
const { loadSampleData, loadSampleReservations } = require('./sampleData');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

if (!fs.existsSync(path.join(__dirname, 'exports'))) {
  fs.mkdirSync(path.join(__dirname, 'exports'), { recursive: true });
}

app.get('/api/equipment', (req, res) => {
  equipmentService.getAll((err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/equipment', (req, res) => {
  equipmentService.create(req.body, (err, id) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id, ...req.body });
  });
});

app.put('/api/equipment/:id', (req, res) => {
  equipmentService.update(req.params.id, req.body, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

app.delete('/api/equipment/:id', (req, res) => {
  equipmentService.delete(req.params.id, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

app.get('/api/classes', (req, res) => {
  classService.getAll((err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/classes', (req, res) => {
  classService.create(req.body, (err, id) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id, ...req.body });
  });
});

app.get('/api/reservations', (req, res) => {
  reservationService.getAll((err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/reservations', (req, res) => {
  reservationService.create(req.body, (err, id, status) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id, status, ...req.body });
  });
});

app.put('/api/reservations/:id', (req, res) => {
  reservationService.update(req.params.id, req.body, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

app.post('/api/reservations/:id/approve', (req, res) => {
  const { approved_by, comment } = req.body;
  reservationService.approve(req.params.id, approved_by, comment, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

app.post('/api/reservations/:id/reject', (req, res) => {
  const { approved_by, comment } = req.body;
  reservationService.reject(req.params.id, approved_by, comment, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

app.post('/api/reservations/:id/complete', (req, res) => {
  reservationService.complete(req.params.id, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

app.get('/api/stats', (req, res) => {
  const db = require('./database');
  
  db.all(`
    SELECT 
      COUNT(*) as total_reservations,
      SUM(CASE WHEN status = '待审批' THEN 1 ELSE 0 END) as pending_count,
      SUM(CASE WHEN status = '已确认' THEN 1 ELSE 0 END) as confirmed_count,
      SUM(CASE WHEN status = '已拒绝' THEN 1 ELSE 0 END) as rejected_count,
      SUM(CASE WHEN status = '已完成' THEN 1 ELSE 0 END) as completed_count
    FROM reservations
  `, (err1, reservationStats) => {
    if (err1) return res.status(500).json({ error: err1.message });
    
    db.all(`
      SELECT 
        SUM(CASE WHEN type = '危险' THEN 1 ELSE 0 END) as dangerous_count,
        SUM(CASE WHEN is_consumable = 1 THEN 1 ELSE 0 END) as consumable_count
      FROM equipment
    `, (err2, equipmentStats) => {
      if (err2) return res.status(500).json({ error: err2.message });
      
      db.all(`
        SELECT e.name, SUM(cd.quantity) as total_deducted
        FROM consumable_deductions cd
        JOIN equipment e ON cd.equipment_id = e.id
        GROUP BY cd.equipment_id
      `, (err3, deductionStats) => {
        if (err3) return res.status(500).json({ error: err3.message });
        
        res.json({
          reservations: reservationStats[0],
          equipment: equipmentStats[0],
          deductions: deductionStats
        });
      });
    });
  });
});

app.get('/api/export/reservations/:format', (req, res) => {
  const format = req.params.format;
  
  reservationService.getAll((err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const exportData = rows.map(row => ({
      '预约ID': row.id,
      '班级': row.class_name,
      '器材': row.equipment_name,
      '学科': row.category,
      '器材类型': row.type,
      '是否易耗品': row.is_consumable ? '是' : '否',
      '数量': row.quantity,
      '单位': row.unit,
      '预约日期': row.reservation_date,
      '用途': row.purpose,
      '状态': row.status,
      '创建时间': row.created_at,
      '审批人': row.approved_by || '',
      '审批时间': row.approval_time || '',
      '审批意见': row.approval_comment || ''
    }));

    const timestamp = new Date().toISOString().slice(0, 10);
    
    if (format === 'excel') {
      const workbook = xlsx.utils.book_new();
      const worksheet = xlsx.utils.json_to_sheet(exportData);
      xlsx.utils.book_append_sheet(workbook, worksheet, '预约记录');
      const filePath = path.join(__dirname, 'exports', `reservations_${timestamp}.xlsx`);
      xlsx.writeFile(workbook, filePath);
      res.download(filePath);
    } else if (format === 'csv') {
      const parser = new Parser();
      const csv = parser.parse(exportData);
      const filePath = path.join(__dirname, 'exports', `reservations_${timestamp}.csv`);
      fs.writeFileSync(filePath, csv);
      res.download(filePath);
    } else {
      res.status(400).json({ error: '不支持的导出格式' });
    }
  });
});

app.get('/api/export/equipment/:format', (req, res) => {
  const format = req.params.format;
  
  equipmentService.getAll((err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const exportData = rows.map(row => ({
      '器材ID': row.id,
      '名称': row.name,
      '学科': row.category,
      '类型': row.type,
      '是否易耗品': row.is_consumable ? '是' : '否',
      '库存数量': row.quantity,
      '单位': row.unit,
      '存放位置': row.location || '',
      '描述': row.description || ''
    }));

    const timestamp = new Date().toISOString().slice(0, 10);
    
    if (format === 'excel') {
      const workbook = xlsx.utils.book_new();
      const worksheet = xlsx.utils.json_to_sheet(exportData);
      xlsx.utils.book_append_sheet(workbook, worksheet, '器材档案');
      const filePath = path.join(__dirname, 'exports', `equipment_${timestamp}.xlsx`);
      xlsx.writeFile(workbook, filePath);
      res.download(filePath);
    } else if (format === 'csv') {
      const parser = new Parser();
      const csv = parser.parse(exportData);
      const filePath = path.join(__dirname, 'exports', `equipment_${timestamp}.csv`);
      fs.writeFileSync(filePath, csv);
      res.download(filePath);
    } else {
      res.status(400).json({ error: '不支持的导出格式' });
    }
  });
});

app.post('/api/load-sample', (req, res) => {
  loadSampleData((err1) => {
    if (err1) return res.status(500).json({ error: err1.message });
    loadSampleReservations((err2) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ success: true, message: '示例数据加载完成' });
    });
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`访问首页查看操作界面`);
  console.log(`API 端点说明:`);
  console.log(`  GET  /api/equipment      - 获取所有器材`);
  console.log(`  POST /api/equipment      - 新增器材`);
  console.log(`  GET  /api/reservations   - 获取所有预约`);
  console.log(`  POST /api/reservations   - 新增预约`);
  console.log(`  GET  /api/stats          - 获取统计信息`);
  console.log(`  POST /api/load-sample    - 加载示例数据`);
  console.log(`  GET  /api/export/reservations/excel  - 导出预约Excel`);
  console.log(`  GET  /api/export/equipment/excel     - 导出器材Excel`);
});
