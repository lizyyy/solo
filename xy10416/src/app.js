const express = require('express');
const bodyParser = require('body-parser');
const db = require('./db');
const app = express();
const PORT = 3002;

app.use(bodyParser.json());

function getBatchStats(batchId, callback) {
  db.get(`
    SELECT 
      lb.*,
      COALESCE(SUM(CASE WHEN wr.status = 'sent' THEN wr.send_quantity ELSE 0 END), 0) as in_wash,
      COALESCE(SUM(CASE WHEN wr.status = 'returned' THEN (wr.send_quantity - wr.return_quantity) ELSE 0 END), 0) as wash_shortage,
      COALESCE(SUM(ur.quantity), 0) - COALESCE(SUM(ur.returned_quantity), 0) as in_use,
      COALESCE(SUM(lr.quantity), 0) as total_loss
    FROM linen_batches lb
    LEFT JOIN wash_records wr ON lb.id = wr.batch_id
    LEFT JOIN usage_records ur ON lb.id = ur.batch_id AND ur.status = 'in_use'
    LEFT JOIN loss_records lr ON lb.id = lr.batch_id AND lr.status IN ('pending', 'confirmed')
    WHERE lb.id = ?
    GROUP BY lb.id
  `, [batchId], (err, row) => {
    if (err) return callback(err);
    if (!row) return callback(null, null);
    
    const consumed = (row.wash_shortage || 0) + (row.in_use || 0) + (row.total_loss || 0);
    const remaining = row.total_quantity - consumed;
    
    callback(null, { ...row, remaining: remaining, consumed: consumed });
  });
}

function hasUnreturnedWash(batchId, callback) {
  db.get(`
    SELECT COUNT(*) as count FROM wash_records 
    WHERE batch_id = ? AND status = 'sent'
  `, [batchId], (err, row) => {
    if (err) return callback(err);
    callback(null, row.count > 0);
  });
}

app.post('/api/batches', (req, res) => {
  const { batch_no, linen_type, total_quantity, received_date } = req.body;
  
  if (!batch_no || !linen_type || !total_quantity || !received_date) {
    return res.status(400).json({ error: '缺少必填字段: batch_no, linen_type, total_quantity, received_date' });
  }

  db.run(`
    INSERT INTO linen_batches (batch_no, linen_type, total_quantity, received_date)
    VALUES (?, ?, ?, ?)
  `, [batch_no, linen_type, total_quantity, received_date], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ error: '批次号已存在' });
      }
      return res.status(500).json({ error: err.message });
    }

    db.run(`
      INSERT OR REPLACE INTO inventory (linen_type, total_stock, in_stock)
      SELECT 
        ?,
        COALESCE((SELECT total_stock FROM inventory WHERE linen_type = ?), 0) + ?,
        COALESCE((SELECT in_stock FROM inventory WHERE linen_type = ?), 0) + ?
    `, [linen_type, linen_type, total_quantity, linen_type, total_quantity], (invErr) => {
      if (invErr) return res.status(500).json({ error: invErr.message });
      res.status(201).json({ id: this.lastID, batch_no, linen_type, total_quantity, received_date });
    });
  });
});

app.post('/api/wash/send', (req, res) => {
  const { batch_id, send_quantity, send_date, wash_factory } = req.body;
  
  if (!batch_id || !send_quantity || !send_date) {
    return res.status(400).json({ error: '缺少必填字段: batch_id, send_quantity, send_date' });
  }

  getBatchStats(batch_id, (err, stats) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!stats) return res.status(404).json({ error: '批次不存在' });

    if (send_quantity > stats.remaining) {
      return res.status(400).json({ 
        error: `发送数量超过可用库存，可用: ${stats.remaining}, 请求: ${send_quantity}` 
      });
    }

    db.run(`
      INSERT INTO wash_records (batch_id, send_quantity, send_date, wash_factory)
      VALUES (?, ?, ?, ?)
    `, [batch_id, send_quantity, send_date, wash_factory], function(err) {
      if (err) return res.status(500).json({ error: err.message });

      db.run(`
        UPDATE inventory 
        SET in_stock = in_stock - ?,
            in_wash = in_wash + ?
        WHERE linen_type = ?
      `, [send_quantity, send_quantity, stats.linen_type], (invErr) => {
        if (invErr) return res.status(500).json({ error: invErr.message });
        res.status(201).json({ id: this.lastID, batch_id, send_quantity, send_date, status: 'sent' });
      });
    });
  });
});

app.post('/api/wash/return', (req, res) => {
  const { wash_record_id, return_quantity, return_date } = req.body;
  
  if (!wash_record_id || return_quantity === undefined || !return_date) {
    return res.status(400).json({ error: '缺少必填字段: wash_record_id, return_quantity, return_date' });
  }

  db.get('SELECT * FROM wash_records WHERE id = ?', [wash_record_id], (err, wash) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!wash) return res.status(404).json({ error: '洗涤记录不存在' });
    if (wash.status === 'returned') {
      return res.status(400).json({ error: '该洗涤批次已洗回，禁止重复提交' });
    }

    const shortage = wash.send_quantity - return_quantity;

    db.serialize(() => {
      db.run(`
        UPDATE wash_records 
        SET return_quantity = ?, return_date = ?, status = 'returned'
        WHERE id = ?
      `, [return_quantity, return_date, wash_record_id], (updateErr) => {
        if (updateErr) return res.status(500).json({ error: updateErr.message });

        db.get('SELECT linen_type FROM linen_batches WHERE id = ?', [wash.batch_id], (batchErr, batch) => {
          if (batchErr) return res.status(500).json({ error: batchErr.message });

          db.run(`
            UPDATE inventory 
            SET in_wash = in_wash - ?,
                in_stock = in_stock + ?,
                total_stock = total_stock - ?
            WHERE linen_type = ?
          `, [wash.send_quantity, return_quantity, shortage, batch.linen_type], (invErr) => {
            if (invErr) return res.status(500).json({ error: invErr.message });
            res.json({ 
              id: wash_record_id, 
              return_quantity, 
              return_date, 
              shortage,
              status: 'returned' 
            });
          });
        });
      });
    });
  });
});

app.post('/api/usage', (req, res) => {
  const { batch_id, room_no, quantity, usage_date } = req.body;
  
  if (!batch_id || !room_no || !quantity || !usage_date) {
    return res.status(400).json({ error: '缺少必填字段: batch_id, room_no, quantity, usage_date' });
  }

  hasUnreturnedWash(batch_id, (err, hasUnreturned) => {
    if (err) return res.status(500).json({ error: err.message });
    
    if (hasUnreturned) {
      return res.status(400).json({ error: '该批次有未洗回的洗涤记录，禁止领用' });
    }

    getBatchStats(batch_id, (statsErr, stats) => {
      if (statsErr) return res.status(500).json({ error: statsErr.message });
      if (!stats) return res.status(404).json({ error: '批次不存在' });

      if (quantity > stats.remaining) {
        return res.status(400).json({ 
          error: `领用数量超过可用库存，可用: ${stats.remaining}, 请求: ${quantity}` 
        });
      }

      db.run(`
        INSERT INTO usage_records (batch_id, room_no, quantity, usage_date)
        VALUES (?, ?, ?, ?)
      `, [batch_id, room_no, quantity, usage_date], function(err) {
        if (err) return res.status(500).json({ error: err.message });

        db.run(`
          UPDATE inventory 
          SET in_stock = in_stock - ?,
              in_use = in_use + ?
          WHERE linen_type = ?
        `, [quantity, quantity, stats.linen_type], (invErr) => {
          if (invErr) return res.status(500).json({ error: invErr.message });
          res.status(201).json({ id: this.lastID, batch_id, room_no, quantity, usage_date, status: 'in_use' });
        });
      });
    });
  });
});

app.post('/api/loss/apply', (req, res) => {
  const { batch_id, quantity, loss_type, reason, apply_date, room_no } = req.body;
  
  if (!batch_id || !quantity || !loss_type || !apply_date) {
    return res.status(400).json({ error: '缺少必填字段: batch_id, quantity, loss_type, apply_date' });
  }

  if (!['客损', '洗涤损耗', '仓库盘亏'].includes(loss_type)) {
    return res.status(400).json({ error: '报损类型必须是: 客损, 洗涤损耗, 仓库盘亏' });
  }

  getBatchStats(batch_id, (err, stats) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!stats) return res.status(404).json({ error: '批次不存在' });

    if (quantity > stats.remaining) {
      return res.status(400).json({ 
        error: `报损数量超过可用库存，可用: ${stats.remaining}, 请求: ${quantity}` 
      });
    }

    db.run(`
      INSERT INTO loss_records (batch_id, quantity, loss_type, reason, apply_date, room_no)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [batch_id, quantity, loss_type, reason, apply_date, room_no], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ 
        id: this.lastID, 
        batch_id, 
        quantity, 
        loss_type, 
        reason, 
        apply_date, 
        room_no,
        status: 'pending',
        compensate_confirmed: 'no'
      });
    });
  });
});

app.post('/api/loss/confirm', (req, res) => {
  const { loss_record_id, compensate_amount } = req.body;
  
  if (!loss_record_id) {
    return res.status(400).json({ error: '缺少必填字段: loss_record_id' });
  }

  db.get('SELECT * FROM loss_records WHERE id = ?', [loss_record_id], (err, loss) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!loss) return res.status(404).json({ error: '报损记录不存在' });
    if (loss.status === 'confirmed') {
      return res.status(400).json({ error: '该报损已确认' });
    }

    db.serialize(() => {
      db.run(`
        UPDATE loss_records 
        SET compensate_amount = ?, compensate_confirmed = 'yes', status = 'confirmed'
        WHERE id = ?
      `, [compensate_amount || 0, loss_record_id], (updateErr) => {
        if (updateErr) return res.status(500).json({ error: updateErr.message });

        db.get('SELECT linen_type FROM linen_batches WHERE id = ?', [loss.batch_id], (batchErr, batch) => {
          if (batchErr) return res.status(500).json({ error: batchErr.message });

          db.run(`
            UPDATE inventory 
            SET total_stock = total_stock - ?
            WHERE linen_type = ?
          `, [loss.quantity, batch.linen_type], (invErr) => {
            if (invErr) return res.status(500).json({ error: invErr.message });
            res.json({ 
              id: loss_record_id, 
              compensate_amount: compensate_amount || 0, 
              compensate_confirmed: 'yes',
              status: 'confirmed' 
            });
          });
        });
      });
    });
  });
});

app.post('/api/loss/close', (req, res) => {
  const { loss_record_id } = req.body;
  
  if (!loss_record_id) {
    return res.status(400).json({ error: '缺少必填字段: loss_record_id' });
  }

  db.get('SELECT * FROM loss_records WHERE id = ?', [loss_record_id], (err, loss) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!loss) return res.status(404).json({ error: '报损记录不存在' });
    
    if (loss.loss_type === '客损' && loss.compensate_confirmed !== 'yes') {
      return res.status(400).json({ error: '客损报损需先确认赔付才能关闭' });
    }

    db.run(`
      UPDATE loss_records SET status = 'closed' WHERE id = ?
    `, [loss_record_id], (updateErr) => {
      if (updateErr) return res.status(500).json({ error: updateErr.message });
      res.json({ id: loss_record_id, status: 'closed' });
    });
  });
});

app.get('/api/stats', (req, res) => {
  db.all(`
    SELECT 
      i.linen_type,
      i.total_stock,
      i.in_stock,
      i.in_wash,
      i.in_use,
      COALESCE(SUM(CASE WHEN lr.status IN ('confirmed', 'closed') THEN lr.quantity ELSE 0 END), 0) as total_loss,
      COALESCE(SUM(CASE WHEN lr.status IN ('confirmed', 'closed') THEN lr.compensate_amount ELSE 0 END), 0) as total_compensate
    FROM inventory i
    LEFT JOIN linen_batches lb ON i.linen_type = lb.linen_type
    LEFT JOIN loss_records lr ON lb.id = lr.batch_id
    GROUP BY i.linen_type
  `, (err, stats) => {
    if (err) return res.status(500).json({ error: err.message });

    const result = stats.map(s => {
      const lossRate = s.total_stock > 0 
        ? ((s.total_loss / (s.total_stock + s.total_loss)) * 100).toFixed(2) 
        : '0.00';
      return {
        linen_type: s.linen_type,
        total_stock: s.total_stock,
        in_stock: s.in_stock,
        in_wash: s.in_wash,
        in_use: s.in_use,
        available: s.in_stock,
        total_loss: s.total_loss,
        loss_rate: lossRate + '%',
        total_compensate: s.total_compensate
      };
    });

    db.all(`
      SELECT 
        lr.id,
        lb.linen_type,
        lr.quantity,
        lr.loss_type,
        lr.reason,
        lr.status,
        lr.compensate_confirmed
      FROM loss_records lr
      JOIN linen_batches lb ON lr.batch_id = lb.id
      WHERE lr.status = 'pending'
    `, (pendingErr, pending) => {
      if (pendingErr) return res.status(500).json({ error: pendingErr.message });
      
      res.json({
        inventory: result,
        pending_losses: pending
      });
    });
  });
});

app.get('/api/batches', (req, res) => {
  db.all('SELECT * FROM linen_batches ORDER BY created_at DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/wash-records', (req, res) => {
  db.all(`
    SELECT wr.*, lb.batch_no, lb.linen_type
    FROM wash_records wr
    JOIN linen_batches lb ON wr.batch_id = lb.id
    ORDER BY wr.created_at DESC
  `, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/loss-records', (req, res) => {
  db.all(`
    SELECT lr.*, lb.batch_no, lb.linen_type
    FROM loss_records lr
    JOIN linen_batches lb ON lr.batch_id = lb.id
    ORDER BY lr.created_at DESC
  `, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.listen(PORT, () => {
  console.log(`酒店布草报损 API 运行在 http://localhost:${PORT}`);
});
