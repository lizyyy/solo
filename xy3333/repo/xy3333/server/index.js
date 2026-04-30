const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./database');

const app = express();
const PORT = 5001;

app.use(cors());
app.use(bodyParser.json());

function addAuditLog(action, details) {
  db.run('INSERT INTO audit_logs (action, details) VALUES (?, ?)', [action, JSON.stringify(details)]);
}

app.get('/api/members', (req, res) => {
  db.all('SELECT * FROM members ORDER BY id', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ members: rows });
  });
});

app.post('/api/members', (req, res) => {
  const { name, role } = req.body;
  if (!name || !role) {
    res.status(400).json({ error: '姓名和角色不能为空' });
    return;
  }
  db.run('INSERT INTO members (name, role) VALUES (?, ?)', [name, role], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    const newMember = { id: this.lastID, name, role };
    addAuditLog('CREATE_MEMBER', newMember);
    res.json({ member: newMember });
  });
});

app.delete('/api/members/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM members WHERE id = ?', [id], (err) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    addAuditLog('DELETE_MEMBER', { id });
    res.json({ success: true });
  });
});

app.get('/api/shift-templates', (req, res) => {
  db.all('SELECT * FROM shift_templates ORDER BY id', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ templates: rows });
  });
});

app.post('/api/shift-templates', (req, res) => {
  const { name, start_time, end_time, color } = req.body;
  if (!name || !start_time || !end_time) {
    res.status(400).json({ error: '班次名称和时间不能为空' });
    return;
  }
  db.run('INSERT INTO shift_templates (name, start_time, end_time, color) VALUES (?, ?, ?, ?)', 
    [name, start_time, end_time, color || '#1890ff'], 
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      const newTemplate = { id: this.lastID, name, start_time, end_time, color: color || '#1890ff' };
      addAuditLog('CREATE_SHIFT_TEMPLATE', newTemplate);
      res.json({ template: newTemplate });
    });
});

app.delete('/api/shift-templates/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM shift_templates WHERE id = ?', [id], (err) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    addAuditLog('DELETE_SHIFT_TEMPLATE', { id });
    res.json({ success: true });
  });
});

app.get('/api/schedules', (req, res) => {
  const sql = `
    SELECT s.id, s.member_id, s.shift_template_id, s.date,
           m.name as member_name, m.role,
           st.name as shift_name, st.start_time, st.end_time, st.color
    FROM schedules s
    JOIN members m ON s.member_id = m.id
    JOIN shift_templates st ON s.shift_template_id = st.id
    ORDER BY s.date, st.start_time
  `;
  db.all(sql, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ schedules: rows });
  });
});

app.post('/api/schedules', (req, res) => {
  const { member_id, shift_template_id, date } = req.body;
  
  if (!member_id || !shift_template_id || !date) {
    res.status(400).json({ error: '成员、班次和日期不能为空' });
    return;
  }
  
  db.get('SELECT id FROM schedules WHERE member_id = ? AND date = ?', [member_id, date], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (row) {
      res.status(400).json({ error: '该成员在该日期已有排班' });
      return;
    }
    
    db.run('INSERT INTO schedules (member_id, shift_template_id, date) VALUES (?, ?, ?)', 
      [member_id, shift_template_id, date], 
      function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        const newSchedule = { id: this.lastID, member_id, shift_template_id, date };
        addAuditLog('CREATE_SCHEDULE', newSchedule);
        res.json({ schedule: newSchedule });
      });
  });
});

app.delete('/api/schedules/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM schedules WHERE id = ?', [id], (err) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    addAuditLog('DELETE_SCHEDULE', { id });
    res.json({ success: true });
  });
});

app.get('/api/swap-requests', (req, res) => {
  const sql = `
    SELECT 
      sr.id, sr.requester_id, sr.responder_id, sr.requester_schedule_id, sr.responder_schedule_id, sr.status, sr.created_at, sr.updated_at,
      req.name as requester_name,
      resp.name as responder_name,
      req_s.date as requester_date, req_st.name as requester_shift,
      resp_s.date as responder_date, resp_st.name as responder_shift
    FROM swap_requests sr
    JOIN members req ON sr.requester_id = req.id
    JOIN members resp ON sr.responder_id = resp.id
    JOIN schedules req_s ON sr.requester_schedule_id = req_s.id
    JOIN shift_templates req_st ON req_s.shift_template_id = req_st.id
    JOIN schedules resp_s ON sr.responder_schedule_id = resp_s.id
    JOIN shift_templates resp_st ON resp_s.shift_template_id = resp_st.id
    ORDER BY sr.created_at DESC
  `;
  db.all(sql, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ requests: rows });
  });
});

app.post('/api/swap-requests', (req, res) => {
  const { requester_id, responder_id, requester_schedule_id, responder_schedule_id } = req.body;
  
  if (!requester_id || !responder_id || !requester_schedule_id || !responder_schedule_id) {
    res.status(400).json({ error: '信息不完整' });
    return;
  }
  
  if (requester_id === responder_id) {
    res.status(400).json({ error: '不能与自己换班' });
    return;
  }
  
  db.get('SELECT * FROM swap_requests WHERE requester_schedule_id = ? AND responder_schedule_id = ? AND status = "pending"', 
    [requester_schedule_id, responder_schedule_id], 
    (err, row) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (row) {
        res.status(400).json({ error: '已有待处理的相同换班申请' });
        return;
      }
      
      db.run('INSERT INTO swap_requests (requester_id, responder_id, requester_schedule_id, responder_schedule_id) VALUES (?, ?, ?, ?)', 
        [requester_id, responder_id, requester_schedule_id, responder_schedule_id], 
        function(err) {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }
          const newRequest = { id: this.lastID, requester_id, responder_id, requester_schedule_id, responder_schedule_id, status: 'pending' };
          addAuditLog('CREATE_SWAP_REQUEST', newRequest);
          res.json({ request: newRequest });
        });
    });
});

app.put('/api/swap-requests/:id', (req, res) => {
  const { id } = req.params;
  const { action } = req.body;
  
  db.get('SELECT * FROM swap_requests WHERE id = ?', [id], (err, request) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!request) {
      res.status(404).json({ error: '申请不存在' });
      return;
    }
    if (request.status !== 'pending') {
      res.status(400).json({ error: '申请状态不是待处理' });
      return;
    }
    
    let newStatus;
    if (action === 'approve') {
      newStatus = 'approved';
    } else if (action === 'reject') {
      newStatus = 'rejected';
    } else {
      res.status(400).json({ error: '无效的操作' });
      return;
    }
    
    db.run('UPDATE swap_requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
      [newStatus, id], 
      (err) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        
        if (newStatus === 'approved') {
          db.get('SELECT * FROM schedules WHERE id = ?', [request.requester_schedule_id], (err, reqSched) => {
            if (err) {
              res.status(500).json({ error: err.message });
              return;
            }
            db.get('SELECT * FROM schedules WHERE id = ?', [request.responder_schedule_id], (err, respSched) => {
              if (err) {
                res.status(500).json({ error: err.message });
                return;
              }
              
              // 先更新其中一个到一个临时状态或者先更新一个，这里我们交换成员ID
              // 为避免UNIQUE约束冲突，我们分两步：先设置一个为-1，再交换
              db.run('UPDATE schedules SET member_id = -1 WHERE id = ?', [request.requester_schedule_id], (err) => {
                if (err) {
                  res.status(500).json({ error: err.message });
                  return;
                }
                db.run('UPDATE schedules SET member_id = ? WHERE id = ?', [request.requester_id, request.responder_schedule_id], (err) => {
                  if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                  }
                  db.run('UPDATE schedules SET member_id = ? WHERE id = ?', [request.responder_id, request.requester_schedule_id], (err) => {
                    if (err) {
                      res.status(500).json({ error: err.message });
                      return;
                    }
                    addAuditLog('SWAP_APPROVED', { request_id: id });
                    res.json({ success: true, status: newStatus });
                  });
                });
              });
            });
          });
        } else {
          addAuditLog('SWAP_REJECTED', { request_id: id });
          res.json({ success: true, status: newStatus });
        }
      });
  });
});

app.get('/api/audit-logs', (req, res) => {
  db.all('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ logs: rows });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
