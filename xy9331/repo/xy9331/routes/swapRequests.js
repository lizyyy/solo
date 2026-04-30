const express = require('express');
const db = require('../database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

const STATUS_MAP = {
  'pending_confirm': '待确认',
  'pending_approval': '待店长批准',
  'completed': '已完成',
  'rejected': '已拒绝',
  'expired': '已过期'
};

const VALID_TRANSITIONS = {
  'pending_confirm': ['pending_approval', 'rejected', 'expired'],
  'pending_approval': ['completed', 'rejected', 'expired'],
  'completed': [],
  'rejected': [],
  'expired': []
};

function canTransition(fromStatus, toStatus) {
  return VALID_TRANSITIONS[fromStatus]?.includes(toStatus) || false;
}

function getShiftDetails(shiftId, callback) {
  const query = `
    SELECT s.*, u.name as user_name
    FROM shifts s
    LEFT JOIN users u ON s.user_id = u.id
    WHERE s.id = ?
  `;
  db.get(query, [shiftId], callback);
}

router.get('/', authenticateToken, (req, res) => {
  const { status, requester_id, responder_id, all = false } = req.query;
  
  let query = `
    SELECT sr.*, 
           ru.name as requester_name, 
           rop.name as responder_name,
           rs.date as requester_shift_date,
           rs.start_time as requester_shift_start,
           rs.end_time as requester_shift_end,
           rs.shift_type as requester_shift_type,
           rsp.date as responder_shift_date,
           rsp.start_time as responder_shift_start,
           rsp.end_time as responder_shift_end,
           rsp.shift_type as responder_shift_type
    FROM swap_requests sr
    LEFT JOIN users ru ON sr.requester_id = ru.id
    LEFT JOIN users rop ON sr.responder_id = rop.id
    LEFT JOIN shifts rs ON sr.requester_shift_id = rs.id
    LEFT JOIN shifts rsp ON sr.responder_shift_id = rsp.id
    WHERE 1=1
  `;
  
  const params = [];
  
  if (status) {
    query += ' AND sr.status = ?';
    params.push(status);
  }
  
  if (requester_id) {
    query += ' AND sr.requester_id = ?';
    params.push(parseInt(requester_id));
  }
  
  if (responder_id) {
    query += ' AND sr.responder_id = ?';
    params.push(parseInt(responder_id));
  }
  
  if (all !== 'true' && req.user.role !== 'admin') {
    const userId = req.user.id;
    query += ' AND (sr.requester_id = ? OR sr.responder_id = ? OR sr.open_to_all = 1)';
    params.push(userId, userId);
  }
  
  query += ' ORDER BY sr.created_at DESC';
  
  db.all(query, params, (err, requests) => {
    if (err) {
      return res.status(500).json({ error: '数据库错误' });
    }
    
    const formattedRequests = requests.map(r => ({
      ...r,
      status_text: STATUS_MAP[r.status] || r.status
    }));
    
    res.json({ requests: formattedRequests });
  });
});

router.get('/my', authenticateToken, (req, res) => {
  const userId = req.user.id;
  
  const query = `
    SELECT sr.*, 
           ru.name as requester_name, 
           rop.name as responder_name,
           rs.date as requester_shift_date,
           rs.start_time as requester_shift_start,
           rs.end_time as requester_shift_end,
           rs.shift_type as requester_shift_type,
           rsp.date as responder_shift_date,
           rsp.start_time as responder_shift_start,
           rsp.end_time as responder_shift_end,
           rsp.shift_type as responder_shift_type
    FROM swap_requests sr
    LEFT JOIN users ru ON sr.requester_id = ru.id
    LEFT JOIN users rop ON sr.responder_id = rop.id
    LEFT JOIN shifts rs ON sr.requester_shift_id = rs.id
    LEFT JOIN shifts rsp ON sr.responder_shift_id = rsp.id
    WHERE sr.requester_id = ? OR sr.responder_id = ?
    ORDER BY sr.created_at DESC
  `;
  
  db.all(query, [userId, userId], (err, requests) => {
    if (err) {
      return res.status(500).json({ error: '数据库错误' });
    }
    
    const formattedRequests = requests.map(r => ({
      ...r,
      status_text: STATUS_MAP[r.status] || r.status
    }));
    
    res.json({ requests: formattedRequests });
  });
});

router.get('/:id', authenticateToken, (req, res) => {
  const requestId = req.params.id;
  
  const query = `
    SELECT sr.*, 
           ru.name as requester_name, 
           rop.name as responder_name,
           rs.date as requester_shift_date,
           rs.start_time as requester_shift_start,
           rs.end_time as requester_shift_end,
           rs.shift_type as requester_shift_type,
           rsp.date as responder_shift_date,
           rsp.start_time as responder_shift_start,
           rsp.end_time as responder_shift_end,
           rsp.shift_type as responder_shift_type
    FROM swap_requests sr
    LEFT JOIN users ru ON sr.requester_id = ru.id
    LEFT JOIN users rop ON sr.responder_id = rop.id
    LEFT JOIN shifts rs ON sr.requester_shift_id = rs.id
    LEFT JOIN shifts rsp ON sr.responder_shift_id = rsp.id
    WHERE sr.id = ?
  `;
  
  db.get(query, [requestId], (err, request) => {
    if (err) {
      return res.status(500).json({ error: '数据库错误' });
    }
    if (!request) {
      return res.status(404).json({ error: '换班请求不存在' });
    }
    
    res.json({ 
      request: {
        ...request,
        status_text: STATUS_MAP[request.status] || request.status
      }
    });
  });
});

router.post('/', authenticateToken, (req, res) => {
  const { requester_shift_id, responder_id, responder_shift_id, open_to_all, notes } = req.body;
  const requesterId = req.user.id;
  
  if (!requester_shift_id) {
    return res.status(400).json({ error: '请选择要换的班次' });
  }
  
  if (!open_to_all && (!responder_id || !responder_shift_id)) {
    return res.status(400).json({ error: '非开放换班请指定换班人和对方的班次' });
  }
  
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    
    const checkShiftQuery = `
      SELECT * FROM shifts WHERE id = ? AND user_id = ?
    `;
    
    db.get(checkShiftQuery, [requester_shift_id, requesterId], (err, requesterShift) => {
      if (err) {
        db.run('ROLLBACK');
        return res.status(500).json({ error: '数据库错误' });
      }
      
      if (!requesterShift) {
        db.run('ROLLBACK');
        return res.status(400).json({ error: '班次不存在或不属于您' });
      }
      
      if (open_to_all) {
        const insertQuery = `
          INSERT INTO swap_requests (requester_id, requester_shift_id, open_to_all, status, notes)
          VALUES (?, ?, 1, 'pending_confirm', ?)
        `;
        
        db.run(insertQuery, [requesterId, requester_shift_id, notes], function(err) {
          if (err) {
            db.run('ROLLBACK');
            return res.status(500).json({ error: '数据库错误' });
          }
          
          db.run('COMMIT');
          res.status(201).json({ 
            id: this.lastID, 
            message: '开放换班请求已创建，等待他人接单' 
          });
        });
      } else {
        const checkResponderShiftQuery = `
          SELECT * FROM shifts WHERE id = ? AND user_id = ?
        `;
        
        db.get(checkResponderShiftQuery, [responder_shift_id, responder_id], (err, responderShift) => {
          if (err) {
            db.run('ROLLBACK');
            return res.status(500).json({ error: '数据库错误' });
          }
          
          if (!responderShift) {
            db.run('ROLLBACK');
            return res.status(400).json({ error: '对方班次不存在或不属于该员工' });
          }
          
          if (parseInt(responder_id) === parseInt(requesterId)) {
            db.run('ROLLBACK');
            return res.status(400).json({ error: '不能与自己换班' });
          }
          
          const insertQuery = `
            INSERT INTO swap_requests (requester_id, responder_id, requester_shift_id, responder_shift_id, open_to_all, status, notes)
            VALUES (?, ?, ?, ?, 0, 'pending_confirm', ?)
          `;
          
          db.run(insertQuery, [requesterId, responder_id, requester_shift_id, responder_shift_id, notes], function(err) {
            if (err) {
              db.run('ROLLBACK');
              return res.status(500).json({ error: '数据库错误' });
            }
            
            db.run('COMMIT');
            res.status(201).json({ 
              id: this.lastID, 
              message: '换班请求已发送，等待对方确认' 
            });
          });
        });
      }
    });
  });
});

router.post('/:id/confirm', authenticateToken, (req, res) => {
  const requestId = req.params.id;
  const userId = req.user.id;
  const { responder_shift_id } = req.body;
  
  db.get('SELECT * FROM swap_requests WHERE id = ?', [requestId], (err, request) => {
    if (err) {
      return res.status(500).json({ error: '数据库错误' });
    }
    
    if (!request) {
      return res.status(404).json({ error: '换班请求不存在' });
    }
    
    if (request.status !== 'pending_confirm') {
      return res.status(400).json({ error: `当前状态为"${STATUS_MAP[request.status]}"，无法确认` });
    }
    
    if (request.open_to_all === 1) {
      if (!responder_shift_id) {
        return res.status(400).json({ error: '请选择您要换出的班次' });
      }
      
      db.get('SELECT * FROM shifts WHERE id = ? AND user_id = ?', [responder_shift_id, userId], (err, responderShift) => {
        if (err) {
          return res.status(500).json({ error: '数据库错误' });
        }
        
        if (!responderShift) {
          return res.status(400).json({ error: '班次不存在或不属于您' });
        }
        
        if (parseInt(userId) === parseInt(request.requester_id)) {
          return res.status(400).json({ error: '不能接自己的换班请求' });
        }
        
        db.serialize(() => {
          db.run('BEGIN TRANSACTION');
          
          const updateQuery = `
            UPDATE swap_requests 
            SET responder_id = ?, responder_shift_id = ?, status = 'pending_approval'
            WHERE id = ? AND status = 'pending_confirm'
          `;
          
          db.run(updateQuery, [userId, responder_shift_id, requestId], function(err) {
            if (err) {
              db.run('ROLLBACK');
              return res.status(500).json({ error: '数据库错误' });
            }
            
            if (this.changes === 0) {
              db.run('ROLLBACK');
              return res.status(400).json({ error: '换班请求状态已变化，请刷新重试' });
            }
            
            db.run('COMMIT');
            res.json({ message: '已确认接单，等待店长批准' });
          });
        });
      });
    } else {
      if (parseInt(userId) !== parseInt(request.responder_id)) {
        return res.status(403).json({ error: '您不是被指定的换班人' });
      }
      
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        const updateQuery = `
          UPDATE swap_requests 
          SET status = 'pending_approval'
          WHERE id = ? AND status = 'pending_confirm'
        `;
        
        db.run(updateQuery, [requestId], function(err) {
          if (err) {
            db.run('ROLLBACK');
            return res.status(500).json({ error: '数据库错误' });
          }
          
          if (this.changes === 0) {
            db.run('ROLLBACK');
            return res.status(400).json({ error: '换班请求状态已变化，请刷新重试' });
          }
          
          db.run('COMMIT');
          res.json({ message: '已确认换班，等待店长批准' });
        });
      });
    }
  });
});

router.post('/:id/reject', authenticateToken, (req, res) => {
  const requestId = req.params.id;
  const userId = req.user.id;
  const { reason } = req.body;
  
  db.get('SELECT * FROM swap_requests WHERE id = ?', [requestId], (err, request) => {
    if (err) {
      return res.status(500).json({ error: '数据库错误' });
    }
    
    if (!request) {
      return res.status(404).json({ error: '换班请求不存在' });
    }
    
    const isRequester = parseInt(userId) === parseInt(request.requester_id);
    const isResponder = request.responder_id && parseInt(userId) === parseInt(request.responder_id);
    const isAdmin = req.user.role === 'admin';
    
    if (!isRequester && !isResponder && !isAdmin) {
      return res.status(403).json({ error: '您没有权限拒绝此请求' });
    }
    
    if (request.status === 'completed' || request.status === 'rejected' || request.status === 'expired') {
      return res.status(400).json({ error: `当前状态为"${STATUS_MAP[request.status]}"，无法拒绝` });
    }
    
    if (isResponder && request.status === 'pending_approval') {
      return res.status(400).json({ error: '已进入店长批准阶段，无法拒绝，请联系店长' });
    }
    
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      const notes = reason ? `${request.notes || ''} 拒绝原因: ${reason}`.trim() : request.notes;
      const updateQuery = `
        UPDATE swap_requests 
        SET status = 'rejected', notes = ?
        WHERE id = ?
      `;
      
      db.run(updateQuery, [notes, requestId], function(err) {
        if (err) {
          db.run('ROLLBACK');
          return res.status(500).json({ error: '数据库错误' });
        }
        
        db.run('COMMIT');
        res.json({ message: '已拒绝换班请求' });
      });
    });
  });
});

router.post('/:id/approve', authenticateToken, requireAdmin, (req, res) => {
  const requestId = req.params.id;
  
  db.get('SELECT * FROM swap_requests WHERE id = ?', [requestId], (err, request) => {
    if (err) {
      return res.status(500).json({ error: '数据库错误' });
    }
    
    if (!request) {
      return res.status(404).json({ error: '换班请求不存在' });
    }
    
    if (request.status !== 'pending_approval') {
      return res.status(400).json({ error: `当前状态为"${STATUS_MAP[request.status]}"，无法批准` });
    }
    
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      const updateRequesterShift = `
        UPDATE shifts SET user_id = ? WHERE id = ?
      `;
      
      db.run(updateRequesterShift, [request.responder_id, request.requester_shift_id], (err) => {
        if (err) {
          db.run('ROLLBACK');
          return res.status(500).json({ error: '数据库错误' });
        }
        
        const updateResponderShift = `
          UPDATE shifts SET user_id = ? WHERE id = ?
        `;
        
        db.run(updateResponderShift, [request.requester_id, request.responder_shift_id], (err) => {
          if (err) {
            db.run('ROLLBACK');
            return res.status(500).json({ error: '数据库错误' });
          }
          
          const updateRequest = `
            UPDATE swap_requests SET status = 'completed' WHERE id = ?
          `;
          
          db.run(updateRequest, [requestId], function(err) {
            if (err) {
              db.run('ROLLBACK');
              return res.status(500).json({ error: '数据库错误' });
            }
            
            db.run('COMMIT');
            res.json({ message: '换班已批准，班次已互换' });
          });
        });
      });
    });
  });
});

router.post('/:id/cancel', authenticateToken, (req, res) => {
  const requestId = req.params.id;
  const userId = req.user.id;
  
  db.get('SELECT * FROM swap_requests WHERE id = ?', [requestId], (err, request) => {
    if (err) {
      return res.status(500).json({ error: '数据库错误' });
    }
    
    if (!request) {
      return res.status(404).json({ error: '换班请求不存在' });
    }
    
    if (parseInt(userId) !== parseInt(request.requester_id)) {
      return res.status(403).json({ error: '只有请求人可以撤销' });
    }
    
    if (request.status !== 'pending_confirm') {
      return res.status(400).json({ error: `当前状态为"${STATUS_MAP[request.status]}"，无法撤销` });
    }
    
    db.run('UPDATE swap_requests SET status = "rejected" WHERE id = ?', [requestId], function(err) {
      if (err) {
        return res.status(500).json({ error: '数据库错误' });
      }
      
      res.json({ message: '换班请求已撤销' });
    });
  });
});

module.exports = router;
