const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const businessRules = require('../services/businessRules');

const generateAdjustmentNo = () => {
  const now = new Date();
  const dateStr = now.getFullYear().toString() + 
    (now.getMonth() + 1).toString().padStart(2, '0') + 
    now.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `ADJ${dateStr}${random}`;
};

router.post('/', (req, res) => {
  const { title, type, description, effectTime, expireTime, items, storeIds, createdBy } = req.body;

  if (!title || !type || !effectTime || !items || !items.length || !storeIds || !storeIds.length) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  try {
    for (const item of items) {
      businessRules.checkDuplicateAdjustment(item.productId, effectTime);
    }

    const adjustmentId = uuidv4();
    const adjustmentNo = generateAdjustmentNo();

    db.run(`
      INSERT INTO price_adjustments (id, adjustment_no, type, title, description, effect_time, expire_time, created_by, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft')
    `, [adjustmentId, adjustmentNo, type, title, description, effectTime, expireTime || null, createdBy]);

    const adjItemIds = [];
    for (const item of items) {
      const itemId = uuidv4();
      db.run(`
        INSERT INTO price_adjustment_items (id, adjustment_id, product_id, original_price, new_price)
        VALUES (?, ?, ?, ?, ?)
      `, [itemId, adjustmentId, item.productId, item.originalPrice, item.newPrice]);
      adjItemIds.push(itemId);
    }

    const taskIds = [];
    for (const storeId of storeIds) {
      const existingTask = db.get(`
        SELECT id FROM store_tasks WHERE adjustment_id = ? AND store_id = ?
      `, [adjustmentId, storeId]);

      let taskId;
      if (existingTask) {
        taskId = existingTask.id;
      } else {
        taskId = uuidv4();
        db.run(`
          INSERT INTO store_tasks (id, adjustment_id, store_id, status)
          VALUES (?, ?, ?, 'pending')
        `, [taskId, adjustmentId, storeId]);
        taskIds.push(taskId);
      }

      for (const adjItemId of adjItemIds) {
        db.run(`
          INSERT INTO task_items (id, store_task_id, adjustment_item_id, status)
          VALUES (?, ?, ?, 'pending')
        `, [uuidv4(), taskId, adjItemId]);
      }
    }

    res.json({ id: adjustmentId, adjustmentNo });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/', (req, res) => {
  const { type, status, regionId, keyword } = req.query;
  
  let whereClause = '1=1';
  const params = [];

  if (type) {
    whereClause += ' AND pa.type = ?';
    params.push(type);
  }

  if (status) {
    whereClause += ' AND pa.status = ?';
    params.push(status);
  }

  if (keyword) {
    whereClause += ' AND (pa.title LIKE ? OR pa.adjustment_no LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`);
  }

  let regionFilter = '';
  let regionParams = [];
  if (regionId) {
    regionFilter = `AND EXISTS (
      SELECT 1 FROM store_tasks st 
      JOIN stores s ON st.store_id = s.id 
      WHERE st.adjustment_id = pa.id AND s.region_id = ?
    )`;
    regionParams.push(regionId);
  }

  const adjustments = db.all(`
    SELECT pa.*, u.name as creator_name,
      (SELECT COUNT(*) FROM store_tasks WHERE adjustment_id = pa.id) as total_stores,
      (SELECT COUNT(*) FROM store_tasks WHERE adjustment_id = pa.id AND status = 'confirmed') as confirmed_stores,
      (SELECT COUNT(*) FROM store_tasks WHERE adjustment_id = pa.id AND status = 'pending') as pending_stores,
      (SELECT COUNT(*) FROM price_adjustment_items WHERE adjustment_id = pa.id) as total_items
    FROM price_adjustments pa
    LEFT JOIN users u ON pa.created_by = u.id
    WHERE ${whereClause} ${regionFilter}
    ORDER BY pa.created_at DESC
  `, [...params, ...regionParams]);

  res.json(adjustments);
});

router.get('/:id', (req, res) => {
  const { id } = req.params;

  const adjustment = db.get(`
    SELECT pa.*, u.name as creator_name
    FROM price_adjustments pa
    LEFT JOIN users u ON pa.created_by = u.id
    WHERE pa.id = ?
  `, [id]);

  if (!adjustment) {
    return res.status(404).json({ error: '调价单不存在' });
  }

  const items = db.all(`
    SELECT pai.*, p.sku, p.name as product_name, p.category, p.unit
    FROM price_adjustment_items pai
    JOIN products p ON pai.product_id = p.id
    WHERE pai.adjustment_id = ?
  `, [id]);

  const storeTasks = db.all(`
    SELECT st.*, s.name as store_name, s.code as store_code, s.region_id, r.name as region_name
    FROM store_tasks st
    JOIN stores s ON st.store_id = s.id
    LEFT JOIN regions r ON s.region_id = r.id
    WHERE st.adjustment_id = ?
    ORDER BY r.name, s.name
  `, [id]);

  res.json({ ...adjustment, items, storeTasks });
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { title, type, description, effectTime, expireTime, items, storeIds } = req.body;

  try {
    businessRules.checkModifyAfterConfirm(id);

    const adjustment = db.get('SELECT * FROM price_adjustments WHERE id = ?', [id]);
    if (!adjustment) {
      throw new Error('调价单不存在');
    }

    if (adjustment.status !== 'draft') {
      throw new Error('只能修改草稿状态的调价单');
    }

    if (items && items.length) {
      for (const item of items) {
        businessRules.checkDuplicateAdjustment(item.productId, effectTime || adjustment.effect_time, id);
      }
    }

    db.run(`
      UPDATE price_adjustments 
      SET title = ?, type = ?, description = ?, effect_time = ?, expire_time = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [title || adjustment.title, type || adjustment.type, description || null, effectTime || adjustment.effect_time, expireTime || adjustment.expire_time || null, id]);

    if (items) {
      db.run('DELETE FROM price_adjustment_items WHERE adjustment_id = ?', [id]);
      
      const taskItemsToDelete = db.all(`
        SELECT id FROM store_tasks WHERE adjustment_id = ?
      `, [id]);
      
      for (const task of taskItemsToDelete) {
        db.run('DELETE FROM task_items WHERE store_task_id = ?', [task.id]);
      }

      const adjItemIds = [];
      for (const item of items) {
        const itemId = uuidv4();
        db.run(`
          INSERT INTO price_adjustment_items (id, adjustment_id, product_id, original_price, new_price)
          VALUES (?, ?, ?, ?, ?)
        `, [itemId, id, item.productId, item.originalPrice, item.newPrice]);
        adjItemIds.push(itemId);
      }

      const tasks = db.all('SELECT id FROM store_tasks WHERE adjustment_id = ?', [id]);
      for (const task of tasks) {
        for (const adjItemId of adjItemIds) {
          db.run(`
            INSERT INTO task_items (id, store_task_id, adjustment_item_id, status)
            VALUES (?, ?, ?, 'pending')
          `, [uuidv4(), task.id, adjItemId]);
        }
      }
    }

    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:id/publish', (req, res) => {
  const { id } = req.params;

  try {
    const adjustment = db.get('SELECT * FROM price_adjustments WHERE id = ?', [id]);
    if (!adjustment) {
      return res.status(404).json({ error: '调价单不存在' });
    }

    if (adjustment.status !== 'draft') {
      return res.status(400).json({ error: '只能发布草稿状态的调价单' });
    }

    db.run(`
      UPDATE price_adjustments 
      SET status = 'published', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [id]);

    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
