const express = require('express');
const router = express.Router();
const db = require('../database');
const conflictChecker = require('../services/conflictChecker');

router.get('/', (req, res) => {
  const query = `
    SELECT c.*, s.name as sponsor_name
    FROM contracts c
    JOIN sponsors s ON c.sponsor_id = s.id
    ORDER BY c.created_at DESC
  `;
  
  db.all(query, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

router.get('/:id', (req, res) => {
  const query = `
    SELECT c.*, s.name as sponsor_name
    FROM contracts c
    JOIN sponsors s ON c.sponsor_id = s.id
    WHERE c.id = ?
  `;
  
  db.get(query, [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: 'Contract not found' });
    }
    res.json(row);
  });
});

router.post('/', async (req, res) => {
  const { contract_number, sponsor_id, category, total_slots, used_slots, start_date, end_date, exclusivity_category, max_frequency, makegood_allowed, episode_ids } = req.body;
  
  if (!contract_number || !sponsor_id || !category || !total_slots) {
    return res.status(400).json({ error: 'Contract_number, sponsor_id, category and total_slots are required' });
  }
  
  try {
    if (episode_ids && episode_ids.length > 0) {
      const conflicts = await conflictChecker.checkAllConflicts({
        sponsor_id,
        category,
        episode_ids,
        max_frequency: max_frequency || 2
      });
      
      if (conflicts.hasConflicts) {
        return res.status(409).json({
          error: 'Conflicts detected in contract import',
          conflicts: conflicts.conflicts
        });
      }
    }
    
    const stmt = db.prepare('INSERT INTO contracts (contract_number, sponsor_id, category, total_slots, used_slots, start_date, end_date, exclusivity_category, max_frequency, makegood_allowed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    stmt.run(contract_number, sponsor_id, category, total_slots, used_slots || 0, start_date, end_date, exclusivity_category, max_frequency || 2, makegood_allowed !== undefined ? makegood_allowed : 1, function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({ 
        id: this.lastID, 
        contract_number, 
        sponsor_id, 
        category, 
        total_slots, 
        used_slots: used_slots || 0, 
        start_date, 
        end_date, 
        exclusivity_category, 
        max_frequency: max_frequency || 2, 
        makegood_allowed: makegood_allowed !== undefined ? makegood_allowed : 1 
      });
    });
    stmt.finalize();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/import', async (req, res) => {
  const contractData = req.body;
  
  if (!contractData.contract_number || !contractData.sponsor || !contractData.category || !contractData.total_slots) {
    return res.status(400).json({ error: 'Invalid contract format. Required fields: contract_number, sponsor, category, total_slots' });
  }
  
  try {
    let sponsorId;
    const existingSponsor = await new Promise((resolve, reject) => {
      db.get('SELECT id FROM sponsors WHERE name = ?', [contractData.sponsor], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (existingSponsor) {
      sponsorId = existingSponsor.id;
    } else {
      const stmt = db.prepare('INSERT INTO sponsors (name, category) VALUES (?, ?)');
      const result = await new Promise((resolve, reject) => {
        stmt.run(contractData.sponsor, contractData.category, function(err) {
          if (err) reject(err);
          else resolve({ lastID: this.lastID });
        });
        stmt.finalize();
      });
      sponsorId = result.lastID;
    }
    
    let episodeIds = [];
    if (contractData.episodes && contractData.episodes.length > 0) {
      for (const epNumber of contractData.episodes) {
        const episode = await new Promise((resolve, reject) => {
          db.get('SELECT id FROM episodes WHERE episode_number = ?', [epNumber], (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });
        
        if (episode) {
          episodeIds.push(episode.id);
        }
      }
    }
    
    const conflicts = await conflictChecker.checkAllConflicts({
      sponsor_id: sponsorId,
      category: contractData.category,
      episode_ids: episodeIds,
      max_frequency: contractData.max_frequency || 2
    });
    
    const existingContract = await new Promise((resolve, reject) => {
      db.get('SELECT id FROM contracts WHERE contract_number = ?', [contractData.contract_number], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (existingContract) {
      const updateStmt = db.prepare('UPDATE contracts SET sponsor_id = ?, category = ?, total_slots = ?, used_slots = ?, start_date = ?, end_date = ?, exclusivity_category = ?, max_frequency = ?, makegood_allowed = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
      await new Promise((resolve, reject) => {
        updateStmt.run(
          sponsorId, 
          contractData.category, 
          contractData.total_slots, 
          contractData.used_slots || 0, 
          contractData.start_date, 
          contractData.end_date, 
          contractData.exclusivity_category, 
          contractData.max_frequency || 2, 
          contractData.makegood_allowed !== undefined ? contractData.makegood_allowed : 1, 
          existingContract.id, 
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
        updateStmt.finalize();
      });
      
      res.json({
        id: existingContract.id,
        contract_number: contractData.contract_number,
        message: 'Contract updated successfully',
        conflicts: conflicts.conflicts,
        hasConflicts: conflicts.hasConflicts
      });
    } else {
      const insertStmt = db.prepare('INSERT INTO contracts (contract_number, sponsor_id, category, total_slots, used_slots, start_date, end_date, exclusivity_category, max_frequency, makegood_allowed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      const result = await new Promise((resolve, reject) => {
        insertStmt.run(
          contractData.contract_number, 
          sponsorId, 
          contractData.category, 
          contractData.total_slots, 
          contractData.used_slots || 0, 
          contractData.start_date, 
          contractData.end_date, 
          contractData.exclusivity_category, 
          contractData.max_frequency || 2, 
          contractData.makegood_allowed !== undefined ? contractData.makegood_allowed : 1, 
          function(err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID });
          }
        );
        insertStmt.finalize();
      });
      
      res.status(201).json({
        id: result.lastID,
        contract_number: contractData.contract_number,
        message: 'Contract imported successfully',
        conflicts: conflicts.conflicts,
        hasConflicts: conflicts.hasConflicts
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  const { contract_number, sponsor_id, category, total_slots, used_slots, start_date, end_date, exclusivity_category, max_frequency, makegood_allowed } = req.body;
  const stmt = db.prepare('UPDATE contracts SET contract_number = ?, sponsor_id = ?, category = ?, total_slots = ?, used_slots = ?, start_date = ?, end_date = ?, exclusivity_category = ?, max_frequency = ?, makegood_allowed = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
  stmt.run(contract_number, sponsor_id, category, total_slots, used_slots, start_date, end_date, exclusivity_category, max_frequency, makegood_allowed, req.params.id, function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Contract not found' });
    }
    res.json({ id: req.params.id, contract_number, sponsor_id, category, total_slots, used_slots, start_date, end_date, exclusivity_category, max_frequency, makegood_allowed });
  });
  stmt.finalize();
});

router.delete('/:id', (req, res) => {
  db.run('DELETE FROM contracts WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Contract not found' });
    }
    res.status(204).end();
  });
});

module.exports = router;
