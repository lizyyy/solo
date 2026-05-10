const express = require('express');
const { v4: uuidv4 } = require('uuid');

function getOwnersRouter(db) {
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
      const owners = await query(`
        SELECT o.*, 
          h.unit_number, h.room_number, h.area as house_area,
          b.name as building_name
        FROM owners o
        LEFT JOIN houses h ON o.house_id = h.id
        LEFT JOIN buildings b ON h.building_id = b.id
        ORDER BY b.name, h.unit_number, h.room_number
      `);
      res.json(owners);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/search/by-house', async (req, res) => {
    try {
      const { building_id, unit_number, room_number } = req.query;
      const owners = await query(`
        SELECT o.*, h.unit_number, h.room_number, h.area as house_area, b.name as building_name
        FROM owners o
        JOIN houses h ON o.house_id = h.id
        JOIN buildings b ON h.building_id = b.id
        WHERE h.building_id = ? AND h.unit_number = ? AND h.room_number = ?
      `, [building_id, unit_number, room_number]);
      res.json(owners);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/', async (req, res) => {
    try {
      const { name, phone, id_card, house_id } = req.body;
      const id = uuidv4();
      
      await run(`
        INSERT INTO owners (id, name, phone, id_card, house_id)
        VALUES (?, ?, ?, ?, ?)
      `, [id, name, phone, id_card, house_id]);

      const owner = await queryOne(`
        SELECT o.*, 
          h.unit_number, h.room_number, h.area as house_area,
          b.name as building_name
        FROM owners o
        LEFT JOIN houses h ON o.house_id = h.id
        LEFT JOIN buildings b ON h.building_id = b.id
        WHERE o.id = ?
      `, [id]);
      
      res.status(201).json(owner);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

module.exports = { getOwnersRouter };
