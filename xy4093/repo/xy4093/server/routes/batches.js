import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getAll, getOne, runQuery, getDatabase } from '../database/db.js';
import { Scheduler } from '../services/scheduler.js';
import { RulesEngine } from '../services/rulesEngine.js';

const router = Router();

router.get('/', (req, res) => {
  try {
    const { status } = req.query;
    
    let query = `
      SELECT eb.*, s.name as ship_name, s.capacity as ship_capacity
      FROM evacuation_batches eb
      LEFT JOIN ships s ON eb.ship_id = s.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ' AND eb.status = ?';
      params.push(status);
    }
    query += ' ORDER BY eb.batch_number';

    const batches = getAll(query, params);
    
    for (const batch of batches) {
      const guests = getAll(`
        SELECT g.*, r.room_number
        FROM guests g
        LEFT JOIN rooms r ON g.room_id = r.id
        WHERE g.evacuation_batch_id = ?
        ORDER BY 
          CASE WHEN g.is_elderly = 1 THEN 1 
               WHEN g.is_child = 1 THEN 2 
               WHEN g.has_disability = 1 THEN 3 
               ELSE 4 END
      `, [batch.id]);
      
      batch.guests = guests.map(g => ({
        ...g,
        priority: RulesEngine.validatePriority(g)
      }));
    }

    res.json({ success: true, data: batches });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const batch = getOne(`
      SELECT eb.*, s.name as ship_name, s.capacity as ship_capacity
      FROM evacuation_batches eb
      LEFT JOIN ships s ON eb.ship_id = s.id
      WHERE eb.id = ?
    `, [req.params.id]);
    
    if (!batch) {
      return res.status(404).json({ success: false, error: '撤离批次不存在' });
    }

    const guests = getAll(`
      SELECT g.*, r.room_number
      FROM guests g
      LEFT JOIN rooms r ON g.room_id = r.id
      WHERE g.evacuation_batch_id = ?
      ORDER BY 
        CASE WHEN g.is_elderly = 1 THEN 1 
             WHEN g.is_child = 1 THEN 2 
             WHEN g.has_disability = 1 THEN 3 
             ELSE 4 END
    `, [req.params.id]);

    batch.guests = guests.map(g => ({
      ...g,
      priority: RulesEngine.validatePriority(g)
    }));

    res.json({ success: true, data: batch });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { batch_number, ship_id, priority, max_capacity, scheduled_time } = req.body;
    
    if (batch_number === undefined) {
      const maxBatch = getOne('SELECT MAX(batch_number) as max FROM evacuation_batches');
      batch_number = (maxBatch?.max || 0) + 1;
    }

    const existing = getOne('SELECT * FROM evacuation_batches WHERE batch_number = ?', [batch_number]);
    if (existing) {
      return res.status(400).json({ success: false, error: '批次号已存在' });
    }

    const id = uuidv4();
    const ship = ship_id ? getOne('SELECT * FROM ships WHERE id = ?', [ship_id]) : null;
    const capacity = max_capacity || ship?.capacity || 20;

    runQuery(`
      INSERT INTO evacuation_batches (id, batch_number, ship_id, priority, max_capacity, scheduled_time, status, guest_count)
      VALUES (?, ?, ?, ?, ?, ?, 'planned', 0)
    `, [id, batch_number, ship_id || null, priority || 'normal', capacity, scheduled_time || null]);

    const newBatch = getOne(`
      SELECT eb.*, s.name as ship_name
      FROM evacuation_batches eb
      LEFT JOIN ships s ON eb.ship_id = s.id
      WHERE eb.id = ?
    `, [id]);

    res.json({ success: true, data: newBatch });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const { batch_number, ship_id, priority, status, max_capacity, scheduled_time } = req.body;
    
    const existing = getOne('SELECT * FROM evacuation_batches WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ success: false, error: '撤离批次不存在' });
    }

    if (batch_number !== undefined && batch_number !== existing.batch_number) {
      const duplicate = getOne(
        'SELECT * FROM evacuation_batches WHERE batch_number = ? AND id != ?',
        [batch_number, req.params.id]
      );
      if (duplicate) {
        return res.status(400).json({ success: false, error: '批次号已存在' });
      }
    }

    runQuery(`
      UPDATE evacuation_batches SET
        batch_number = COALESCE(?, batch_number),
        ship_id = ?,
        priority = COALESCE(?, priority),
        status = COALESCE(?, status),
        max_capacity = COALESCE(?, max_capacity),
        scheduled_time = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      batch_number,
      ship_id === undefined ? existing.ship_id : ship_id,
      priority,
      status,
      max_capacity,
      scheduled_time === undefined ? existing.scheduled_time : scheduled_time,
      req.params.id
    ]);

    const updatedBatch = getOne(`
      SELECT eb.*, s.name as ship_name
      FROM evacuation_batches eb
      LEFT JOIN ships s ON eb.ship_id = s.id
      WHERE eb.id = ?
    `, [req.params.id]);

    res.json({ success: true, data: updatedBatch });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/start', (req, res) => {
  try {
    const batch = getOne('SELECT * FROM evacuation_batches WHERE id = ?', [req.params.id]);
    if (!batch) {
      return res.status(404).json({ success: false, error: '撤离批次不存在' });
    }

    if (batch.status === 'completed') {
      return res.status(400).json({ success: false, error: '该批次已完成' });
    }

    runQuery(`
      UPDATE evacuation_batches SET status = 'in_progress', updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `, [req.params.id]);

    const updatedBatch = getOne(`
      SELECT eb.*, s.name as ship_name
      FROM evacuation_batches eb
      LEFT JOIN ships s ON eb.ship_id = s.id
      WHERE eb.id = ?
    `, [req.params.id]);

    res.json({ success: true, data: updatedBatch, message: '批次已开始' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/complete', (req, res) => {
  try {
    const batch = getOne('SELECT * FROM evacuation_batches WHERE id = ?', [req.params.id]);
    if (!batch) {
      return res.status(404).json({ success: false, error: '撤离批次不存在' });
    }

    const db = getDatabase();
    const transaction = db.transaction(() => {
      runQuery(`
        UPDATE guests SET is_evacuated = 1, updated_at = CURRENT_TIMESTAMP
        WHERE evacuation_batch_id = ? AND is_evacuated = 0
      `, [req.params.id]);

      const guests = getAll(
        'SELECT DISTINCT room_id FROM guests WHERE evacuation_batch_id = ?',
        [req.params.id]
      );

      for (const guest of guests) {
        if (guest.room_id) {
          const remaining = getOne(
            'SELECT COUNT(*) as count FROM guests WHERE room_id = ? AND is_evacuated = 0',
            [guest.room_id]
          );
          if (remaining.count === 0) {
            runQuery(
              'UPDATE rooms SET is_evacuated = 1, is_occupied = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
              [guest.room_id]
            );
          }
        }
      }

      runQuery(`
        UPDATE evacuation_batches SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `, [req.params.id]);
    });

    transaction();

    const updatedBatch = getOne(`
      SELECT eb.*, s.name as ship_name
      FROM evacuation_batches eb
      LEFT JOIN ships s ON eb.ship_id = s.id
      WHERE eb.id = ?
    `, [req.params.id]);

    res.json({ success: true, data: updatedBatch, message: '批次已完成' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const batch = getOne('SELECT * FROM evacuation_batches WHERE id = ?', [req.params.id]);
    if (!batch) {
      return res.status(404).json({ success: false, error: '撤离批次不存在' });
    }

    if (batch.status !== 'planned') {
      return res.status(400).json({ 
        success: false, 
        error: '只能删除计划中的批次，进行中或已完成的批次不可删除' 
      });
    }

    const guests = getAll(
      'SELECT COUNT(*) as count FROM guests WHERE evacuation_batch_id = ?',
      [req.params.id]
    );
    if (guests[0].count > 0) {
      return res.status(400).json({ 
        success: false, 
        error: `该批次还有 ${guests[0].count} 名住客，请先移除后再删除` 
      });
    }

    runQuery('DELETE FROM evacuation_batches WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: '撤离批次已删除' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/generate-plan', (req, res) => {
  try {
    const { useShips = true, batchSize = 20, priorityFirst = true } = req.body;
    
    const plan = Scheduler.generateEvacuationPlan({ useShips, batchSize, priorityFirst });
    
    res.json({ 
      success: true, 
      data: plan,
      message: plan.batches.length > 0 
        ? `已生成 ${plan.batches.length} 个撤离批次` 
        : '没有需要撤离的住客'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/save-plan', (req, res) => {
  try {
    const { plan } = req.body;
    
    if (!plan || !plan.batches) {
      return res.status(400).json({ success: false, error: '撤离计划数据不完整' });
    }

    const result = Scheduler.saveEvacuationPlan(plan);
    
    res.json({ 
      success: true, 
      data: result,
      message: `已保存 ${plan.batches.length} 个撤离批次`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
