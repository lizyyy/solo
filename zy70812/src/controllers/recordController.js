const db = require('../models/database');
const { logOperation, getRecordLogs } = require('../utils/logger');
const { upsertVessel, upsertBerth } = require('../utils/importer');

function generateRecordNo() {
  const date = new Date();
  const prefix = 'R' + date.getFullYear().toString().slice(-2) + 
    (date.getMonth() + 1).toString().padStart(2, '0') +
    date.getDate().toString().padStart(2, '0');
  return new Promise((resolve, reject) => {
    db.get('SELECT MAX(record_no) as max FROM scheduling_records WHERE record_no LIKE ?', 
      [prefix + '%'], (err, row) => {
        if (err) return reject(err);
        let seq = 1;
        if (row.max) {
          seq = parseInt(row.max.slice(-4)) + 1;
        }
        resolve(prefix + seq.toString().padStart(4, '0'));
      }
    );
  });
}

async function createRecord(req, res) {
  try {
    const { 
      batch_id, vessel_data, berth_data, arrival_date, 
      departure_date, planned_berth_time, handling_type, 
      cargo_quantity, created_by 
    } = req.body;
    
    if (!batch_id || !vessel_data || !arrival_date || !created_by) {
      return res.status(400).json({ error: 'batch_id, vessel_data, arrival_date, created_by are required' });
    }

    const vessel = await upsertVessel(vessel_data);
    const berth = berth_data ? await upsertBerth(berth_data) : null;
    
    const recordNo = await generateRecordNo();
    
    db.run(`
      INSERT INTO scheduling_records 
      (batch_id, record_no, vessel_id, berth_id, arrival_date, departure_date, 
       planned_berth_time, handling_type, cargo_quantity, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      batch_id, recordNo, vessel.id, berth ? berth.id : null,
      arrival_date, departure_date, planned_berth_time,
      handling_type, cargo_quantity, created_by
    ], async function(err) {
      if (err) return res.status(500).json({ error: err.message });
      
      const recordId = this.lastID;
      
      await logOperation({
        record_id: recordId,
        batch_id: batch_id,
        operation_type: 'record_create',
        operation_status: 'success',
        handled_by: created_by,
        details: { record_no: recordNo, vessel_name: vessel.vessel_name }
      });
      
      res.json({
        id: recordId,
        record_no: recordNo,
        vessel,
        berth,
        status: 'pending'
      });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function processRecord(req, res) {
  try {
    const { id } = req.params;
    const { handled_by, status = 'processed', reason } = req.body;
    
    if (!handled_by) {
      return res.status(400).json({ error: 'handled_by is required' });
    }

    db.get('SELECT * FROM scheduling_records WHERE id = ?', [id], async (err, record) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!record) return res.status(404).json({ error: 'Record not found' });
      
      db.run(`
        UPDATE scheduling_records 
        SET status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [status, id], async (err) => {
        if (err) return res.status(500).json({ error: err.message });
        
        await logOperation({
          record_id: id,
          batch_id: record.batch_id,
          operation_type: 'record_process',
          operation_status: status,
          reason,
          handled_by,
          details: { old_status: record.status, new_status: status }
        });
        
        res.json({ success: true, id, status });
      });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function returnForRevision(req, res) {
  try {
    const { id } = req.params;
    const { handled_by, reason } = req.body;
    
    if (!handled_by || !reason) {
      return res.status(400).json({ error: 'handled_by and reason are required' });
    }

    db.get('SELECT * FROM scheduling_records WHERE id = ?', [id], async (err, record) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!record) return res.status(404).json({ error: 'Record not found' });
      
      db.run(`
        UPDATE scheduling_records 
        SET status = 'returned', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [id], async (err) => {
        if (err) return res.status(500).json({ error: err.message });
        
        await logOperation({
          record_id: id,
          batch_id: record.batch_id,
          operation_type: 'record_return',
          operation_status: 'returned',
          reason,
          handled_by,
          details: { old_status: record.status }
        });
        
        res.json({ success: true, id, status: 'returned', reason });
      });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function handleSpecialCase(req, res) {
  try {
    const { id } = req.params;
    const { case_type, reason, handled_by } = req.body;
    
    if (!case_type || !reason || !handled_by) {
      return res.status(400).json({ error: 'case_type, reason, handled_by are required' });
    }

    if (!['draft_restriction', 'cross_day_window', 'urgent_insertion'].includes(case_type)) {
      return res.status(400).json({ error: 'Invalid case_type. Must be draft_restriction, cross_day_window, or urgent_insertion' });
    }

    db.get('SELECT * FROM scheduling_records WHERE id = ?', [id], async (err, record) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!record) return res.status(404).json({ error: 'Record not found' });
      
      db.run(`
        UPDATE scheduling_records 
        SET special_case_type = ?, special_case_reason = ?, 
            special_case_handled_by = ?, special_case_handled_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [case_type, reason, handled_by, id], async (err) => {
        if (err) return res.status(500).json({ error: err.message });
        
        await logOperation({
          record_id: id,
          batch_id: record.batch_id,
          operation_type: 'special_case',
          operation_status: case_type,
          reason,
          handled_by,
          details: { case_type, reason }
        });
        
        res.json({ 
          success: true, 
          id, 
          special_case_type: case_type,
          special_case_reason: reason,
          special_case_handled_by: handled_by
        });
      });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function confirmAgent(req, res) {
  try {
    const { id } = req.params;
    const { confirmed_by } = req.body;
    
    if (!confirmed_by) {
      return res.status(400).json({ error: 'confirmed_by is required' });
    }

    db.get('SELECT * FROM scheduling_records WHERE id = ?', [id], async (err, record) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!record) return res.status(404).json({ error: 'Record not found' });
      
      db.run(`
        UPDATE scheduling_records 
        SET agent_confirmed = 1, agent_confirmed_by = ?, 
            agent_confirmed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [confirmed_by, id], async (err) => {
        if (err) return res.status(500).json({ error: err.message });
        
        await logOperation({
          record_id: id,
          batch_id: record.batch_id,
          operation_type: 'agent_confirm',
          operation_status: 'confirmed',
          handled_by: confirmed_by
        });
        
        res.json({ success: true, id, agent_confirmed: true });
      });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function lockBerth(req, res) {
  try {
    const { id } = req.params;
    const { locked_by } = req.body;
    
    if (!locked_by) {
      return res.status(400).json({ error: 'locked_by is required' });
    }

    db.get('SELECT * FROM scheduling_records WHERE id = ?', [id], async (err, record) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!record) return res.status(404).json({ error: 'Record not found' });
      
      db.run(`
        UPDATE scheduling_records 
        SET berth_locked = 1, berth_locked_by = ?, 
            berth_locked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [locked_by, id], async (err) => {
        if (err) return res.status(500).json({ error: err.message });
        
        await logOperation({
          record_id: id,
          batch_id: record.batch_id,
          operation_type: 'berth_lock',
          operation_status: 'locked',
          handled_by: locked_by
        });
        
        res.json({ success: true, id, berth_locked: true });
      });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function confirmLoadingPlan(req, res) {
  try {
    const { id } = req.params;
    const { confirmed_by } = req.body;
    
    if (!confirmed_by) {
      return res.status(400).json({ error: 'confirmed_by is required' });
    }

    db.get('SELECT * FROM scheduling_records WHERE id = ?', [id], async (err, record) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!record) return res.status(404).json({ error: 'Record not found' });
      
      db.run(`
        UPDATE scheduling_records 
        SET loading_plan_confirmed = 1, loading_plan_confirmed_by = ?, 
            loading_plan_confirmed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [confirmed_by, id], async (err) => {
        if (err) return res.status(500).json({ error: err.message });
        
        await logOperation({
          record_id: id,
          batch_id: record.batch_id,
          operation_type: 'loading_plan_confirm',
          operation_status: 'confirmed',
          handled_by: confirmed_by
        });
        
        res.json({ success: true, id, loading_plan_confirmed: true });
      });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

function listRecords(req, res) {
  const { 
    batch_id, status, agent_confirmed, berth_locked, loading_plan_confirmed,
    vessel_name, start_date, end_date, limit = 50, offset = 0 
  } = req.query;
  
  let query = `
    SELECT 
      sr.*,
      b.batch_no,
      v.vessel_name,
      v.vessel_imo,
      v.draft,
      be.berth_no
    FROM scheduling_records sr
    LEFT JOIN batches b ON sr.batch_id = b.id
    LEFT JOIN vessels v ON sr.vessel_id = v.id
    LEFT JOIN berths be ON sr.berth_id = be.id
    WHERE 1=1
  `;
  const params = [];

  if (batch_id) {
    query += ' AND sr.batch_id = ?';
    params.push(batch_id);
  }

  if (status) {
    query += ' AND sr.status = ?';
    params.push(status);
  }

  if (agent_confirmed !== undefined) {
    query += ' AND sr.agent_confirmed = ?';
    params.push(agent_confirmed === 'true' ? 1 : 0);
  }

  if (berth_locked !== undefined) {
    query += ' AND sr.berth_locked = ?';
    params.push(berth_locked === 'true' ? 1 : 0);
  }

  if (loading_plan_confirmed !== undefined) {
    query += ' AND sr.loading_plan_confirmed = ?';
    params.push(loading_plan_confirmed === 'true' ? 1 : 0);
  }

  if (vessel_name) {
    query += ' AND v.vessel_name LIKE ?';
    params.push(`%${vessel_name}%`);
  }

  if (start_date) {
    query += ' AND sr.arrival_date >= ?';
    params.push(start_date);
  }

  if (end_date) {
    query += ' AND sr.arrival_date <= ?';
    params.push(end_date);
  }

  query += ' ORDER BY sr.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));
  
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
}

async function getRecordDetail(req, res) {
  try {
    const { id } = req.params;
    
    const record = await new Promise((resolve, reject) => {
      db.get(`
        SELECT 
          sr.*,
          b.batch_no,
          v.vessel_name,
          v.vessel_imo,
          v.draft,
          v.agent,
          be.berth_no,
          be.max_draft,
          be.berth_name
        FROM scheduling_records sr
        LEFT JOIN batches b ON sr.batch_id = b.id
        LEFT JOIN vessels v ON sr.vessel_id = v.id
        LEFT JOIN berths be ON sr.berth_id = be.id
        WHERE sr.id = ?
      `, [id], (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });

    if (!record) return res.status(404).json({ error: 'Record not found' });

    const logs = await getRecordLogs(id);
    
    res.json({ record, operation_logs: logs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  createRecord,
  processRecord,
  returnForRevision,
  handleSpecialCase,
  confirmAgent,
  lockBerth,
  confirmLoadingPlan,
  listRecords,
  getRecordDetail
};
