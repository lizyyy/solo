const express = require('express');
const router = express.Router();
const dbHelper = require('../utils/db-helper');
const reconciler = require('../utils/reconciler');
const exporter = require('../utils/exporter');
const { resolveDirtyRecord } = require('../utils/dirty-detector');

router.post('/reconcile/:orderNo', async (req, res) => {
  try {
    const result = await reconciler.reconcileOrder(req.params.orderNo);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/chain/:orderNo', async (req, res) => {
  try {
    const result = await reconciler.getOrderChain(req.params.orderNo);
    if (!result) {
      return res.status(404).json({ error: '报修单不存在' });
    }
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/discrepancy', async (req, res) => {
  try {
    const { order_no, type, description, reporter } = req.body;
    if (!order_no || !type) {
      return res.status(400).json({ error: '缺少必填字段' });
    }
    const result = await reconciler.addDiscrepancy(order_no, type, description, reporter);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/export/order/:orderNo', async (req, res) => {
  try {
    const result = await exporter.exportOrderToCSV(req.params.orderNo);
    res.json({ success: true, data: {
      filename: result.filename,
      filepath: result.filepath,
      preview: result.content.substring(0, 500)
    }});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/export/summary', async (req, res) => {
  try {
    const result = await exporter.exportAllOrdersSummary();
    res.json({ success: true, data: {
      filename: result.filename,
      filepath: result.filepath,
      record_count: result.data.length,
      preview: result.content.substring(0, 500)
    }});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/dirty-records', async (req, res) => {
  try {
    const { resolved, page = 1, limit = 50 } = req.query;
    let sql = 'SELECT * FROM dirty_records';
    let countSql = 'SELECT COUNT(*) as total FROM dirty_records';
    let params = [];
    let countParams = [];

    if (resolved !== undefined) {
      sql += ' WHERE is_resolved = ?';
      countSql += ' WHERE is_resolved = ?';
      params.push(resolved === 'true' ? 1 : 0);
      countParams.push(resolved === 'true' ? 1 : 0);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

    const records = await dbHelper.all(sql, params);
    const countResult = await dbHelper.get(countSql, countParams);

    res.json({
      success: true,
      data: records,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult.total
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/dirty-records/:id/resolve', async (req, res) => {
  try {
    const { resolved_by, resolved_note } = req.body;
    await resolveDirtyRecord(req.params.id, resolved_by || 'system', resolved_note);

    const record = await dbHelper.get('SELECT * FROM dirty_records WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: record });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/export/dirty-records', async (req, res) => {
  try {
    const { resolved } = req.query;
    const resolvedFlag = resolved === 'true' ? true : (resolved === 'false' ? false : null);
    const result = await exporter.exportDirtyRecords(resolvedFlag);
    
    res.json({ success: true, data: {
      filename: result.filename,
      filepath: result.filepath,
      record_count: result.data.length,
      preview: result.content.substring(0, 500)
    }});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/snapshots/:orderNo', async (req, res) => {
  try {
    const snapshots = await dbHelper.all(
      'SELECT * FROM reconcile_snapshots WHERE order_no = ? ORDER BY created_at DESC',
      [req.params.orderNo]
    );
    res.json({ success: true, data: snapshots });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/snapshots/compare/:snapshotNo1/:snapshotNo2', async (req, res) => {
  try {
    const snap1 = await dbHelper.get(
      'SELECT * FROM reconcile_snapshots WHERE snapshot_no = ?',
      [req.params.snapshotNo1]
    );
    const snap2 = await dbHelper.get(
      'SELECT * FROM reconcile_snapshots WHERE snapshot_no = ?',
      [req.params.snapshotNo2]
    );

    if (!snap1 || !snap2) {
      return res.status(404).json({ error: '快照不存在' });
    }

    const differences = [];
    const fields = ['total_labor_fee', 'total_material_fee', 'total_refund', 'net_amount', 'is_consistent'];
    
    fields.forEach(field => {
      if (snap1[field] !== snap2[field]) {
        differences.push({
          field,
          snapshot1: snap1[field],
          snapshot2: snap2[field],
          change: typeof snap1[field] === 'number' ? snap2[field] - snap1[field] : null
        });
      }
    });

    res.json({
      success: true,
      data: {
        snapshot1: snap1,
        snapshot2: snap2,
        differences,
        has_changes: differences.length > 0
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/audit-logs', async (req, res) => {
  try {
    const { entity_type, entity_id, page = 1, limit = 50 } = req.query;
    let sql = 'SELECT * FROM audit_logs';
    let params = [];

    const conditions = [];
    if (entity_type) {
      conditions.push('entity_type = ?');
      params.push(entity_type);
    }
    if (entity_id) {
      conditions.push('entity_id = ?');
      params.push(entity_id);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

    const logs = await dbHelper.all(sql, params);
    res.json({ success: true, data: logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
