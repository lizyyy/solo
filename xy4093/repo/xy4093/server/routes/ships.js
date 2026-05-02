import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getAll, getOne, runQuery } from '../database/db.js';
import { RulesEngine } from '../services/rulesEngine.js';

const router = Router();

router.get('/', (req, res) => {
  try {
    const ships = getAll(`
      SELECT s.*,
        (s.capacity - s.current_load) as available_slots
      FROM ships s
      ORDER BY s.name
    `);
    res.json({ success: true, data: ships });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/available', (req, res) => {
  try {
    const ships = getAll(`
      SELECT s.*,
        (s.capacity - s.current_load) as available_slots
      FROM ships s
      WHERE s.status = 'available' AND s.current_load < s.capacity
      ORDER BY s.capacity DESC
    `);
    res.json({ success: true, data: ships, count: ships.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const ship = getOne(`
      SELECT s.*,
        (s.capacity - s.current_load) as available_slots
      FROM ships s
      WHERE s.id = ?
    `, [req.params.id]);
    
    if (!ship) {
      return res.status(404).json({ success: false, error: '船班不存在' });
    }

    const batches = getAll(`
      SELECT eb.*, COUNT(g.id) as guest_count
      FROM evacuation_batches eb
      LEFT JOIN guests g ON g.evacuation_batch_id = eb.id
      WHERE eb.ship_id = ?
      GROUP BY eb.id
      ORDER BY eb.batch_number
    `, [req.params.id]);

    res.json({ success: true, data: { ...ship, batches } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { name, capacity, departure_time, estimated_arrival } = req.body;
    
    if (!name || !capacity) {
      return res.status(400).json({ success: false, error: '船名和容量不能为空' });
    }

    if (capacity <= 0) {
      return res.status(400).json({ success: false, error: '容量必须大于0' });
    }

    const id = uuidv4();
    runQuery(`
      INSERT INTO ships (id, name, capacity, current_load, status, departure_time, estimated_arrival)
      VALUES (?, ?, ?, 0, 'available', ?, ?)
    `, [id, name, capacity, departure_time || null, estimated_arrival || null]);

    const newShip = getOne('SELECT * FROM ships WHERE id = ?', [id]);
    res.json({ success: true, data: newShip });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const { name, capacity, status, current_load, departure_time, estimated_arrival } = req.body;
    
    const existing = getOne('SELECT * FROM ships WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ success: false, error: '船班不存在' });
    }

    if (capacity !== undefined && capacity <= 0) {
      return res.status(400).json({ success: false, error: '容量必须大于0' });
    }

    if (current_load !== undefined && capacity !== undefined && current_load > capacity) {
      return res.status(400).json({ success: false, error: '当前载客量不能超过容量' });
    }

    runQuery(`
      UPDATE ships SET
        name = COALESCE(?, name),
        capacity = COALESCE(?, capacity),
        status = COALESCE(?, status),
        current_load = COALESCE(?, current_load),
        departure_time = ?,
        estimated_arrival = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      name, capacity, status, current_load,
      departure_time === undefined ? existing.departure_time : departure_time,
      estimated_arrival === undefined ? existing.estimated_arrival : estimated_arrival,
      req.params.id
    ]);

    const updatedShip = getOne(`
      SELECT s.*, (s.capacity - s.current_load) as available_slots
      FROM ships s WHERE s.id = ?
    `, [req.params.id]);

    res.json({ success: true, data: updatedShip });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const ship = getOne('SELECT * FROM ships WHERE id = ?', [req.params.id]);
    if (!ship) {
      return res.status(404).json({ success: false, error: '船班不存在' });
    }

    const batches = getAll(
      'SELECT COUNT(*) as count FROM evacuation_batches WHERE ship_id = ? AND status != "completed"',
      [req.params.id]
    );
    if (batches[0].count > 0) {
      return res.status(400).json({ 
        success: false, 
        error: `该船班还有 ${batches[0].count} 个未完成的撤离批次，无法删除` 
      });
    }

    runQuery('DELETE FROM ships WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: '船班已删除' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/batch', (req, res) => {
  try {
    const { ships } = req.body;
    
    if (!ships || !Array.isArray(ships)) {
      return res.status(400).json({ success: false, error: '参数错误' });
    }

    const results = { success: [], failed: [] };

    for (const shipData of ships) {
      try {
        const { name, capacity, departure_time, estimated_arrival } = shipData;
        
        if (!name || !capacity) {
          results.failed.push({ name: shipData.name || '未知', error: '船名和容量不能为空' });
          continue;
        }

        if (capacity <= 0) {
          results.failed.push({ name, error: '容量必须大于0' });
          continue;
        }

        const id = uuidv4();
        runQuery(`
          INSERT INTO ships (id, name, capacity, current_load, status, departure_time, estimated_arrival)
          VALUES (?, ?, ?, 0, 'available', ?, ?)
        `, [id, name, capacity, departure_time || null, estimated_arrival || null]);

        results.success.push({ id, name, capacity });
      } catch (error) {
        results.failed.push({ name: shipData.name, error: error.message });
      }
    }

    res.json({ 
      success: true, 
      data: results,
      summary: `成功导入 ${results.success.length} 艘船，失败 ${results.failed.length} 艘`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
