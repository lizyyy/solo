const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const { Parser } = require('json2csv');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const path = require('path');
const fs = require('fs');
const db = require('../database');
const { INVOICE_STATUSES, EXCEPTION_TYPES } = require('../database');

const router = express.Router();

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.csv', '.json', '.jpg', '.jpeg', '.png', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件类型'));
    }
  }
});

async function addHistory(invoiceId, action, oldValues, newValues, operator = 'system', notes = '') {
  const historyId = uuidv4();
  await db.run(
    `INSERT INTO invoice_history (id, invoice_id, action, old_values, new_values, operator, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      historyId,
      invoiceId,
      action,
      JSON.stringify(oldValues || {}),
      JSON.stringify(newValues || {}),
      operator,
      notes,
      dayjs().format('YYYY-MM-DD HH:mm:ss')
    ]
  );
  return historyId;
}

function detectExceptions(invoice) {
  const exceptions = [];

  if (invoice.approval_amount && invoice.amount !== invoice.approval_amount) {
    exceptions.push({
      type: EXCEPTION_TYPES.AMOUNT_MISMATCH,
      field: 'amount',
      expected_value: invoice.approval_amount?.toString(),
      actual_value: invoice.amount?.toString(),
      description: `票据金额(¥${invoice.amount})与审批金额(¥${invoice.approval_amount})不一致`
    });
  }

  if (invoice.tax_number && !isValidTaxNumber(invoice.tax_number)) {
    exceptions.push({
      type: EXCEPTION_TYPES.TAX_NUMBER_INVALID,
      field: 'tax_number',
      expected_value: '15-20位字母数字',
      actual_value: invoice.tax_number,
      description: `税号格式无效: ${invoice.tax_number}`
    });
  }

  if (invoice.vendor_tax_number && !isValidTaxNumber(invoice.vendor_tax_number)) {
    exceptions.push({
      type: EXCEPTION_TYPES.TAX_NUMBER_INVALID,
      field: 'vendor_tax_number',
      expected_value: '15-20位字母数字',
      actual_value: invoice.vendor_tax_number,
      description: `供应商税号格式无效: ${invoice.vendor_tax_number}`
    });
  }

  if (!invoice.approver_name) {
    exceptions.push({
      type: EXCEPTION_TYPES.APPROVAL_MISSING,
      field: 'approver_name',
      expected_value: '审批人姓名',
      actual_value: '(空)',
      description: '审批人信息缺失'
    });
  }

  return exceptions;
}

function isValidTaxNumber(tax) {
  if (!tax) return false;
  const valid = /^[0-9A-Z]{15,20}$/i;
  return valid.test(tax);
}

async function writeExceptions(invoiceId, exceptions) {
  await db.run('DELETE FROM exceptions WHERE invoice_id = ?', [invoiceId]);

  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  for (const ex of exceptions) {
    await db.run(
      `INSERT INTO exceptions (
        id, invoice_id, type, field, expected_value, actual_value,
        description, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        invoiceId,
        ex.type,
        ex.field,
        ex.expected_value || null,
        ex.actual_value || null,
        ex.description,
        'open',
        now
      ]
    );
  }
}

router.post('/import/csv', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: '请上传文件' });
    }

    const results = [];
    const errors = [];
    let rowNum = 1;

    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on('data', (row) => {
        rowNum++;
        try {
          const cleaned = cleanRow(row);
          if (!cleaned.invoice_number || !cleaned.amount) {
            errors.push({ row: rowNum, error: '票据号和金额必填' });
            return;
          }
          results.push(cleaned);
        } catch (e) {
          errors.push({ row: rowNum, error: e.message });
        }
      })
      .on('end', async () => {
        const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
        let imported = 0;
        const importedIds = [];
        const totalExceptions = [];

        for (const data of results) {
          try {
            const id = uuidv4();
            const exceptions = detectExceptions(data);
            const status =
              exceptions.length > 0
                ? INVOICE_STATUSES.EXCEPTION
                : INVOICE_STATUSES.PENDING;

            await db.run(
              `INSERT INTO invoices (
                id, invoice_number, invoice_date, amount, tax_amount, tax_number,
                vendor_name, vendor_tax_number, approval_amount, approver_name,
                approval_date, approval_comments, status, created_at, updated_at, exception_count
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                id,
                data.invoice_number,
                data.invoice_date,
                data.amount,
                data.tax_amount || 0,
                data.tax_number,
                data.vendor_name,
                data.vendor_tax_number,
                data.approval_amount,
                data.approver_name,
                data.approval_date,
                data.approval_comments,
                status,
                now,
                now,
                exceptions.length
              ]
            );

            await writeExceptions(id, exceptions);

            await addHistory(
              id,
              'create',
              null,
              { ...data, importSource: 'CSV' },
              'importer',
              `CSV批量导入 - 票据号: ${data.invoice_number}`
            );

            totalExceptions.push(...exceptions.map(e => ({ invoiceId: id, ...e })));
            importedIds.push(id);
            imported++;
          } catch (e) {
            errors.push({ row: results.indexOf(data) + 2, error: e.message });
          }
        }

        fs.unlinkSync(req.file.path);

        res.json({
          success: true,
          data: {
            imported,
            total: results.length,
            errors,
            invoiceIds: importedIds,
            withExceptions: totalExceptions.length > 0
          }
        });
      });
  } catch (err) {
    console.error('导入失败:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/import/json', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: '请上传文件' });
    }

    const raw = fs.readFileSync(req.file.path, 'utf-8');
    const data = JSON.parse(raw);
    const items = Array.isArray(data) ? data : data.invoices || [];

    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    let imported = 0;
    const errors = [];
    const importedIds = [];

    for (let i = 0; i < items.length; i++) {
      try {
        const item = items[i];
        if (!item.invoice_number || !item.amount) {
          errors.push({ index: i, error: '票据号和金额必填' });
          continue;
        }

        const id = uuidv4();
        const exceptions = detectExceptions(item);
        const status =
          exceptions.length > 0
            ? INVOICE_STATUSES.EXCEPTION
            : INVOICE_STATUSES.PENDING;

        await db.run(
          `INSERT INTO invoices (
            id, invoice_number, invoice_date, amount, tax_amount, tax_number,
            vendor_name, vendor_tax_number, approval_amount, approver_name,
            approval_date, approval_comments, status, created_at, updated_at, exception_count
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            item.invoice_number,
            item.invoice_date,
            item.amount,
            item.tax_amount || 0,
            item.tax_number,
            item.vendor_name,
            item.vendor_tax_number,
            item.approval_amount,
            item.approver_name,
            item.approval_date,
            item.approval_comments,
            status,
            now,
            now,
            exceptions.length
          ]
        );

        await writeExceptions(id, exceptions);

        await addHistory(
          id,
          'create',
          null,
          { ...item, importSource: 'JSON' },
          'importer',
          `JSON批量导入 - 票据号: ${item.invoice_number}`
        );

        importedIds.push(id);
        imported++;
      } catch (e) {
        errors.push({ index: i, error: e.message });
      }
    }

    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      data: {
        imported,
        total: items.length,
        errors,
        invoiceIds: importedIds
      }
    });
  } catch (err) {
    console.error('JSON 导入失败:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/upload/image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: '请上传图片' });
    }

    const filePath = `/uploads/${req.file.filename}`;
    res.json({
      success: true,
      data: {
        path: filePath,
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size
      }
    });
  } catch (err) {
    console.error('图片上传失败:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/export/csv', async (req, res) => {
  try {
    const { status, keyword } = req.query;

    let sql = 'SELECT * FROM invoices';
    const params = [];
    const conditions = [];

    if (status && status !== 'all') {
      conditions.push('status = ?');
      params.push(status);
    }

    if (keyword) {
      conditions.push(
        '(invoice_number LIKE ? OR vendor_name LIKE ? OR tax_number LIKE ?)'
      );
      const kw = `%${keyword}%`;
      params.push(kw, kw, kw);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    sql += ' ORDER BY created_at DESC';

    const invoices = await db.all(sql, params);

    const fields = [
      { label: '票据号', value: 'invoice_number' },
      { label: '开票日期', value: 'invoice_date' },
      { label: '供应商', value: 'vendor_name' },
      { label: '金额', value: 'amount' },
      { label: '税额', value: 'tax_amount' },
      { label: '税号', value: 'tax_number' },
      { label: '供应商税号', value: 'vendor_tax_number' },
      { label: '审批金额', value: 'approval_amount' },
      { label: '审批人', value: 'approver_name' },
      { label: '审批日期', value: 'approval_date' },
      { label: '审批意见', value: 'approval_comments' },
      { label: '状态', value: 'status' },
      { label: '异常数量', value: 'exception_count' },
      { label: '创建时间', value: 'created_at' }
    ];

    const parser = new Parser({ fields });
    const csvContent = parser.parse(invoices);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="invoices-${dayjs().format('YYYYMMDDHHmmss')}.csv"`
    );
    res.send('\uFEFF' + csvContent);
  } catch (err) {
    console.error('导出 CSV 失败:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/export/json', async (req, res) => {
  try {
    const { status, keyword } = req.query;

    let sql = 'SELECT * FROM invoices';
    const params = [];
    const conditions = [];

    if (status && status !== 'all') {
      conditions.push('status = ?');
      params.push(status);
    }

    if (keyword) {
      conditions.push(
        '(invoice_number LIKE ? OR vendor_name LIKE ? OR tax_number LIKE ?)'
      );
      const kw = `%${keyword}%`;
      params.push(kw, kw, kw);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    sql += ' ORDER BY created_at DESC';

    const invoices = await db.all(sql, params);

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="invoices-${dayjs().format('YYYYMMDDHHmmss')}.json"`
    );
    res.json({
      exportedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      count: invoices.length,
      invoices
    });
  } catch (err) {
    console.error('导出 JSON 失败:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

function cleanRow(row) {
  return {
    invoice_number: trim(row['票据号'] || row.invoice_number || row.id),
    invoice_date: trim(row['开票日期'] || row.invoice_date),
    amount: parseFloat(row['金额'] || row.amount) || 0,
    tax_amount: parseFloat(row['税额'] || row.tax_amount) || 0,
    tax_number: trim(row['税号'] || row.tax_number),
    vendor_name: trim(row['供应商'] || row.vendor_name),
    vendor_tax_number: trim(row['供应商税号'] || row.vendor_tax_number),
    approval_amount: parseFloat(row['审批金额'] || row.approval_amount) || null,
    approver_name: trim(row['审批人'] || row.approver_name),
    approval_date: trim(row['审批日期'] || row.approval_date),
    approval_comments: trim(row['审批意见'] || row.approval_comments)
  };
}

function trim(val) {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

module.exports = router;
