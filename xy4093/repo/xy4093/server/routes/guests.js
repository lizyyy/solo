import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getAll, getOne, runQuery, getDatabase } from '../database/db.js';
import { RulesEngine } from '../services/rulesEngine.js';
import { Scheduler } from '../services/scheduler.js';

const router = Router();

router.get('/', (req, res) => {
  try {
    const { room_id, is_evacuated, is_elderly, is_child, has_disability } = req.query;
    
    let query = `
      SELECT g.*, r.room_number, eb.batch_number,
        CASE 
          WHEN g.is_elderly = 1 THEN '老人'
          WHEN g.is_child = 1 THEN '儿童'
          WHEN g.has_disability = 1 THEN '行动不便'
          ELSE '普通'
        END as priority_tag
      FROM guests g
      LEFT JOIN rooms r ON g.room_id = r.id
      LEFT JOIN evacuation_batches eb ON g.evacuation_batch_id = eb.id
      WHERE 1=1
    `;
    const params = [];

    if (room_id) {
      query += ' AND g.room_id = ?';
      params.push(room_id);
    }
    if (is_evacuated !== undefined) {
      query += ' AND g.is_evacuated = ?';
      params.push(is_evacuated === 'true' ? 1 : 0);
    }
    if (is_elderly === 'true') {
      query += ' AND g.is_elderly = 1';
    }
    if (is_child === 'true') {
      query += ' AND g.is_child = 1';
    }
    if (has_disability === 'true') {
      query += ' AND g.has_disability = 1';
    }

    query += ` ORDER BY 
      CASE WHEN g.is_elderly = 1 THEN 1 
           WHEN g.is_child = 1 THEN 2 
           WHEN g.has_disability = 1 THEN 3 
           ELSE 4 END,
      r.room_number, g.name`;

    const guests = getAll(query, params);
    res.json({ success: true, data: guests });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/priority', (req, res) => {
  try {
    const guests = RulesEngine.getPriorityGuests();
    res.json({ success: true, data: guests, count: guests.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const guest = getOne(`
      SELECT g.*, r.room_number, eb.batch_number
      FROM guests g
      LEFT JOIN rooms r ON g.room_id = r.id
      LEFT JOIN evacuation_batches eb ON g.evacuation_batch_id = eb.id
      WHERE g.id = ?
    `, [req.params.id]);
    
    if (!guest) {
      return res.status(404).json({ success: false, error: '住客不存在' });
    }

    const priority = RulesEngine.validatePriority(guest);
    res.json({ success: true, data: { ...guest, priority } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', (req, res) => {
  try {
    const {
      room_id, name, id_number, phone, age, gender,
      is_elderly, is_child, has_disability, nationality,
      checkin_date, checkout_date
    } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: '姓名不能为空' });
    }

    const id = uuidv4();
    const isElderly = is_elderly || (age && age >= 65) || 0;
    const isChild = is_child || (age && age < 18) || 0;

    runQuery(`
      INSERT INTO guests (
        id, room_id, name, id_number, phone, age, gender,
        is_elderly, is_child, has_disability, nationality,
        checkin_date, checkout_date, is_evacuated
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `, [
      id, room_id || null, name, id_number || null, phone || null,
      age || null, gender || null, isElderly, isChild,
      has_disability || 0, nationality || '中国',
      checkin_date || null, checkout_date || null
    ]);

    if (room_id) {
      runQuery(`
        UPDATE rooms SET is_occupied = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `, [room_id]);
    }

    const newGuest = getOne(`
      SELECT g.*, r.room_number
      FROM guests g
      LEFT JOIN rooms r ON g.room_id = r.id
      WHERE g.id = ?
    `, [id]);
    
    res.json({ success: true, data: newGuest });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const {
      room_id, name, id_number, phone, age, gender,
      is_elderly, is_child, has_disability, nationality,
      checkin_date, checkout_date, is_evacuated, evacuation_batch_id
    } = req.body;

    const existing = getOne('SELECT * FROM guests WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ success: false, error: '住客不存在' });
    }

    const isElderly = is_elderly !== undefined ? is_elderly : (age && age >= 65) || existing.is_elderly;
    const isChild = is_child !== undefined ? is_child : (age && age < 18) || existing.is_child;

    runQuery(`
      UPDATE guests SET
        room_id = COALESCE(?, room_id),
        name = COALESCE(?, name),
        id_number = COALESCE(?, id_number),
        phone = COALESCE(?, phone),
        age = COALESCE(?, age),
        gender = COALESCE(?, gender),
        is_elderly = COALESCE(?, is_elderly),
        is_child = COALESCE(?, is_child),
        has_disability = COALESCE(?, has_disability),
        nationality = COALESCE(?, nationality),
        checkin_date = COALESCE(?, checkin_date),
        checkout_date = COALESCE(?, checkout_date),
        is_evacuated = COALESCE(?, is_evacuated),
        evacuation_batch_id = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      room_id, name, id_number, phone, age, gender,
      isElderly, isChild, has_disability, nationality,
      checkin_date, checkout_date, is_evacuated,
      evacuation_batch_id === undefined ? existing.evacuation_batch_id : evacuation_batch_id,
      req.params.id
    ]);

    const updatedGuest = getOne(`
      SELECT g.*, r.room_number, eb.batch_number
      FROM guests g
      LEFT JOIN rooms r ON g.room_id = r.id
      LEFT JOIN evacuation_batches eb ON g.evacuation_batch_id = eb.id
      WHERE g.id = ?
    `, [req.params.id]);

    res.json({ success: true, data: updatedGuest });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/evacuate', (req, res) => {
  try {
    const result = Scheduler.markGuestEvacuated(req.params.id);
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    const guest = getOne('SELECT * FROM guests WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: guest, message: '住客已标记为撤离' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/assign-batch', (req, res) => {
  try {
    const { batch_id } = req.body;
    if (!batch_id) {
      return res.status(400).json({ success: false, error: '批次ID不能为空' });
    }

    const result = Scheduler.assignGuestToBatch(req.params.id, batch_id);
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    const guest = getOne(`
      SELECT g.*, r.room_number, eb.batch_number
      FROM guests g
      LEFT JOIN rooms r ON g.room_id = r.id
      LEFT JOIN evacuation_batches eb ON g.evacuation_batch_id = eb.id
      WHERE g.id = ?
    `, [req.params.id]);

    res.json({ success: true, data: guest, message: '住客已分配到撤离批次' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/remove-batch', (req, res) => {
  try {
    const guest = getOne('SELECT * FROM guests WHERE id = ?', [req.params.id]);
    if (!guest) {
      return res.status(404).json({ success: false, error: '住客不存在' });
    }

    if (!guest.evacuation_batch_id) {
      return res.status(400).json({ success: false, error: '住客未分配到任何批次' });
    }

    Scheduler.removeGuestFromBatch(req.params.id, guest.evacuation_batch_id);

    const updatedGuest = getOne(`
      SELECT g.*, r.room_number
      FROM guests g
      LEFT JOIN rooms r ON g.room_id = r.id
      WHERE g.id = ?
    `, [req.params.id]);

    res.json({ success: true, data: updatedGuest, message: '住客已从批次移除' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const guest = getOne('SELECT * FROM guests WHERE id = ?', [req.params.id]);
    if (!guest) {
      return res.status(404).json({ success: false, error: '住客不存在' });
    }

    if (guest.is_evacuated === 1) {
      return res.status(400).json({ success: false, error: '已撤离的住客无法删除' });
    }

    runQuery('DELETE FROM guests WHERE id = ?', [req.params.id]);

    if (guest.room_id) {
      const remaining = getAll(
        'SELECT COUNT(*) as count FROM guests WHERE room_id = ? AND is_evacuated = 0',
        [guest.room_id]
      );
      if (remaining[0].count === 0) {
        runQuery('UPDATE rooms SET is_occupied = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [guest.room_id]);
      }
    }

    res.json({ success: true, message: '住客已删除' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/batch', (req, res) => {
  try {
    const { guests } = req.body;
    
    if (!guests || !Array.isArray(guests)) {
      return res.status(400).json({ success: false, error: '参数错误' });
    }

    const db = getDatabase();
    const results = { success: [], failed: [] };

    for (const guestData of guests) {
      try {
        const {
          room_number, name, id_number, phone, age, gender,
          is_elderly, is_child, has_disability, nationality,
          checkin_date, checkout_date
        } = guestData;

        if (!name) {
          results.failed.push({ name: guestData.name || '未知', error: '姓名不能为空' });
          continue;
        }

        let room_id = null;
        if (room_number) {
          const room = getOne('SELECT * FROM rooms WHERE room_number = ?', [room_number]);
          if (!room) {
            results.failed.push({ name, error: `房间号 ${room_number} 不存在` });
            continue;
          }
          room_id = room.id;
        }

        const id = uuidv4();
        const isElderly = is_elderly || (age && age >= 65) || 0;
        const isChild = is_child || (age && age < 18) || 0;

        runQuery(`
          INSERT INTO guests (
            id, room_id, name, id_number, phone, age, gender,
            is_elderly, is_child, has_disability, nationality,
            checkin_date, checkout_date, is_evacuated
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        `, [
          id, room_id, name, id_number || null, phone || null,
          age || null, gender || null, isElderly, isChild,
          has_disability || 0, nationality || '中国',
          checkin_date || null, checkout_date || null
        ]);

        if (room_id) {
          runQuery(`
            UPDATE rooms SET is_occupied = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?
          `, [room_id]);
        }

        results.success.push({ id, name, room_number });
      } catch (error) {
        results.failed.push({ name: guestData.name, error: error.message });
      }
    }

    res.json({ 
      success: true, 
      data: results,
      summary: `成功导入 ${results.success.length} 人，失败 ${results.failed.length} 人`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
