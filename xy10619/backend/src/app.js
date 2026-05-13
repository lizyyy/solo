const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const borrowRoutes = require('./routes/borrows');
const debtRoutes = require('./routes/debts');
const anomalyRoutes = require('./routes/anomalies');
const compensationRoutes = require('./routes/compensations');
const reportRoutes = require('./routes/reports');
const logRoutes = require('./routes/logs');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api/borrows', borrowRoutes);
app.use('/api/debts', debtRoutes);
app.use('/api/anomalies', anomalyRoutes);
app.use('/api/compensations', compensationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/logs', logRoutes);

app.get('/api/statistics', (req, res) => {
  const db = require('./models/database');
  const stats = {};
  
  db.get(`SELECT COUNT(*) as count FROM borrow_records WHERE is_overdue = 1 AND status != 'returned'`, (err, row) => {
    stats.overdueCount = row ? row.count : 0;
    
    db.get(`SELECT COUNT(*) as count FROM reader_debts WHERE is_paid = 0`, (err, row) => {
      stats.unpaidDebtCount = row ? row.count : 0;
      
      db.get(`SELECT SUM(final_amount) as total FROM reader_debts WHERE is_paid = 0`, (err, row) => {
        stats.totalUnpaidAmount = row ? row.total || 0 : 0;
        
        db.get(`SELECT COUNT(*) as count FROM anomalies WHERE is_resolved = 0`, (err, row) => {
          stats.anomalyCount = row ? row.count : 0;
          
          db.get(`SELECT COUNT(*) as count FROM lost_compensation WHERE is_paid = 0`, (err, row) => {
            stats.lostCompensationCount = row ? row.count : 0;
            
            db.get(`SELECT COUNT(*) as count FROM reduction_approvals WHERE approval_status = 'pending'`, (err, row) => {
              stats.pendingReductionCount = row ? row.count : 0;
              
              res.json({ success: true, data: stats });
            });
          });
        });
      });
    });
  });
});

app.get('/api/damage-levels', (req, res) => {
  const db = require('./models/database');
  db.all(`SELECT * FROM damage_levels`, (err, rows) => {
    if (err) {
      res.json({ success: false, message: err.message });
    } else {
      res.json({ success: true, data: rows });
    }
  });
});

app.get('/api/staff', (req, res) => {
  const db = require('./models/database');
  db.all(`SELECT * FROM staff`, (err, rows) => {
    if (err) {
      res.json({ success: false, message: err.message });
    } else {
      res.json({ success: true, data: rows });
    }
  });
});

app.get('/api/readers', (req, res) => {
  const db = require('./models/database');
  db.all(`SELECT * FROM readers`, (err, rows) => {
    if (err) {
      res.json({ success: false, message: err.message });
    } else {
      res.json({ success: true, data: rows });
    }
  });
});

app.get('/api/books', (req, res) => {
  const db = require('./models/database');
  db.all(`SELECT * FROM books`, (err, rows) => {
    if (err) {
      res.json({ success: false, message: err.message });
    } else {
      res.json({ success: true, data: rows });
    }
  });
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
