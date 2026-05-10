const express = require('express');
const { v4: uuidv4 } = require('uuid');

function getDelegatesRouter(db) {
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
      const { repair_item_id, status } = req.query;
      
      let sql = `
        SELECT d.*,
          p.name as principal_name, p.phone as principal_phone,
          p_h.unit_number as principal_unit, p_h.room_number as principal_room,
          p_b.name as principal_building,
          a.name as agent_name, a.phone as agent_phone,
          ri.name as repair_item_name
        FROM delegates d
        LEFT JOIN owners p ON d.principal_owner_id = p.id
        LEFT JOIN houses p_h ON p.house_id = p_h.id
        LEFT JOIN buildings p_b ON p_h.building_id = p_b.id
        LEFT JOIN owners a ON d.agent_owner_id = a.id
        LEFT JOIN repair_items ri ON d.repair_item_id = ri.id
        WHERE 1=1
      `;
      const params = [];

      if (repair_item_id) {
        sql += ' AND d.repair_item_id = ?';
        params.push(repair_item_id);
      }

      if (status && status !== 'all') {
        sql += ' AND d.status = ?';
        params.push(status);
      }

      sql += ' ORDER BY d.created_at DESC';

      const delegates = await query(sql, params);
      res.json(delegates);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/', async (req, res) => {
    try {
      const { 
        repair_item_id, 
        principal_owner_id, 
        agent_owner_id, 
        agent_name, 
        agent_phone, 
        start_date, 
        end_date 
      } = req.body;

      if (!repair_item_id || !principal_owner_id || !start_date || !end_date) {
        return res.status(400).json({ error: '缺少必要字段' });
      }

      const repairItem = await queryOne('SELECT * FROM repair_items WHERE id = ?', [repair_item_id]);
      if (!repairItem) return res.status(400).json({ error: '维修事项不存在' });

      const principal = await queryOne('SELECT * FROM owners WHERE id = ?', [principal_owner_id]);
      if (!principal) return res.status(400).json({ error: '委托人不存在' });

      const existingActive = await queryOne(`
        SELECT * FROM delegates 
        WHERE repair_item_id = ? 
          AND principal_owner_id = ? 
          AND status = 'active'
          AND revoked_at IS NULL
      `, [repair_item_id, principal_owner_id]);

      if (existingActive) {
        return res.status(400).json({
          error: '已存在有效委托',
          message: '该业主在本维修事项下已有有效委托，请先撤销旧委托'
        });
      }

      const id = uuidv4();

      await run(`
        INSERT INTO delegates 
          (id, repair_item_id, principal_owner_id, agent_owner_id, agent_name, agent_phone, start_date, end_date, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
      `, [id, repair_item_id, principal_owner_id, agent_owner_id, agent_name, agent_phone, start_date, end_date]);

      await run(`
        INSERT INTO vote_logs (id, action, details)
        VALUES (?, ?, ?)
      `, [uuidv4(), 'delegate_created', `业主${principal.name}创建委托，有效期${start_date}至${end_date}`]);

      const delegate = await queryOne(`
        SELECT d.*,
          p.name as principal_name, p.phone as principal_phone,
          p_h.unit_number as principal_unit, p_h.room_number as principal_room,
          p_b.name as principal_building,
          a.name as agent_name, a.phone as agent_phone,
          ri.name as repair_item_name
        FROM delegates d
        LEFT JOIN owners p ON d.principal_owner_id = p.id
        LEFT JOIN houses p_h ON p.house_id = p_h.id
        LEFT JOIN buildings p_b ON p_h.building_id = p_b.id
        LEFT JOIN owners a ON d.agent_owner_id = a.id
        LEFT JOIN repair_items ri ON d.repair_item_id = ri.id
        WHERE d.id = ?
      `, [id]);

      res.status(201).json(delegate);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/:id/revoke', async (req, res) => {
    try {
      const { id } = req.params;
      const now = new Date().toISOString();

      const delegate = await queryOne('SELECT * FROM delegates WHERE id = ?', [id]);
      if (!delegate) return res.status(404).json({ error: '委托不存在' });
      if (delegate.status !== 'active') return res.status(400).json({ error: '委托已无效' });

      await run(`UPDATE delegates SET status = 'revoked', revoked_at = ? WHERE id = ?`, [now, id]);

      await run(`
        INSERT INTO vote_logs (id, action, details)
        VALUES (?, ?, ?)
      `, [uuidv4(), 'delegate_revoked', `委托被撤销`]);

      const updated = await queryOne(`
        SELECT d.*,
          p.name as principal_name, p.phone as principal_phone,
          p_h.unit_number as principal_unit, p_h.room_number as principal_room,
          p_b.name as principal_building,
          a.name as agent_name, a.phone as agent_phone
        FROM delegates d
        LEFT JOIN owners p ON d.principal_owner_id = p.id
        LEFT JOIN houses p_h ON p.house_id = p_h.id
        LEFT JOIN buildings p_b ON p_h.building_id = p_b.id
        LEFT JOIN owners a ON d.agent_owner_id = a.id
        WHERE d.id = ?
      `, [id]);

      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

module.exports = { getDelegatesRouter };
