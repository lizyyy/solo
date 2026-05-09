const express = require('express');
const router = express.Router();
const db = require('../database');
const { calculateHeatScore, calculateDifferenceRate, checkInterceptionRules } = require('../services/heatCalculation');

router.get('/', (req, res) => {
  const { status, station_id } = req.query;
  let sql = `SELECT at.*, s.name as station_name, r.name as route_name 
             FROM adjustment_tasks at 
             LEFT JOIN stations s ON at.station_id = s.id 
             LEFT JOIN routes r ON at.route_id = r.id 
             WHERE 1=1`;
  const params = [];
  
  if (status) {
    sql += ' AND at.status = ?';
    params.push(status);
  }
  if (station_id) {
    sql += ' AND at.station_id = ?';
    params.push(station_id);
  }
  sql += ' ORDER BY at.created_at DESC';
  
  db.all(sql, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

router.get('/:id', (req, res) => {
  const sql = `SELECT at.*, s.name as station_name, r.name as route_name, r.code as route_code
               FROM adjustment_tasks at 
               LEFT JOIN stations s ON at.station_id = s.id 
               LEFT JOIN routes r ON at.route_id = r.id 
               WHERE at.id = ?`;
  db.get(sql, [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(row);
  });
});

router.post('/', (req, res) => {
  const { station_id, route_id, type, title, description } = req.body;
  
  db.parallelize(() => {
    db.get('SELECT COUNT(*) as count FROM registrations WHERE station_id = ? AND status = ?', 
           [station_id, 'active'], (err, regCount) => {
      if (err) return res.status(500).json({ error: err.message });
      
      db.get(`SELECT COUNT(DISTINCT employee_id) as count FROM swipe_records 
              WHERE station_id = ? AND DATE(swipe_time) >= DATE('now', '-30 days')`, 
             [station_id], (err, actualCount) => {
        if (err) return res.status(500).json({ error: err.message });
        
        const registration_count = regCount.count;
        const actual_count = actualCount.count;
        const difference_rate = calculateDifferenceRate(registration_count, actual_count);
        const heat_score = calculateHeatScore(difference_rate, registration_count);
        
        const interception = checkInterceptionRules({
          registration_count,
          actual_count,
          difference_rate,
          heat_score
        });
        
        const proposal = generateProposal(registration_count, actual_count, difference_rate, heat_score);
        
        const status = interception.needsReview ? 'pending_review' : 'pending';
        
        const sql = `INSERT INTO adjustment_tasks 
                     (station_id, route_id, type, title, description, status, 
                      heat_score, registration_count, actual_count, difference_rate, 
                      proposal) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        
        db.run(sql, [station_id, route_id, type, title, description, status,
                     heat_score, registration_count, actual_count, difference_rate, proposal], 
               function(err) {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          res.json({ 
            id: this.lastID, 
            status,
            interception,
            heat_score,
            difference_rate,
            registration_count,
            actual_count,
            proposal
          });
        });
      });
    });
  });
});

router.post('/:id/review', (req, res) => {
  const { action, comment, reviewed_by } = req.body;
  const id = req.params.id;
  
  let newStatus;
  if (action === 'approve') {
    newStatus = 'approved';
  } else if (action === 'reject') {
    newStatus = 'rejected';
  } else if (action === 'escalate') {
    newStatus = 'escalated';
  } else {
    return res.status(400).json({ error: '无效的操作类型' });
  }
  
  const sql = `UPDATE adjustment_tasks SET status = ?, reviewed_at = CURRENT_TIMESTAMP, 
               reviewed_by = ?, review_comment = ? WHERE id = ?`;
  
  db.run(sql, [newStatus, reviewed_by, comment, id], (err) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (action === 'approve') {
      const taskSql = 'SELECT * FROM adjustment_tasks WHERE id = ?';
      db.get(taskSql, [id], (err, task) => {
        if (task.type === 'withdrawal') {
          db.run('UPDATE stations SET status = ? WHERE id = ?', ['withdrawn', task.station_id]);
        }
        res.json({ id, status: newStatus, message: '复核完成' });
      });
    } else {
      res.json({ id, status: newStatus, message: '复核完成' });
    }
  });
});

router.get('/:id/impact', (req, res) => {
  const taskId = req.params.id;
  const sql = 'SELECT station_id FROM adjustment_tasks WHERE id = ?';
  
  db.get(sql, [taskId], (err, task) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!task) return res.status(404).json({ error: '任务不存在' });
    
    db.all(`SELECT r.*, e.name as employee_name, e.department, e.phone, e.email
            FROM registrations r 
            LEFT JOIN employees e ON r.employee_id = e.id 
            WHERE r.station_id = ? AND r.status = ?`,
           [task.station_id, 'active'], (err, affectedEmployees) => {
      if (err) return res.status(500).json({ error: err.message });
      
      db.get(`SELECT s.name as station_name, s.code as station_code,
              r2.name as route_name, r2.code as route_code
              FROM stations s 
              LEFT JOIN routes r2 ON s.route_id = r2.id 
              WHERE s.id = ?`, [task.station_id], (err, station) => {
        if (err) return res.status(500).json({ error: err.message });
        
        const departments = {};
        affectedEmployees.forEach(emp => {
          if (emp.department) {
            departments[emp.department] = (departments[emp.department] || 0) + 1;
          }
        });
        
        res.json({
          station,
          affected_count: affectedEmployees.length,
          affected_employees: affectedEmployees,
          department_breakdown: departments,
          alternative_options: findAlternativeStations(task.station_id)
        });
      });
    });
  });
});

function generateProposal(regCount, actualCount, diffRate, heatScore) {
  if (regCount === 0) {
    return '该站点无活跃报名员工，建议直接撤点，无需过渡。';
  }
  
  if (diffRate >= 0.7) {
    return `差异率高达${(diffRate * 100).toFixed(1)}%，建议立即启动撤点流程。预计影响${regCount}名员工，需提前7天发布公告。`;
  } else if (diffRate >= 0.5) {
    return `差异率${(diffRate * 100).toFixed(1)}%，热度指数偏低。建议先观察2周，同时通知已报名员工确认乘车需求。`;
  } else if (diffRate >= 0.3) {
    return `差异率${(diffRate * 100).toFixed(1)}%，存在一定报名实乘差异。建议与部门行政对接，核实员工实际通勤情况后再决定。`;
  } else {
    return `差异率${(diffRate * 100).toFixed(1)}%，运营状况良好，暂不建议调整。可在季度评估时重新复核。`;
  }
}

function findAlternativeStations(stationId) {
  return [
    { id: null, name: '建议步行至周边站点（距离500米内）', type: 'nearby' },
    { id: null, name: '建议转乘其他线路', type: 'transfer' },
    { id: null, name: '建议申请通勤补贴', type: 'subsidy' }
  ];
}

module.exports = router;
