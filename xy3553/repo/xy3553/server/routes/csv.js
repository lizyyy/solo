const express = require('express');
const router = express.Router();
const multer = require('multer');
const csvParser = require('csv-parser');
const { Parser } = require('json2csv');
const { 
  generateTicketNumber, 
  STATUS_COLORS, 
  getStatusColor, 
  getNextStatuses,
  getAllTickets,
  createTicket
} = require('../database');
const { Readable } = require('stream');

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传 CSV 文件'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

router.get('/export', (req, res) => {
  try {
    const { status, start_date, end_date } = req.query;
    
    const options = {};
    if (status && status !== '') options.status = status;
    if (start_date) options.start_date = start_date;
    if (end_date) options.end_date = end_date;
    
    const tickets = getAllTickets(options);
    
    if (tickets.length === 0) {
      return res.status(404).json({
        success: false,
        error: '没有可导出的数据'
      });
    }
    
    const exportData = tickets.map(t => ({
      '工单编号': t.ticket_number,
      '客户姓名': t.customer_name,
      '手机号': t.customer_phone,
      '设备型号': t.device_model,
      '故障描述': t.fault_description,
      '报价金额': t.quote_amount,
      '维修配件': t.repair_parts,
      '预计取机时间': t.expected_pickup_time,
      '状态': t.status,
      '备注': t.notes,
      '创建时间': t.created_at,
      '更新时间': t.updated_at
    }));
    
    const fields = [
      '工单编号', '客户姓名', '手机号', '设备型号', '故障描述',
      '报价金额', '维修配件', '预计取机时间', '状态', '备注',
      '创建时间', '更新时间'
    ];
    
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(exportData);
    
    const timestamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=工单_${timestamp}.csv`);
    
    res.send('\uFEFF' + csv);
  } catch (err) {
    console.error('导出 CSV 失败:', err);
    res.status(500).json({
      success: false,
      error: '导出失败',
      message: err.message
    });
  }
});

router.post('/import', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '请上传 CSV 文件'
      });
    }
    
    const results = [];
    const errors = [];
    let successCount = 0;
    let errorCount = 0;
    
    const stream = Readable.from(req.file.buffer.toString('utf8'));
    
    stream
      .pipe(csvParser())
      .on('data', (data) => results.push(data))
      .on('end', () => {
        if (results.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'CSV 文件中没有数据'
          });
        }
        
        results.forEach((row, index) => {
          const lineNumber = index + 2;
          
          const customerName = row['客户姓名'] || row['customer_name'] || '';
          const customerPhone = row['手机号'] || row['customer_phone'] || '';
          const deviceModel = row['设备型号'] || row['device_model'] || '';
          const faultDescription = row['故障描述'] || row['fault_description'] || '';
          const quoteAmount = parseFloat(row['报价金额'] || row['quote_amount'] || '0') || 0;
          const repairParts = row['维修配件'] || row['repair_parts'] || '';
          const expectedPickupTime = row['预计取机时间'] || row['expected_pickup_time'] || '';
          const notes = row['备注'] || row['notes'] || '';
          
          if (!customerName.trim()) {
            errors.push(`第 ${lineNumber} 行: 客户姓名不能为空`);
            errorCount++;
            return;
          }
          
          if (!customerPhone.trim()) {
            errors.push(`第 ${lineNumber} 行: 手机号不能为空`);
            errorCount++;
            return;
          }
          
          if (!/^1[3-9]\d{9}$/.test(customerPhone.trim())) {
            errors.push(`第 ${lineNumber} 行: 手机号格式不正确`);
            errorCount++;
            return;
          }
          
          if (!deviceModel.trim()) {
            errors.push(`第 ${lineNumber} 行: 设备型号不能为空`);
            errorCount++;
            return;
          }
          
          if (!faultDescription.trim()) {
            errors.push(`第 ${lineNumber} 行: 故障描述不能为空`);
            errorCount++;
            return;
          }
          
          try {
            const ticketData = {
              customer_name: customerName,
              customer_phone: customerPhone,
              device_model: deviceModel,
              fault_description: faultDescription,
              quote_amount: quoteAmount,
              repair_parts: repairParts,
              expected_pickup_time: expectedPickupTime,
              notes: notes
            };
            
            createTicket(ticketData);
            successCount++;
          } catch (err) {
            errors.push(`第 ${lineNumber} 行: ${err.message}`);
            errorCount++;
          }
        });
        
        res.json({
          success: true,
          data: {
            total: results.length,
            successCount,
            errorCount,
            errors: errors.slice(0, 100)
          },
          message: `导入完成: 成功 ${successCount} 条, 失败 ${errorCount} 条`
        });
      })
      .on('error', (err) => {
        console.error('CSV 解析失败:', err);
        res.status(500).json({
          success: false,
          error: 'CSV 解析失败',
          message: err.message
        });
      });
  } catch (err) {
    console.error('导入 CSV 失败:', err);
    res.status(500).json({
      success: false,
      error: '导入失败',
      message: err.message
    });
  }
});

router.get('/template', (req, res) => {
  const fields = [
    '客户姓名', '手机号', '设备型号', '故障描述',
    '报价金额', '维修配件', '预计取机时间', '状态', '备注'
  ];
  
  const sampleData = [
    {
      '客户姓名': '张三',
      '手机号': '13800138001',
      '设备型号': 'iPhone 13 Pro',
      '故障描述': '屏幕碎裂',
      '报价金额': '1200',
      '维修配件': '原装屏幕',
      '预计取机时间': '2024-01-15',
      '状态': '维修中',
      '备注': '客户比较着急'
    }
  ];
  
  const json2csvParser = new Parser({ fields });
  const csv = json2csvParser.parse(sampleData);
  
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=工单导入模板.csv');
  
  res.send('\uFEFF' + csv);
});

module.exports = router;
