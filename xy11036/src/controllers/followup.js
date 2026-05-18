const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { Parser } = require('json2csv');
const config = require('../config');

const dbPath = path.join(__dirname, '..', '..', 'data', 'counseling.db');

function getDbConnection() {
  return new sqlite3.Database(dbPath);
}

function generateFollowupNo() {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `FU-${dateStr}-${random}`;
}

exports.create = (req, res) => {
  const db = getDbConnection();
  const data = req.body;
  
  const followupNo = generateFollowupNo();
  
  db.run(`
    INSERT INTO followup_records (
      followup_no, client_id, client_name, client_phone,
      original_appointment_id, original_appointment_date, original_appointment_time,
      counselor_id, counselor_name, store_id, store_name,
      reschedule_count, last_reschedule_date, reschedule_reason,
      followup_status, followup_result, followup_date, followup_note,
      next_appointment_date, next_appointment_time, assignee
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    followupNo,
    data.client_id, data.client_name, data.client_phone,
    data.original_appointment_id,
    data.original_appointment_date, data.original_appointment_time,
    data.counselor_id, data.counselor_name,
    data.store_id, data.store_name,
    data.reschedule_count || 0,
    data.last_reschedule_date,
    data.reschedule_reason,
    data.followup_status || 'pending',
    data.followup_result,
    data.followup_date,
    data.followup_note,
    data.next_appointment_date,
    data.next_appointment_time,
    data.assignee
  ], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    db.get('SELECT * FROM followup_records WHERE id = ?', [this.lastID], (err, row) => {
      db.close();
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(row);
    });
  });
};

exports.update = (req, res) => {
  const db = getDbConnection();
  const { id } = req.params;
  const data = req.body;
  
  db.get('SELECT * FROM followup_records WHERE id = ?', [id], (err, row) => {
    if (err) {
      db.close();
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      db.close();
      res.status(404).json({ error: '记录不存在' });
      return;
    }
    
    const updated = { ...row, ...data, updated_at: new Date().toISOString() };
    
    db.run(`
      UPDATE followup_records SET
        client_id = ?, client_name = ?, client_phone = ?,
        original_appointment_id = ?, original_appointment_date = ?, original_appointment_time = ?,
        counselor_id = ?, counselor_name = ?, store_id = ?, store_name = ?,
        reschedule_count = ?, last_reschedule_date = ?, reschedule_reason = ?,
        followup_status = ?, followup_result = ?, followup_date = ?, followup_note = ?,
        next_appointment_date = ?, next_appointment_time = ?, assignee = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      updated.client_id, updated.client_name, updated.client_phone,
      updated.original_appointment_id,
      updated.original_appointment_date, updated.original_appointment_time,
      updated.counselor_id, updated.counselor_name,
      updated.store_id, updated.store_name,
      updated.reschedule_count,
      updated.last_reschedule_date,
      updated.reschedule_reason,
      updated.followup_status,
      updated.followup_result,
      updated.followup_date,
      updated.followup_note,
      updated.next_appointment_date,
      updated.next_appointment_time,
      updated.assignee,
      id
    ], function(err) {
      if (err) {
        db.close();
        res.status(500).json({ error: err.message });
        return;
      }
      db.get('SELECT * FROM followup_records WHERE id = ?', [id], (err, row) => {
        db.close();
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        res.json(row);
      });
    });
  });
};

exports.list = (req, res) => {
  const db = getDbConnection();
  const {
    start_date, end_date,
    followup_status,
    assignee,
    store_name,
    page = 1,
    page_size = 20
  } = req.query;
  
  let query = 'SELECT * FROM followup_records WHERE 1=1';
  let countQuery = 'SELECT COUNT(*) as total FROM followup_records WHERE 1=1';
  const params = [];
  const countParams = [];
  
  if (start_date) {
    query += ' AND original_appointment_date >= ?';
    countQuery += ' AND original_appointment_date >= ?';
    params.push(start_date);
    countParams.push(start_date);
  }
  
  if (end_date) {
    query += ' AND original_appointment_date <= ?';
    countQuery += ' AND original_appointment_date <= ?';
    params.push(end_date);
    countParams.push(end_date);
  }
  
  if (followup_status) {
    query += ' AND followup_status = ?';
    countQuery += ' AND followup_status = ?';
    params.push(followup_status);
    countParams.push(followup_status);
  }
  
  if (assignee) {
    query += ' AND assignee LIKE ?';
    countQuery += ' AND assignee LIKE ?';
    params.push(`%${assignee}%`);
    countParams.push(`%${assignee}%`);
  }
  
  if (store_name) {
    query += ' AND store_name LIKE ?';
    countQuery += ' AND store_name LIKE ?';
    params.push(`%${store_name}%`);
    countParams.push(`%${store_name}%`);
  }
  
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(page_size), (parseInt(page) - 1) * parseInt(page_size));
  
  db.all(query, params, (err, rows) => {
    if (err) {
      db.close();
      res.status(500).json({ error: err.message });
      return;
    }
    db.get(countQuery, countParams, (err, countResult) => {
      db.close();
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({
        data: rows,
        pagination: {
          page: parseInt(page),
          page_size: parseInt(page_size),
          total: countResult.total,
          total_pages: Math.ceil(countResult.total / parseInt(page_size))
        }
      });
    });
  });
};

exports.get = (req, res) => {
  const db = getDbConnection();
  const { id } = req.params;
  
  db.get('SELECT * FROM followup_records WHERE id = ?', [id], (err, row) => {
    db.close();
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: '记录不存在' });
      return;
    }
    res.json(row);
  });
};

exports.exportCsv = (req, res) => {
  const db = getDbConnection();
  const { start_date, end_date, followup_status, assignee, store_name } = req.query;
  
  let query = 'SELECT * FROM followup_records WHERE 1=1';
  const params = [];
  
  if (start_date) {
    query += ' AND original_appointment_date >= ?';
    params.push(start_date);
  }
  
  if (end_date) {
    query += ' AND original_appointment_date <= ?';
    params.push(end_date);
  }
  
  if (followup_status) {
    query += ' AND followup_status = ?';
    params.push(followup_status);
  }
  
  if (assignee) {
    query += ' AND assignee LIKE ?';
    params.push(`%${assignee}%`);
  }
  
  if (store_name) {
    query += ' AND store_name LIKE ?';
    params.push(`%${store_name}%`);
  }
  
  query += ' ORDER BY created_at DESC';
  
  db.all(query, params, (err, rows) => {
    db.close();
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    const fields = [
      'followup_no', 'client_name', 'client_phone',
      'original_appointment_date', 'original_appointment_time',
      'counselor_name', 'store_name',
      'reschedule_count', 'reschedule_reason',
      'followup_status', 'followup_result', 'followup_date', 'followup_note',
      'next_appointment_date', 'next_appointment_time',
      'assignee', 'created_at'
    ];
    
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(rows);
    
    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.attachment(`followup_records_${new Date().toISOString().slice(0, 10)}.csv`);
    res.send('\uFEFF' + csv);
  });
};

exports.batchImport = (req, res) => {
  const db = getDbConnection();
  const records = req.body;
  
  if (!Array.isArray(records)) {
    db.close();
    res.status(400).json({ error: '请求数据必须是数组' });
    return;
  }
  
  const results = [];
  
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    
    const processRecord = (index) => {
      if (index >= records.length) {
        db.run('COMMIT', (err) => {
          db.close();
          if (err) {
            res.status(500).json({ error: err.message, results });
            return;
          }
          res.json({
            total: records.length,
            success: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            results
          });
        });
        return;
      }
      
      const data = records[index];
      let error = null;
      
      if (!data.client_name || !data.client_phone) {
        error = '来访者姓名和电话不能为空';
      }
      
      if (!data.original_appointment_date || !data.original_appointment_time) {
        error = '原预约日期和时间不能为空';
      }
      
      if (data.reschedule_count >= config.MAX_RESCHEDULE_TIMES) {
        error = `改约次数超过限制（最多${config.MAX_RESCHEDULE_TIMES}次）`;
      }
      
      if (error) {
        results.push({
          index,
          success: false,
          error,
          data
        });
        processRecord(index + 1);
        return;
      }
      
      const followupNo = generateFollowupNo();
      
      db.run(`
        INSERT INTO followup_records (
          followup_no, client_id, client_name, client_phone,
          original_appointment_id, original_appointment_date, original_appointment_time,
          counselor_id, counselor_name, store_id, store_name,
          reschedule_count, last_reschedule_date, reschedule_reason,
          followup_status, followup_result, followup_date, followup_note,
          next_appointment_date, next_appointment_time, assignee
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        followupNo,
        data.client_id, data.client_name, data.client_phone,
        data.original_appointment_id,
        data.original_appointment_date, data.original_appointment_time,
        data.counselor_id, data.counselor_name,
        data.store_id, data.store_name,
        data.reschedule_count || 0,
        data.last_reschedule_date,
        data.reschedule_reason,
        data.followup_status || 'pending',
        data.followup_result,
        data.followup_date,
        data.followup_note,
        data.next_appointment_date,
        data.next_appointment_time,
        data.assignee
      ], function(err) {
        if (err) {
          results.push({
            index,
            success: false,
            error: err.message,
            data
          });
        } else {
          results.push({
            index,
            success: true,
            id: this.lastID,
            followup_no: followupNo
          });
        }
        processRecord(index + 1);
      });
    };
    
    processRecord(0);
  });
};
