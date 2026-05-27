const express = require('express');
const crypto = require('crypto');
const db = require('./database');
const classifier = require('./classifier');
const reportGenerator = require('./report-generator');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));

function generateBatchId() {
  return 'B' + Date.now() + Math.random().toString(36).substr(2, 4).toUpperCase();
}

function calculateContentHash(items) {
  const sorted = JSON.stringify(items.sort((a, b) => 
    (a.waybill_no || '').localeCompare(b.waybill_no || '')
  ));
  return crypto.createHash('sha256').update(sorted).digest('hex');
}

function getBatchResults(batchId) {
  const items = db.prepare(`
    SELECT di.*, cr.category, cr.reason_code, cr.reason_desc, 
           cr.action_required, cr.action_deadline
    FROM detention_items di
    LEFT JOIN classification_results cr ON di.id = cr.item_id
    WHERE di.batch_id = ?
    ORDER BY di.row_index
  `).all(batchId);

  const errors = db.prepare(`
    SELECT row_index, field_name, error_type, error_message
    FROM validation_errors
    WHERE batch_id = ?
    ORDER BY row_index, field_name
  `).all(batchId);

  const errorsByRow = {};
  errors.forEach(err => {
    if (!errorsByRow[err.row_index]) {
      errorsByRow[err.row_index] = [];
    }
    errorsByRow[err.row_index].push({
      field_name: err.field_name,
      error_type: err.error_type,
      error_message: err.error_message
    });
  });

  return items.map(item => ({
    row_index: item.row_index,
    item_id: item.id,
    waybill_no: item.waybill_no,
    receiver_name: item.receiver_name,
    receiver_phone: item.receiver_phone,
    detained_at: item.detained_at,
    category: item.category,
    reason_code: item.reason_code,
    reason_desc: item.reason_desc,
    action_required: item.action_required,
    action_deadline: item.action_deadline,
    errors: errorsByRow[item.row_index] || [],
    raw_data: JSON.parse(item.raw_data)
  }));
}

app.post('/api/batches', (req, res) => {
  try {
    const { station_id, batch_no, items } = req.body;

    if (!station_id || !batch_no || !Array.isArray(items)) {
      return res.status(400).json({
        error: 'INVALID_REQUEST',
        message: '缺少必要参数: station_id, batch_no, items'
      });
    }

    if (items.length === 0) {
      return res.status(400).json({
        error: 'EMPTY_BATCH',
        message: '批次数据不能为空'
      });
    }

    const contentHash = calculateContentHash(items);

    const existingBatch = db.prepare(`
      SELECT * FROM batches WHERE content_hash = ?
    `).get(contentHash);

    if (existingBatch) {
      const results = getBatchResults(existingBatch.id);
      const stats = db.prepare(`
        SELECT category, COUNT(*) as count
        FROM classification_results
        WHERE batch_id = ?
        GROUP BY category
      `).all(existingBatch.id);

      return res.json({
        duplicate: true,
        message: '检测到重复提交，返回历史处理结果',
        batch_id: existingBatch.id,
        station_id: existingBatch.station_id,
        batch_no: existingBatch.batch_no,
        submitted_at: existingBatch.submitted_at,
        statistics: stats.reduce((acc, s) => ({ ...acc, [s.category]: s.count }), {}),
        items: results
      });
    }

    const batchId = generateBatchId();
    const submittedAt = new Date().toISOString();

    db.prepare(`
      INSERT INTO batches (id, station_id, batch_no, submitted_at, items_count, content_hash, raw_data)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      batchId,
      station_id,
      batch_no,
      submittedAt,
      items.length,
      contentHash,
      JSON.stringify(items)
    );

    const results = classifier.processBatch(batchId, items);

    const stats = results.reduce((acc, r) => {
      acc[r.category] = (acc[r.category] || 0) + 1;
      return acc;
    }, {});

    res.json({
      duplicate: false,
      batch_id: batchId,
      station_id,
      batch_no,
      submitted_at: submittedAt,
      items_count: items.length,
      statistics: stats,
      items: results
    });

  } catch (error) {
    console.error('创建批次失败:', error);
    res.status(500).json({
      error: 'SERVER_ERROR',
      message: error.message
    });
  }
});

app.get('/api/batches', (req, res) => {
  try {
    const { station_id, page = 1, page_size = 20 } = req.query;
    const offset = (page - 1) * page_size;

    let query = 'SELECT * FROM batches';
    let params = [];

    if (station_id) {
      query += ' WHERE station_id = ?';
      params.push(station_id);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(page_size), Number(offset));

    const batches = db.prepare(query).all(...params);

    res.json({
      page: Number(page),
      page_size: Number(page_size),
      data: batches.map(b => ({
        id: b.id,
        station_id: b.station_id,
        batch_no: b.batch_no,
        submitted_at: b.submitted_at,
        items_count: b.items_count
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/batches/:batchId', (req, res) => {
  try {
    const { batchId } = req.params;

    const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(batchId);
    if (!batch) {
      return res.status(404).json({ error: 'BATCH_NOT_FOUND' });
    }

    const results = getBatchResults(batchId);
    const stats = db.prepare(`
      SELECT category, COUNT(*) as count
      FROM classification_results
      WHERE batch_id = ?
      GROUP BY category
    `).all(batchId);

    res.json({
      batch_id: batch.id,
      station_id: batch.station_id,
      batch_no: batch.batch_no,
      submitted_at: batch.submitted_at,
      items_count: batch.items_count,
      statistics: stats.reduce((acc, s) => ({ ...acc, [s.category]: s.count }), {}),
      items: results
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/batches/:batchId/report', (req, res) => {
  try {
    const { batchId } = req.params;
    const { format = 'json' } = req.query;

    const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(batchId);
    if (!batch) {
      return res.status(404).json({ error: 'BATCH_NOT_FOUND' });
    }

    const results = getBatchResults(batchId);
    const stats = db.prepare(`
      SELECT category, COUNT(*) as count
      FROM classification_results
      WHERE batch_id = ?
      GROUP BY category
    `).all(batchId);

    const statistics = stats.reduce((acc, s) => ({ ...acc, [s.category]: s.count }), {});

    if (format === 'csv') {
      const csvContent = reportGenerator.generateCSV(batch, results, statistics);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="batch-${batchId}.csv"`);
      res.send('\uFEFF' + csvContent);
    } else {
      res.json(reportGenerator.generateJSON(batch, results, statistics));
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/batches/:batchId/trace', (req, res) => {
  try {
    const { batchId } = req.params;

    const traces = db.prepare(`
      SELECT ft.*, di.waybill_no, di.row_index
      FROM field_trace ft
      JOIN detention_items di ON ft.item_id = di.id
      WHERE di.batch_id = ?
      ORDER BY di.row_index, ft.field_name
    `).all(batchId);

    const traceByItem = {};
    traces.forEach(t => {
      if (!traceByItem[t.item_id]) {
        traceByItem[t.item_id] = {
          item_id: t.item_id,
          row_index: t.row_index,
          waybill_no: t.waybill_no,
          fields: {}
        };
      }
      traceByItem[t.item_id].fields[t.field_name] = {
        original_value: t.original_value,
        final_value: t.final_value,
        transformation_steps: JSON.parse(t.transformation_steps)
      };
    });

    res.json({
      batch_id: batchId,
      trace_count: traces.length,
      items: Object.values(traceByItem)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/batches/:batchId/errors', (req, res) => {
  try {
    const { batchId } = req.params;

    const errors = db.prepare(`
      SELECT ve.*, di.waybill_no, di.raw_data
      FROM validation_errors ve
      LEFT JOIN detention_items di ON ve.item_id = di.id
      WHERE ve.batch_id = ?
      ORDER BY ve.row_index, ve.field_name
    `).all(batchId);

    res.json({
      batch_id: batchId,
      error_count: errors.length,
      errors: errors.map(e => ({
        row_index: e.row_index,
        waybill_no: e.waybill_no,
        field_name: e.field_name,
        error_type: e.error_type,
        error_message: e.error_message,
        raw_data: e.raw_data ? JSON.parse(e.raw_data) : null
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`快递驿站滞留件处理API服务已启动: http://localhost:${PORT}`);
});
