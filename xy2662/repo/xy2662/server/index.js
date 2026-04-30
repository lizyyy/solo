const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const csvParser = require('csv-parser');
const { Parser } = require('json2csv');
const fs = require('fs');
const db = require('./database');
const { insertSampleData } = require('./sample-data');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const upload = multer({ dest: 'uploads/' });

function validateRepairOrder(data, isUpdate = false) {
  const errors = [];
  
  if (!isUpdate && (!data.customer_name || data.customer_name.trim() === '')) {
    errors.push('客户姓名不能为空');
  }
  
  if (!isUpdate && (!data.phone || data.phone.trim() === '')) {
    errors.push('联系电话不能为空');
  }
  
  if (!isUpdate && (!data.device_model || data.device_model.trim() === '')) {
    errors.push('设备型号不能为空');
  }
  
  if (!isUpdate && (!data.fault_description || data.fault_description.trim() === '')) {
    errors.push('故障描述不能为空');
  }
  
  if (data.phone && !/^1[3-9]\d{9}$/.test(data.phone.trim())) {
    errors.push('手机号码格式不正确');
  }
  
  if (data.quote_amount !== undefined && data.quote_amount !== null && data.quote_amount !== '') {
    const amount = parseFloat(data.quote_amount);
    if (isNaN(amount) || amount < 0) {
      errors.push('报价金额必须是有效的正数');
    }
  }
  
  return errors;
}

app.get('/api/orders', async (req, res) => {
  try {
    const filters = {};
    if (req.query.status) {
      filters.status = req.query.status;
    }
    if (req.query.search) {
      filters.search = req.query.search;
    }
    
    const orders = await db.getRepairOrders(filters);
    res.json({ success: true, data: orders });
  } catch (error) {
    console.error('获取工单列表失败:', error);
    res.status(500).json({ success: false, message: '获取工单列表失败: ' + error.message });
  }
});

app.get('/api/orders/:id', async (req, res) => {
  try {
    const order = await db.getRepairOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: '工单不存在' });
    }
    
    const auditLogs = await db.getAuditLogs(req.params.id);
    res.json({ success: true, data: { ...order, auditLogs } });
  } catch (error) {
    console.error('获取工单详情失败:', error);
    res.status(500).json({ success: false, message: '获取工单详情失败: ' + error.message });
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    const errors = validateRepairOrder(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: errors.join('；') });
    }
    
    const orderId = await db.createRepairOrder(req.body);
    const order = await db.getRepairOrderById(orderId);
    
    res.status(201).json({ success: true, data: order, message: '工单创建成功' });
  } catch (error) {
    console.error('创建工单失败:', error);
    res.status(500).json({ success: false, message: '创建工单失败: ' + error.message });
  }
});

app.put('/api/orders/:id', async (req, res) => {
  try {
    const errors = validateRepairOrder(req.body, true);
    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: errors.join('；') });
    }
    
    const existingOrder = await db.getRepairOrderById(req.params.id);
    if (!existingOrder) {
      return res.status(404).json({ success: false, message: '工单不存在' });
    }
    
    await db.updateRepairOrder(req.params.id, req.body);
    const updatedOrder = await db.getRepairOrderById(req.params.id);
    
    res.json({ success: true, data: updatedOrder, message: '工单更新成功' });
  } catch (error) {
    console.error('更新工单失败:', error);
    res.status(500).json({ success: false, message: '更新工单失败: ' + error.message });
  }
});

app.put('/api/orders/:id/status', async (req, res) => {
  try {
    const { status, note } = req.body;
    
    if (!status) {
      return res.status(400).json({ success: false, message: '状态不能为空' });
    }
    
    const existingOrder = await db.getRepairOrderById(req.params.id);
    if (!existingOrder) {
      return res.status(404).json({ success: false, message: '工单不存在' });
    }
    
    await db.updateStatus(req.params.id, status, note);
    const updatedOrder = await db.getRepairOrderById(req.params.id);
    
    res.json({ success: true, data: updatedOrder, message: '状态更新成功' });
  } catch (error) {
    console.error('更新状态失败:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

app.get('/api/status-info', (req, res) => {
  res.json({
    success: true,
    data: {
      statusFlow: db.STATUS_FLOW,
      statusNames: db.STATUS_NAMES
    }
  });
});

app.post('/api/csv/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: '请选择要导入的 CSV 文件' });
    }
    
    const results = [];
    const errors = [];
    
    const stream = fs.createReadStream(req.file.path)
      .pipe(csvParser({
        mapHeaders: ({ header }) => {
          const headerMap = {
            '客户姓名': 'customer_name',
            '联系电话': 'phone',
            '设备型号': 'device_model',
            '故障描述': 'fault_description',
            '报价金额': 'quote_amount',
            '维修配件': 'repair_parts',
            '预计取机时间': 'expected_pickup_time',
            '备注': 'notes',
            '状态': 'status'
          };
          return headerMap[header] || header;
        }
      }));
    
    for await (const row of stream) {
      const validationErrors = validateRepairOrder(row);
      if (validationErrors.length > 0) {
        errors.push(`行 ${results.length + 1}: ${validationErrors.join('；')}`);
        continue;
      }
      
      try {
        const orderId = await db.createRepairOrder(row);
        results.push({ orderId, customer_name: row.customer_name });
      } catch (error) {
        errors.push(`行 ${results.length + 1}: 导入失败 - ${error.message}`);
      }
    }
    
    fs.unlinkSync(req.file.path);
    
    res.json({
      success: true,
      data: {
        imported: results.length,
        errors: errors.length,
        errorDetails: errors
      },
      message: `成功导入 ${results.length} 条记录${errors.length > 0 ? `，有 ${errors.length} 条记录导入失败` : ''}`
    });
  } catch (error) {
    console.error('CSV 导入失败:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ success: false, message: 'CSV 导入失败: ' + error.message });
  }
});

app.get('/api/csv/export', async (req, res) => {
  try {
    const orders = await db.getRepairOrders({});
    
    const fields = [
      { label: '工单编号', value: 'id' },
      { label: '客户姓名', value: 'customer_name' },
      { label: '联系电话', value: 'phone' },
      { label: '设备型号', value: 'device_model' },
      { label: '故障描述', value: 'fault_description' },
      { label: '报价金额', value: 'quote_amount' },
      { label: '维修配件', value: 'repair_parts' },
      { label: '预计取机时间', value: 'expected_pickup_time' },
      { label: '状态', value: (row) => db.getStatusName(row.status) },
      { label: '备注', value: 'notes' },
      { label: '创建时间', value: 'created_at' },
      { label: '更新时间', value: 'updated_at' }
    ];
    
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(orders);
    
    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.header('Content-Disposition', `attachment; filename=repair_orders_${new Date().toISOString().split('T')[0]}.csv`);
    res.send('\ufeff' + csv);
  } catch (error) {
    console.error('CSV 导出失败:', error);
    res.status(500).json({ success: false, message: 'CSV 导出失败: ' + error.message });
  }
});

app.post('/api/init-sample-data', async (req, res) => {
  try {
    const result = await insertSampleData();
    if (result) {
      res.json({ success: true, message: '示例数据初始化成功' });
    } else {
      res.json({ success: true, message: '数据库中已有数据，跳过示例数据初始化' });
    }
  } catch (error) {
    console.error('初始化示例数据失败:', error);
    res.status(500).json({ success: false, message: '初始化示例数据失败: ' + error.message });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, async () => {
  console.log(`========================================`);
  console.log(`  手机维修工单管理系统已启动`);
  console.log(`========================================`);
  console.log(`  服务地址: http://localhost:${PORT}`);
  console.log(`========================================`);
  console.log('正在初始化示例数据...');
  try {
    await insertSampleData();
  } catch (error) {
    console.error('初始化示例数据失败:', error);
  }
});
