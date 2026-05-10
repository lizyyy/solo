const express = require('express');
const { v4: uuidv4 } = require('uuid');

function getVotingRouter(db) {
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

  function isDelegateValid(delegate, now) {
    if (!delegate) return false;
    if (delegate.status !== 'active') return false;
    if (delegate.revoked_at) return false;
    
    const startDate = new Date(delegate.start_date);
    const endDate = new Date(delegate.end_date);
    
    return now >= startDate && now <= endDate;
  }

  router.post('/cast', async (req, res) => {
    try {
      const { repair_item_id, house_id, voter_owner_id, vote_value, vote_type, delegate_id, notes } = req.body;
      const now = new Date();

      const repairItem = await queryOne('SELECT * FROM repair_items WHERE id = ?', [repair_item_id]);
      if (!repairItem) return res.status(400).json({ error: '维修事项不存在' });
      if (repairItem.status !== 'active') return res.status(400).json({ error: '该维修事项已结束' });

      const house = await queryOne('SELECT * FROM houses WHERE id = ?', [house_id]);
      if (!house) return res.status(400).json({ error: '房屋不存在' });

      const existingActiveVote = await queryOne(`
        SELECT v.* FROM votes v
        WHERE v.repair_item_id = ? AND v.house_id = ? AND v.status = 'active'
      `, [repair_item_id, house_id]);

      if (existingActiveVote) {
        return res.status(400).json({
          error: '重复投票',
          message: '该房屋在本维修事项下已有有效投票，如需修改请先撤回原投票',
          existing_vote: existingActiveVote
        });
      }

      if (vote_type === 'delegate') {
        if (!delegate_id) return res.status(400).json({ error: '委托投票需要提供委托ID' });
        
        const delegate = await queryOne(`
          SELECT d.*, 
            p.name as principal_name, p.house_id as principal_house_id,
            a.name as agent_name
          FROM delegates d
          LEFT JOIN owners p ON d.principal_owner_id = p.id
          LEFT JOIN owners a ON d.agent_owner_id = a.id
          WHERE d.id = ?
        `, [delegate_id]);

        if (!isDelegateValid(delegate, now)) {
          return res.status(400).json({
            error: '委托无效',
            message: '该委托已过期、已撤销或不在有效期内',
            delegate_status: delegate ? delegate.status : 'not_found'
          });
        }

        if (delegate.principal_house_id !== house_id) {
          return res.status(400).json({ error: '委托与房屋不匹配' });
        }
      }

      const voteId = uuidv4();

      await run(`
        INSERT INTO votes (id, repair_item_id, house_id, voter_owner_id, vote_value, vote_type, delegate_id, status, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)
      `, [voteId, repair_item_id, house_id, voter_owner_id, vote_value, vote_type || 'direct', delegate_id, notes]);

      await run(`
        INSERT INTO vote_logs (id, vote_id, action, details)
        VALUES (?, ?, ?, ?)
      `, [uuidv4(), voteId, 'vote_created', vote_type === 'delegate' 
        ? `委托投票，表决：${vote_value}` 
        : `业主亲自投票，表决：${vote_value}`]);

      const vote = await queryOne(`
        SELECT v.*, 
          h.unit_number, h.room_number, h.area,
          b.name as building_name,
          o.name as voter_name,
          d.principal_owner_id,
          (SELECT name FROM owners WHERE id = d.principal_owner_id) as principal_name
        FROM votes v
        LEFT JOIN houses h ON v.house_id = h.id
        LEFT JOIN buildings b ON h.building_id = b.id
        LEFT JOIN owners o ON v.voter_owner_id = o.id
        LEFT JOIN delegates d ON v.delegate_id = d.id
        WHERE v.id = ?
      `, [voteId]);

      res.status(201).json(vote);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/:id/revoke', async (req, res) => {
    try {
      const { id } = req.params;
      const now = new Date().toISOString();

      const vote = await queryOne(`
        SELECT v.*, ri.status as repair_status
        FROM votes v
        LEFT JOIN repair_items ri ON v.repair_item_id = ri.id
        WHERE v.id = ?
      `, [id]);

      if (!vote) return res.status(404).json({ error: '投票不存在' });
      if (vote.status !== 'active') return res.status(400).json({ error: '该投票已被撤回或无效' });
      if (vote.repair_status !== 'active') return res.status(400).json({ error: '维修事项已结束，无法撤回' });

      await run(`UPDATE votes SET status = 'revoked', revoked_at = ? WHERE id = ?`, [now, id]);

      await run(`
        INSERT INTO vote_logs (id, vote_id, action, details)
        VALUES (?, ?, 'vote_revoked', '投票被撤回')
      `, [uuidv4(), id]);

      const updated = await queryOne(`
        SELECT v.*, 
          h.unit_number, h.room_number, h.area,
          b.name as building_name,
          o.name as voter_name
        FROM votes v
        LEFT JOIN houses h ON v.house_id = h.id
        LEFT JOIN buildings b ON h.building_id = b.id
        LEFT JOIN owners o ON v.voter_owner_id = o.id
        WHERE v.id = ?
      `, [id]);

      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/by-repair-item/:repairItemId', async (req, res) => {
    try {
      const { repairItemId } = req.params;
      const { status, include_history } = req.query;

      let sql = `
        SELECT v.*, 
          h.unit_number, h.room_number, h.area,
          b.name as building_name,
          o.name as voter_name, o.phone as voter_phone,
          d.principal_owner_id,
          (SELECT name FROM owners WHERE id = d.principal_owner_id) as principal_name
        FROM votes v
        LEFT JOIN houses h ON v.house_id = h.id
        LEFT JOIN buildings b ON h.building_id = b.id
        LEFT JOIN owners o ON v.voter_owner_id = o.id
        LEFT JOIN delegates d ON v.delegate_id = d.id
        WHERE v.repair_item_id = ?
      `;

      const params = [repairItemId];

      if (status && status !== 'all') {
        sql += ' AND v.status = ?';
        params.push(status);
      } else if (include_history !== 'true') {
        sql += " AND v.status = 'active'";
      }

      sql += ' ORDER BY v.created_at DESC';

      const votes = await query(sql, params);
      res.json(votes);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/check-duplicate', async (req, res) => {
    try {
      const { repair_item_id, house_id } = req.query;
      const existing = await queryOne(`
        SELECT v.*, 
          h.unit_number, h.room_number, b.name as building_name,
          o.name as voter_name
        FROM votes v
        LEFT JOIN houses h ON v.house_id = h.id
        LEFT JOIN buildings b ON h.building_id = b.id
        LEFT JOIN owners o ON v.voter_owner_id = o.id
        WHERE v.repair_item_id = ? AND v.house_id = ? AND v.status = 'active'
      `, [repair_item_id, house_id]);

      if (existing) {
        res.json({ has_existing: true, vote: existing });
      } else {
        const historical = await query(`
          SELECT v.*, 
            h.unit_number, h.room_number, b.name as building_name,
            o.name as voter_name
          FROM votes v
          LEFT JOIN houses h ON v.house_id = h.id
          LEFT JOIN buildings b ON h.building_id = b.id
          LEFT JOIN owners o ON v.voter_owner_id = o.id
          WHERE v.repair_item_id = ? AND v.house_id = ?
          ORDER BY v.created_at DESC
        `, [repair_item_id, house_id]);

        res.json({ has_existing: false, historical });
      }
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/disputes/:repairItemId', async (req, res) => {
    try {
      const { repairItemId } = req.params;
      const now = new Date().toISOString().split('T')[0];

      const disputes = await query(`
        SELECT 
          v.id, v.vote_type, v.vote_value, v.status, v.created_at, v.notes,
          h.unit_number, h.room_number, h.area, b.name as building_name,
          o.name as voter_name,
          d.start_date, d.end_date, d.status as delegate_status,
          d.revoked_at as delegate_revoked_at
        FROM votes v
        LEFT JOIN houses h ON v.house_id = h.id
        LEFT JOIN buildings b ON h.building_id = b.id
        LEFT JOIN owners o ON v.voter_owner_id = o.id
        LEFT JOIN delegates d ON v.delegate_id = d.id
        WHERE v.repair_item_id = ?
          AND v.status = 'active'
          AND v.vote_type = 'delegate'
          AND (
            d.status != 'active'
            OR d.revoked_at IS NOT NULL
            OR ? < d.start_date
            OR ? > d.end_date
          )
      `, [repairItemId, now, now]);

      const withdrawn = await query(`
        SELECT 
          v.id, v.vote_type, v.vote_value, v.status, v.created_at, v.revoked_at, v.notes,
          h.unit_number, h.room_number, h.area, b.name as building_name,
          o.name as voter_name
        FROM votes v
        LEFT JOIN houses h ON v.house_id = h.id
        LEFT JOIN buildings b ON h.building_id = b.id
        LEFT JOIN owners o ON v.voter_owner_id = o.id
        WHERE v.repair_item_id = ? AND v.status = 'revoked'
        ORDER BY v.revoked_at DESC
      `, [repairItemId]);

      res.json({ invalid_delegate_votes: disputes, withdrawn_votes: withdrawn });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

module.exports = { getVotingRouter };
