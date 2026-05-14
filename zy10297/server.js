const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

const db = new sqlite3.Database('./keys.db');

db.run('PRAGMA foreign_keys = ON');

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS properties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_code TEXT UNIQUE NOT NULL,
      address TEXT NOT NULL,
      owner_name TEXT,
      owner_phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key_code TEXT UNIQUE NOT NULL,
      property_id INTEGER NOT NULL,
      status TEXT DEFAULT 'available',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (property_id) REFERENCES properties(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS agents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      department TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      appointment_code TEXT UNIQUE NOT NULL,
      key_id INTEGER NOT NULL,
      agent_id INTEGER NOT NULL,
      appointment_date DATE NOT NULL,
      time_slot TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (key_id) REFERENCES keys(id),
      FOREIGN KEY (agent_id) REFERENCES agents(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS borrow_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      borrow_code TEXT UNIQUE NOT NULL,
      key_id INTEGER NOT NULL,
      agent_id INTEGER NOT NULL,
      appointment_id INTEGER,
      borrow_time DATETIME NOT NULL,
      expected_return_time DATETIME NOT NULL,
      actual_return_time DATETIME,
      status TEXT DEFAULT 'borrowed',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (key_id) REFERENCES keys(id),
      FOREIGN KEY (agent_id) REFERENCES agents(id),
      FOREIGN KEY (appointment_id) REFERENCES appointments(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS loss_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      loss_code TEXT UNIQUE NOT NULL,
      key_id INTEGER NOT NULL,
      agent_id INTEGER NOT NULL,
      loss_date DATE NOT NULL,
      lock_change_fee DECIMAL(10, 2) NOT NULL,
      fee_paid BOOLEAN DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (key_id) REFERENCES keys(id),
      FOREIGN KEY (agent_id) REFERENCES agents(id)
    )
  `);
});

function generateCode(prefix) {
  return prefix + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 5).toUpperCase();
}

function formatSQLiteDate(date) {
  return date.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
}

app.get('/api/properties', (req, res) => {
  db.all('SELECT * FROM properties ORDER BY created_at DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/properties', (req, res) => {
  const { property_code, address, owner_name, owner_phone } = req.body;
  db.get('SELECT id FROM properties WHERE property_code = ?', [property_code], (err, existing) => {
    if (err) return res.status(500).json({ error: err.message });
    if (existing) return res.status(400).json({ error: '房源编号已存在' });
    
    db.run('INSERT INTO properties (property_code, address, owner_name, owner_phone) VALUES (?, ?, ?, ?)', 
      [property_code, address, owner_name, owner_phone], function(err) {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ id: this.lastID, property_code, address, owner_name, owner_phone });
      });
  });
});

app.get('/api/keys', (req, res) => {
  db.all(`
    SELECT k.*, p.address, p.property_code,
           (SELECT br.borrow_time FROM borrow_records br WHERE br.key_id = k.id AND br.status = 'borrowed' ORDER BY br.borrow_time DESC LIMIT 1) as borrow_time,
           (SELECT br.expected_return_time FROM borrow_records br WHERE br.key_id = k.id AND br.status = 'borrowed' ORDER BY br.borrow_time DESC LIMIT 1) as expected_return_time,
           (SELECT a.name FROM borrow_records br JOIN agents a ON br.agent_id = a.id WHERE br.key_id = k.id AND br.status = 'borrowed' ORDER BY br.borrow_time DESC LIMIT 1) as borrower_name
    FROM keys k
    JOIN properties p ON k.property_id = p.id
    ORDER BY k.created_at DESC
  `, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/keys', (req, res) => {
  const { key_code, property_id } = req.body;
  db.get('SELECT id FROM keys WHERE key_code = ?', [key_code], (err, existing) => {
    if (err) return res.status(500).json({ error: err.message });
    if (existing) return res.status(400).json({ error: '钥匙编号已存在' });
    
    db.run('INSERT INTO keys (key_code, property_id) VALUES (?, ?)', [key_code, property_id], function(err) {
      if (err) return res.status(400).json({ error: err.message });
      res.json({ id: this.lastID, key_code, property_id, status: 'available' });
    });
  });
});

app.get('/api/agents', (req, res) => {
  db.all('SELECT * FROM agents ORDER BY created_at DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/agents', (req, res) => {
  const { agent_code, name, phone, department } = req.body;
  db.get('SELECT id FROM agents WHERE agent_code = ?', [agent_code], (err, existing) => {
    if (err) return res.status(500).json({ error: err.message });
    if (existing) return res.status(400).json({ error: '经纪人编号已存在' });
    
    db.run('INSERT INTO agents (agent_code, name, phone, department) VALUES (?, ?, ?, ?)', 
      [agent_code, name, phone, department], function(err) {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ id: this.lastID, agent_code, name, phone, department });
      });
  });
});

app.get('/api/appointments', (req, res) => {
  db.all(`
    SELECT a.*, k.key_code, p.address, ag.name as agent_name
    FROM appointments a
    JOIN keys k ON a.key_id = k.id
    JOIN properties p ON k.property_id = p.id
    JOIN agents ag ON a.agent_id = ag.id
    ORDER BY a.appointment_date DESC, a.created_at DESC
  `, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/appointments', (req, res) => {
  const { key_id, agent_id, appointment_date, time_slot, notes } = req.body;
  
  db.get(`
    SELECT id FROM appointments 
    WHERE key_id = ? AND appointment_date = ? AND time_slot = ? AND status = 'pending'
  `, [key_id, appointment_date, time_slot], (err, existing) => {
    if (err) return res.status(500).json({ error: err.message });
    if (existing) return res.status(400).json({ error: '该钥匙在该时段已有待执行预约，请勿重复预约' });

    const appointment_code = generateCode('APT');
    db.run('INSERT INTO appointments (appointment_code, key_id, agent_id, appointment_date, time_slot, notes) VALUES (?, ?, ?, ?, ?, ?)', 
      [appointment_code, key_id, agent_id, appointment_date, time_slot, notes], function(err) {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ id: this.lastID, appointment_code, key_id, agent_id, appointment_date, time_slot, notes, status: 'pending' });
      });
  });
});

app.get('/api/borrow-records', (req, res) => {
  db.all(`
    SELECT br.*, k.key_code, p.address, ag.name as agent_name, a.appointment_code
    FROM borrow_records br
    JOIN keys k ON br.key_id = k.id
    JOIN properties p ON k.property_id = p.id
    JOIN agents ag ON br.agent_id = ag.id
    LEFT JOIN appointments a ON br.appointment_id = a.id
    ORDER BY br.borrow_time DESC
  `, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/borrow', (req, res) => {
  const { key_id, agent_id, appointment_id, expected_return_hours, notes } = req.body;
  
  if (!appointment_id) {
    return res.status(400).json({ error: '必须提供预约 ID，请先创建带看预约再借出钥匙' });
  }

  db.get(`
    SELECT a.id, a.key_id, a.agent_id, a.status, a.appointment_date,
           k.status as key_status
    FROM appointments a
    JOIN keys k ON a.key_id = k.id
    WHERE a.id = ?
  `, [appointment_id], (err, appointment) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!appointment) return res.status(400).json({ error: '预约不存在，请检查预约 ID' });

    if (appointment.status !== 'pending') {
      return res.status(400).json({ error: '该预约状态无效，可能已执行或已取消' });
    }

    if (appointment.appointment_date < new Date().toISOString().split('T')[0]) {
      return res.status(400).json({ error: '该预约已过期，请创建新的预约' });
    }

    if (key_id && appointment.key_id !== key_id) {
      return res.status(400).json({ error: '钥匙 ID 与预约不匹配' });
    }

    if (agent_id && appointment.agent_id !== agent_id) {
      return res.status(400).json({ error: '经纪人 ID 与预约不匹配' });
    }

    if (appointment.key_status === 'lost') {
      return res.status(400).json({ error: '钥匙已丢失，无法借出' });
    }

    if (appointment.key_status === 'borrowed') {
      return res.status(400).json({ error: '钥匙已被借出' });
    }

    const actualKeyId = key_id || appointment.key_id;
    const actualAgentId = agent_id || appointment.agent_id;

    const borrow_time = formatSQLiteDate(new Date());
    const expected_return_time = formatSQLiteDate(new Date(Date.now() + (expected_return_hours || 4) * 60 * 60 * 1000));
    const borrow_code = generateCode('BRW');

    db.run(`
      INSERT INTO borrow_records (borrow_code, key_id, agent_id, appointment_id, borrow_time, expected_return_time, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [borrow_code, actualKeyId, actualAgentId, appointment_id, borrow_time, expected_return_time, notes], function(err) {
      if (err) return res.status(400).json({ error: err.message });
      const borrowId = this.lastID;

      db.run('UPDATE keys SET status = ? WHERE id = ?', ['borrowed', actualKeyId], (err) => {
        if (err) return res.status(500).json({ error: err.message });

        db.run('UPDATE appointments SET status = ? WHERE id = ?', ['completed', appointment_id], (err) => {
          if (err) console.error(err);
        });

        res.json({ 
          id: borrowId, 
          borrow_code, 
          key_id: actualKeyId, 
          agent_id: actualAgentId, 
          appointment_id,
          borrow_time, 
          expected_return_time, 
          status: 'borrowed', 
          hasAppointment: true 
        });
      });
    });
  });
});

app.post('/api/return', (req, res) => {
  const { borrow_record_id, notes } = req.body;
  
  db.get('SELECT * FROM borrow_records WHERE id = ?', [borrow_record_id], (err, record) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!record) return res.status(400).json({ error: '借用记录不存在' });
    if (record.status === 'returned') return res.status(400).json({ error: '该钥匙已归还' });
    if (record.status === 'lost') return res.status(400).json({ error: '该钥匙已登记丢失，无法归还，请走丢失赔付流程' });

    db.get('SELECT status FROM keys WHERE id = ?', [record.key_id], (err, key) => {
      if (err) return res.status(500).json({ error: err.message });
      if (key.status === 'lost') return res.status(400).json({ error: '该钥匙已登记丢失，无法归还，请走丢失赔付流程' });

      const actual_return_time = formatSQLiteDate(new Date());
      db.run('UPDATE borrow_records SET actual_return_time = ?, status = ?, notes = COALESCE(?, notes) WHERE id = ?', 
        [actual_return_time, 'returned', notes, borrow_record_id], (err) => {
          if (err) return res.status(400).json({ error: err.message });
          
          db.run('UPDATE keys SET status = ? WHERE id = ?', ['available', record.key_id], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, actual_return_time });
          });
        });
    });
  });
});

app.get('/api/loss-records', (req, res) => {
  db.all(`
    SELECT lr.*, k.key_code, p.address, ag.name as agent_name
    FROM loss_records lr
    JOIN keys k ON lr.key_id = k.id
    JOIN properties p ON k.property_id = p.id
    JOIN agents ag ON lr.agent_id = ag.id
    ORDER BY lr.loss_date DESC
  `, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/report-loss', (req, res) => {
  const { key_id, agent_id, loss_date, lock_change_fee, notes } = req.body;
  
  db.get('SELECT status FROM keys WHERE id = ?', [key_id], (err, key) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!key) return res.status(400).json({ error: '钥匙不存在' });
    if (key.status === 'lost') return res.status(400).json({ error: '该钥匙已报失' });

    db.get('SELECT id FROM loss_records WHERE key_id = ? AND agent_id = ? AND loss_date = ?', 
      [key_id, agent_id, loss_date], (err, existingLoss) => {
        if (err) return res.status(500).json({ error: err.message });
        if (existingLoss) return res.status(400).json({ error: '该丢失记录已存在，请勿重复提交' });

        const loss_code = generateCode('LSS');
        db.run(`
          INSERT INTO loss_records (loss_code, key_id, agent_id, loss_date, lock_change_fee, notes)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [loss_code, key_id, agent_id, loss_date, lock_change_fee, notes], function(err) {
          if (err) return res.status(400).json({ error: err.message });
          const lossId = this.lastID;

          db.run('UPDATE keys SET status = ? WHERE id = ?', ['lost', key_id], (err) => {
            if (err) return res.status(500).json({ error: err.message });

            db.get('SELECT id FROM borrow_records WHERE key_id = ? AND status = ?', [key_id, 'borrowed'], (err, openBorrow) => {
              if (openBorrow) {
                db.run('UPDATE borrow_records SET status = ? WHERE id = ?', ['lost', openBorrow.id], (err) => {
                  if (err) console.error(err);
                });
              }

              res.json({ id: lossId, loss_code, key_id, agent_id, loss_date, lock_change_fee, notes });
            });
          });
        });
      });
  });
});

app.get('/api/key-timeline/:key_id', (req, res) => {
  const { key_id } = req.params;
  db.all(`
    SELECT 'borrow' as type, borrow_time as time, '借出' as event, ag.name as person, br.status
    FROM borrow_records br
    JOIN agents ag ON br.agent_id = ag.id
    WHERE br.key_id = ?
    UNION ALL
    SELECT 'return' as type, actual_return_time as time, '归还' as event, ag.name as person, br.status
    FROM borrow_records br
    JOIN agents ag ON br.agent_id = ag.id
    WHERE br.key_id = ? AND br.actual_return_time IS NOT NULL
    UNION ALL
    SELECT 'loss' as type, loss_date as time, '丢失' as event, ag.name as person, 'lost' as status
    FROM loss_records lr
    JOIN agents ag ON lr.agent_id = ag.id
    WHERE lr.key_id = ?
    ORDER BY time DESC
  `, [key_id, key_id, key_id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/export-compensation', (req, res) => {
  db.all(`
    SELECT 
      lr.loss_code as '丢失编号',
      k.key_code as '钥匙编号',
      p.address as '房源地址',
      ag.name as '责任人',
      lr.loss_date as '丢失日期',
      lr.lock_change_fee as '换锁费用',
      CASE WHEN lr.fee_paid THEN '已赔付' ELSE '未赔付' END as '赔付状态',
      lr.notes as '备注'
    FROM loss_records lr
    JOIN keys k ON lr.key_id = k.id
    JOIN properties p ON k.property_id = p.id
    JOIN agents ag ON lr.agent_id = ag.id
    ORDER BY lr.loss_date DESC
  `, (err, records) => {
    if (err) return res.status(500).json({ error: err.message });

    const ws = xlsx.utils.json_to_sheet(records);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, '钥匙赔付记录');
    
    const filePath = path.join(__dirname, 'temp_compensation.xlsx');
    xlsx.writeFile(wb, filePath);
    
    res.download(filePath, '钥匙赔付记录.xlsx', (err) => {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });
  });
});

app.get('/api/statistics', (req, res) => {
  db.get('SELECT COUNT(*) as count FROM keys', (err, total) => {
    if (err) return res.status(500).json({ error: err.message });
    
    db.get("SELECT COUNT(*) as count FROM keys WHERE status = 'borrowed'", (err, borrowed) => {
      if (err) return res.status(500).json({ error: err.message });
      
      db.get("SELECT COUNT(*) as count FROM keys WHERE status = 'lost'", (err, lost) => {
        if (err) return res.status(500).json({ error: err.message });
        
        db.get(`
          SELECT COUNT(*) as count 
          FROM borrow_records 
          WHERE status = 'borrowed' AND expected_return_time < DATETIME('now')
        `, (err, overdue) => {
          if (err) return res.status(500).json({ error: err.message });
          
          db.get('SELECT SUM(lock_change_fee) as total FROM loss_records', (err, compensation) => {
            if (err) return res.status(500).json({ error: err.message });
            
            const totalKeys = total.count;
            const borrowedKeys = borrowed.count;
            const lostKeys = lost.count;
            const availableKeys = totalKeys - borrowedKeys - lostKeys;
            
            res.json({
              totalKeys,
              borrowedKeys,
              lostKeys,
              availableKeys,
              overdue: overdue.count,
              totalCompensation: compensation.total || 0
            });
          });
        });
      });
    });
  });
});

app.get('/api/overdue-records', (req, res) => {
  db.all(`
    SELECT br.*, k.key_code, p.address, ag.name as agent_name,
           JULIANDAY('now') - JULIANDAY(br.expected_return_time) as overdue_hours
    FROM borrow_records br
    JOIN keys k ON br.key_id = k.id
    JOIN properties p ON k.property_id = p.id
    JOIN agents ag ON br.agent_id = ag.id
    WHERE br.status = 'borrowed' AND br.expected_return_time < DATETIME('now')
    ORDER BY br.expected_return_time ASC
  `, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.listen(PORT, () => {
  console.log(`房产钥匙托管台系统运行在 http://localhost:${PORT}`);
});
