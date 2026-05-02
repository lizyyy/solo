const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

const formatDateTime = (dateTime) => {
  if (!dateTime) return '';
  const date = new Date(dateTime);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getEventStats = (eventId) => {
  const stats = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'registered' THEN 1 ELSE 0 END) as registered,
      SUM(CASE WHEN status = 'waitlist' THEN 1 ELSE 0 END) as waitlist,
      SUM(CASE WHEN checked_in = 1 THEN 1 ELSE 0 END) as checked_in
    FROM registrations 
    WHERE event_id = ?
  `).get(eventId);
  
  return stats;
};

app.get('/api/events', (req, res) => {
  try {
    const events = db.prepare(`
      SELECT * FROM events 
      ORDER BY created_at DESC
    `).all();
    
    const eventsWithStats = events.map(event => {
      const stats = getEventStats(event.id);
      const sessions = event.sessions ? JSON.parse(event.sessions) : [];
      
      return {
        ...event,
        sessions,
        ...stats,
        available_slots: event.total_slots - stats.registered
      };
    });
    
    res.json({ success: true, data: eventsWithStats });
  } catch (error) {
    console.error('获取活动列表失败:', error);
    res.status(500).json({ success: false, message: '获取活动列表失败' });
  }
});

app.get('/api/events/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    const event = db.prepare(`
      SELECT * FROM events WHERE id = ?
    `).get(id);
    
    if (!event) {
      return res.status(404).json({ success: false, message: '活动不存在' });
    }
    
    const stats = getEventStats(event.id);
    const sessions = event.sessions ? JSON.parse(event.sessions) : [];
    
    res.json({
      success: true,
      data: {
        ...event,
        sessions,
        ...stats,
        available_slots: event.total_slots - stats.registered
      }
    });
  } catch (error) {
    console.error('获取活动详情失败:', error);
    res.status(500).json({ success: false, message: '获取活动详情失败' });
  }
});

app.post('/api/events', (req, res) => {
  try {
    const { title, event_date, total_slots, check_in_code, sessions } = req.body;
    
    if (!title || !event_date || !total_slots || !check_in_code) {
      return res.status(400).json({ success: false, message: '缺少必填字段' });
    }
    
    const sessionsJson = sessions && sessions.length > 0 
      ? JSON.stringify(sessions) 
      : null;
    
    const result = db.prepare(`
      INSERT INTO events (title, event_date, total_slots, check_in_code, sessions)
      VALUES (?, ?, ?, ?, ?)
    `).run(title, event_date, total_slots, check_in_code, sessionsJson);
    
    res.json({
      success: true,
      message: '活动创建成功',
      data: { id: result.lastInsertRowid }
    });
  } catch (error) {
    console.error('创建活动失败:', error);
    res.status(500).json({ success: false, message: '创建活动失败' });
  }
});

app.delete('/api/events/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    db.prepare('DELETE FROM registrations WHERE event_id = ?').run(id);
    
    const result = db.prepare('DELETE FROM events WHERE id = ?').run(id);
    
    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: '活动不存在' });
    }
    
    res.json({ success: true, message: '活动删除成功' });
  } catch (error) {
    console.error('删除活动失败:', error);
    res.status(500).json({ success: false, message: '删除活动失败' });
  }
});

app.get('/api/events/:id/registrations', (req, res) => {
  try {
    const { id } = req.params;
    const { session, status } = req.query;
    
    let query = `
      SELECT * FROM registrations 
      WHERE event_id = ?
    `;
    const params = [id];
    
    if (session) {
      query += ' AND session = ?';
      params.push(session);
    }
    
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY created_at ASC';
    
    const registrations = db.prepare(query).all(...params);
    
    res.json({ success: true, data: registrations });
  } catch (error) {
    console.error('获取报名列表失败:', error);
    res.status(500).json({ success: false, message: '获取报名列表失败' });
  }
});

app.get('/api/events/:id/registrations/by-session', (req, res) => {
  try {
    const { id } = req.params;
    
    const event = db.prepare('SELECT sessions FROM events WHERE id = ?').get(id);
    if (!event) {
      return res.status(404).json({ success: false, message: '活动不存在' });
    }
    
    const sessions = event.sessions ? JSON.parse(event.sessions) : [null];
    
    const result = {};
    
    for (const session of sessions) {
      const registrations = db.prepare(`
        SELECT * FROM registrations 
        WHERE event_id = ? AND session = ?
        ORDER BY 
          CASE status 
            WHEN 'registered' THEN 1 
            WHEN 'waitlist' THEN 2 
            ELSE 3 
          END,
          created_at ASC
      `).all(id, session);
      
      result[session || '全场'] = registrations;
    }
    
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('按场次获取报名列表失败:', error);
    res.status(500).json({ success: false, message: '按场次获取报名列表失败' });
  }
});

app.post('/api/events/:id/register', (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone_last_four, session } = req.body;
    
    if (!name || !phone_last_four) {
      return res.status(400).json({ success: false, message: '姓名和手机号后四位必填' });
    }
    
    if (!/^\d{4}$/.test(phone_last_four)) {
      return res.status(400).json({ success: false, message: '手机号后四位必须是4位数字' });
    }
    
    const event = db.prepare(`
      SELECT * FROM events WHERE id = ?
    `).get(id);
    
    if (!event) {
      return res.status(404).json({ success: false, message: '活动不存在' });
    }
    
    const existing = db.prepare(`
      SELECT * FROM registrations 
      WHERE event_id = ? AND name = ? AND phone_last_four = ?
    `).get(id, name, phone_last_four);
    
    if (existing) {
      return res.status(400).json({ 
        success: false, 
        message: '您已报名过此活动',
        data: { status: existing.status }
      });
    }
    
    const currentRegistered = db.prepare(`
      SELECT COUNT(*) as count FROM registrations 
      WHERE event_id = ? AND status = 'registered'
    `).get(id).count;
    
    let status = 'registered';
    let waitlistPosition = null;
    
    if (currentRegistered >= event.total_slots) {
      status = 'waitlist';
      const waitlistCount = db.prepare(`
        SELECT COUNT(*) as count FROM registrations 
        WHERE event_id = ? AND status = 'waitlist'
      `).get(id).count;
      waitlistPosition = waitlistCount + 1;
    }
    
    const result = db.prepare(`
      INSERT INTO registrations 
      (event_id, name, phone_last_four, session, status, waitlist_position)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, name, phone_last_four, session || null, status, waitlistPosition);
    
    const message = status === 'registered' 
      ? '报名成功' 
      : `名额已满，您已进入候补队列，当前位置：第 ${waitlistPosition} 位`;
    
    res.json({
      success: true,
      message,
      data: {
        id: result.lastInsertRowid,
        status,
        waitlist_position: waitlistPosition
      }
    });
  } catch (error) {
    console.error('报名失败:', error);
    res.status(500).json({ success: false, message: '报名失败' });
  }
});

const moveWaitlistToRegistered = (eventId, session = null) => {
  const waitlistQuery = session 
    ? `SELECT * FROM registrations 
       WHERE event_id = ? AND status = 'waitlist' AND session = ?
       ORDER BY created_at ASC LIMIT 1`
    : `SELECT * FROM registrations 
       WHERE event_id = ? AND status = 'waitlist'
       ORDER BY created_at ASC LIMIT 1`;
  
  const params = session ? [eventId, session] : [eventId];
  const nextWaitlist = db.prepare(waitlistQuery).get(...params);
  
  if (nextWaitlist) {
    db.prepare(`
      UPDATE registrations 
      SET status = 'registered', waitlist_position = NULL 
      WHERE id = ?
    `).run(nextWaitlist.id);
    
    db.prepare(`
      UPDATE registrations 
      SET waitlist_position = waitlist_position - 1 
      WHERE event_id = ? AND status = 'waitlist' AND created_at > ?
    `).run(eventId, nextWaitlist.created_at);
    
    return nextWaitlist;
  }
  
  return null;
};

app.post('/api/registrations/:id/cancel', (req, res) => {
  try {
    const { id } = req.params;
    
    const registration = db.prepare(`
      SELECT * FROM registrations WHERE id = ?
    `).get(id);
    
    if (!registration) {
      return res.status(404).json({ success: false, message: '报名记录不存在' });
    }
    
    if (registration.status === 'cancelled') {
      return res.status(400).json({ success: false, message: '该报名已取消' });
    }
    
    const wasRegistered = registration.status === 'registered';
    
    db.prepare(`
      UPDATE registrations 
      SET status = 'cancelled', checked_in = 0 
      WHERE id = ?
    `).run(id);
    
    if (wasRegistered) {
      db.prepare(`
        UPDATE registrations 
        SET waitlist_position = waitlist_position - 1 
        WHERE event_id = ? AND status = 'waitlist' AND created_at > ?
      `).run(registration.event_id, registration.created_at);
      
      const movedUser = moveWaitlistToRegistered(registration.event_id, registration.session);
      
      if (movedUser) {
        return res.json({
          success: true,
          message: `取消报名成功。候补用户 ${movedUser.name} 已自动递补`,
          data: { moved_user: movedUser }
        });
      }
    }
    
    res.json({ success: true, message: '取消报名成功' });
  } catch (error) {
    console.error('取消报名失败:', error);
    res.status(500).json({ success: false, message: '取消报名失败' });
  }
});

app.post('/api/registrations/:id/checkin', (req, res) => {
  try {
    const { id } = req.params;
    const { check_in_code } = req.body;
    
    const registration = db.prepare(`
      SELECT r.*, e.check_in_code 
      FROM registrations r 
      JOIN events e ON r.event_id = e.id 
      WHERE r.id = ?
    `).get(id);
    
    if (!registration) {
      return res.status(404).json({ success: false, message: '报名记录不存在' });
    }
    
    if (registration.status !== 'registered') {
      return res.status(400).json({ 
        success: false, 
        message: registration.status === 'waitlist' 
          ? '候补用户无法签到' 
          : '该报名已取消'
      });
    }
    
    if (check_in_code !== registration.check_in_code) {
      return res.status(403).json({ success: false, message: '签到码错误' });
    }
    
    if (registration.checked_in === 1) {
      return res.json({ success: true, message: '该用户已签到' });
    }
    
    db.prepare(`
      UPDATE registrations 
      SET checked_in = 1 
      WHERE id = ?
    `).run(id);
    
    res.json({ success: true, message: '签到成功' });
  } catch (error) {
    console.error('签到失败:', error);
    res.status(500).json({ success: false, message: '签到失败' });
  }
});

app.post('/api/events/:id/checkin-batch', (req, res) => {
  try {
    const { id } = req.params;
    const { check_in_code, registration_ids } = req.body;
    
    const event = db.prepare(`
      SELECT check_in_code FROM events WHERE id = ?
    `).get(id);
    
    if (!event) {
      return res.status(404).json({ success: false, message: '活动不存在' });
    }
    
    if (check_in_code !== event.check_in_code) {
      return res.status(403).json({ success: false, message: '签到码错误' });
    }
    
    let successCount = 0;
    const failedIds = [];
    
    for (const regId of registration_ids) {
      const registration = db.prepare(`
        SELECT * FROM registrations WHERE id = ? AND event_id = ?
      `).get(regId, id);
      
      if (registration && registration.status === 'registered' && registration.checked_in === 0) {
        db.prepare(`
          UPDATE registrations SET checked_in = 1 WHERE id = ?
        `).run(regId);
        successCount++;
      } else {
        failedIds.push(regId);
      }
    }
    
    res.json({
      success: true,
      message: `成功签到 ${successCount} 人`,
      data: {
        success_count: successCount,
        failed_count: failedIds.length
      }
    });
  } catch (error) {
    console.error('批量签到失败:', error);
    res.status(500).json({ success: false, message: '批量签到失败' });
  }
});

app.get('/api/events/:id/export', (req, res) => {
  try {
    const { id } = req.params;
    const { session } = req.query;
    
    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
    if (!event) {
      return res.status(404).json({ success: false, message: '活动不存在' });
    }
    
    let query = `
      SELECT * FROM registrations 
      WHERE event_id = ?
    `;
    const params = [id];
    
    if (session) {
      query += ' AND session = ?';
      params.push(session);
    }
    
    query += ` ORDER BY 
      CASE status 
        WHEN 'registered' THEN 1 
        WHEN 'waitlist' THEN 2 
        WHEN 'cancelled' THEN 3 
        ELSE 4 
      END,
      created_at ASC`;
    
    const registrations = db.prepare(query).all(...params);
    
    const headers = ['序号', '姓名', '手机号后四位', '场次', '状态', '是否签到', '报名时间'];
    
    const statusMap = {
      'registered': '已报名',
      'waitlist': '候补',
      'cancelled': '已取消'
    };
    
    const rows = registrations.map((reg, index) => [
      index + 1,
      reg.name,
      reg.phone_last_four,
      reg.session || '全场',
      statusMap[reg.status] || reg.status,
      reg.checked_in ? '已签到' : '未签到',
      reg.created_at
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const filename = `${event.title}_报名名单_${new Date().toISOString().split('T')[0]}.csv`;
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    res.send('\uFEFF' + csvContent);
  } catch (error) {
    console.error('导出CSV失败:', error);
    res.status(500).json({ success: false, message: '导出CSV失败' });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

const fs = require('fs');
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`用户端: http://localhost:${PORT}`);
  console.log(`管理端: http://localhost:${PORT}/admin`);
});
