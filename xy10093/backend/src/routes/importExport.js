const express = require('express');
const router = express.Router();
const XLSX = require('xlsx');
const multer = require('multer');
const db = require('../db');
const path = require('path');
const fs = require('fs');

const upload = multer({ dest: path.join(__dirname, '../../uploads') });

router.get('/export/orders', (req, res) => {
  const orders = db.orders().slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const records = db.records();
  const checks = db.checks();

  const statusMap = {
    'pending': '待处理',
    'in_progress': '返工中',
    'closed': '已闭环'
  };

  const ordersSheet = orders.map(o => ({
    '返工单号': o.order_no,
    '产品名称': o.product_name,
    '批次号': o.batch_no,
    '批量': o.qty,
    '不良数': o.defect_qty,
    '状态': statusMap[o.current_status] || o.current_status,
    '返工次数': records.filter(r => r.order_id === o.id).length,
    '创建时间': o.created_at
  }));

  const recordsSheet = records.map(r => {
    const qc = checks.find(c => c.rework_record_id === r.id);
    const order = orders.find(o => o.id === r.order_id);
    return {
      '返工单号': order?.order_no || '',
      '第几次返工': r.rework_count,
      '不良描述': r.defect_description,
      '根本原因': r.root_cause,
      '原因类别': r.cause_category,
      '责任工序': r.responsible_process,
      '责任人': r.responsible_person,
      '纠正措施': r.correction_action,
      '质检结果': qc?.check_result || '',
      '最终结论': qc?.final_conclusion || ''
    };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ordersSheet), '返工单列表');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(recordsSheet), '返工详情记录');

  const filePath = path.join(__dirname, '../../exports');
  if (!fs.existsSync(filePath)) fs.mkdirSync(filePath, { recursive: true });
  
  const fileName = `rework_export_${Date.now()}.xlsx`;
  const fullPath = path.join(filePath, fileName);
  
  XLSX.writeFile(wb, fullPath);

  res.download(fullPath, fileName, (err) => {
    if (err) console.error(err);
    setTimeout(() => {
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    }, 10000);
  });
});

router.post('/import/orders', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传文件' });
    }

    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    const results = { imported: 0, failed: 0, errors: [] };

    data.forEach((row, index) => {
      try {
        const orderNo = row['返工单号'] || row['order_no'];
        if (!orderNo) {
          results.failed++;
          results.errors.push(`第${index + 2}行: 返工单号为空`);
          return;
        }

        const existing = db.orders().find(o => o.order_no === orderNo);
        if (existing) {
          results.failed++;
          results.errors.push(`第${index + 2}行: 返工单号 ${orderNo} 已存在`);
          return;
        }

        const productName = row['产品名称'] || row['product_name'] || '未命名';
        const batchNo = row['批次号'] || row['batch_no'] || '';
        const qty = parseInt(row['批量'] || row['qty'] || 0, 10);
        const defectQty = parseInt(row['不良数'] || row['defect_qty'] || 0, 10);

        const orders = db.orders();
        orders.push({
          id: db.genId(orders),
          order_no: orderNo,
          product_name: productName,
          batch_no: batchNo,
          qty: qty,
          defect_qty: defectQty,
          current_status: 'pending',
          created_at: db.now(),
          updated_at: db.now()
        });

        results.imported++;
      } catch (e) {
        results.failed++;
        results.errors.push(`第${index + 2}行: ${e.message}`);
      }
    });

    db.save();

    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.json(results);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
