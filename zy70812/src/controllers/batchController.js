const db = require('../models/database');
const { logOperation } = require('../utils/logger');

function generateBatchNo() {
  const date = new Date();
  const prefix = 'B' + date.getFullYear().toString().slice(-2) + 
    (date.getMonth() + 1).toString().padStart(2, '0') +
    date.getDate().toString().padStart(2, '0');
  return new Promise((resolve, reject) => {
    db.get('SELECT MAX(batch_no) as max FROM batches WHERE batch_no LIKE ?', 
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

async function createBatch(req, res) {
  try {
    const { name, created_by } = req.body;
    
    if (!name || !created_by) {
      return res.status(400).json({ error: 'name and created_by are required' });
    }

    const batchNo = await generateBatchNo();
    
    db.run(`
      INSERT INTO batches (batch_no, name, created_by)
      VALUES (?, ?, ?)
    `, [batchNo, name, created_by], async function(err) {
      if (err) return res.status(500).json({ error: err.message });
      
      const batchId = this.lastID;
      
      await logOperation({
        batch_id: batchId,
        operation_type: 'batch_create',
        operation_status: 'success',
        handled_by: created_by,
        details: { batch_no: batchNo, name }
      });
      
      res.json({
        id: batchId,
        batch_no: batchNo,
        name,
        status: 'pending',
        created_by
      });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

function listBatches(req, res) {
  const { status, limit = 50, offset = 0 } = req.query;
  
  let query = 'SELECT * FROM batches WHERE 1=1';
  const params = [];
  
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));
  
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
}

function getBatch(req, res) {
  const { id } = req.params;
  
  db.get('SELECT * FROM batches WHERE id = ?', [id], (err, batch) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!batch) return res.status(404).json({ error: 'Batch not found' });
    
    db.all(`
      SELECT sr.*, v.vessel_name, be.berth_no 
      FROM scheduling_records sr
      LEFT JOIN vessels v ON sr.vessel_id = v.id
      LEFT JOIN berths be ON sr.berth_id = be.id
      WHERE sr.batch_id = ?
      ORDER BY sr.created_at DESC
    `, [id], (err, records) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ...batch, records });
    });
  });
}

module.exports = {
  createBatch,
  listBatches,
  getBatch,
  generateBatchNo
};
