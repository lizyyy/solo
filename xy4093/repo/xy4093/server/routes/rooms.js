import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getAll, getOne, runQuery } from '../database/db.js';
import { RulesEngine } from '../services/rulesEngine.js';

const router = Router();

router.get('/', (req, res) => {
  try {
    const rooms = getAll(`
      SELECT r.*,
        (SELECT COUNT(*) FROM guests WHERE room_id = r.id AND is_evacuated = 0) as current_guests
      FROM rooms r
      ORDER BY r.room_number
    `);
    res.json({ success: true, data: rooms });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const room = getOne('SELECT * FROM rooms WHERE id = ?', [req.params.id]);
    if (!room) {
      return res.status(404).json({ success: false, error: '房间不存在' });
    }
    
    const guests = getAll(`
      SELECT * FROM guests WHERE room_id = ?
      ORDER BY is_evacuated
    `, [req.params.id]);
    
    res.json({ success: true, data: { ...room, guests } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { room_number, floor, capacity } = req.body;
    
    if (!room_number) {
      return res.status(400).json({ success: false, error: '房间号不能为空' });
    }

    const existing = getOne('SELECT * FROM rooms WHERE room_number = ?', [room_number]);
    if (existing) {
      return res.status(400).json({ success: false, error: '房间号已存在' });
    }

    const id = uuidv4();
    runQuery(`
      INSERT INTO rooms (id, room_number, floor, capacity, status, is_occupied)
      VALUES (?, ?, ?, ?, 'available', 0)
    `, [id, room_number, floor || null, capacity || 2]);

    const newRoom = getOne('SELECT * FROM rooms WHERE id = ?', [id]);
    res.json({ success: true, data: newRoom });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const { room_number, floor, capacity, status, is_occupied, is_evacuated } = req.body;
    
    const existing = getOne('SELECT * FROM rooms WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ success: false, error: '房间不存在' });
    }

    if (room_number && room_number !== existing.room_number) {
      const duplicate = getOne('SELECT * FROM rooms WHERE room_number = ? AND id != ?', [room_number, req.params.id]);
      if (duplicate) {
        return res.status(400).json({ success: false, error: '房间号已存在' });
      }
    }

    runQuery(`
      UPDATE rooms 
      SET room_number = COALESCE(?, room_number),
          floor = COALESCE(?, floor),
          capacity = COALESCE(?, capacity),
          status = COALESCE(?, status),
          is_occupied = COALESCE(?, is_occupied),
          is_evacuated = COALESCE(?, is_evacuated),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [room_number, floor, capacity, status, is_occupied, is_evacuated, req.params.id]);

    const updatedRoom = getOne('SELECT * FROM rooms WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: updatedRoom });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/seal-window', (req, res) => {
  try {
    const result = RulesEngine.validateRoomClearForSeal(req.params.id);
    if (!result.valid) {
      return res.status(400).json({ success: false, error: result.error, details: result });
    }

    runQuery(`
      UPDATE rooms 
      SET is_window_sealed = 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [req.params.id]);

    const updatedRoom = getOne('SELECT * FROM rooms WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: updatedRoom, message: '窗户已封' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const room = getOne('SELECT * FROM rooms WHERE id = ?', [req.params.id]);
    if (!room) {
      return res.status(404).json({ success: false, error: '房间不存在' });
    }

    const guests = getAll('SELECT COUNT(*) as count FROM guests WHERE room_id = ?', [req.params.id]);
    if (guests[0].count > 0) {
      return res.status(400).json({ success: false, error: '该房间还有住客，无法删除' });
    }

    runQuery('DELETE FROM rooms WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: '房间已删除' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/batch', (req, res) => {
  try {
    const { rooms } = req.body;
    
    if (!rooms || !Array.isArray(rooms)) {
      return res.status(400).json({ success: false, error: '参数错误' });
    }

    const results = { success: [], failed: [] };

    for (const roomData of rooms) {
      try {
        const { room_number, floor, capacity } = roomData;
        
        if (!room_number) {
          results.failed.push({ room_number: '未知', error: '房间号不能为空' });
          continue;
        }

        const existing = getOne('SELECT * FROM rooms WHERE room_number = ?', [room_number]);
        if (existing) {
          results.failed.push({ room_number, error: '房间号已存在' });
          continue;
        }

        const id = uuidv4();
        runQuery(`
          INSERT INTO rooms (id, room_number, floor, capacity, status, is_occupied)
          VALUES (?, ?, ?, ?, 'available', 0)
        `, [id, room_number, floor || null, capacity || 2]);

        results.success.push({ id, room_number });
      } catch (error) {
        results.failed.push({ room_number: roomData.room_number, error: error.message });
      }
    }

    res.json({ 
      success: true, 
      data: results,
      summary: `成功导入 ${results.success.length} 间，失败 ${results.failed.length} 间`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
