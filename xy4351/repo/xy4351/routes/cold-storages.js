const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/', (req, res) => {
  db.all(`
    SELECT cs.*,
           (SELECT COUNT(*) FROM storage_slots WHERE cold_storage_id = cs.id) as total_slots_count,
           (SELECT SUM(current_usage) FROM storage_slots WHERE cold_storage_id = cs.id) as total_used
    FROM cold_storages cs
    ORDER BY cs.created_at DESC
  `, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

router.get('/:id', (req, res) => {
  db.get(`
    SELECT cs.*,
           (SELECT COUNT(*) FROM storage_slots WHERE cold_storage_id = cs.id) as total_slots_count,
           (SELECT SUM(current_usage) FROM storage_slots WHERE cold_storage_id = cs.id) as total_used
    FROM cold_storages cs
    WHERE cs.id = ?
  `, [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: '冷藏柜不存在' });
    }
    
    db.all(`
      SELECT ss.*,
             (SELECT COUNT(*) FROM seed_batches WHERE storage_slot_id = ss.id) as batch_count
      FROM storage_slots ss
      WHERE ss.cold_storage_id = ?
      ORDER BY ss.row_number, ss.column_number
    `, [req.params.id], (err, slots) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      row.storage_slots = slots;
      res.json(row);
    });
  });
});

router.get('/code/:cabinetCode', (req, res) => {
  db.get(`
    SELECT cs.*,
           (SELECT COUNT(*) FROM storage_slots WHERE cold_storage_id = cs.id) as total_slots_count,
           (SELECT SUM(current_usage) FROM storage_slots WHERE cold_storage_id = cs.id) as total_used
    FROM cold_storages cs
    WHERE cs.cabinet_code = ?
  `, [req.params.cabinetCode], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: '冷藏柜不存在' });
    }
    res.json(row);
  });
});

router.post('/', (req, res) => {
  const {
    cabinet_code,
    cabinet_name,
    location,
    total_slots,
    temperature,
    humidity,
    status,
    description
  } = req.body;

  if (!cabinet_code || !cabinet_name || !location) {
    return res.status(400).json({ error: '柜号、名称和位置为必填项' });
  }

  const stmt = db.prepare(`
    INSERT INTO cold_storages (
      cabinet_code, cabinet_name, location, total_slots,
      temperature, humidity, status, description
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    cabinet_code,
    cabinet_name,
    location,
    total_slots || 100,
    temperature !== undefined ? temperature : -18.0,
    humidity !== undefined ? humidity : 30.0,
    status || '正常',
    description || null,
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: '柜号已存在' });
        }
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({
        id: this.lastID,
        message: '冷藏柜创建成功'
      });
    }
  );
  stmt.finalize();
});

router.post('/:id/slots', (req, res) => {
  const coldStorageId = req.params.id;
  const { slots } = req.body;

  if (!slots || !Array.isArray(slots) || slots.length === 0) {
    return res.status(400).json({ error: '格位数据为必填项，且必须为数组' });
  }

  db.get('SELECT * FROM cold_storages WHERE id = ?', [coldStorageId], (err, cabinet) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!cabinet) {
      return res.status(404).json({ error: '冷藏柜不存在' });
    }

    const stmt = db.prepare(`
      INSERT INTO storage_slots (
        cold_storage_id, slot_code, row_number, column_number, max_capacity
      )
      VALUES (?, ?, ?, ?, ?)
    `);

    let successCount = 0;
    let errorSlots = [];

    slots.forEach((slot, index) => {
      stmt.run(
        coldStorageId,
        slot.slot_code || `${cabinet.cabinet_code}-${index + 1}`,
        slot.row_number || null,
        slot.column_number || null,
        slot.max_capacity || 10,
        function(err) {
          if (err) {
            errorSlots.push({
              slot_code: slot.slot_code,
              error: err.message
            });
          } else {
            successCount++;
          }
        }
      );
    });

    stmt.finalize((err) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      if (errorSlots.length > 0) {
        res.status(207).json({
          message: `部分格位创建成功`,
          success_count: successCount,
          error_count: errorSlots.length,
          errors: errorSlots
        });
      } else {
        res.status(201).json({
          message: `成功创建 ${successCount} 个格位`,
          success_count: successCount
        });
      }
    });
  });
});

router.get('/slots/available', (req, res) => {
  db.all(`
    SELECT ss.*,
           cs.cabinet_code, cs.cabinet_name, cs.location as cabinet_location,
           (ss.max_capacity - ss.current_usage) as available_capacity
    FROM storage_slots ss
    LEFT JOIN cold_storages cs ON ss.cold_storage_id = cs.id
    WHERE ss.current_usage < ss.max_capacity
    ORDER BY cs.cabinet_code, ss.slot_code
  `, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

router.get('/slots/:slotId', (req, res) => {
  db.get(`
    SELECT ss.*,
           cs.cabinet_code, cs.cabinet_name, cs.location as cabinet_location,
           (ss.max_capacity - ss.current_usage) as available_capacity
    FROM storage_slots ss
    LEFT JOIN cold_storages cs ON ss.cold_storage_id = cs.id
    WHERE ss.id = ?
  `, [req.params.slotId], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: '格位不存在' });
    }
    
    db.all(`
      SELECT sb.*, ns.common_name, ns.scientific_name
      FROM seed_batches sb
      LEFT JOIN native_species ns ON sb.species_id = ns.id
      WHERE sb.storage_slot_id = ?
      ORDER BY sb.created_at DESC
    `, [req.params.slotId], (err, batches) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      row.seed_batches = batches;
      res.json(row);
    });
  });
});

router.put('/:id', (req, res) => {
  const {
    cabinet_code,
    cabinet_name,
    location,
    total_slots,
    temperature,
    humidity,
    status,
    description
  } = req.body;

  db.get('SELECT * FROM cold_storages WHERE id = ?', [req.params.id], (err, existingCabinet) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!existingCabinet) {
      return res.status(404).json({ error: '冷藏柜不存在' });
    }

    const stmt = db.prepare(`
      UPDATE cold_storages 
      SET cabinet_code = ?, cabinet_name = ?, location = ?, total_slots = ?,
          temperature = ?, humidity = ?, status = ?, description = ?
      WHERE id = ?
    `);
    
    stmt.run(
      cabinet_code || existingCabinet.cabinet_code,
      cabinet_name || existingCabinet.cabinet_name,
      location || existingCabinet.location,
      total_slots !== undefined ? total_slots : existingCabinet.total_slots,
      temperature !== undefined ? temperature : existingCabinet.temperature,
      humidity !== undefined ? humidity : existingCabinet.humidity,
      status || existingCabinet.status,
      description !== undefined ? description : existingCabinet.description,
      req.params.id,
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: '柜号已存在' });
          }
          return res.status(500).json({ error: err.message });
        }
        res.json({ message: '冷藏柜更新成功' });
      }
    );
    stmt.finalize();
  });
});

router.delete('/:id', (req, res) => {
  db.get('SELECT COUNT(*) as count FROM storage_slots WHERE cold_storage_id = ?', [req.params.id], (err, result) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (result.count > 0) {
      return res.status(400).json({ 
        error: '该冷藏柜有关联的格位，请先删除格位',
        associated_slots: result.count
      });
    }

    db.run('DELETE FROM cold_storages WHERE id = ?', [req.params.id], function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: '冷藏柜不存在' });
      }
      res.json({ message: '冷藏柜删除成功' });
    });
  });
});

module.exports = router;
