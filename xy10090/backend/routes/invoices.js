const express = require('express');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const db = require('../database');
const { INVOICE_STATUSES, EXCEPTION_TYPES } = require('../database');

const router = express.Router();

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

function buildSearchQuery(filters) {
  const conditions = [];
  const params = [];

  if (filters.keyword) {
    conditions.push(
      `(invoice_number LIKE ? OR vendor_name LIKE ? OR tax_number LIKE ? OR vendor_tax_number LIKE ?)`
    );
    const kw = `%${filters.keyword}%`;
    params.push(kw, kw, kw, kw);
  }

  if (filters.status && filters.status !== 'all') {
    conditions.push('status = ?');
    params.push(filters.status);
  }

  if (filters.hasException === 'true') {
    conditions.push('exception_count > 0');
  } else if (filters.hasException === 'false') {
    conditions.push('exception_count = 0');
  }

  if (filters.amountFrom) {
    conditions.push('amount >= ?');
    params.push(parseFloat(filters.amountFrom));
  }

  if (filters.amountTo) {
    conditions.push('amount <= ?');
    params.push(parseFloat(filters.amountTo));
  }

  if (filters.dateFrom) {
    conditions.push('invoice_date >= ?');
    params.push(filters.dateFrom);
  }

  if (filters.dateTo) {
    conditions.push('invoice_date <= ?');
    params.push(filters.dateTo);
  }

  if (filters.createdFrom) {
    conditions.push('created_at >= ?');
    params.push(filters.createdFrom + ' 00:00:00');
  }

  if (filters.createdTo) {
    conditions.push('created_at <= ?');
    params.push(filters.createdTo + ' 23:59:59');
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { whereClause, params };
}

router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const sortBy = req.query.sortBy || 'created_at';
    const sortOrder = req.query.sortOrder || 'DESC';

    const { whereClause, params } = buildSearchQuery(req.query);

    const countResult = await db.get(
      `SELECT COUNT(*) as total FROM invoices ${whereClause}`,
      params
    );

    const validSortFields = [
      'invoice_number',
      'invoice_date',
      'amount',
      'status',
      'created_at',
      'updated_at',
      'exception_count'
    ];
    const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'created_at';
    const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const offset = (page - 1) * pageSize;
    const invoices = await db.all(
      `SELECT * FROM invoices ${whereClause} ORDER BY ${safeSortBy} ${safeSortOrder} LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    res.json({
      success: true,
      data: {
        items: invoices,
        total: countResult.total,
        page,
        pageSize,
        totalPages: Math.ceil(countResult.total / pageSize)
      }
    });
  } catch (err) {
    console.error('获取票据列表失败:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const stats = await db.get(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'reviewing' THEN 1 ELSE 0 END) as reviewing,
        SUM(CASE WHEN status = 'exception' THEN 1 ELSE 0 END) as exception,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN exception_count > 0 THEN 1 ELSE 0 END) as withExceptions,
        COALESCE(SUM(amount), 0) as totalAmount,
        COALESCE(SUM(tax_amount), 0) as totalTaxAmount
      FROM invoices
    `);

    const exceptionStats = await db.all(`
      SELECT type, COUNT(*) as count
      FROM exceptions
      WHERE status = 'open'
      GROUP BY type
    `);

    res.json({
      success: true,
      data: {
        overview: stats,
        exceptionByType: exceptionStats
      }
    });
  } catch (err) {
    console.error('获取统计失败:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const invoice = await db.get('SELECT * FROM invoices WHERE id = ?', [req.params.id]);

    if (!invoice) {
      return res.status(404).json({ success: false, error: '票据不存在' });
    }

    const history = await db.all(
      `SELECT * FROM invoice_history WHERE invoice_id = ? ORDER BY created_at DESC`,
      [req.params.id]
    );

    const exceptions = await db.all(
      `SELECT * FROM exceptions WHERE invoice_id = ? ORDER BY created_at DESC`,
      [req.params.id]
    );

    res.json({
      success: true,
      data: {
        invoice,
        history: history.map((h) => ({
          ...h,
          old_values: JSON.parse(h.old_values || '{}'),
          new_values: JSON.parse(h.new_values || '{}')
        })),
        exceptions
      }
    });
  } catch (err) {
    console.error('获取票据详情失败:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      invoice_number,
      invoice_date,
      amount,
      tax_amount = 0,
      tax_number,
      vendor_name,
      vendor_tax_number,
      approval_amount,
      approver_name,
      approval_date,
      approval_comments,
      image_path = null
    } = req.body;

    if (!invoice_number || !amount) {
      return res.status(400).json({ success: false, error: '票据号和金额必填' });
    }

    const id = uuidv4();
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');

    const exceptionCount = detectExceptions({
      amount,
      approval_amount,
      tax_number,
      vendor_tax_number,
      approver_name
    });

    const status =
      exceptionCount > 0
        ? INVOICE_STATUSES.EXCEPTION
        : INVOICE_STATUSES.PENDING;

    await db.run(
      `INSERT INTO invoices (
        id, invoice_number, invoice_date, amount, tax_amount, tax_number,
        vendor_name, vendor_tax_number, approval_amount, approver_name,
        approval_date, approval_comments, image_path, status, created_at,
        updated_at, exception_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        invoice_number,
        invoice_date,
        amount,
        tax_amount,
        tax_number,
        vendor_name,
        vendor_tax_number,
        approval_amount,
        approver_name,
        approval_date,
        approval_comments,
        image_path,
        status,
        now,
        now,
        exceptionCount
      ]
    );

    await addHistory(id, 'create', null, req.body, 'uploader', '票据上传');

    res.json({ success: true, data: { id } });
  } catch (err) {
    console.error('创建票据失败:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

function detectExceptions(invoice) {
  let count = 0;

  if (invoice.approval_amount && invoice.amount !== invoice.approval_amount) {
    count++;
  }

  if (invoice.tax_number && !isValidTaxNumber(invoice.tax_number)) {
    count++;
  }

  if (invoice.vendor_tax_number && !isValidTaxNumber(invoice.vendor_tax_number)) {
    count++;
  }

  if (!invoice.approver_name) {
    count++;
  }

  return count;
}

function isValidTaxNumber(tax) {
  if (!tax) return false;
  const valid = /^[0-9A-Z]{15,20}$/i;
  return valid.test(tax);
}

router.put('/:id', async (req, res) => {
  try {
    const existing = await db.get('SELECT * FROM invoices WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ success: false, error: '票据不存在' });
    }

    const updates = req.body;
    const updateFields = [];
    const updateValues = [];

    const allowedFields = [
      'invoice_number',
      'invoice_date',
      'amount',
      'tax_amount',
      'tax_number',
      'vendor_name',
      'vendor_tax_number',
      'approval_amount',
      'approver_name',
      'approval_date',
      'approval_comments',
      'image_path'
    ];

    allowedFields.forEach((field) => {
      if (updates[field] !== undefined) {
        updateFields.push(`${field} = ?`);
        updateValues.push(updates[field]);
      }
    });

    if (updateFields.length === 0) {
      return res.status(400).json({ success: false, error: '没有可更新的字段' });
    }

    updateFields.push('updated_at = ?');
    updateValues.push(dayjs().format('YYYY-MM-DD HH:mm:ss'));
    updateValues.push(req.params.id);

    await db.run(
      `UPDATE invoices SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    const updated = { ...existing, ...updates };
    const exceptionCount = detectExceptions(updated);

    await db.run(`UPDATE invoices SET exception_count = ? WHERE id = ?`, [
      exceptionCount,
      req.params.id
    ]);

    if (
      existing.status === INVOICE_STATUSES.EXCEPTION &&
      exceptionCount === 0
    ) {
      await db.run(`UPDATE invoices SET status = ? WHERE id = ?`, [
        INVOICE_STATUSES.PENDING,
        req.params.id
      ]);
    }

    const oldValues = {};
    const newValues = {};
    allowedFields.forEach((f) => {
      if (updates[f] !== undefined && existing[f] !== updates[f]) {
        oldValues[f] = existing[f];
        newValues[f] = updates[f];
      }
    });

    await addHistory(req.params.id, 'update', oldValues, newValues, 'revisor', '更新票据信息');

    res.json({ success: true });
  } catch (err) {
    console.error('更新票据失败:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:id/review', async (req, res) => {
  try {
    const { action, comments, operator = 'revisor' } = req.body;
    const invoice = await db.get('SELECT * FROM invoices WHERE id = ?', [req.params.id]);

    if (!invoice) {
      return res.status(404).json({ success: false, error: '票据不存在' });
    }

    const validActions = ['approve', 'reject', 'reviewing'];
    if (!validActions.includes(action)) {
      return res.status(400).json({ success: false, error: '无效的操作' });
    }

    const statusMap = {
      approve: INVOICE_STATUSES.APPROVED,
      reject: INVOICE_STATUSES.REJECTED,
      reviewing: INVOICE_STATUSES.REVIEWING
    };

    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    await db.run(
      `UPDATE invoices SET status = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?`,
      [statusMap[action], operator, now, now, req.params.id]
    );

    await addHistory(
      req.params.id,
      action,
      { status: invoice.status },
      { status: statusMap[action], comments },
      operator,
      comments || ''
    );

    res.json({ success: true });
  } catch (err) {
    console.error('审核操作失败:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const existing = await db.get('SELECT * FROM invoices WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ success: false, error: '票据不存在' });
    }

    await db.run('DELETE FROM exceptions WHERE invoice_id = ?', [req.params.id]);
    await db.run('DELETE FROM invoice_history WHERE invoice_id = ?', [req.params.id]);
    await db.run('DELETE FROM invoices WHERE id = ?', [req.params.id]);

    res.json({ success: true });
  } catch (err) {
    console.error('删除票据失败:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/batch/delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: '请选择要删除的票据' });
    }

    const placeholders = ids.map(() => '?').join(',');
    await db.run(`DELETE FROM exceptions WHERE invoice_id IN (${placeholders})`, ids);
    await db.run(`DELETE FROM invoice_history WHERE invoice_id IN (${placeholders})`, ids);
    await db.run(`DELETE FROM invoices WHERE id IN (${placeholders})`, ids);

    res.json({ success: true, data: { deleted: ids.length } });
  } catch (err) {
    console.error('批量删除失败:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
