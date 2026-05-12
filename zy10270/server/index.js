const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const { initDatabase, runQuery, getQuery, allQuery } = require('./database');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

function generateBatchNo() {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `W${dateStr}${random}`;
}

app.get('/api/rooms', async (req, res) => {
  try {
    const rooms = await allQuery('SELECT * FROM rooms ORDER BY created_at DESC');
    res.json(rooms);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/rooms', async (req, res) => {
  try {
    const { name, building, floor, safe_stock } = req.body;
    const id = uuidv4();
    await runQuery(
      'INSERT INTO rooms (id, name, building, floor, safe_stock) VALUES (?, ?, ?, ?, ?)',
      [id, name, building, floor, safe_stock || 5]
    );
    const room = await getQuery('SELECT * FROM rooms WHERE id = ?', [id]);
    res.json(room);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/rooms/:id', async (req, res) => {
  try {
    const { name, building, floor, safe_stock } = req.body;
    await runQuery(
      'UPDATE rooms SET name = ?, building = ?, floor = ?, safe_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [name, building, floor, safe_stock, req.params.id]
    );
    const room = await getQuery('SELECT * FROM rooms WHERE id = ?', [req.params.id]);
    res.json(room);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/rooms/:id', async (req, res) => {
  try {
    await runQuery('DELETE FROM rooms WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/linens', async (req, res) => {
  try {
    const { status, type, room_id } = req.query;
    let sql = 'SELECT l.*, r.name as room_name FROM linens l LEFT JOIN rooms r ON l.room_id = r.id WHERE 1=1';
    const params = [];
    
    if (status) {
      sql += ' AND l.status = ?';
      params.push(status);
    }
    if (type) {
      sql += ' AND l.type = ?';
      params.push(type);
    }
    if (room_id) {
      sql += ' AND l.room_id = ?';
      params.push(room_id);
    }
    
    sql += ' ORDER BY l.created_at DESC';
    const linens = await allQuery(sql, params);
    res.json(linens);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/linens', async (req, res) => {
  try {
    const { type, barcode, room_id, price } = req.body;
    
    if (barcode) {
      const existing = await getQuery('SELECT id FROM linens WHERE barcode = ?', [barcode]);
      if (existing) {
        return res.status(400).json({ error: '该条形码已存在' });
      }
    }

    const id = uuidv4();
    await runQuery(
      'INSERT INTO linens (id, type, barcode, room_id, price) VALUES (?, ?, ?, ?, ?)',
      [id, type, barcode, room_id, price || 0]
    );
    const linen = await getQuery('SELECT l.*, r.name as room_name FROM linens l LEFT JOIN rooms r ON l.room_id = r.id WHERE l.id = ?', [id]);
    res.json(linen);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/linens/:id', async (req, res) => {
  try {
    const { type, barcode, room_id, price } = req.body;
    await runQuery(
      'UPDATE linens SET type = ?, barcode = ?, room_id = ?, price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [type, barcode, room_id, price, req.params.id]
    );
    const linen = await getQuery('SELECT l.*, r.name as room_name FROM linens l LEFT JOIN rooms r ON l.room_id = r.id WHERE l.id = ?', [req.params.id]);
    res.json(linen);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/linens/:id', async (req, res) => {
  try {
    await runQuery('DELETE FROM linens WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/batches', async (req, res) => {
  try {
    const { status } = req.query;
    let sql = 'SELECT * FROM batches WHERE 1=1';
    const params = [];
    
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    
    sql += ' ORDER BY created_at DESC';
    const batches = await allQuery(sql, params);
    res.json(batches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/batches/:id', async (req, res) => {
  try {
    const batch = await getQuery('SELECT * FROM batches WHERE id = ?', [req.params.id]);
    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }
    const items = await allQuery('SELECT * FROM batch_items WHERE batch_id = ?', [req.params.id]);
    const timeline = await allQuery('SELECT * FROM batch_timeline WHERE batch_id = ? ORDER BY created_at ASC', [req.params.id]);
    res.json({ ...batch, items, timeline });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/batches', async (req, res) => {
  try {
    const { items, created_by } = req.body;
    
    if (!items || items.length === 0) {
      return res.status(400).json({ error: '请选择要送洗的布草' });
    }

    const linenIds = items.map(item => item.linen_id);
    const placeholders = linenIds.map(() => '?').join(',');
    
    const washingLinens = await allQuery(
      `SELECT id FROM linens WHERE id IN (${placeholders}) AND status = 'washing'`,
      linenIds
    );
    
    if (washingLinens.length > 0) {
      return res.status(400).json({ error: '存在已在洗涤中的布草，请勿重复送洗' });
    }

    const batchId = uuidv4();
    const batchNo = generateBatchNo();

    await runQuery(
      'INSERT INTO batches (id, batch_no, status, send_quantity, send_at, created_by) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?)',
      [batchId, batchNo, 'sent', items.length, created_by]
    );

    for (const item of items) {
      await runQuery(
        'INSERT INTO batch_items (id, batch_id, linen_id, linen_type, room_id) VALUES (?, ?, ?, ?, ?)',
        [uuidv4(), batchId, item.linen_id, item.type, item.room_id]
      );
      
      await runQuery(
        'UPDATE linens SET status = ?, wash_count = wash_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['washing', item.linen_id]
      );
    }

    await runQuery(
      'INSERT INTO batch_timeline (id, batch_id, action, description, quantity, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [uuidv4(), batchId, 'send', '创建送洗批次', items.length, created_by]
    );

    const batch = await getQuery('SELECT * FROM batches WHERE id = ?', [batchId]);
    res.json(batch);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/batches/:id/receive', async (req, res) => {
  try {
    const { received_items, created_by } = req.body;
    const batchId = req.params.id;

    const batch = await getQuery('SELECT * FROM batches WHERE id = ?', [batchId]);
    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }
    if (batch.status === 'completed') {
      return res.status(400).json({ error: '该批次已完成' });
    }

    const allItems = await allQuery('SELECT * FROM batch_items WHERE batch_id = ?', [batchId]);
    
    if (received_items.length > allItems.length) {
      return res.status(400).json({ error: '回库数量不能超过送洗数量' });
    }

    for (const itemId of received_items) {
      await runQuery(
        'UPDATE batch_items SET status = ? WHERE batch_id = ? AND linen_id = ?',
        ['received', batchId, itemId]
      );
      
      await runQuery(
        'UPDATE linens SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['in_stock', itemId]
      );
    }

    const missingItems = allItems.filter(item => !received_items.includes(item.linen_id));
    for (const item of missingItems) {
      await runQuery(
        'UPDATE batch_items SET status = ? WHERE batch_id = ? AND linen_id = ?',
        ['missing', batchId, item.linen_id]
      );
      
      await runQuery(
        'UPDATE linens SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['missing', item.linen_id]
      );
    }

    await runQuery(
      'UPDATE batches SET status = ?, receive_quantity = ?, receive_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['completed', received_items.length, batchId]
    );

    await runQuery(
      'INSERT INTO batch_timeline (id, batch_id, action, description, quantity, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [uuidv4(), batchId, 'receive', '验收入库', received_items.length, created_by]
    );

    if (missingItems.length > 0) {
      await runQuery(
        'INSERT INTO batch_timeline (id, batch_id, action, description, quantity, created_by) VALUES (?, ?, ?, ?, ?, ?)',
        [uuidv4(), batchId, 'missing', '标记丢失', missingItems.length, created_by]
      );
    }

    const updatedBatch = await getQuery('SELECT * FROM batches WHERE id = ?', [batchId]);
    res.json(updatedBatch);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/claims', async (req, res) => {
  try {
    const claims = await allQuery(`
      SELECT c.*, l.type as linen_type, l.barcode, b.batch_no 
      FROM claims c 
      LEFT JOIN linens l ON c.linen_id = l.id 
      LEFT JOIN batches b ON c.batch_id = b.id 
      ORDER BY c.created_at DESC
    `);
    res.json(claims);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/claims', async (req, res) => {
  try {
    const { linen_id, batch_id, amount, reason } = req.body;

    const linen = await getQuery('SELECT * FROM linens WHERE id = ?', [linen_id]);
    if (!linen) {
      return res.status(404).json({ error: '布草不存在' });
    }

    const existingClaim = await getQuery('SELECT * FROM claims WHERE linen_id = ? AND status != "cancelled"', [linen_id]);
    if (existingClaim) {
      return res.status(400).json({ error: '该布草已有未完成的赔付记录' });
    }

    const claimId = uuidv4();
    await runQuery(
      'INSERT INTO claims (id, linen_id, batch_id, amount, reason, status) VALUES (?, ?, ?, ?, ?, ?)',
      [claimId, linen_id, batch_id, amount, reason, 'completed']
    );

    await runQuery(
      'UPDATE linens SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['claimed', linen_id]
    );

    if (batch_id) {
      await runQuery(
        'INSERT INTO batch_timeline (id, batch_id, action, description, quantity, created_by) VALUES (?, ?, ?, ?, ?, ?)',
        [uuidv4(), batch_id, 'claim', `赔付: ${reason}`, 1, 'system']
      );
    }

    const claim = await getQuery(`
      SELECT c.*, l.type as linen_type, l.barcode, b.batch_no 
      FROM claims c 
      LEFT JOIN linens l ON c.linen_id = l.id 
      LEFT JOIN batches b ON c.batch_id = b.id 
      WHERE c.id = ?
    `, [claimId]);
    res.json(claim);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/linens/:id/restore', async (req, res) => {
  try {
    const linenId = req.params.id;
    
    const linen = await getQuery('SELECT * FROM linens WHERE id = ?', [linenId]);
    if (!linen) {
      return res.status(404).json({ error: '布草不存在' });
    }
    
    if (linen.status !== 'claimed') {
      return res.status(400).json({ error: '只有已赔付的布草才能恢复入库' });
    }

    const claim = await getQuery('SELECT * FROM claims WHERE linen_id = ? AND status = "completed" ORDER BY created_at DESC LIMIT 1', [linenId]);
    if (claim) {
      await runQuery('UPDATE claims SET status = "cancelled" WHERE id = ?', [claim.id]);
    }

    await runQuery(
      'UPDATE linens SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['in_stock', linenId]
    );

    const updatedLinen = await getQuery('SELECT l.*, r.name as room_name FROM linens l LEFT JOIN rooms r ON l.room_id = r.id WHERE l.id = ?', [linenId]);
    res.json(updatedLinen);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/inventory', async (req, res) => {
  try {
    const inventory = await allQuery(`
      SELECT 
        r.id as room_id,
        r.name as room_name,
        r.safe_stock,
        l.type,
        COUNT(l.id) as count,
        CASE WHEN COUNT(l.id) < r.safe_stock THEN 1 ELSE 0 END as is_low
      FROM rooms r
      LEFT JOIN linens l ON r.id = l.room_id AND l.status = 'in_stock'
      GROUP BY r.id, l.type
      ORDER BY r.name, l.type
    `);
    res.json(inventory);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/linen-types', (req, res) => {
  res.json(['床单', '被罩', '枕套', '浴巾', '毛巾', '地巾']);
});

initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
});
