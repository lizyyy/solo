const express = require('express');
const multer = require('multer');
const csvParser = require('csv-parser');
const { Parser } = require('json2csv');
const { Readable } = require('stream');
const db = require('../db');
const { STATUS_MAP, generateTicketNo } = require('../utils/statusFlow');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/export', (req, res) => {
  const { status } = req.query;
  
  let sql = 'SELECT * FROM tickets WHERE 1=1';
  const params = [];

  if (status && STATUS_MAP[status]) {
    sql += ' AND status = ?';
    params.push(status);
  }

  sql += ' ORDER BY created_at DESC';

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error('查询工单失败:', err);
      return res.status(500).json({ 
        success: false, 
        message: '导出失败' 
      });
    }

    const data = rows.map(row => ({
      工单号: row.ticket_no,
      客户姓名: row.customer_name,
      手机号: row.customer_phone,
      设备型号: row.device_model,
      故障描述: row.fault_description || '',
      报价金额: row.quote_amount || 0,
      维修配件: row.repair_parts || '',
      预计取机时间: row.estimated_pickup_time || '',
      备注: row.notes || '',
      状态: STATUS_MAP[row.status]?.label || row.status,
      创建时间: row.created_at,
      更新时间: row.updated_at
    }));

    const fields = [
      '工单号', '客户姓名', '手机号', '设备型号', '故障描述',
      '报价金额', '维修配件', '预计取机时间', '备注', '状态',
      '创建时间', '更新时间'
    ];

    try {
      const json2csvParser = new Parser({ fields });
      const csv = json2csvParser.parse(data);
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=repair_tickets_${Date.now()}.csv`);
      res.write('\uFEFF');
      res.send(csv);
    } catch (parseErr) {
      console.error('CSV生成失败:', parseErr);
      res.status(500).json({ 
        success: false, 
        message: '导出失败' 
      });
    }
  });
});

const STATUS_LABEL_TO_VALUE = {};
Object.keys(STATUS_MAP).forEach(key => {
  STATUS_LABEL_TO_VALUE[STATUS_MAP[key].label] = key;
  STATUS_LABEL_TO_VALUE[key] = key;
});

const validatePhone = (phone) => {
  return /^1[3-9]\d{9}$/.test(phone);
};

router.post('/import', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ 
      success: false, 
      message: '请上传CSV文件' 
    });
  }

  const results = [];
  const errors = [];
  let rowIndex = 0;

  const bufferStream = new Readable();
  bufferStream.push(req.file.buffer);
  bufferStream.push(null);

  bufferStream
    .pipe(csvParser())
    .on('data', (data) => {
      rowIndex++;
      
      const row = {};
      Object.keys(data).forEach(key => {
        const trimmedKey = key.trim();
        row[trimmedKey] = data[key]?.trim() || '';
      });

      const customerName = row['客户姓名'] || row['姓名'] || row['customer_name'] || '';
      const customerPhone = row['手机号'] || row['电话'] || row['customer_phone'] || '';
      const deviceModel = row['设备型号'] || row['型号'] || row['device_model'] || '';
      const faultDescription = row['故障描述'] || row['故障'] || row['fault_description'] || '';
      const quoteAmount = parseFloat(row['报价金额'] || row['报价'] || row['quote_amount'] || '0') || 0;
      const repairParts = row['维修配件'] || row['配件'] || row['repair_parts'] || '';
      const estimatedPickupTime = row['预计取机时间'] || row['取机时间'] || row['estimated_pickup_time'] || '';
      const notes = row['备注'] || row['notes'] || '';
      const statusLabel = row['状态'] || row['status'] || 'pending_inspection';

      let status = STATUS_LABEL_TO_VALUE[statusLabel] || 'pending_inspection';
      if (!STATUS_MAP[status]) {
        status = 'pending_inspection';
      }

      const rowErrors = [];
      if (!customerName) {
        rowErrors.push('客户姓名不能为空');
      }
      if (!customerPhone) {
        rowErrors.push('手机号不能为空');
      } else if (!validatePhone(customerPhone)) {
        rowErrors.push('手机号格式不正确');
      }
      if (!deviceModel) {
        rowErrors.push('设备型号不能为空');
      }
      if (quoteAmount < 0) {
        rowErrors.push('报价金额不能为负数');
      }

      if (rowErrors.length > 0) {
        errors.push({
          row: rowIndex,
          errors: rowErrors,
          data: { customerName, customerPhone, deviceModel }
        });
        return;
      }

      results.push({
        ticket_no: generateTicketNo(),
        customer_name: customerName,
        customer_phone: customerPhone,
        device_model: deviceModel,
        fault_description: faultDescription,
        quote_amount: quoteAmount,
        repair_parts: repairParts,
        estimated_pickup_time: estimatedPickupTime,
        notes: notes,
        status: status
      });
    })
    .on('end', () => {
      if (errors.length > 0) {
        return res.status(400).json({ 
          success: false, 
          message: `存在 ${errors.length} 条数据验证失败`,
          errors: errors
        });
      }

      if (results.length === 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'CSV文件中没有有效数据' 
        });
      }

      const insertStmt = db.prepare(`
        INSERT INTO tickets (
          ticket_no, customer_name, customer_phone, device_model,
          fault_description, quote_amount, repair_parts,
          estimated_pickup_time, notes, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const logStmt = db.prepare(`
        INSERT INTO status_logs (ticket_id, from_status, to_status, reason)
        VALUES (?, ?, ?, ?)
      `);

      let successCount = 0;
      const failedItems = [];

      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        results.forEach((item, index) => {
          insertStmt.run(
            item.ticket_no,
            item.customer_name,
            item.customer_phone,
            item.device_model,
            item.fault_description,
            item.quote_amount,
            item.repair_parts,
            item.estimated_pickup_time,
            item.notes,
            item.status,
            function(err) {
              if (err) {
                failedItems.push({
                  row: index + 1,
                  data: item,
                  error: err.message
                });
              } else {
                const ticketId = this.lastID;
                logStmt.run(ticketId, null, item.status, 'CSV导入创建');
                successCount++;
              }
            }
          );
        });

        db.run('COMMIT', (commitErr) => {
          insertStmt.finalize();
          logStmt.finalize();

          if (commitErr) {
            console.error('事务提交失败:', commitErr);
            return res.status(500).json({ 
              success: false, 
              message: '导入失败' 
            });
          }

          if (failedItems.length > 0) {
            res.json({
              success: true,
              message: `部分导入成功：成功 ${successCount} 条，失败 ${failedItems.length} 条`,
              data: {
                successCount,
                failedCount: failedItems.length,
                failedItems: failedItems.slice(0, 10)
              }
            });
          } else {
            res.json({
              success: true,
              message: `成功导入 ${successCount} 条数据`,
              data: {
                successCount
              }
            });
          }
        });
      });
    })
    .on('error', (err) => {
      console.error('CSV解析失败:', err);
      res.status(500).json({ 
        success: false, 
        message: '文件解析失败' 
      });
    });
});

router.get('/template', (req, res) => {
  const templateData = [
    {
      '客户姓名': '张三',
      '手机号': '13800138001',
      '设备型号': 'iPhone 14 Pro',
      '故障描述': '屏幕碎裂，无法触摸',
      '报价金额': '1500',
      '维修配件': '原装屏幕总成',
      '预计取机时间': '2026-05-03 18:00',
      '备注': '客户要求原装配件',
      '状态': '待检测'
    },
    {
      '客户姓名': '李四',
      '手机号': '13900139002',
      '设备型号': '华为 Mate 60 Pro',
      '故障描述': '电池耗电快',
      '报价金额': '399',
      '维修配件': '原装电池',
      '预计取机时间': '2026-05-02 16:00',
      '备注': '',
      '状态': '维修中'
    }
  ];

  const fields = [
    '客户姓名', '手机号', '设备型号', '故障描述',
    '报价金额', '维修配件', '预计取机时间', '备注', '状态'
  ];

  try {
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(templateData);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=import_template.csv');
    res.write('\uFEFF');
    res.send(csv);
  } catch (parseErr) {
    console.error('模板生成失败:', parseErr);
    res.status(500).json({ 
      success: false, 
      message: '模板下载失败' 
    });
  }
});

module.exports = router;
