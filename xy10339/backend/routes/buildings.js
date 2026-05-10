const express = require('express');
const { v4: uuidv4 } = require('uuid');

function getBuildingsRouter(db) {
  const router = express.Router();

  function query(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  function queryOne(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  function run(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve(this);
      });
    });
  }

  router.get('/', async (req, res) => {
    try {
      const buildings = await query(`SELECT * FROM buildings ORDER BY name`);
      res.json(buildings);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/:id', async (req, res) => {
    try {
      const building = await queryOne('SELECT * FROM buildings WHERE id = ?', [req.params.id]);
      if (!building) return res.status(404).json({ error: '楼栋不存在' });
      
      const houses = await query(`
        SELECT h.*, 
          (SELECT o.name FROM owners o WHERE o.house_id = h.id LIMIT 1) as owner_name,
          (SELECT o.phone FROM owners o WHERE o.house_id = h.id LIMIT 1) as owner_phone
        FROM houses h WHERE h.building_id = ?
        ORDER BY h.unit_number, h.room_number
      `, [req.params.id]);
      
      res.json({ ...building, houses });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/', async (req, res) => {
    try {
      const { name, unit_count, total_area } = req.body;
      const id = uuidv4();
      
      await run(`
        INSERT INTO buildings (id, name, unit_count, total_area)
        VALUES (?, ?, ?, ?)
      `, [id, name, unit_count, total_area]);

      const building = await queryOne('SELECT * FROM buildings WHERE id = ?', [id]);
      res.status(201).json(building);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/:id/houses', async (req, res) => {
    try {
      const { unit_number, room_number, area, owners } = req.body;
      const houseId = uuidv4();
      
      await run(`
        INSERT INTO houses (id, building_id, unit_number, room_number, area)
        VALUES (?, ?, ?, ?, ?)
      `, [houseId, req.params.id, unit_number, room_number, area]);

      if (owners && owners.length > 0) {
        for (const owner of owners) {
          await run(`
            INSERT INTO owners (id, name, phone, id_card, house_id)
            VALUES (?, ?, ?, ?, ?)
          `, [uuidv4(), owner.name, owner.phone, owner.id_card, houseId]);
        }
      }

      const house = await queryOne(`
        SELECT h.*, 
          (SELECT o.name FROM owners o WHERE o.house_id = h.id LIMIT 1) as owner_name,
          (SELECT o.phone FROM owners o WHERE o.house_id = h.id LIMIT 1) as owner_phone
        FROM houses h WHERE h.id = ?
      `, [houseId]);
      
      res.status(201).json(house);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

module.exports = { getBuildingsRouter };
