const express = require('express');
const path = require('path');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const { Parser } = require('json2csv');
const cors = require('cors');

const services = require('./services');
const db = require('./database');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const upload = multer({ dest: 'uploads/' });

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/price-changes', async (req, res) => {
  try {
    const { status, product_code, operator, start_date, end_date } = req.query;
    let sql = 'SELECT * FROM price_changes WHERE 1=1';
    const params = [];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    if (product_code) {
      sql += ' AND product_code LIKE ?';
      params.push(`%${product_code}%`);
    }
    if (operator) {
      sql += ' AND operator LIKE ?';
      params.push(`%${operator}%`);
    }
    if (start_date) {
      sql += ' AND created_at >= ?';
      params.push(start_date);
    }
    if (end_date) {
      sql += ' AND created_at <= ?';
      params.push(end_date + ' 23:59:59');
    }

    sql += ' ORDER BY created_at DESC';
    const rows = await services.allAsync(sql, params);
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/price-changes/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const priceChange = await services.getAsync(
      'SELECT * FROM price_changes WHERE id = ?',
      [id]
    );

    if (!priceChange) {
      return res.status(404).json({ error: '记录不存在' });
    }

    const eslChanges = await services.allAsync(
      'SELECT * FROM esl_changes WHERE price_change_id = ?',
      [id]
    );
    const cashierChanges = await services.allAsync(
      'SELECT * FROM cashier_changes WHERE price_change_id = ?',
      [id]
    );
    const promotions = await services.allAsync(
      'SELECT * FROM promotions WHERE price_change_id = ?',
      [id]
    );
    const rollbacks = await services.allAsync(
      'SELECT * FROM rollback_records WHERE price_change_id = ? ORDER BY rolled_back_at DESC',
      [id]
    );
    const discrepancies = await services.allAsync(
      'SELECT * FROM price_discrepancies WHERE price_change_id = ?',
      [id]
    );
    const timeline = await services.allAsync(
      'SELECT * FROM audit_timeline WHERE price_change_id = ? ORDER BY created_at DESC',
      [id]
    );

    res.json({
      ...priceChange,
      esl_changes: eslChanges,
      cashier_changes: cashierChanges,
      promotions,
      rollbacks,
      discrepancies,
      timeline: timeline.map(t => ({
        ...t,
        event_details: JSON.parse(t.event_details)
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/price-changes', async (req, res) => {
  try {
    const result = await services.processPriceChange(req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/price-changes/batch', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传CSV文件' });
    }

    const results = [];
    const operator = req.body.operator || 'system';

    await new Promise((resolve, reject) => {
      fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', async (row) => {
          try {
            const data = {
              product_code: row.product_code,
              product_name: row.product_name,
              old_price: parseFloat(row.old_price),
              new_price: parseFloat(row.new_price),
              reason: row.reason,
              operator,
              devices: row.device_id ? [
                { device_id: row.device_id, simulate_offline: row.simulate_offline === 'true' }
              ] : [],
              terminals: row.terminal_id ? [
                { terminal_id: row.terminal_id, simulate_failure: row.simulate_failure === 'true' }
              ] : [],
              force: row.force === 'true'
            };
            if (row.promotion_name) {
              data.promotion = {
                promotion_name: row.promotion_name,
                rule_type: row.rule_type || 'DISCOUNT',
                effect_start: row.effect_start,
                effect_end: row.effect_end
              };
            }
            const result = await services.processPriceChange(data);
            results.push(result);
          } catch (err) {
            results.push({ error: err.message, row });
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });

    fs.unlinkSync(req.file.path);

    const success = results.filter(r => r.success).length;
    const failed = results.length - success;

    res.json({
      total: results.length,
      success,
      failed,
      results
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/price-changes/:id/rollback', async (req, res) => {
  try {
    const result = await services.rollbackPriceChange(req.params.id, req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/price-changes/:id/reissue', async (req, res) => {
  try {
    const result = await services.reissuePriceChange(
      req.params.id,
      req.body.operator || 'system'
    );
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/export/price-changes', async (req, res) => {
  try {
    const { status, product_code, operator, start_date, end_date } = req.query;
    let sql = `
      SELECT
        pc.id,
        pc.product_code,
        pc.product_name,
        pc.old_price,
        pc.new_price,
        pc.status,
        pc.reason,
        pc.operator,
        pc.request_id,
        pc.created_at
      FROM price_changes pc
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      sql += ' AND pc.status = ?';
      params.push(status);
    }
    if (product_code) {
      sql += ' AND pc.product_code LIKE ?';
      params.push(`%${product_code}%`);
    }
    if (operator) {
      sql += ' AND pc.operator LIKE ?';
      params.push(`%${operator}%`);
    }
    if (start_date) {
      sql += ' AND pc.created_at >= ?';
      params.push(start_date);
    }
    if (end_date) {
      sql += ' AND pc.created_at <= ?';
      params.push(end_date + ' 23:59:59');
    }

    sql += ' ORDER BY pc.created_at DESC';
    const rows = await services.allAsync(sql, params);

    const fields = [
      { label: 'ID', value: 'id' },
      { label: '商品编码', value: 'product_code' },
      { label: '商品名称', value: 'product_name' },
      { label: '原价', value: 'old_price' },
      { label: '新价', value: 'new_price' },
      { label: '状态', value: 'status' },
      { label: '原因', value: 'reason' },
      { label: '操作员', value: 'operator' },
      { label: '请求ID', value: 'request_id' },
      { label: '创建时间', value: 'created_at' }
    ];

    const parser = new Parser({ fields });
    const csvContent = parser.parse(rows);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=price_changes_${Date.now()}.csv`);
    res.send('\uFEFF' + csvContent);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/discrepancies', async (req, res) => {
  try {
    const { status } = req.query;
    let sql = `
      SELECT
        pd.*,
        pc.product_code,
        pc.product_name
      FROM price_discrepancies pd
      JOIN price_changes pc ON pd.price_change_id = pc.id
      WHERE 1=1
    `;
    const params = [];
    if (status) {
      sql += ' AND pd.status = ?';
      params.push(status);
    }
    sql += ' ORDER BY pd.discovered_at DESC';

    const rows = await services.allAsync(sql, params);
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/statistics', async (req, res) => {
  try {
    const total = await services.getAsync(
      'SELECT COUNT(*) as count FROM price_changes'
    );
    const byStatus = await services.allAsync(
      'SELECT status, COUNT(*) as count FROM price_changes GROUP BY status'
    );
    const openDiscrepancies = await services.getAsync(
      'SELECT COUNT(*) as count FROM price_discrepancies WHERE status = ?',
      ['OPEN']
    );
    const today = new Date().toISOString().split('T')[0];
    const todayCount = await services.getAsync(
      'SELECT COUNT(*) as count FROM price_changes WHERE DATE(created_at) = ?',
      [today]
    );

    const statusMap = {};
    byStatus.forEach(s => { statusMap[s.status] = s.count; });

    res.json({
      total: total.count,
      today: todayCount.count,
      by_status: statusMap,
      open_discrepancies: openDiscrepancies.count
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`门店价签审计系统已启动`);
  console.log(`========================================`);
  console.log(`Web 界面:  http://localhost:${PORT}`);
  console.log(`API 文档:  http://localhost:${PORT}/api/health`);
  console.log(`数据目录:  ${path.join(__dirname, '..', 'data')}`);
  console.log(`========================================\n`);
});
