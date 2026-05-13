const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/routes', (req, res) => {
  db.all(`SELECT * FROM routes ORDER BY route_code`, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.post('/routes', (req, res) => {
  const { route_name, route_code, direction, capacity, operator_id, operator_name } = req.body;
  db.run(`INSERT INTO routes (route_name, route_code, direction, capacity) VALUES (?, ?, ?, ?)`,
    [route_name, route_code, direction, capacity],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      db.run(`INSERT INTO operation_logs (module, operation_type, record_id, new_value, operator_id, operator_name) VALUES (?, ?, ?, ?, ?, ?)`,
        ['route', 'create', this.lastID, JSON.stringify(req.body), operator_id, operator_name]);
      res.json({ id: this.lastID, message: '线路创建成功' });
    });
});

router.put('/routes/:id', (req, res) => {
  const { id } = req.params;
  const { route_name, route_code, direction, capacity, status, operator_id, operator_name } = req.body;
  
  db.get(`SELECT * FROM routes WHERE id = ?`, [id], (err, oldRow) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    db.run(`UPDATE routes SET route_name = ?, route_code = ?, direction = ?, capacity = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [route_name, route_code, direction, capacity, status, id],
      function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        db.run(`INSERT INTO operation_logs (module, operation_type, record_id, old_value, new_value, operator_id, operator_name) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          ['route', 'update', id, JSON.stringify(oldRow), JSON.stringify(req.body), operator_id, operator_name]);
        res.json({ message: '线路更新成功' });
      });
  });
});

router.get('/stations', (req, res) => {
  const { route_id } = req.query;
  let sql = `SELECT s.*, r.route_name FROM stations s LEFT JOIN routes r ON s.route_id = r.id`;
  let params = [];
  if (route_id) {
    sql += ` WHERE s.route_id = ?`;
    params.push(route_id);
  }
  sql += ` ORDER BY s.route_id, s.station_order`;
  
  db.all(sql, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.post('/stations', (req, res) => {
  const { route_id, station_name, station_order, arrival_time, operator_id, operator_name } = req.body;
  db.run(`INSERT INTO stations (route_id, station_name, station_order, arrival_time) VALUES (?, ?, ?, ?)`,
    [route_id, station_name, station_order, arrival_time],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      db.run(`INSERT INTO operation_logs (module, operation_type, record_id, new_value, operator_id, operator_name) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['station', 'create', this.lastID, JSON.stringify(req.body), operator_id, operator_name]);
      res.json({ id: this.lastID, message: '站点创建成功' });
    });
});

router.put('/stations/:id', (req, res) => {
  const { id } = req.params;
  const { route_id, station_name, station_order, arrival_time, operator_id, operator_name } = req.body;
  
  db.get(`SELECT * FROM stations WHERE id = ?`, [id], (err, oldRow) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    db.run(`UPDATE stations SET route_id = ?, station_name = ?, station_order = ?, arrival_time = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [route_id, station_name, station_order, arrival_time, id],
      function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        db.run(`INSERT INTO operation_logs (module, operation_type, record_id, old_value, new_value, operator_id, operator_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          ['station', 'update', id, JSON.stringify(oldRow), JSON.stringify(req.body), operator_id, operator_name]);
        res.json({ message: '站点更新成功' });
      });
  });
});

router.get('/reservations', (req, res) => {
  const { route_id, date, status } = req.query;
  let sql = `SELECT r.*, rt.route_name, s.station_name FROM reservations r 
             LEFT JOIN routes rt ON r.route_id = rt.id 
             LEFT JOIN stations s ON r.station_id = s.id WHERE 1=1`;
  let params = [];
  
  if (route_id) { sql += ` AND r.route_id = ?`; params.push(route_id); }
  if (date) { sql += ` AND r.reservation_date = ?`; params.push(date); }
  if (status) { sql += ` AND r.status = ?`; params.push(status); }
  
  sql += ` ORDER BY r.created_at DESC`;
  
  db.all(sql, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.put('/reservations/:id', (req, res) => {
  const { id } = req.params;
  const { status, operator_id, operator_name, remark } = req.body;
  
  db.get(`SELECT * FROM reservations WHERE id = ?`, [id], (err, oldRow) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    db.run(`UPDATE reservations SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [status, id],
      function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        db.run(`INSERT INTO operation_logs (module, operation_type, record_id, old_value, new_value, operator_id, operator_name, remark) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          ['reservation', 'update', id, JSON.stringify(oldRow), JSON.stringify(req.body), operator_id, operator_name, remark]);
        res.json({ message: '预约更新成功' });
      });
  });
});

router.get('/waitlists', (req, res) => {
  const { route_id, date, status } = req.query;
  let sql = `SELECT w.*, rt.route_name, s.station_name FROM waitlists w 
             LEFT JOIN routes rt ON w.route_id = rt.id 
             LEFT JOIN stations s ON w.station_id = s.id WHERE 1=1`;
  let params = [];
  
  if (route_id) { sql += ` AND w.route_id = ?`; params.push(route_id); }
  if (date) { sql += ` AND w.reservation_date = ?`; params.push(date); }
  if (status) { sql += ` AND w.status = ?`; params.push(status); }
  
  sql += ` ORDER BY w.priority, w.created_at`;
  
  db.all(sql, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.post('/waitlists/:id/promote', (req, res) => {
  const { id } = req.params;
  const { operator_id, operator_name } = req.body;
  
  db.get(`SELECT * FROM waitlists WHERE id = ?`, [id], (err, waitlist) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!waitlist || waitlist.status !== 'waiting') {
      res.status(400).json({ error: '候补记录无效或已处理' });
      return;
    }
    
    db.run(`BEGIN TRANSACTION`);
    db.run(`UPDATE waitlists SET status = 'promoted', promoted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]);
    db.run(`INSERT INTO reservations (route_id, user_id, user_name, station_id, reservation_date, time_slot, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [waitlist.route_id, waitlist.user_id, waitlist.user_name, waitlist.station_id, waitlist.reservation_date, waitlist.time_slot, 'confirmed']);
    db.run(`INSERT INTO operation_logs (module, operation_type, record_id, new_value, operator_id, operator_name) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['waitlist', 'promote', id, JSON.stringify({ promoted: true }), operator_id, operator_name]);
    db.run(`COMMIT`, (err) => {
      if (err) {
        db.run(`ROLLBACK`);
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: '候补转正成功' });
    });
  });
});

router.get('/temp-buses', (req, res) => {
  const { route_id, date } = req.query;
  let sql = `SELECT t.*, r.route_name FROM temp_buses t LEFT JOIN routes r ON t.route_id = r.id WHERE 1=1`;
  let params = [];
  
  if (route_id) { sql += ` AND t.route_id = ?`; params.push(route_id); }
  if (date) { sql += ` AND t.effective_date = ?`; params.push(date); }
  
  sql += ` ORDER BY t.created_at DESC`;
  
  db.all(sql, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.post('/temp-buses', (req, res) => {
  const { route_id, bus_number, capacity, driver_name, effective_date, time_slot, reason, operator_id, operator_name } = req.body;
  db.run(`INSERT INTO temp_buses (route_id, bus_number, capacity, driver_name, effective_date, time_slot, reason, operator_id, operator_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [route_id, bus_number, capacity, driver_name, effective_date, time_slot, reason, operator_id, operator_name],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      db.run(`INSERT INTO operation_logs (module, operation_type, record_id, new_value, operator_id, operator_name) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['temp_bus', 'create', this.lastID, JSON.stringify(req.body), operator_id, operator_name]);
      res.json({ id: this.lastID, message: '临时加车成功' });
    });
});

router.get('/exceptions', (req, res) => {
  const { route_id, severity, status } = req.query;
  let sql = `SELECT e.*, r.route_name FROM exceptions e LEFT JOIN routes r ON e.route_id = r.id WHERE 1=1`;
  let params = [];
  
  if (route_id) { sql += ` AND e.route_id = ?`; params.push(route_id); }
  if (severity) { sql += ` AND e.severity = ?`; params.push(severity); }
  if (status) { sql += ` AND e.status = ?`; params.push(status); }
  
  sql += ` ORDER BY e.created_at DESC`;
  
  db.all(sql, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.put('/exceptions/:id/handle', (req, res) => {
  const { id } = req.params;
  const { handler_id, handler_name, old_value, new_value } = req.body;
  
  db.run(`UPDATE exceptions SET status = 'handled', handler_id = ?, handler_name = ?, handled_at = CURRENT_TIMESTAMP, old_value = ?, new_value = ? WHERE id = ?`,
    [handler_id, handler_name, old_value, new_value, id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      db.run(`INSERT INTO operation_logs (module, operation_type, record_id, old_value, new_value, operator_id, operator_name) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['exception', 'handle', id, old_value, new_value, handler_id, handler_name]);
      res.json({ message: '异常处理完成' });
    });
});

router.get('/statistics', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  
  db.parallelize(() => {
    let totalRoutes, activeReservations, waitingCount, tempBusCount, handledExceptions;
    
    db.get(`SELECT COUNT(*) as count FROM routes WHERE status = 'active'`, (err, row) => { totalRoutes = row.count; });
    db.get(`SELECT COUNT(*) as count FROM reservations WHERE reservation_date = ?`, [today], (err, row) => { activeReservations = row.count; });
    db.get(`SELECT COUNT(*) as count FROM waitlists WHERE status = 'waiting'`, (err, row) => { waitingCount = row.count; });
    db.get(`SELECT COUNT(*) as count FROM temp_buses WHERE effective_date = ? AND status = 'active'`, [today], (err, row) => { tempBusCount = row.count; });
    db.get(`SELECT COUNT(*) as count FROM exceptions WHERE status = 'pending'`, (err, row) => { handledExceptions = row.count; });
    
    setTimeout(() => {
      res.json({
        totalRoutes,
        activeReservations,
        waitingCount,
        tempBusCount,
        pendingExceptions: handledExceptions
      });
    }, 100);
  });
});

router.get('/load-rates', (req, res) => {
  const { start_date, end_date, route_id } = req.query;
  let sql = `SELECT d.*, r.route_name FROM daily_load_rates d LEFT JOIN routes r ON d.route_id = r.id WHERE 1=1`;
  let params = [];
  
  if (start_date) { sql += ` AND d.stat_date >= ?`; params.push(start_date); }
  if (end_date) { sql += ` AND d.stat_date <= ?`; params.push(end_date); }
  if (route_id) { sql += ` AND d.route_id = ?`; params.push(route_id); }
  
  sql += ` ORDER BY d.stat_date DESC, d.route_id`;
  
  db.all(sql, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.post('/load-rates/calculate', (req, res) => {
  const { route_id, stat_date, time_slot, operator_id, operator_name } = req.body;
  
  db.get(`SELECT capacity FROM routes WHERE id = ?`, [route_id], (err, route) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    const base_capacity = route.capacity;
    
    db.get(`SELECT SUM(capacity) as temp_capacity FROM temp_buses WHERE route_id = ? AND effective_date = ? AND time_slot = ? AND status = 'active'`,
      [route_id, stat_date, time_slot], (err, tempBus) => {
        const temp_capacity = tempBus.temp_capacity || 0;
        const total_capacity = base_capacity + temp_capacity;
        
        db.get(`SELECT COUNT(*) as reserved_count FROM reservations WHERE route_id = ? AND reservation_date = ? AND time_slot = ? AND status = 'confirmed'`,
          [route_id, stat_date, time_slot], (err, reserved) => {
            const reserved_count = reserved.reserved_count;
            
            db.get(`SELECT COUNT(*) as waitlist_promoted_count FROM waitlists WHERE route_id = ? AND reservation_date = ? AND time_slot = ? AND status = 'promoted'`,
              [route_id, stat_date, time_slot], (err, promoted) => {
                const waitlist_promoted_count = promoted.waitlist_promoted_count;
                
                db.get(`SELECT COUNT(*) as no_show_deduction FROM reservations WHERE route_id = ? AND reservation_date = ? AND time_slot = ? AND status = 'no_show'`,
                  [route_id, stat_date, time_slot], (err, noShow) => {
                    const no_show_deduction = noShow.no_show_deduction;
                    const actual_passengers = reserved_count + waitlist_promoted_count - no_show_deduction;
                    const final_load_rate = total_capacity > 0 ? (actual_passengers / total_capacity * 100).toFixed(2) : 0;
                    
                    db.run(`INSERT OR REPLACE INTO daily_load_rates (route_id, stat_date, time_slot, base_capacity, temp_capacity, total_capacity, reserved_count, waitlist_promoted_count, no_show_deduction, final_load_rate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                      [route_id, stat_date, time_slot, base_capacity, temp_capacity, total_capacity, reserved_count, waitlist_promoted_count, no_show_deduction, parseFloat(final_load_rate)],
                      function(err) {
                        if (err) {
                          res.status(500).json({ error: err.message });
                          return;
                        }
                        res.json({
                          message: '满载率计算完成',
                          data: {
                            base_capacity,
                            temp_capacity,
                            total_capacity,
                            reserved_count,
                            waitlist_promoted_count,
                            no_show_deduction,
                            final_load_rate: parseFloat(final_load_rate)
                          }
                        });
                      });
                  });
              });
          });
      });
  });
});

router.get('/operation-logs', (req, res) => {
  const { module, start_date, end_date, operator_id } = req.query;
  let sql = `SELECT * FROM operation_logs WHERE 1=1`;
  let params = [];
  
  if (module) { sql += ` AND module = ?`; params.push(module); }
  if (start_date) { sql += ` AND DATE(created_at) >= ?`; params.push(start_date); }
  if (end_date) { sql += ` AND DATE(created_at) <= ?`; params.push(end_date); }
  if (operator_id) { sql += ` AND operator_id = ?`; params.push(operator_id); }
  
  sql += ` ORDER BY created_at DESC LIMIT 500`;
  
  db.all(sql, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

const ExcelJS = require('exceljs');

router.get('/reports/export', async (req, res) => {
  const { start_date, end_date, route_id, operator_id, export_type = 'excel' } = req.query;
  
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = '班车管理系统';
    workbook.created = new Date();
    
    const worksheet1 = workbook.addWorksheet('预约数据');
    worksheet1.columns = [
      { header: '线路名称', key: 'route_name', width: 15 },
      { header: '用户ID', key: 'user_id', width: 12 },
      { header: '用户姓名', key: 'user_name', width: 12 },
      { header: '站点', key: 'station_name', width: 15 },
      { header: '预约日期', key: 'reservation_date', width: 12 },
      { header: '时段', key: 'time_slot', width: 10 },
      { header: '状态', key: 'status', width: 10 }
    ];
    
    const worksheet2 = workbook.addWorksheet('候补数据');
    worksheet2.columns = [
      { header: '线路名称', key: 'route_name', width: 15 },
      { header: '用户ID', key: 'user_id', width: 12 },
      { header: '用户姓名', key: 'user_name', width: 12 },
      { header: '站点', key: 'station_name', width: 15 },
      { header: '候补日期', key: 'reservation_date', width: 12 },
      { header: '时段', key: 'time_slot', width: 10 },
      { header: '优先级', key: 'priority', width: 8 },
      { header: '状态', key: 'status', width: 10 }
    ];
    
    const worksheet3 = workbook.addWorksheet('操作日志');
    worksheet3.columns = [
      { header: '模块', key: 'module', width: 12 },
      { header: '操作类型', key: 'operation_type', width: 12 },
      { header: '原值', key: 'old_value', width: 30 },
      { header: '新值', key: 'new_value', width: 30 },
      { header: '责任人', key: 'operator_name', width: 12 },
      { header: '处理时间', key: 'created_at', width: 20 }
    ];
    
    const worksheet4 = workbook.addWorksheet('满载率统计');
    worksheet4.columns = [
      { header: '线路名称', key: 'route_name', width: 15 },
      { header: '统计日期', key: 'stat_date', width: 12 },
      { header: '时段', key: 'time_slot', width: 10 },
      { header: '基础容量', key: 'base_capacity', width: 10 },
      { header: '临时容量', key: 'temp_capacity', width: 10 },
      { header: '总容量', key: 'total_capacity', width: 10 },
      { header: '预约人数', key: 'reserved_count', width: 10 },
      { header: '候补转正', key: 'waitlist_promoted_count', width: 10 },
      { header: '爽约扣减', key: 'no_show_deduction', width: 10 },
      { header: '满载率(%)', key: 'final_load_rate', width: 12 }
    ];
    
    const worksheet5 = workbook.addWorksheet('异常记录');
    worksheet5.columns = [
      { header: '线路名称', key: 'route_name', width: 15 },
      { header: '异常类型', key: 'exception_type', width: 15 },
      { header: '严重程度', key: 'severity', width: 10 },
      { header: '描述', key: 'description', width: 30 },
      { header: '原因', key: 'reason', width: 30 },
      { header: '状态', key: 'status', width: 10 },
      { header: '处理人', key: 'handler_name', width: 12 },
      { header: '处理时间', key: 'handled_at', width: 20 }
    ];
    
    let reservationSql = `SELECT r.*, rt.route_name, s.station_name FROM reservations r LEFT JOIN routes rt ON r.route_id = rt.id LEFT JOIN stations s ON r.station_id = s.id WHERE 1=1`;
    let waitlistSql = `SELECT w.*, rt.route_name, s.station_name FROM waitlists w LEFT JOIN routes rt ON w.route_id = rt.id LEFT JOIN stations s ON w.station_id = s.id WHERE 1=1`;
    let logSql = `SELECT * FROM operation_logs WHERE 1=1`;
    let loadRateSql = `SELECT d.*, r.route_name FROM daily_load_rates d LEFT JOIN routes r ON d.route_id = r.id WHERE 1=1`;
    let exceptionSql = `SELECT e.*, r.route_name FROM exceptions e LEFT JOIN routes r ON e.route_id = r.id WHERE 1=1`;
    
    let reservationParams = [];
    let waitlistParams = [];
    let logParams = [];
    let loadRateParams = [];
    let exceptionParams = [];
    
    if (start_date) {
      reservationSql += ` AND r.reservation_date >= ?`; reservationParams.push(start_date);
      waitlistSql += ` AND w.reservation_date >= ?`; waitlistParams.push(start_date);
      logSql += ` AND DATE(created_at) >= ?`; logParams.push(start_date);
      loadRateSql += ` AND d.stat_date >= ?`; loadRateParams.push(start_date);
      exceptionSql += ` AND DATE(e.created_at) >= ?`; exceptionParams.push(start_date);
    }
    if (end_date) {
      reservationSql += ` AND r.reservation_date <= ?`; reservationParams.push(end_date);
      waitlistSql += ` AND w.reservation_date <= ?`; waitlistParams.push(end_date);
      logSql += ` AND DATE(created_at) <= ?`; logParams.push(end_date);
      loadRateSql += ` AND d.stat_date <= ?`; loadRateParams.push(end_date);
      exceptionSql += ` AND DATE(e.created_at) <= ?`; exceptionParams.push(end_date);
    }
    if (route_id) {
      reservationSql += ` AND r.route_id = ?`; reservationParams.push(route_id);
      waitlistSql += ` AND w.route_id = ?`; waitlistParams.push(route_id);
      loadRateSql += ` AND d.route_id = ?`; loadRateParams.push(route_id);
      exceptionSql += ` AND e.route_id = ?`; exceptionParams.push(route_id);
    }
    if (operator_id) {
      logSql += ` AND operator_id = ?`; logParams.push(operator_id);
    }
    
    const reservations = await new Promise((resolve, reject) => {
      db.all(reservationSql, reservationParams, (err, rows) => err ? reject(err) : resolve(rows));
    });
    const waitlists = await new Promise((resolve, reject) => {
      db.all(waitlistSql, waitlistParams, (err, rows) => err ? reject(err) : resolve(rows));
    });
    const logs = await new Promise((resolve, reject) => {
      db.all(logSql, logParams, (err, rows) => err ? reject(err) : resolve(rows));
    });
    const loadRates = await new Promise((resolve, reject) => {
      db.all(loadRateSql, loadRateParams, (err, rows) => err ? reject(err) : resolve(rows));
    });
    const exceptions = await new Promise((resolve, reject) => {
      db.all(exceptionSql, exceptionParams, (err, rows) => err ? reject(err) : resolve(rows));
    });
    
    worksheet1.addRows(reservations);
    worksheet2.addRows(waitlists);
    worksheet3.addRows(logs);
    worksheet4.addRows(loadRates);
    worksheet5.addRows(exceptions);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=班车管理报表_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
