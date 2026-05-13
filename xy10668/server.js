const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const { Parser } = require('json2csv');
const db = require('./database');
const sampleData = require('./sample-data');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

function logOperation(operationType, targetId, targetType, operator, description) {
  const logId = uuidv4();
  db.run(
    `INSERT INTO operation_logs (id, operation_type, target_id, target_type, operator, description)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [logId, operationType, targetId, targetType, operator, description]
  );
}

function recordHistory(tableName, recordId, fieldName, oldValue, newValue, operator) {
  const historyId = uuidv4();
  const historyTable = tableName + '_history';
  const idColumn = tableName.replace(/_/g, '').slice(0, -1) + '_id';
  db.run(
    `INSERT INTO ${historyTable} (id, ${idColumn}, field_name, old_value, new_value, operator)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [historyId, recordId, fieldName, oldValue, newValue, operator]
  );
}

app.get('/api/packages', (req, res) => {
  db.all(`SELECT * FROM packages ORDER BY created_at DESC`, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/packages', (req, res) => {
  const { tracking_number, sender, receiver, origin, destination, operator } = req.body;
  const id = uuidv4();
  db.run(
    `INSERT INTO packages (id, tracking_number, sender, receiver, origin, destination)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, tracking_number, sender, receiver, origin, destination],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      logOperation('create', id, 'package', operator, `创建包裹 ${tracking_number}`);
      res.json({ id, ...req.body });
    }
  );
});

app.put('/api/packages/:id', (req, res) => {
  const { operator } = req.body;
  const packageId = req.params.id;
  
  db.get(`SELECT * FROM packages WHERE id = ?`, [packageId], (err, oldPackage) => {
    if (err || !oldPackage) return res.status(404).json({ error: 'Package not found' });
    
    const updates = [];
    const values = [];
    const fields = ['tracking_number', 'sender', 'receiver', 'origin', 'destination', 'status'];
    
    fields.forEach(field => {
      if (req.body[field] !== undefined && req.body[field] !== oldPackage[field]) {
        updates.push(`${field} = ?`);
        values.push(req.body[field]);
        recordHistory('packages', packageId, field, oldPackage[field], req.body[field], operator);
      }
    });
    
    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(packageId);
      
      db.run(
        `UPDATE packages SET ${updates.join(', ')} WHERE id = ?`,
        values,
        function(err) {
          if (err) return res.status(500).json({ error: err.message });
          logOperation('update', packageId, 'package', operator, `更新包裹信息`);
          res.json({ success: true });
        }
      );
    } else {
      res.json({ success: true, message: 'No changes' });
    }
  });
});

app.get('/api/packages/:id/tracks', (req, res) => {
  db.all(
    `SELECT * FROM package_tracks WHERE package_id = ? ORDER BY created_at DESC`,
    [req.params.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

app.post('/api/packages/:id/tracks', (req, res) => {
  const { location, status, description, operator } = req.body;
  const id = uuidv4();
  db.run(
    `INSERT INTO package_tracks (id, package_id, location, status, description, operator)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, req.params.id, location, status, description, operator],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      logOperation('create', id, 'track', operator, `添加包裹轨迹: ${description}`);
      res.json({ id, ...req.body });
    }
  );
});

app.put('/api/tracks/:id', (req, res) => {
  const { operator } = req.body;
  const trackId = req.params.id;
  
  db.get(`SELECT * FROM package_tracks WHERE id = ?`, [trackId], (err, oldTrack) => {
    if (err || !oldTrack) return res.status(404).json({ error: 'Track not found' });
    
    const updates = [];
    const values = [];
    const fields = ['location', 'status', 'description'];
    
    fields.forEach(field => {
      if (req.body[field] !== undefined && req.body[field] !== oldTrack[field]) {
        updates.push(`${field} = ?`);
        values.push(req.body[field]);
        recordHistory('package_tracks', trackId, field, oldTrack[field], req.body[field], operator);
      }
    });
    
    if (updates.length > 0) {
      values.push(trackId);
      db.run(
        `UPDATE package_tracks SET ${updates.join(', ')} WHERE id = ?`,
        values,
        function(err) {
          if (err) return res.status(500).json({ error: err.message });
          logOperation('update', trackId, 'track', operator, `更新轨迹信息`);
          res.json({ success: true });
        }
      );
    } else {
      res.json({ success: true });
    }
  });
});

app.get('/api/branch-shifts', (req, res) => {
  db.all(`SELECT * FROM branch_shifts ORDER BY shift_date DESC`, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/branch-shifts', (req, res) => {
  const { branch_name, shift_code, shift_date, start_time, end_time, manager, operator } = req.body;
  const id = uuidv4();
  db.run(
    `INSERT INTO branch_shifts (id, branch_name, shift_code, shift_date, start_time, end_time, manager)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, branch_name, shift_code, shift_date, start_time, end_time, manager],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      logOperation('create', id, 'shift', operator, `创建班次 ${shift_code}`);
      res.json({ id, ...req.body });
    }
  );
});

app.put('/api/branch-shifts/:id', (req, res) => {
  const { operator } = req.body;
  const shiftId = req.params.id;
  
  db.get(`SELECT * FROM branch_shifts WHERE id = ?`, [shiftId], (err, oldShift) => {
    if (err || !oldShift) return res.status(404).json({ error: 'Shift not found' });
    
    const updates = [];
    const values = [];
    const fields = ['branch_name', 'shift_code', 'shift_date', 'start_time', 'end_time', 'manager', 'status'];
    
    fields.forEach(field => {
      if (req.body[field] !== undefined && req.body[field] !== oldShift[field]) {
        updates.push(`${field} = ?`);
        values.push(req.body[field]);
        recordHistory('branch_shifts', shiftId, field, oldShift[field], req.body[field], operator);
      }
    });
    
    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(shiftId);
      db.run(
        `UPDATE branch_shifts SET ${updates.join(', ')} WHERE id = ?`,
        values,
        function(err) {
          if (err) return res.status(500).json({ error: err.message });
          logOperation('update', shiftId, 'shift', operator, `更新班次信息`);
          res.json({ success: true });
        }
      );
    } else {
      res.json({ success: true });
    }
  });
});

app.get('/api/driver-handovers', (req, res) => {
  db.all(
    `SELECT dh.*, bs.branch_name, bs.shift_code 
     FROM driver_handovers dh 
     LEFT JOIN branch_shifts bs ON dh.shift_id = bs.id 
     ORDER BY dh.created_at DESC`,
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

app.post('/api/driver-handovers', (req, res) => {
  const { shift_id, driver_name, driver_phone, vehicle_number, handover_time, package_count, operator } = req.body;
  const id = uuidv4();
  db.run(
    `INSERT INTO driver_handovers (id, shift_id, driver_name, driver_phone, vehicle_number, handover_time, package_count, operator)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, shift_id, driver_name, driver_phone, vehicle_number, handover_time, package_count, operator],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      logOperation('create', id, 'handover', operator, `创建司机交接: ${driver_name}`);
      res.json({ id, ...req.body });
    }
  );
});

app.put('/api/driver-handovers/:id', (req, res) => {
  const { operator } = req.body;
  const handoverId = req.params.id;
  
  db.get(`SELECT * FROM driver_handovers WHERE id = ?`, [handoverId], (err, oldHandover) => {
    if (err || !oldHandover) return res.status(404).json({ error: 'Handover not found' });
    
    const updates = [];
    const values = [];
    const fields = ['driver_name', 'driver_phone', 'vehicle_number', 'handover_time', 'package_count', 'status'];
    
    fields.forEach(field => {
      if (req.body[field] !== undefined && req.body[field] !== oldHandover[field]) {
        updates.push(`${field} = ?`);
        values.push(req.body[field]);
        recordHistory('driver_handovers', handoverId, field, oldHandover[field], req.body[field], operator);
      }
    });
    
    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(handoverId);
      db.run(
        `UPDATE driver_handovers SET ${updates.join(', ')} WHERE id = ?`,
        values,
        function(err) {
          if (err) return res.status(500).json({ error: err.message });
          logOperation('update', handoverId, 'handover', operator, `更新交接信息`);
          res.json({ success: true });
        }
      );
    } else {
      res.json({ success: true });
    }
  });
});

app.get('/api/misclassifications', (req, res) => {
  db.all(
    `SELECT mr.*, p.tracking_number 
     FROM misclassification_records mr 
     LEFT JOIN packages p ON mr.package_id = p.id 
     ORDER BY mr.created_at DESC`,
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

app.post('/api/misclassifications', (req, res) => {
  const { package_id, misclassified_branch, correct_branch, found_time, reporter, description, operator } = req.body;
  const id = uuidv4();
  db.run(
    `INSERT INTO misclassification_records (id, package_id, misclassified_branch, correct_branch, found_time, reporter, description)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, package_id, misclassified_branch, correct_branch, found_time, reporter, description],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      db.run(`UPDATE packages SET status = 'blocked' WHERE id = ?`, [package_id]);
      logOperation('create', id, 'misclassification', operator, `登记错分包裹`);
      res.json({ id, ...req.body });
    }
  );
});

app.put('/api/misclassifications/:id', (req, res) => {
  const { status, operator } = req.body;
  const misId = req.params.id;
  
  db.run(
    `UPDATE misclassification_records SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [status, misId],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      logOperation('update', misId, 'misclassification', operator, `更新错分状态为: ${status}`);
      res.json({ success: true });
    }
  );
});

app.get('/api/reassignments', (req, res) => {
  db.all(
    `SELECT r.*, mr.package_id, p.tracking_number
     FROM reassignments r 
     LEFT JOIN misclassification_records mr ON r.misclassification_id = mr.id
     LEFT JOIN packages p ON mr.package_id = p.id
     ORDER BY r.created_at DESC`,
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

app.post('/api/reassignments', (req, res) => {
  const { misclassification_id, handler, reassign_time, new_route, notes, operator } = req.body;
  const id = uuidv4();
  db.run(
    `INSERT INTO reassignments (id, misclassification_id, handler, reassign_time, new_route, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, misclassification_id, handler, reassign_time, new_route, notes],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      logOperation('create', id, 'reassignment', operator, `创建重派处理`);
      res.json({ id, ...req.body });
    }
  );
});

app.put('/api/reassignments/:id', (req, res) => {
  const { status, operator } = req.body;
  db.run(
    `UPDATE reassignments SET status = ? WHERE id = ?`,
    [status, req.params.id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      logOperation('update', req.params.id, 'reassignment', operator, `更新重派状态为: ${status}`);
      res.json({ success: true });
    }
  );
});

app.get('/api/compensations', (req, res) => {
  db.all(
    `SELECT c.*, mr.package_id, p.tracking_number, mr.misclassified_branch
     FROM compensations c 
     LEFT JOIN misclassification_records mr ON c.misclassification_id = mr.id
     LEFT JOIN packages p ON mr.package_id = p.id
     ORDER BY c.created_at DESC`,
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

app.post('/api/compensations', (req, res) => {
  const { misclassification_id, amount, responsible_person, request_id, notes, operator } = req.body;
  
  db.get(
    `SELECT * FROM compensations WHERE misclassification_id = ? OR request_id = ?`,
    [misclassification_id, request_id],
    (err, existing) => {
      if (existing) {
        return res.json({ 
          success: true, 
          message: 'Compensation already exists', 
          compensation: existing,
          isIdempotent: true
        });
      }
      
      const id = uuidv4();
      db.run(
        `INSERT INTO compensations (id, misclassification_id, amount, responsible_person, request_id, notes, approve_time, status)
         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'approved')`,
        [id, misclassification_id, amount, responsible_person, request_id, notes],
        function(err) {
          if (err) return res.status(500).json({ error: err.message });
          logOperation('create', id, 'compensation', operator, `创建赔付: ¥${amount} 责任人: ${responsible_person}`);
          res.json({ id, ...req.body, status: 'approved' });
        }
      );
    }
  );
});

app.get('/api/operation-logs', (req, res) => {
  db.all(`SELECT * FROM operation_logs ORDER BY created_at DESC LIMIT 100`, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/history/:type/:id', (req, res) => {
  const { type, id } = req.params;
  const tableMap = {
    'track': 'package_track_history',
    'shift': 'branch_shift_history',
    'handover': 'driver_handover_history'
  };
  const idColumnMap = {
    'track': 'track_id',
    'shift': 'shift_id',
    'handover': 'handover_id'
  };
  
  const table = tableMap[type];
  const idColumn = idColumnMap[type];
  
  if (!table) {
    return res.status(400).json({ error: 'Invalid type' });
  }
  
  db.all(
    `SELECT * FROM ${table} WHERE ${idColumn} = ? ORDER BY changed_at DESC`,
    [id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

app.get('/api/export/report', (req, res) => {
  const { responsible_person, start_date, end_date } = req.query;
  
  let query = `
    SELECT 
      c.id,
      p.tracking_number,
      c.amount,
      c.responsible_person,
      c.approve_time,
      c.status,
      mr.misclassified_branch,
      mr.correct_branch,
      r.handler as reassigned_by,
      r.reassign_time
    FROM compensations c
    LEFT JOIN misclassification_records mr ON c.misclassification_id = mr.id
    LEFT JOIN packages p ON mr.package_id = p.id
    LEFT JOIN reassignments r ON mr.id = r.misclassification_id
    WHERE 1=1
  `;
  
  const params = [];
  
  if (responsible_person) {
    query += ` AND c.responsible_person = ?`;
    params.push(responsible_person);
  }
  
  if (start_date) {
    query += ` AND c.approve_time >= ?`;
    params.push(start_date);
  }
  
  if (end_date) {
    query += ` AND c.approve_time <= ?`;
    params.push(end_date);
  }
  
  query += ` ORDER BY c.approve_time DESC`;
  
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    try {
      const parser = new Parser();
      const csv = parser.parse(rows);
      
      res.header('Content-Type', 'text/csv');
      res.attachment(`misclassification_report_${new Date().toISOString().split('T')[0]}.csv`);
      res.send(csv);
    } catch (parseErr) {
      res.status(500).json({ error: parseErr.message });
    }
  });
});

app.get('/api/statistics', (req, res) => {
  db.serialize(() => {
    db.get(`SELECT COUNT(*) as total FROM packages`, (err, packages) => {
      db.get(`SELECT COUNT(*) as total FROM misclassification_records`, (err, misclassifications) => {
        db.get(`SELECT COUNT(*) as total FROM compensations`, (err, compensations) => {
          db.get(`SELECT SUM(amount) as total FROM compensations WHERE status = 'approved'`, (err, totalAmount) => {
            res.json({
              packages: packages.total,
              misclassifications: misclassifications.total,
              compensations: compensations.total,
              totalCompensation: totalAmount.total || 0
            });
          });
        });
      });
    });
  });
});

app.post('/api/init-sample-data', (req, res) => {
  sampleData.initSampleData((err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, message: 'Sample data initialized' });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
