const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const csv = require('csv-parser');
const { Parser } = require('json2csv');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const dbPath = path.join(__dirname, 'cleaning.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err);
  } else {
    console.log('数据库连接成功');
  }
});

const upload = multer({ dest: 'uploads/' });

const logAudit = (tableName, recordId, action, oldValues, newValues, modifiedBy) => {
  db.run(`INSERT INTO audit_logs (table_name, record_id, action, old_values, new_values, modified_by) 
          VALUES (?, ?, ?, ?, ?, ?)`,
    [tableName, recordId, action, JSON.stringify(oldValues), JSON.stringify(newValues), modifiedBy]);
};

app.get('/api/dashboard', (req, res) => {
  db.serialize(() => {
    const result = {};
    
    db.get(`SELECT COUNT(*) as total FROM cleaning_assignments WHERE status = 'assigned'`, (err, row) => {
      result.pendingAssignments = row.total;
    });
    
    db.get(`SELECT COUNT(*) as total FROM rework_records WHERE rework_status = 'pending'`, (err, row) => {
      result.pendingReworks = row.total;
    });
    
    db.get(`SELECT COUNT(*) as total FROM rework_records WHERE rework_status = 'in_progress'`, (err, row) => {
      result.inProgressReworks = row.total;
    });
    
    db.get(`SELECT COUNT(*) as total FROM material_consumption WHERE status = 'anomaly'`, (err, row) => {
      result.materialAnomalies = row.total;
    });
    
    db.all(`SELECT * FROM rework_records WHERE rework_status IN ('pending', 'in_progress') ORDER BY complaint_date DESC LIMIT 10`, (err, rows) => {
      result.recentComplaints = rows;
    });
    
    db.all(`SELECT * FROM cleaning_assignments WHERE status IN ('assigned', 'in_progress') ORDER BY scheduled_date ASC LIMIT 10`, (err, rows) => {
      result.upcomingAssignments = rows;
    });
    
    setTimeout(() => res.json(result), 100);
  });
});

app.get('/api/properties', (req, res) => {
  db.all(`SELECT * FROM properties ORDER BY name`, (err, rows) => {
    res.json(rows);
  });
});

app.get('/api/cleaners', (req, res) => {
  db.all(`SELECT * FROM cleaners ORDER BY name`, (err, rows) => {
    res.json(rows);
  });
});

app.get('/api/calendar', (req, res) => {
  const { startDate, endDate, propertyId } = req.query;
  let query = `SELECT ce.*, p.name as property_name FROM calendar_events ce 
               JOIN properties p ON ce.property_id = p.id WHERE 1=1`;
  const params = [];
  
  if (startDate) {
    query += ` AND ce.date >= ?`;
    params.push(startDate);
  }
  if (endDate) {
    query += ` AND ce.date <= ?`;
    params.push(endDate);
  }
  if (propertyId) {
    query += ` AND ce.property_id = ?`;
    params.push(propertyId);
  }
  query += ` ORDER BY ce.date DESC`;
  
  db.all(query, params, (err, rows) => {
    res.json(rows);
  });
});

app.get('/api/checkout-events', (req, res) => {
  db.all(`SELECT ce.*, p.name as property_name FROM checkout_events ce 
          JOIN properties p ON ce.property_id = p.id ORDER BY ce.checkout_date DESC`, (err, rows) => {
    res.json(rows);
  });
});

app.get('/api/cleaning-assignments', (req, res) => {
  const { status, propertyId, cleanerId, startDate, endDate } = req.query;
  let query = `SELECT ca.*, p.name as property_name FROM cleaning_assignments ca 
               JOIN properties p ON ca.property_id = p.id WHERE 1=1`;
  const params = [];
  
  if (status) {
    query += ` AND ca.status = ?`;
    params.push(status);
  }
  if (propertyId) {
    query += ` AND ca.property_id = ?`;
    params.push(propertyId);
  }
  if (cleanerId) {
    query += ` AND ca.cleaner_id = ?`;
    params.push(cleanerId);
  }
  if (startDate) {
    query += ` AND ca.scheduled_date >= ?`;
    params.push(startDate);
  }
  if (endDate) {
    query += ` AND ca.scheduled_date <= ?`;
    params.push(endDate);
  }
  query += ` ORDER BY ca.scheduled_date DESC`;
  
  db.all(query, params, (err, rows) => {
    res.json(rows);
  });
});

app.put('/api/cleaning-assignments/:id', (req, res) => {
  const id = req.params.id;
  const { status, quality_score, inspection_notes, modified_by } = req.body;
  
  db.get(`SELECT * FROM cleaning_assignments WHERE id = ?`, [id], (err, oldRow) => {
    if (err || !oldRow) {
      return res.status(404).json({ error: '记录不存在' });
    }
    
    const oldValues = { status: oldRow.status, quality_score: oldRow.quality_score, inspection_notes: oldRow.inspection_notes };
    const newValues = { status, quality_score, inspection_notes };
    
    db.run(`UPDATE cleaning_assignments SET status = ?, quality_score = ?, inspection_notes = ?, 
            old_values = ?, new_values = ?, modified_by = ?, modified_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [status, quality_score, inspection_notes, JSON.stringify(oldValues), JSON.stringify(newValues), modified_by, id],
      (err) => {
        if (err) {
          res.status(500).json({ error: err.message });
        } else {
          logAudit('cleaning_assignments', id, 'update', oldValues, newValues, modified_by);
          res.json({ success: true });
        }
      });
  });
});

app.get('/api/rework-records', (req, res) => {
  const { status, responsible_person, startDate, endDate } = req.query;
  let query = `SELECT rr.*, p.name as property_name, ca.cleaner_name 
               FROM rework_records rr 
               JOIN cleaning_assignments ca ON rr.cleaning_assignment_id = ca.id
               JOIN properties p ON ca.property_id = p.id WHERE 1=1`;
  const params = [];
  
  if (status) {
    query += ` AND rr.rework_status = ?`;
    params.push(status);
  }
  if (responsible_person) {
    query += ` AND rr.responsible_person = ?`;
    params.push(responsible_person);
  }
  if (startDate) {
    query += ` AND rr.complaint_date >= ?`;
    params.push(startDate);
  }
  if (endDate) {
    query += ` AND rr.complaint_date <= ?`;
    params.push(endDate);
  }
  query += ` ORDER BY rr.complaint_date DESC`;
  
  db.all(query, params, (err, rows) => {
    res.json(rows);
  });
});

app.post('/api/rework-records', (req, res) => {
  const { cleaning_assignment_id, complaint_source, complaint_date, complaint_type, description, 
          responsible_person, rework_assign_to, rework_scheduled_date, created_by } = req.body;
  
  db.run(`INSERT INTO rework_records (cleaning_assignment_id, complaint_source, complaint_date, 
          complaint_type, description, responsible_person, rework_assign_to, rework_scheduled_date, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [cleaning_assignment_id, complaint_source, complaint_date, complaint_type, description, 
     responsible_person, rework_assign_to, rework_scheduled_date, created_by],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json({ id: this.lastID, success: true });
      }
    });
});

app.put('/api/rework-records/:id', (req, res) => {
  const id = req.params.id;
  const { rework_status, rework_completion_date, resolution_notes } = req.body;
  
  db.run(`UPDATE rework_records SET rework_status = ?, rework_completion_date = ?, resolution_notes = ? WHERE id = ?`,
    [rework_status, rework_completion_date, resolution_notes, id],
    (err) => {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json({ success: true });
      }
    });
});

app.get('/api/materials', (req, res) => {
  db.all(`SELECT * FROM materials ORDER BY name`, (err, rows) => {
    res.json(rows);
  });
});

app.get('/api/material-consumption', (req, res) => {
  const { status } = req.query;
  let query = `SELECT mc.*, m.name as material_name, ca.cleaner_name 
               FROM material_consumption mc 
               JOIN materials m ON mc.material_id = m.id
               JOIN cleaning_assignments ca ON mc.cleaning_assignment_id = ca.id WHERE 1=1`;
  const params = [];
  
  if (status) {
    query += ` AND mc.status = ?`;
    params.push(status);
  }
  query += ` ORDER BY mc.created_at DESC`;
  
  db.all(query, params, (err, rows) => {
    res.json(rows);
  });
});

app.get('/api/performance', (req, res) => {
  const { month } = req.query;
  db.all(`SELECT pr.*, c.name as cleaner_name FROM performance_reviews pr 
          JOIN cleaners c ON pr.cleaner_id = c.id 
          ${month ? 'WHERE pr.month = ?' : ''} ORDER BY pr.month DESC, c.name`,
    month ? [month] : [], (err, rows) => {
      res.json(rows);
    });
});

app.post('/api/performance/:id/adjust', (req, res) => {
  const id = req.params.id;
  const { manual_adjustment, adjustment_reason, adjusted_by } = req.body;
  
  db.get(`SELECT * FROM performance_reviews WHERE id = ?`, [id], (err, row) => {
    if (!row) return res.status(404).json({ error: '记录不存在' });
    
    const final_score = row.avg_score + manual_adjustment;
    db.run(`UPDATE performance_reviews SET manual_adjustment = ?, adjustment_reason = ?, 
            adjusted_by = ?, final_score = ? WHERE id = ?`,
      [manual_adjustment, adjustment_reason, adjusted_by, final_score, id],
      (err) => {
        if (err) {
          res.status(500).json({ error: err.message });
        } else {
          logAudit('performance_reviews', id, 'adjust', 
            { manual_adjustment: row.manual_adjustment, final_score: row.final_score },
            { manual_adjustment, final_score }, adjusted_by);
          res.json({ success: true });
        }
      });
  });
});

app.get('/api/audit-logs', (req, res) => {
  const { tableName, recordId } = req.query;
  let query = `SELECT * FROM audit_logs WHERE 1=1`;
  const params = [];
  
  if (tableName) {
    query += ` AND table_name = ?`;
    params.push(tableName);
  }
  if (recordId) {
    query += ` AND record_id = ?`;
    params.push(recordId);
  }
  query += ` ORDER BY modified_at DESC LIMIT 100`;
  
  db.all(query, params, (err, rows) => {
    res.json(rows);
  });
});

app.post('/api/import', upload.single('file'), (req, res) => {
  const results = [];
  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', () => {
      fs.unlinkSync(req.file.path);
      res.json({ success: true, count: results.length, data: results });
    });
});

app.get('/api/export/rework', (req, res) => {
  const { responsible_person, startDate, endDate, status } = req.query;
  let query = `SELECT rr.*, p.name as property_name, ca.cleaner_name 
               FROM rework_records rr 
               JOIN cleaning_assignments ca ON rr.cleaning_assignment_id = ca.id
               JOIN properties p ON ca.property_id = p.id WHERE 1=1`;
  const params = [];
  
  if (responsible_person) {
    query += ` AND rr.responsible_person = ?`;
    params.push(responsible_person);
  }
  if (startDate) {
    query += ` AND rr.complaint_date >= ?`;
    params.push(startDate);
  }
  if (endDate) {
    query += ` AND rr.complaint_date <= ?`;
    params.push(endDate);
  }
  if (status) {
    query += ` AND rr.rework_status = ?`;
    params.push(status);
  }
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      const json2csvParser = new Parser();
      const csvData = json2csvParser.parse(rows);
      res.header('Content-Type', 'text/csv');
      res.attachment('rework_records.csv');
      res.send(csvData);
    }
  });
});

app.get('/api/export/cleaning', (req, res) => {
  const { cleanerId, startDate, endDate, status } = req.query;
  let query = `SELECT ca.*, p.name as property_name FROM cleaning_assignments ca 
               JOIN properties p ON ca.property_id = p.id WHERE 1=1`;
  const params = [];
  
  if (cleanerId) {
    query += ` AND ca.cleaner_id = ?`;
    params.push(cleanerId);
  }
  if (startDate) {
    query += ` AND ca.scheduled_date >= ?`;
    params.push(startDate);
  }
  if (endDate) {
    query += ` AND ca.scheduled_date <= ?`;
    params.push(endDate);
  }
  if (status) {
    query += ` AND ca.status = ?`;
    params.push(status);
  }
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      const json2csvParser = new Parser();
      const csvData = json2csvParser.parse(rows);
      res.header('Content-Type', 'text/csv');
      res.attachment('cleaning_assignments.csv');
      res.send(csvData);
    }
  });
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
