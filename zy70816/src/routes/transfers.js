const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.post('/', async (req, res) => {
  try {
    const { batch_no, from_store_code, to_store_code, quantity, reason, created_by } = req.body;

    const batch = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM batches WHERE batch_no = ?', [batch_no], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }

    const fromStore = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM stores WHERE store_code = ?', [from_store_code], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!fromStore) {
      return res.status(404).json({ error: '调出门店不存在' });
    }

    const toStore = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM stores WHERE store_code = ?', [to_store_code], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!toStore) {
      return res.status(404).json({ error: '调入门店不存在' });
    }

    const inventory = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM inventory WHERE batch_id = ? AND store_id = ?', [batch.id, fromStore.id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!inventory || inventory.quantity < quantity) {
      return res.status(400).json({ error: '调出门店库存不足' });
    }

    const transfer_no = `TF${Date.now()}`;

    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO transfers (transfer_no, batch_id, from_store_id, to_store_id, quantity, reason, status, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [transfer_no, batch.id, fromStore.id, toStore.id, quantity, reason, 'pending', created_by || '系统'],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });

    res.status(201).json({
      message: '调拨单已创建',
      transfer_no,
      batch_no,
      from_store: fromStore.store_name,
      to_store: toStore.store_name,
      quantity
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:transfer_no/confirm', async (req, res) => {
  try {
    const { confirmed_by } = req.body;

    const transfer = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM transfers WHERE transfer_no = ?', [req.params.transfer_no], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!transfer) {
      return res.status(404).json({ error: '调拨单不存在' });
    }

    if (transfer.status !== 'pending') {
      return res.status(400).json({ error: '该调拨单已处理' });
    }

    db.serialize(async () => {
      try {
        await new Promise((resolve, reject) => {
          db.run('BEGIN TRANSACTION', (err) => {
            if (err) reject(err);
            else resolve();
          });
        });

        await new Promise((resolve, reject) => {
          db.run(
            `UPDATE inventory SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP
             WHERE batch_id = ? AND store_id = ?`,
            [transfer.quantity, transfer.batch_id, transfer.from_store_id],
            function(err) {
              if (err) reject(err);
              else resolve();
            }
          );
        });

        const toInventory = await new Promise((resolve, reject) => {
          db.get(
            'SELECT * FROM inventory WHERE batch_id = ? AND store_id = ?',
            [transfer.batch_id, transfer.to_store_id],
            (err, row) => {
              if (err) reject(err);
              else resolve(row);
            }
          );
        });

        if (toInventory) {
          await new Promise((resolve, reject) => {
            db.run(
              `UPDATE inventory SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP
               WHERE batch_id = ? AND store_id = ?`,
              [transfer.quantity, transfer.batch_id, transfer.to_store_id],
              function(err) {
                if (err) reject(err);
                else resolve();
              }
            );
          });
        } else {
          await new Promise((resolve, reject) => {
            db.run(
              `INSERT INTO inventory (batch_id, store_id, quantity) VALUES (?, ?, ?)`,
              [transfer.batch_id, transfer.to_store_id, transfer.quantity],
              function(err) {
                if (err) reject(err);
                else resolve();
              }
            );
          });
        }

        await new Promise((resolve, reject) => {
          db.run(
            `UPDATE transfers SET status = 'confirmed', confirmed_by = ?, confirmed_at = CURRENT_TIMESTAMP
             WHERE transfer_no = ?`,
            [confirmed_by || '系统', req.params.transfer_no],
            function(err) {
              if (err) reject(err);
              else resolve();
            }
          );
        });

        await new Promise((resolve, reject) => {
          db.run('COMMIT', (err) => {
            if (err) reject(err);
            else resolve();
          });
        });

        res.json({ message: '调拨已确认', transfer_no: req.params.transfer_no });
      } catch (err) {
        await new Promise((resolve) => {
          db.run('ROLLBACK', () => resolve());
        });
        throw err;
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const transfers = await new Promise((resolve, reject) => {
      db.all(
        `SELECT t.*, b.batch_no, p.product_name,
                s1.store_name as from_store, s2.store_name as to_store
         FROM transfers t
         LEFT JOIN batches b ON t.batch_id = b.id
         LEFT JOIN products p ON b.product_id = p.id
         LEFT JOIN stores s1 ON t.from_store_id = s1.id
         LEFT JOIN stores s2 ON t.to_store_id = s2.id
         ORDER BY t.created_at DESC`,
        [],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    res.json(transfers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
