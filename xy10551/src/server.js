const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database/init');

const activitiesRouter = require('./routes/activities');
const residentsRouter = require('./routes/residents');

async function startServer() {
  await db.init();
  
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(cors());
  app.use(express.json());

  app.use('/api/activities', activitiesRouter);
  app.use('/api/residents', residentsRouter);

  app.get('/api/health', (req, res) => {
    res.json({ success: true, message: '社区活动报名 API 运行正常', timestamp: new Date().toISOString() });
  });

  app.get('/api/overview', (req, res) => {
    const activities = db.prepare('SELECT * FROM activities ORDER BY start_time DESC').all();
    const residents = db.prepare('SELECT COUNT(*) as count FROM residents').get().count;
    
    const stats = activities.map(activity => {
      const regStats = db.prepare(`
        SELECT 
          COUNT(CASE WHEN status IN ('confirmed', 'checked_in') THEN 1 END) as confirmed_count,
          COUNT(CASE WHEN status = 'checked_in' THEN 1 END) as checked_in_count,
          COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_count,
          COALESCE(SUM(CASE WHEN status IN ('confirmed', 'checked_in') THEN participant_count END), 0) as confirmed_participants,
          COALESCE(SUM(CASE WHEN status = 'checked_in' THEN participant_count END), 0) as checked_in_participants
        FROM registrations WHERE activity_id = ?
      `).get(activity.id);
      
      const waitlistCount = db.prepare('SELECT COUNT(*) as count FROM waitlist WHERE activity_id = ? AND status = \'waiting\'').get(activity.id).count;
      
      return {
        id: activity.id,
        name: activity.name,
        status: activity.status,
        maxParticipants: activity.max_participants,
        ...regStats,
        availableSpots: activity.max_participants - (regStats.confirmed_participants || 0),
        waitlistCount
      };
    });
    
    res.json({
      success: true,
      data: {
        totalResidents: residents,
        totalActivities: activities.length,
        activities: stats
      }
    });
  });

  app.use('/', express.static(path.join(__dirname, '..', 'public')));

  app.use((err, req, res, next) => {
    console.error('服务器错误:', err);
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      message: err.message
    });
  });

  app.use((req, res) => {
    res.status(404).json({ success: false, error: '接口不存在', path: req.path });
  });

  app.listen(PORT, () => {
    console.log(`
═══════════════════════════════════════════════
  社区活动报名 API 已启动
  服务地址: http://localhost:${PORT}
  API 基础路径: http://localhost:${PORT}/api
  健康检查: http://localhost:${PORT}/api/health
  总览接口: http://localhost:${PORT}/api/overview
  前端页面: http://localhost:${PORT}/
═══════════════════════════════════════════════
    `);
  });

  return app;
}

startServer().catch(err => {
  console.error('启动服务器失败:', err);
  process.exit(1);
});
