const db = require('./database');
const stateMachine = require('./stateMachine');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const { Parser } = require('json2csv');
const moment = require('moment');

const UPLOAD_DIR = path.join(__dirname, '../uploads');
const EXPORT_DIR = path.join(__dirname, '../exports');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(EXPORT_DIR)) fs.mkdirSync(EXPORT_DIR, { recursive: true });

async function simulateOCR(invoiceId) {
  const invoice = await db.get('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
  if (!invoice) throw new Error('发票不存在');

  await stateMachine.transition(invoiceId, 'ocr_processing');

  await new Promise(resolve => setTimeout(resolve, 1500));

  const success = Math.random() > 0.15;
  
  if (success) {
    const mockOCRData = {
      invoice_number: `FP${Date.now().toString().slice(-8)}`,
      invoice_code: `CODE${Math.floor(Math.random() * 10000).toString().padStart(6, '0')}`,
      tax_number: '91310101MA1G8K2P6R',
      amount: parseFloat((Math.random() * 10000 + 100).toFixed(2)),
      invoice_date: moment().format('YYYY-MM-DD'),
      seller_name: '测试供应商有限公司',
      buyer_name: '采购方企业有限公司',
      confidence: 0.85 + Math.random() * 0.14
    };

    await db.run(
      `UPDATE invoices SET 
        invoice_number = ?, invoice_code = ?, tax_number = ?, 
        amount = ?, invoice_date = ?, seller_name = ?, buyer_name = ?,
        confidence = ?, ocr_raw = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        mockOCRData.invoice_number, mockOCRData.invoice_code, mockOCRData.tax_number,
        mockOCRData.amount, mockOCRData.invoice_date, mockOCRData.seller_name, mockOCRData.buyer_name,
        mockOCRData.confidence, JSON.stringify(mockOCRData), invoiceId
      ]
    );

    await stateMachine.transition(invoiceId, 'ocr_success');
    return { success: true, data: mockOCRData };
  } else {
    await stateMachine.transition(invoiceId, 'ocr_failed', 'system', 'OCR识别失败，图像质量问题');
    return { success: false, error: 'OCR识别失败' };
  }
}

async function processTaxValidation(invoiceId) {
  const invoice = await db.get('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
  if (!invoice) throw new Error('发票不存在');

  await stateMachine.transition(invoiceId, 'tax_validating');

  const taxResult = stateMachine.validateTaxNumber(invoice.tax_number);
  
  if (!taxResult.valid) {
    await stateMachine.transition(invoiceId, 'tax_invalid', 'system', taxResult.reason);
    return { valid: false, reason: taxResult.reason };
  }

  await stateMachine.transition(invoiceId, 'duplicate_checking');
  
  const dupResult = await stateMachine.checkDuplicate(invoice);
  
  if (dupResult.isDuplicate) {
    await stateMachine.recordDuplicate(invoiceId, dupResult.duplicateWith, dupResult.reason);
    await stateMachine.transition(invoiceId, 'duplicate_found', 'system', dupResult.reason);
    return { valid: false, isDuplicate: true, reason: dupResult.reason };
  }

  await stateMachine.transition(invoiceId, 'review_pending');
  return { valid: true };
}

async function retryOCR(invoiceId) {
  const invoice = await db.get('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
  if (!invoice) throw new Error('发票不存在');

  if (invoice.retry_count >= invoice.max_retries) {
    throw new Error('已达到最大重试次数');
  }

  await db.run(
    'UPDATE invoices SET retry_count = retry_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [invoiceId]
  );

  return simulateOCR(invoiceId);
}

async function reviewInvoice(invoiceId, action, operator, reason, updatedFields = null) {
  const invoice = await db.get('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
  if (!invoice) throw new Error('发票不存在');

  if (invoice.status !== 'review_pending') {
    throw new Error('当前状态不允许审核');
  }

  if (updatedFields) {
    const setClauses = Object.keys(updatedFields).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(updatedFields), invoiceId];
    await db.run(`UPDATE invoices SET ${setClauses}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, values);
  }

  if (action === 'approve') {
    await stateMachine.transition(invoiceId, 'review_approved', operator, reason, updatedFields);
    await stateMachine.transition(invoiceId, 'export_ready', 'system');
  } else if (action === 'reject') {
    await stateMachine.transition(invoiceId, 'review_rejected', operator, reason, updatedFields);
  } else {
    throw new Error('无效的审核操作');
  }

  await db.run('UPDATE duplicates SET resolved = 1 WHERE invoice_id = ? AND resolved = 0', [invoiceId]);

  return { success: true };
}

async function resolveDuplicate(invoiceId, keepOriginal, operator, reason) {
  const invoice = await db.get('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
  if (!invoice) throw new Error('发票不存在');

  if (keepOriginal) {
    await stateMachine.transition(invoiceId, 'review_rejected', operator, `重复发票，保留原票。${reason}`);
  } else {
    const dup = await db.get('SELECT duplicate_with FROM duplicates WHERE invoice_id = ?', [invoiceId]);
    if (dup) {
      await db.run('UPDATE invoices SET status = ? WHERE id = ?', ['review_rejected', dup.duplicate_with]);
      await stateMachine.transition(dup.duplicate_with, 'review_rejected', operator, `被新发票替换。${reason}`);
    }
    await stateMachine.transition(invoiceId, 'review_approved', operator, `替换重复发票。${reason}`);
    await stateMachine.transition(invoiceId, 'export_ready', 'system');
  }

  await db.run('UPDATE duplicates SET resolved = 1 WHERE invoice_id = ?', [invoiceId]);

  return { success: true };
}

async function exportInvoices(createdBy) {
  const invoices = await db.all(
    `SELECT * FROM invoices WHERE status = 'export_ready' ORDER BY created_at`
  );

  if (invoices.length === 0) {
    throw new Error('没有可导出的发票');
  }

  const exportData = invoices.map(inv => ({
    发票ID: inv.id,
    发票代码: inv.invoice_code,
    发票号码: inv.invoice_number,
    税号: inv.tax_number,
    金额: inv.amount,
    开票日期: inv.invoice_date,
    销售方: inv.seller_name,
    购买方: inv.buyer_name,
    置信度: inv.confidence,
    上传时间: inv.created_at
  }));

  const totalAmount = invoices.reduce((sum, inv) => sum + inv.amount, 0);

  const parser = new Parser();
  const csv = parser.parse(exportData);
  
  const exportId = uuidv4();
  const filename = `发票导出_${moment().format('YYYYMMDD_HHmmss')}.csv`;
  const filePath = path.join(EXPORT_DIR, filename);
  
  fs.writeFileSync(filePath, '\uFEFF' + csv, 'utf8');

  await db.run(
    'INSERT INTO exports (id, filename, file_path, record_count, total_amount, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [exportId, filename, `/exports/${filename}`, invoices.length, totalAmount, 'completed', createdBy]
  );

  for (const inv of invoices) {
    await stateMachine.transition(inv.id, 'exported', createdBy);
  }

  return {
    exportId,
    filename,
    downloadUrl: `/exports/${filename}`,
    recordCount: invoices.length,
    totalAmount
  };
}

async function getStatistics() {
  const statusStats = await db.all(`
    SELECT status, COUNT(*) as count 
    FROM invoices 
    GROUP BY status
  `);

  const todayStats = await db.get(`
    SELECT 
      COUNT(*) as today_count,
      SUM(CASE WHEN status = 'exported' THEN amount ELSE 0 END) as today_amount
    FROM invoices 
    WHERE DATE(created_at) = DATE('now')
  `);

  const recentActivity = await db.all(`
    SELECT 
      a.*,
      i.invoice_number,
      i.amount
    FROM audit_logs a
    LEFT JOIN invoices i ON a.invoice_id = i.id
    ORDER BY a.created_at DESC
    LIMIT 20
  `);

  const dailyTrend = await db.all(`
    SELECT 
      DATE(created_at) as date,
      COUNT(*) as count,
      SUM(amount) as amount
    FROM invoices
    WHERE created_at >= DATE('now', '-30 days')
    GROUP BY DATE(created_at)
    ORDER BY date
  `);

  return {
    statusStats,
    todayStats: todayStats || { today_count: 0, today_amount: 0 },
    recentActivity,
    dailyTrend
  };
}

async function getInvoiceDetail(invoiceId) {
  const invoice = await db.get('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
  if (!invoice) return null;

  const auditLogs = await db.all(
    'SELECT * FROM audit_logs WHERE invoice_id = ? ORDER BY created_at',
    [invoiceId]
  );

  const duplicates = await db.all(
    `SELECT d.*, i2.invoice_number as duplicate_number
     FROM duplicates d
     LEFT JOIN invoices i2 ON d.duplicate_with = i2.id
     WHERE d.invoice_id = ?`,
    [invoiceId]
  );

  return {
    ...invoice,
    auditLogs,
    duplicates
  };
}

module.exports = {
  simulateOCR,
  processTaxValidation,
  retryOCR,
  reviewInvoice,
  resolveDuplicate,
  exportInvoices,
  getStatistics,
  getInvoiceDetail
};
