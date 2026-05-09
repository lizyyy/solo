const express = require('express');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const db = require('../database');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const reports = await db.all(
      `SELECT * FROM review_reports ORDER BY generated_at DESC LIMIT 50`
    );

    res.json({
      success: true,
      data: reports.map((r) => ({
        ...r,
        filters: JSON.parse(r.filters || '{}'),
        summary: JSON.parse(r.summary || '{}')
      }))
    });
  } catch (err) {
    console.error('获取报告列表失败:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/generate', async (req, res) => {
  try {
    const { reportType, title, filters = {}, generatedBy = 'system' } = req.body;

    let summary;
    let invoiceIds = [];

    switch (reportType) {
      case 'exception':
        summary = await generateExceptionReport(filters);
        invoiceIds = summary.invoiceIds || [];
        break;
      case 'review_progress':
        summary = await generateProgressReport(filters);
        invoiceIds = summary.invoiceIds || [];
        break;
      case 'daily':
        summary = await generateDailyReport(filters);
        invoiceIds = summary.invoiceIds || [];
        break;
      default:
        summary = await generateGeneralReport(filters);
        invoiceIds = summary.invoiceIds || [];
    }

    const id = uuidv4();
    await db.run(
      `INSERT INTO review_reports (id, report_type, title, filters, summary, generated_at, generated_by, invoice_ids)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        reportType,
        title || `报告-${dayjs().format('YYYY-MM-DD')}`,
        JSON.stringify(filters),
        JSON.stringify(summary),
        dayjs().format('YYYY-MM-DD HH:mm:ss'),
        generatedBy,
        JSON.stringify(invoiceIds)
      ]
    );

    res.json({ success: true, data: { id, summary } });
  } catch (err) {
    console.error('生成报告失败:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

async function generateExceptionReport(filters) {
  const exceptions = await db.all(`
    SELECT e.*, i.invoice_number, i.amount, i.vendor_name
    FROM exceptions e
    JOIN invoices i ON e.invoice_id = i.id
    ORDER BY e.created_at DESC
  `);

  const byType = {};
  exceptions.forEach((e) => {
    if (!byType[e.type]) byType[e.type] = 0;
    byType[e.type]++;
  });

  const openCount = exceptions.filter((e) => e.status === 'open').length;
  const resolvedCount = exceptions.filter((e) => e.status === 'resolved').length;

  return {
    total: exceptions.length,
    open: openCount,
    resolved: resolvedCount,
    byType,
    invoiceIds: [...new Set(exceptions.map((e) => e.invoice_id))],
    topExceptions: exceptions.slice(0, 10)
  };
}

async function generateProgressReport(filters) {
  const stats = await db.get(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'reviewing' THEN 1 ELSE 0 END) as reviewing,
      SUM(CASE WHEN status = 'exception' THEN 1 ELSE 0 END) as exception,
      SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
      COALESCE(SUM(amount), 0) as totalAmount
    FROM invoices
  `);

  const dailyProgress = await db.all(`
    SELECT
      DATE(created_at) as date,
      COUNT(*) as uploaded,
      SUM(CASE WHEN status IN ('approved', 'rejected') THEN 1 ELSE 0 END) as reviewed
    FROM invoices
    GROUP BY DATE(created_at)
    ORDER BY date DESC
    LIMIT 14
  `);

  const completionRate =
    stats.total > 0
      ? Math.round(((stats.approved + stats.rejected) / stats.total) * 100)
      : 0;

  return {
    statusBreakdown: {
      total: stats.total,
      pending: stats.pending,
      reviewing: stats.reviewing,
      exception: stats.exception,
      approved: stats.approved,
      rejected: stats.rejected
    },
    totalAmount: stats.totalAmount,
    completionRate,
    dailyProgress: dailyProgress.reverse(),
    invoiceIds: []
  };
}

async function generateDailyReport(filters) {
  const today = dayjs().format('YYYY-MM-DD');
  const dateFrom = filters.dateFrom || today;
  const dateTo = filters.dateTo || today;

  const invoices = await db.all(
    `SELECT * FROM invoices WHERE DATE(created_at) >= ? AND DATE(created_at) <= ?`,
    [dateFrom, dateTo]
  );

  const byStatus = {};
  let totalAmount = 0;

  invoices.forEach((inv) => {
    if (!byStatus[inv.status]) byStatus[inv.status] = 0;
    byStatus[inv.status]++;
    totalAmount += inv.amount || 0;
  });

  return {
    dateRange: { from: dateFrom, to: dateTo },
    total: invoices.length,
    totalAmount,
    byStatus,
    invoiceIds: invoices.map((i) => i.id)
  };
}

async function generateGeneralReport(filters) {
  return generateProgressReport(filters);
}

router.get('/:id', async (req, res) => {
  try {
    const report = await db.get('SELECT * FROM review_reports WHERE id = ?', [req.params.id]);

    if (!report) {
      return res.status(404).json({ success: false, error: '报告不存在' });
    }

    res.json({
      success: true,
      data: {
        ...report,
        filters: JSON.parse(report.filters || '{}'),
        summary: JSON.parse(report.summary || '{}'),
        invoice_ids: JSON.parse(report.invoice_ids || '[]')
      }
    });
  } catch (err) {
    console.error('获取报告失败:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
