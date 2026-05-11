const express = require('express');
const json2csv = require('json2csv');
const dbModule = require('./database');

const router = express.Router();

function getDb() {
  return dbModule.getDb();
}

router.get('/linen-items', async (req, res) => {
  try {
    const db = getDb();
    const items = db.prepare('SELECT * FROM linen_items ORDER BY created_at DESC').all();
    res.json({ success: true, data: items });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/linen-items/:id', async (req, res) => {
  try {
    const db = getDb();
    const item = db.prepare('SELECT * FROM linen_items WHERE id = ?').get(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, error: '布草档案不存在' });
    }
    res.json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/linen-items', async (req, res) => {
  try {
    const db = getDb();
    const { code, name, type, specification, initial_quality, purchase_date } = req.body;
    const newId = dbModule.getNextId('linen_items');
    const now = new Date().toISOString();
    
    db.prepare(`INSERT INTO linen_items (id, code, name, type, specification, initial_quality, status, purchase_date, total_washes, created_at, updated_at) 
                VALUES (?, ?, ?, ?, ?, ?, 'available', ?, 0, ?, ?)`).run(
      newId, code, name, type, specification, initial_quality || 'good', purchase_date, now, now
    );
    
    const item = db.prepare('SELECT * FROM linen_items WHERE id = ?').get(newId);
    res.json({ success: true, data: item });
  } catch (error) {
    if (error.message.includes('UNIQUE')) {
      return res.status(400).json({ success: false, error: '布草编码已存在' });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/linen-items/:id', async (req, res) => {
  try {
    const db = getDb();
    const { code, name, type, specification, initial_quality, status, purchase_date } = req.body;
    const now = new Date().toISOString();
    
    db.prepare(`UPDATE linen_items SET code = ?, name = ?, type = ?, specification = ?, 
                initial_quality = ?, status = ?, purchase_date = ?, updated_at = ? WHERE id = ?`).run(
      code, name, type, specification, initial_quality, status, purchase_date, now, req.params.id
    );
    
    const item = db.prepare('SELECT * FROM linen_items WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/linen-items/:id', async (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM linen_items WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/stain-levels', async (req, res) => {
  try {
    const db = getDb();
    const levels = db.prepare('SELECT * FROM stain_levels ORDER BY id ASC').all();
    res.json({ success: true, data: levels });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/stain-levels', async (req, res) => {
  try {
    const db = getDb();
    const { level, name, description, color } = req.body;
    const newId = dbModule.getNextId('stain_levels');
    const now = new Date().toISOString();
    
    db.prepare('INSERT INTO stain_levels (id, level, name, description, color, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(newId, level, name, description, color, now);
    
    const created = db.prepare('SELECT * FROM stain_levels WHERE id = ?').get(newId);
    res.json({ success: true, data: created });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/rewash-batches', async (req, res) => {
  try {
    const db = getDb();
    const batches = db.prepare('SELECT * FROM rewash_batches ORDER BY created_at DESC').all();
    res.json({ success: true, data: batches });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/rewash-batches/:id', async (req, res) => {
  try {
    const db = getDb();
    const batch = db.prepare('SELECT * FROM rewash_batches WHERE id = ?').get(req.params.id);
    if (!batch) {
      return res.status(404).json({ success: false, error: '返洗批次不存在' });
    }
    res.json({ success: true, data: batch });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/rewash-batches', async (req, res) => {
  try {
    const db = getDb();
    const { batch_code, name, reason, created_by } = req.body;
    const newId = dbModule.getNextId('rewash_batches');
    const now = new Date().toISOString();
    
    db.prepare(`INSERT INTO rewash_batches (id, batch_code, name, reason, status, created_by, created_at, completed_at) 
                VALUES (?, ?, ?, ?, 'in_progress', ?, ?, NULL)`).run(
      newId, batch_code, name, reason, created_by, now
    );
    
    const batch = db.prepare('SELECT * FROM rewash_batches WHERE id = ?').get(newId);
    res.json({ success: true, data: batch });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/rewash-batches/:id/complete', async (req, res) => {
  try {
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare("UPDATE rewash_batches SET status = 'completed', completed_at = ? WHERE id = ?").run(now, req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/damage-records', async (req, res) => {
  try {
    const db = getDb();
    const records = db.prepare(`
      SELECT dr.*, li.code as linen_code, li.name as linen_name 
      FROM damage_records dr 
      LEFT JOIN linen_items li ON dr.linen_item_id = li.id 
      ORDER BY dr.created_at DESC
    `).all();
    res.json({ success: true, data: records });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/damage-records', async (req, res) => {
  try {
    const db = getDb();
    const { linen_item_id, damage_type, severity, description, reported_by } = req.body;
    const newId = dbModule.getNextId('damage_records');
    const now = new Date().toISOString();
    
    db.prepare(`INSERT INTO damage_records (id, linen_item_id, damage_type, severity, description, status, reported_by, created_at) 
                VALUES (?, ?, ?, ?, ?, 'reported', ?, ?)`).run(
      newId, linen_item_id, damage_type, severity, description, reported_by, now
    );
    
    db.prepare("UPDATE linen_items SET status = 'damaged', updated_at = ? WHERE id = ?").run(now, linen_item_id);
    
    const record = db.prepare('SELECT * FROM damage_records WHERE id = ?').get(newId);
    res.json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/damage-records/:id/status', async (req, res) => {
  try {
    const db = getDb();
    const { status } = req.body;
    db.prepare('UPDATE damage_records SET status = ? WHERE id = ?').run(status, req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/sorting-history', async (req, res) => {
  try {
    const db = getDb();
    let sql = `
      SELECT sh.*, li.code as linen_code, li.name as linen_name, 
             sl.name as stain_level_name, sl.color as stain_color,
             rb.name as rewash_batch_name
      FROM sorting_history sh
      LEFT JOIN linen_items li ON sh.linen_item_id = li.id
      LEFT JOIN stain_levels sl ON sh.stain_level_id = sl.id
      LEFT JOIN rewash_batches rb ON sh.rewash_batch_id = rb.id
      WHERE 1=1
    `;
    const params = [];
    
    if (req.query.linen_item_id) {
      sql += ' AND sh.linen_item_id = ?';
      params.push(req.query.linen_item_id);
    }
    if (req.query.rewash_batch_id) {
      sql += ' AND sh.rewash_batch_id = ?';
      params.push(req.query.rewash_batch_id);
    }
    sql += ' ORDER BY sh.created_at DESC';
    
    const history = db.prepare(sql).all(...params);
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/sorting-history', async (req, res) => {
  try {
    const db = getDb();
    const { linen_item_id, stain_level_id, rewash_batch_id, sorting_result, notes, sorted_by } = req.body;
    const newId = dbModule.getNextId('sorting_history');
    const now = new Date().toISOString();
    
    db.prepare(`INSERT INTO sorting_history (id, linen_item_id, stain_level_id, rewash_batch_id, sorting_result, notes, sorted_by, created_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
      newId, linen_item_id, stain_level_id, rewash_batch_id, sorting_result, notes, sorted_by, now
    );
    
    if (sorting_result === 'normal') {
      db.prepare('UPDATE linen_items SET total_washes = total_washes + 1, updated_at = ? WHERE id = ?').run(now, linen_item_id);
    }
    if (rewash_batch_id) {
      db.prepare("UPDATE linen_items SET status = 'rewashing', updated_at = ? WHERE id = ?").run(now, linen_item_id);
    }
    
    const record = db.prepare('SELECT * FROM sorting_history WHERE id = ?').get(newId);
    res.json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/handover-reports', async (req, res) => {
  try {
    const db = getDb();
    const reports = db.prepare('SELECT * FROM handover_reports ORDER BY created_at DESC').all();
    res.json({ success: true, data: reports });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/handover-reports/:id', async (req, res) => {
  try {
    const db = getDb();
    const report = db.prepare('SELECT * FROM handover_reports WHERE id = ?').get(req.params.id);
    if (!report) {
      return res.status(404).json({ success: false, error: '交接报表不存在' });
    }
    
    let items = [];
    if (report.batch_type === 'rewash' && report.batch_id) {
      items = db.prepare(`
        SELECT sh.*, li.code as linen_code, li.name as linen_name,
               sl.name as stain_level_name
        FROM sorting_history sh
        LEFT JOIN linen_items li ON sh.linen_item_id = li.id
        LEFT JOIN stain_levels sl ON sh.stain_level_id = sl.id
        WHERE sh.rewash_batch_id = ?
      `).all(report.batch_id);
    } else if (report.batch_type === 'damage') {
      items = db.prepare(`
        SELECT dr.*, li.code as linen_code, li.name as linen_name
        FROM damage_records dr
        LEFT JOIN linen_items li ON dr.linen_item_id = li.id
        WHERE dr.status = 'reported'
      `).all();
    }
    
    res.json({ success: true, data: { ...report, items } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/handover-reports', async (req, res) => {
  try {
    const db = getDb();
    const { report_code, batch_type, batch_id, handover_type, notes, handed_by, received_by } = req.body;
    const newId = dbModule.getNextId('handover_reports');
    const now = new Date().toISOString();
    
    let itemsCount = 0;
    if (batch_type === 'rewash' && batch_id) {
      const countResult = db.prepare('SELECT COUNT(*) as cnt FROM sorting_history WHERE rewash_batch_id = ?').get(batch_id);
      itemsCount = countResult ? countResult.cnt : 0;
    } else if (batch_type === 'damage') {
      const countResult = db.prepare("SELECT COUNT(*) as cnt FROM damage_records WHERE status = 'reported'").get();
      itemsCount = countResult ? countResult.cnt : 0;
    }
    
    db.prepare(`INSERT INTO handover_reports (id, report_code, batch_type, batch_id, handover_type, items_count, status, notes, handed_by, received_by, created_at, handover_date) 
                VALUES (?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?)`).run(
      newId, report_code, batch_type, batch_id, handover_type, itemsCount, notes, handed_by, received_by, now, now
    );
    
    const report = db.prepare('SELECT * FROM handover_reports WHERE id = ?').get(newId);
    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/export/:type', async (req, res) => {
  try {
    const db = getDb();
    const { type } = req.params;
    let data = [];
    let fields = [];
    let filename = '';
    
    switch (type) {
      case 'linen':
        data = db.prepare('SELECT * FROM linen_items').all();
        fields = ['id', 'code', 'name', 'type', 'status', 'total_washes', 'purchase_date'];
        filename = 'linen_items.csv';
        break;
      case 'sorting':
        data = db.prepare(`
          SELECT sh.*, li.code as linen_code, li.name as linen_name,
                 sl.name as stain_level_name, rb.name as rewash_batch_name
          FROM sorting_history sh
          LEFT JOIN linen_items li ON sh.linen_item_id = li.id
          LEFT JOIN stain_levels sl ON sh.stain_level_id = sl.id
          LEFT JOIN rewash_batches rb ON sh.rewash_batch_id = rb.id
        `).all();
        fields = ['id', 'linen_code', 'linen_name', 'stain_level_name', 'rewash_batch_name', 'sorting_result', 'created_at'];
        filename = 'sorting_history.csv';
        break;
      case 'handover':
        data = db.prepare('SELECT * FROM handover_reports').all();
        fields = ['id', 'report_code', 'batch_type', 'handover_type', 'items_count', 'handed_by', 'received_by', 'handover_date'];
        filename = 'handover_reports.csv';
        break;
      default:
        return res.status(400).json({ success: false, error: '未知的导出类型' });
    }
    
    if (data.length === 0) {
      return res.json({ success: true, data: '', filename });
    }
    
    const csv = json2csv.parse(data, { fields });
    res.json({ success: true, data: csv, filename });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const db = getDb();
    
    const totalLinen = db.prepare('SELECT COUNT(*) as count FROM linen_items').get();
    const damagedLinen = db.prepare("SELECT COUNT(*) as count FROM linen_items WHERE status = 'damaged'").get();
    const rewashingLinen = db.prepare("SELECT COUNT(*) as count FROM linen_items WHERE status = 'rewashing'").get();
    const pendingDamage = db.prepare("SELECT COUNT(*) as count FROM damage_records WHERE status = 'reported'").get();
    const inProgressRewash = db.prepare("SELECT COUNT(*) as count FROM rewash_batches WHERE status = 'in_progress'").get();
    
    res.json({
      success: true,
      data: {
        totalLinen: totalLinen ? totalLinen.count : 0,
        damagedLinen: damagedLinen ? damagedLinen.count : 0,
        rewashingLinen: rewashingLinen ? rewashingLinen.count : 0,
        pendingDamage: pendingDamage ? pendingDamage.count : 0,
        inProgressRewash: inProgressRewash ? inProgressRewash.count : 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
