const db = require('../config/database');
const moment = require('moment');

const getAccessRecords = (req, res) => {
  const { 
    visitor_name, 
    id_card, 
    plate_number, 
    gate_id, 
    start_date, 
    end_date,
    access_type,
    status,
    page = 1, 
    pageSize = 20 
  } = req.query;
  
  const offset = (page - 1) * pageSize;
  
  let query = `SELECT r.*,
    a.visitor_name, a.id_card, a.phone, a.company, a.visit_purpose,
    a.visitor_code, a.visit_start_time, a.visit_end_time,
    e.name as employee_name, e.department,
    g.gate_name, g.location as gate_location
    FROM access_records r
    LEFT JOIN visitor_appointments a ON r.appointment_id = a.id
    LEFT JOIN employees e ON a.employee_id = e.id
    LEFT JOIN gates g ON r.gate_id = g.gate_code
    WHERE 1=1`;
  let params = [];
  let countQuery = `SELECT COUNT(*) as total FROM access_records r
    LEFT JOIN visitor_appointments a ON r.appointment_id = a.id
    WHERE 1=1`;
  let countParams = [];

  if (visitor_name) {
    const condition = ' AND a.visitor_name LIKE ?';
    query += condition;
    countQuery += condition;
    params.push(`%${visitor_name}%`);
    countParams.push(`%${visitor_name}%`);
  }
  
  if (id_card) {
    const condition = ' AND a.id_card = ?';
    query += condition;
    countQuery += condition;
    params.push(id_card);
    countParams.push(id_card);
  }
  
  if (plate_number) {
    const condition = ' AND r.plate_number LIKE ?';
    query += condition;
    countQuery += condition;
    params.push(`%${plate_number}%`);
    countParams.push(`%${plate_number}%`);
  }
  
  if (gate_id) {
    const condition = ' AND r.gate_id = ?';
    query += condition;
    countQuery += condition;
    params.push(gate_id);
    countParams.push(gate_id);
  }
  
  if (access_type) {
    const condition = ' AND r.access_type = ?';
    query += condition;
    countQuery += condition;
    params.push(access_type);
    countParams.push(access_type);
  }
  
  if (status) {
    const condition = ' AND r.status = ?';
    query += condition;
    countQuery += condition;
    params.push(status);
    countParams.push(status);
  }
  
  if (start_date) {
    const condition = ' AND DATE(r.access_time) >= ?';
    query += condition;
    countQuery += condition;
    params.push(start_date);
    countParams.push(start_date);
  }
  
  if (end_date) {
    const condition = ' AND DATE(r.access_time) <= ?';
    query += condition;
    countQuery += condition;
    params.push(end_date);
    countParams.push(end_date);
  }
  
  query += ' ORDER BY r.access_time DESC LIMIT ? OFFSET ?';
  params.push(parseInt(pageSize), offset);

  db.all(query, params, (err, records) => {
    if (err) {
      return res.status(500).json({ code: 500, message: '服务器错误', error: err.message });
    }

    db.get(countQuery, countParams, (err, result) => {
      if (err) {
        return res.status(500).json({ code: 500, message: '服务器错误', error: err.message });
      }

      res.json({
        code: 200,
        message: '获取成功',
        data: {
          list: records,
          pagination: {
            page: parseInt(page),
            pageSize: parseInt(pageSize),
            total: result.total
          }
        }
      });
    });
  });
};

const getStatistics = (req, res) => {
  const { date } = req.query;
  const targetDate = date || moment().format('YYYY-MM-DD');

  const stats = {};

  db.get(`SELECT COUNT(*) as total 
    FROM visitor_appointments 
    WHERE DATE(visit_start_time) = ?`, [targetDate], (err, row) => {
    stats.total_appointments = row ? row.total : 0;

    db.get(`SELECT COUNT(*) as count 
      FROM visitor_appointments 
      WHERE DATE(visit_start_time) = ? AND status = 'approved'`, [targetDate], (err, row) => {
      stats.approved_appointments = row ? row.count : 0;

      db.get(`SELECT COUNT(*) as count 
        FROM visitor_appointments 
        WHERE DATE(visit_start_time) = ? AND status = 'checkin'`, [targetDate], (err, row) => {
        stats.checked_in = row ? row.count : 0;

        db.get(`SELECT COUNT(*) as count 
          FROM visitor_appointments 
          WHERE DATE(visit_start_time) = ? AND status = 'checkout'`, [targetDate], (err, row) => {
          stats.checked_out = row ? row.count : 0;

          db.get(`SELECT COUNT(*) as count 
            FROM visitor_appointments 
            WHERE DATE(visit_start_time) = ? AND status = 'expired'`, [targetDate], (err, row) => {
            stats.expired = row ? row.count : 0;

            db.get(`SELECT COUNT(*) as count 
              FROM access_records 
              WHERE DATE(access_time) = ? AND status = 'failed'`, [targetDate], (err, row) => {
              stats.failed_access = row ? row.count : 0;

              res.json({
                code: 200,
                message: '获取成功',
                data: {
                  date: targetDate,
                  statistics: stats
                }
              });
            });
          });
        });
      });
    });
  });
};

const exportExceptionSummary = (req, res) => {
  const { date } = req.query;
  const targetDate = date || moment().format('YYYY-MM-DD');

  db.all(`SELECT 
    r.id,
    r.visitor_code,
    r.plate_number,
    r.gate_id,
    g.gate_name,
    r.access_type,
    r.access_time,
    r.status,
    r.failure_reason,
    a.visitor_name,
    a.id_card,
    a.status as appointment_status,
    a.visit_start_time,
    a.visit_end_time
    FROM access_records r
    LEFT JOIN visitor_appointments a ON r.appointment_id = a.id
    LEFT JOIN gates g ON r.gate_id = g.gate_code
    WHERE DATE(r.access_time) = ? AND r.status = 'failed'
    ORDER BY r.access_time DESC`, [targetDate], (err, failedRecords) => {
    if (err) {
      return res.status(500).json({ code: 500, message: '服务器错误', error: err.message });
    }

    db.all(`SELECT 
      a.id,
      a.visitor_code,
      a.visitor_name,
      a.id_card,
      a.visit_start_time,
      a.visit_end_time,
      a.status,
      e.name as employee_name,
      e.department
      FROM visitor_appointments a
      LEFT JOIN employees e ON a.employee_id = e.id
      WHERE DATE(a.visit_start_time) = ? 
      AND a.status IN ('expired', 'approved')
      AND a.checkin_time IS NULL
      AND a.visit_end_time < datetime('now')
      ORDER BY a.visit_end_time DESC`, [targetDate], (err, expiredWithoutCheckin) => {
      if (err) {
        return res.status(500).json({ code: 500, message: '服务器错误', error: err.message });
      }

      db.all(`SELECT 
        a.id,
        a.visitor_code,
        a.visitor_name,
        a.id_card,
        a.visit_start_time,
        a.visit_end_time,
        a.checkin_time,
        e.name as employee_name,
        e.department
        FROM visitor_appointments a
        LEFT JOIN employees e ON a.employee_id = e.id
        WHERE DATE(a.visit_start_time) = ? 
        AND a.status = 'checkin'
        AND a.checkin_time IS NOT NULL
        ORDER BY a.checkin_time DESC`, [targetDate], (err, checkedInNotOut) => {
        if (err) {
          return res.status(500).json({ code: 500, message: '服务器错误', error: err.message });
        }

        const reasonGroups = {};
        failedRecords.forEach(record => {
          const reason = record.failure_reason || '未知原因';
          if (!reasonGroups[reason]) {
            reasonGroups[reason] = { count: 0, records: [] };
          }
          reasonGroups[reason].count++;
          reasonGroups[reason].records.push({
            visitor_code: record.visitor_code,
            plate_number: record.plate_number,
            gate_name: record.gate_name,
            access_time: record.access_time,
            visitor_name: record.visitor_name
          });
        });

        res.json({
          code: 200,
          message: '获取成功',
          data: {
            date: targetDate,
            summary: {
              total_failed_access: failedRecords.length,
              total_expired_no_checkin: expiredWithoutCheckin.length,
              total_checked_in_not_out: checkedInNotOut.length,
              failed_reason_distribution: reasonGroups
            },
            failed_access_records: failedRecords,
            expired_no_checkin: expiredWithoutCheckin,
            checked_in_not_out: checkedInNotOut
          }
        });
      });
    });
  });
};

module.exports = {
  getAccessRecords,
  getStatistics,
  exportExceptionSummary
};
