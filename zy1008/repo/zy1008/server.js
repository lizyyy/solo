const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let dbInitialized = false;

async function initApp() {
  await db.initDatabase();
  dbInitialized = true;
  console.log('数据库初始化完成');
}

app.get('/api/events', (req, res) => {
  try {
    const events = db.getAllEvents();
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/events/:id', (req, res) => {
  try {
    const event = db.getEventById(req.params.id);
    if (!event) {
      return res.status(404).json({ error: '活动不存在' });
    }
    if (event.sessions) {
      event.sessions = JSON.parse(event.sessions);
    }
    res.json(event);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/events', (req, res) => {
  try {
    const { title, date_time, total_slots, checkin_code, sessions } = req.body;
    
    if (!title || !date_time || !total_slots || !checkin_code) {
      return res.status(400).json({ error: '缺少必填字段' });
    }

    const eventId = db.createEvent({
      title,
      date_time,
      total_slots: parseInt(total_slots),
      checkin_code,
      sessions: sessions && sessions.length > 0 ? sessions : null
    });

    res.status(201).json({ id: eventId, message: '活动创建成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/events/:id/stats', (req, res) => {
  try {
    const { session } = req.query;
    const stats = db.getEventStats(req.params.id, session);
    
    if (!stats) {
      return res.status(404).json({ error: '活动不存在' });
    }
    
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/events/:id/register', (req, res) => {
  try {
    const { name, phone_last4, session } = req.body;
    
    if (!name || !phone_last4) {
      return res.status(400).json({ error: '请填写姓名和手机号后四位' });
    }
    
    if (phone_last4.length !== 4 || !/^\d{4}$/.test(phone_last4)) {
      return res.status(400).json({ error: '手机号后四位必须是4位数字' });
    }

    const result = db.registerForEvent(req.params.id, name, phone_last4, session);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/registrations/:id/cancel', (req, res) => {
  try {
    db.cancelRegistration(req.params.id);
    res.json({ message: '取消报名成功' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/registrations/:id/checkin', (req, res) => {
  try {
    const { checkin_code } = req.body;
    
    if (!checkin_code) {
      return res.status(400).json({ error: '请输入签到码' });
    }

    db.checkinUser(req.params.id, checkin_code);
    res.json({ message: '签到成功' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/events/:id/export', (req, res) => {
  try {
    const { session } = req.query;
    const stats = db.getEventStats(req.params.id, session);
    
    if (!stats) {
      return res.status(404).json({ error: '活动不存在' });
    }

    let csv = '姓名,手机号后四位,场次,状态,签到时间,报名时间\n';
    
    stats.registrations.forEach(r => {
      const status = r.status === 'checked_in' ? '已签到' : '已报名';
      csv += `${r.name},${r.phone_last4},${r.session || '-'},${status},${r.checkin_time || '-'},${r.created_at}\n`;
    });
    
    if (stats.waitlist.length > 0) {
      stats.waitlist.forEach(w => {
        csv += `${w.name},${w.phone_last4},${w.session || '-'},候补(第${w.position}位),-,${w.created_at}\n`;
      });
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${stats.event.title}_报名数据.csv"`);
    res.send('\uFEFF' + csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

initApp().then(() => {
  app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
    console.log(`参与者页面: http://localhost:${PORT}`);
    console.log(`管理员页面: http://localhost:${PORT}/admin`);
  });
}).catch(err => {
  console.error('初始化失败:', err);
  process.exit(1);
});
