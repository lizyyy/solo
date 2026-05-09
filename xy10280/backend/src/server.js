const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./database');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(bodyParser.json());

const stationsRouter = require('./routes/stations');
const routesRouter = require('./routes/routes');
const employeesRouter = require('./routes/employees');
const registrationsRouter = require('./routes/registrations');
const swipeRouter = require('./routes/swipe-records');
const adjustmentsRouter = require('./routes/adjustments');
const analyticsRouter = require('./routes/analytics');
const announcementsRouter = require('./routes/announcements');

app.use('/api/stations', stationsRouter);
app.use('/api/routes', routesRouter);
app.use('/api/employees', employeesRouter);
app.use('/api/registrations', registrationsRouter);
app.use('/api/swipe', swipeRouter);
app.use('/api/adjustments', adjustmentsRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/announcements', announcementsRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/dashboard/stats', (req, res) => {
  db.parallelize(() => {
    db.get('SELECT COUNT(*) as count FROM stations WHERE status = ?', ['active'], (err, stations) => {
      if (err) return res.status(500).json({ error: err.message });
      
      db.get('SELECT COUNT(*) as count FROM employees', (err, employees) => {
        if (err) return res.status(500).json({ error: err.message });
        
        db.get('SELECT COUNT(*) as count FROM registrations WHERE status = ?', ['active'], (err, registrations) => {
          if (err) return res.status(500).json({ error: err.message });
          
          db.get('SELECT COUNT(*) as count FROM adjustment_tasks WHERE status = ?', ['pending'], (err, pendingTasks) => {
            if (err) return res.status(500).json({ error: err.message });
            
            res.json({
              activeStations: stations.count,
              totalEmployees: employees.count,
              activeRegistrations: registrations.count,
              pendingAdjustments: pendingTasks.count
            });
          });
        });
      });
    });
  });
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
