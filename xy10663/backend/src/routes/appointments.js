const express = require('express');
const router = express.Router();
const db = require('../database');
const { Parser } = require('json2csv');
const moment = require('moment');

function calculateStatus(appointment) {
  const now = moment();
  const apptDate = moment(`${appointment.appointment_date} ${appointment.appointment_time}`);
  
  if (appointment.status === 'cancelled') return 'cancelled';
  if (appointment.status === 'completed') return 'completed';
  
  if (apptDate.isBefore(now) && appointment.status !== 'completed') {
    return 'no_show';
  }
  
  return appointment.status;
}

router.get('/', (req, res) => {
  const { 
    patient_name, status, report_status, start_date, end_date, 
    lab_item, operator, page = 1, limit = 20 
  } = req.query;
  
  let query = `SELECT a.*, 
    (SELECT COUNT(*) FROM reschedule_logs WHERE appointment_id = a.id) as reschedule_count,
    (SELECT COUNT(*) FROM adjustment_logs WHERE appointment_id = a.id) as adjustment_count
    FROM appointments a WHERE 1=1`;
  const params = [];

  if (patient_name) {
    query += ` AND a.patient_name LIKE ?`;
    params.push(`%${patient_name}%`);
  }
  if (status) {
    query += ` AND a.status = ?`;
    params.push(status);
  }
  if (report_status) {
    query += ` AND a.report_status = ?`;
    params.push(report_status);
  }
  if (start_date) {
    query += ` AND a.appointment_date >= ?`;
    params.push(start_date);
  }
  if (end_date) {
    query += ` AND a.appointment_date <= ?`;
    params.push(end_date);
  }
  if (lab_item) {
    query += ` AND a.lab_item LIKE ?`;
    params.push(`%${lab_item}%`);
  }

  const offset = (page - 1) * limit;
  query += ` ORDER BY a.appointment_date DESC, a.appointment_time DESC LIMIT ? OFFSET ?`;
  params.push(parseInt(limit), offset);

  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    const result = rows.map(row => ({
      ...row,
      computed_status: calculateStatus(row)
    }));

    db.get(`SELECT COUNT(*) as total FROM appointments a WHERE 1=1`, (err, countRow) => {
      res.json({
        data: result,
        total: countRow.total,
        page: parseInt(page),
        limit: parseInt(limit)
      });
    });
  });
});

router.get('/dashboard', (req, res) => {
  db.all(`
    SELECT 
      status,
      COUNT(*) as count
    FROM appointments
    GROUP BY status
  `, (err, statusCounts) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    db.all(`
      SELECT 
        report_status,
        COUNT(*) as count
      FROM appointments
      GROUP BY report_status
    `, (err, reportCounts) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      db.all(`
        SELECT 
          is_abnormal,
          COUNT(*) as count
        FROM reschedule_logs
        GROUP BY is_abnormal
      `, (err, abnormalCounts) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }

        db.all(`
          SELECT 
            DATE(appointment_date) as date,
            COUNT(*) as count
          FROM appointments
          WHERE appointment_date >= DATE('now', '-7 days')
          GROUP BY DATE(appointment_date)
          ORDER BY date DESC
        `, (err, weeklyTrend) => {
          res.json({
            status_counts: statusCounts,
            report_status_counts: reportCounts,
            abnormal_reschedule_counts: abnormalCounts,
            weekly_trend: weeklyTrend
          });
        });
      });
    });
  });
});

router.get('/abnormal', (req, res) => {
  db.all(`
    SELECT 
      rl.*,
      a.patient_name,
      a.lab_item,
      a.patient_id,
      a.phone
    FROM reschedule_logs rl
    JOIN appointments a ON rl.appointment_id = a.id
    WHERE rl.is_abnormal = 1
    ORDER BY rl.created_at DESC
  `, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.get('/:id', (req, res) => {
  const { id } = req.params;
  db.get(`SELECT * FROM appointments WHERE id = ?`, [id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: '预约记录不存在' });
      return;
    }
    res.json(row);
  });
});

router.post('/', (req, res) => {
  const {
    patient_id, patient_name, phone, lab_item, lab_item_code,
    sampling_window, fasting_required, fasting_hours,
    appointment_date, appointment_time, status = 'pending'
  } = req.body;

  const stmt = db.prepare(`
    INSERT INTO appointments 
    (patient_id, patient_name, phone, lab_item, lab_item_code, 
     sampling_window, fasting_required, fasting_hours, 
     appointment_date, appointment_time, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    patient_id, patient_name, phone, lab_item, lab_item_code,
    sampling_window, fasting_required ? 1 : 0, fasting_hours,
    appointment_date, appointment_time, status,
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: this.lastID, message: '创建成功' });
    }
  );
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  const operator = updates.operator || 'system';
  
  db.get(`SELECT * FROM appointments WHERE id = ?`, [id], (err, oldAppt) => {
    if (err || !oldAppt) {
      res.status(404).json({ error: '预约记录不存在' });
      return;
    }

    const fields = [];
    const values = [];
    const logFields = [];

    Object.keys(updates).forEach(key => {
      if (key !== 'operator' && key !== 'reason' && oldAppt[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(updates[key]);
        
        if (['sampling_window', 'fasting_required', 'lab_item', 'appointment_date', 'appointment_time'].includes(key)) {
          logFields.push({
            field: key,
            old: oldAppt[key],
            new: updates[key]
          });
        }
      }
    });

    if (fields.length === 0) {
      res.json({ message: '没有需要更新的字段' });
      return;
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    db.run(`UPDATE appointments SET ${fields.join(', ')} WHERE id = ?`, values, (err) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      if (logFields.length > 0) {
        const logStmt = db.prepare(`
          INSERT INTO adjustment_logs 
          (appointment_id, field_name, old_value, new_value, reason, operator)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        
        logFields.forEach(field => {
          logStmt.run(id, field.field, String(field.old), String(field.new), updates.reason || '修改', operator);
        });
        logStmt.finalize();
      }

      res.json({ message: '更新成功' });
    });
  });
});

router.post('/:id/reschedule', (req, res) => {
  const { id } = req.params;
  const { new_appointment_date, new_appointment_time, reason, operator } = req.body;

  db.get(`SELECT * FROM appointments WHERE id = ?`, [id], (err, oldAppt) => {
    if (err || !oldAppt) {
      res.status(404).json({ error: '预约记录不存在' });
      return;
    }

    db.get(`SELECT COUNT(*) as count FROM reschedule_logs WHERE appointment_id = ?`, [id], (err, countRow) => {
      const isAbnormal = countRow.count >= 2 ? 1 : 0;
      const abnormalNote = isAbnormal ? `改约次数${countRow.count + 1}次，需关注` : null;

      const rescheduleStmt = db.prepare(`
        INSERT INTO reschedule_logs
        (appointment_id, old_appointment_date, new_appointment_date, old_appointment_time,
         new_appointment_time, old_sampling_window, new_sampling_window, 
         old_lab_item, new_lab_item, old_fasting_required, new_fasting_required,
         reason, operator, is_abnormal, abnormal_note)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      rescheduleStmt.run(
        id, oldAppt.appointment_date, new_appointment_date,
        oldAppt.appointment_time, new_appointment_time,
        oldAppt.sampling_window, oldAppt.sampling_window,
        oldAppt.lab_item, oldAppt.lab_item,
        oldAppt.fasting_required, oldAppt.fasting_required,
        reason, operator, isAbnormal, abnormalNote,
        (err) => {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }

          db.run(`
            UPDATE appointments 
            SET appointment_date = ?, appointment_time = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [new_appointment_date, new_appointment_time, id], (err) => {
            if (err) {
              res.status(500).json({ error: err.message });
              return;
            }
            res.json({ message: '改约成功', is_abnormal: isAbnormal });
          });
        }
      );
    });
  });
});

router.get('/export/csv', (req, res) => {
  const { 
    patient_name, status, report_status, start_date, end_date, 
    lab_item, operator, handler, start_handler_time, end_handler_time
  } = req.query;

  let query = `
    SELECT 
      a.patient_id,
      a.patient_name,
      a.phone,
      a.lab_item,
      a.sampling_window,
      CASE WHEN a.fasting_required = 1 THEN '是' ELSE '否' END as fasting_required,
      a.fasting_hours,
      a.appointment_date,
      a.appointment_time,
      a.status,
      a.report_status,
      a.reminder_count,
      (SELECT COUNT(*) FROM reschedule_logs WHERE appointment_id = a.id) as reschedule_count,
      al.operator as handler,
      al.created_at as handler_time
    FROM appointments a
    LEFT JOIN adjustment_logs al ON a.id = al.appointment_id
    WHERE 1=1
  `;
  const params = [];

  if (patient_name) {
    query += ` AND a.patient_name LIKE ?`;
    params.push(`%${patient_name}%`);
  }
  if (status) {
    query += ` AND a.status = ?`;
    params.push(status);
  }
  if (report_status) {
    query += ` AND a.report_status = ?`;
    params.push(report_status);
  }
  if (start_date) {
    query += ` AND a.appointment_date >= ?`;
    params.push(start_date);
  }
  if (end_date) {
    query += ` AND a.appointment_date <= ?`;
    params.push(end_date);
  }
  if (lab_item) {
    query += ` AND a.lab_item LIKE ?`;
    params.push(`%${lab_item}%`);
  }
  if (handler) {
    query += ` AND al.operator LIKE ?`;
    params.push(`%${handler}%`);
  }
  if (start_handler_time) {
    query += ` AND al.created_at >= ?`;
    params.push(start_handler_time);
  }
  if (end_handler_time) {
    query += ` AND al.created_at <= ?`;
    params.push(end_handler_time);
  }

  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    const fields = [
      'patient_id', 'patient_name', 'phone', 'lab_item', 'sampling_window',
      'fasting_required', 'fasting_hours', 'appointment_date', 'appointment_time',
      'status', 'report_status', 'reminder_count', 'reschedule_count',
      'handler', 'handler_time'
    ];

    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(rows);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="appointments_${moment().format('YYYYMMDDHHmmss')}.csv"`);
    res.send('\uFEFF' + csv);
  });
});

router.get('/:id/logs', (req, res) => {
  const { id } = req.params;
  
  db.all(`
    SELECT 
      'reschedule' as type,
      created_at,
      operator,
      reason,
      is_abnormal,
      abnormal_note,
      old_appointment_date as old_value,
      new_appointment_date as new_value
    FROM reschedule_logs
    WHERE appointment_id = ?
    
    UNION ALL
    
    SELECT 
      'adjustment' as type,
      created_at,
      operator,
      reason,
      0 as is_abnormal,
      null as abnormal_note,
      old_value,
      new_value
    FROM adjustment_logs
    WHERE appointment_id = ?
    
    ORDER BY created_at DESC
  `, [id, id], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.get('/reminders/pending', (req, res) => {
  const tomorrow = moment().add(1, 'day').format('YYYY-MM-DD');
  db.all(`
    SELECT * FROM appointments
    WHERE appointment_date = ?
    AND reminder_sent = 0
    AND status NOT IN ('cancelled', 'completed')
    ORDER BY appointment_time
  `, [tomorrow], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.post('/reminders/send', (req, res) => {
  const { appointment_ids, operator } = req.body;
  if (!appointment_ids || appointment_ids.length === 0) {
    res.status(400).json({ error: '请选择预约记录' });
    return;
  }

  const placeholders = appointment_ids.map(() => '?').join(',');
  db.run(`
    UPDATE appointments 
    SET reminder_sent = 1, reminder_count = reminder_count + 1, updated_at = CURRENT_TIMESTAMP
    WHERE id IN (${placeholders})
  `, appointment_ids, (err) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: `成功发送 ${appointment_ids.length} 条提醒` });
  });
});

router.get('/fasting/validate/:id', (req, res) => {
  const { id } = req.params;
  db.get(`SELECT * FROM appointments WHERE id = ?`, [id], (err, appt) => {
    if (err || !appt) {
      res.status(404).json({ error: '预约记录不存在' });
      return;
    }

    const isValid = appt.fasting_required === 1 ? 
      (appt.appointment_time >= '08:00' && appt.appointment_time <= '10:00') : true;

    res.json({
      appointment_id: id,
      fasting_required: appt.fasting_required === 1,
      fasting_hours: appt.fasting_hours,
      sampling_time_valid: isValid,
      recommendation: isValid ? null : '空腹项目建议在上午10:00前采样'
    });
  });
});

module.exports = router;
