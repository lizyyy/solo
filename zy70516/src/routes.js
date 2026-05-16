const express = require('express');
const router = express.Router();
const { runQuery, getQuery, allQuery } = require('./database');
const { validateAppointment, createAuditLog, checkWindowConflict } = require('./rules');
const ics = require('ics');
const moment = require('moment');

router.post('/appointments', async (req, res) => {
  try {
    const { service_name, window_start, window_end, risk_level, dependent_services, created_by } = req.body;
    
    const validation = await validateAppointment(req.body);
    
    if (!validation.valid) {
      await createAuditLog(
        null,
        'create_failed',
        req.body,
        validation.rulesApplied,
        { success: false, errors: validation.errors },
        created_by || 'system'
      );
      
      return res.status(400).json({
        success: false,
        error: '预约创建失败，规则校验未通过',
        details: validation.errors,
        rules_applied: validation.rulesApplied
      });
    }
    
    const result = await runQuery(`
      INSERT INTO appointments (service_name, window_start, window_end, risk_level, dependent_services, created_by, status)
      VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `, [service_name, window_start, window_end, risk_level, dependent_services, created_by]);
    
    await createAuditLog(
      result.lastID,
      'create',
      req.body,
      validation.rulesApplied,
      { success: true, appointment_id: result.lastID },
      created_by || 'system'
    );
    
    const appointment = await getQuery('SELECT * FROM appointments WHERE id = ?', [result.lastID]);
    
    res.status(201).json({
      success: true,
      data: appointment
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      message: error.message
    });
  }
});

router.get('/appointments', async (req, res) => {
  try {
    const { service_name, status, start_date, end_date, page = 1, limit = 20 } = req.query;
    
    let sql = 'SELECT * FROM appointments WHERE 1=1';
    const params = [];
    
    if (service_name) {
      sql += ' AND service_name LIKE ?';
      params.push(`%${service_name}%`);
    }
    
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    
    if (start_date) {
      sql += ' AND window_start >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      sql += ' AND window_end <= ?';
      params.push(end_date);
    }
    
    sql += ' ORDER BY window_start DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
    
    const appointments = await allQuery(sql, params);
    
    const countResult = await getQuery('SELECT COUNT(*) as total FROM appointments');
    
    res.json({
      success: true,
      data: appointments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult.total
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      message: error.message
    });
  }
});

router.get('/appointments/:id', async (req, res) => {
  try {
    const appointment = await getQuery('SELECT * FROM appointments WHERE id = ?', [req.params.id]);
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: '预约记录不存在'
      });
    }
    
    const auditLogs = await allQuery('SELECT * FROM audit_logs WHERE appointment_id = ? ORDER BY created_at DESC', [req.params.id]);
    
    res.json({
      success: true,
      data: {
        ...appointment,
        audit_logs: auditLogs
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      message: error.message
    });
  }
});

router.patch('/appointments/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, approver, conclusion, conflict_reason, operator } = req.body;
    
    const validStatuses = ['pending', 'approved', 'rejected', 'delayed', 'confirmed', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: '无效的状态值',
        valid_statuses: validStatuses
      });
    }
    
    const appointment = await getQuery('SELECT * FROM appointments WHERE id = ?', [id]);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: '预约记录不存在'
      });
    }
    
    if (status === 'approved' || status === 'confirmed') {
      const conflictCheck = await checkWindowConflict(
        appointment.service_name,
        appointment.window_start,
        appointment.window_end,
        parseInt(id)
      );
      
      if (conflictCheck.hasConflict) {
        await createAuditLog(
          parseInt(id),
          'status_change_failed',
          { old_status: appointment.status, new_status: status },
          ['窗口冲突检测'],
          { success: false, conflict: conflictCheck },
          operator || 'system'
        );
        
        return res.status(400).json({
          success: false,
          error: '状态变更失败，存在窗口冲突',
          conflict_details: conflictCheck.conflicts
        });
      }
    }
    
    await runQuery(`
      UPDATE appointments 
      SET status = ?, approver = ?, conclusion = ?, conflict_reason = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [status, approver, conclusion, conflict_reason, id]);
    
    await createAuditLog(
      parseInt(id),
      'status_change',
      { old_status: appointment.status, new_status: status },
      ['状态流转规则'],
      { success: true, new_status: status },
      operator || 'system'
    );
    
    const updatedAppointment = await getQuery('SELECT * FROM appointments WHERE id = ?', [id]);
    
    res.json({
      success: true,
      data: updatedAppointment
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      message: error.message
    });
  }
});

router.post('/appointments/:id/manual-fix', async (req, res) => {
  try {
    const { id } = req.params;
    const { service_name, window_start, window_end, risk_level, dependent_services, status, operator, reason } = req.body;
    
    const appointment = await getQuery('SELECT * FROM appointments WHERE id = ?', [id]);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: '预约记录不存在'
      });
    }
    
    const updateFields = [];
    const updateParams = [];
    
    if (service_name !== undefined) {
      updateFields.push('service_name = ?');
      updateParams.push(service_name);
    }
    if (window_start !== undefined) {
      updateFields.push('window_start = ?');
      updateParams.push(window_start);
    }
    if (window_end !== undefined) {
      updateFields.push('window_end = ?');
      updateParams.push(window_end);
    }
    if (risk_level !== undefined) {
      updateFields.push('risk_level = ?');
      updateParams.push(risk_level);
    }
    if (dependent_services !== undefined) {
      updateFields.push('dependent_services = ?');
      updateParams.push(dependent_services);
    }
    if (status !== undefined) {
      updateFields.push('status = ?');
      updateParams.push(status);
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: '没有提供需要更新的字段'
      });
    }
    
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateParams.push(id);
    
    await runQuery(`UPDATE appointments SET ${updateFields.join(', ')} WHERE id = ?`, updateParams);
    
    await createAuditLog(
      parseInt(id),
      'manual_fix',
      req.body,
      ['人工修正绕过规则'],
      { success: true, reason: reason },
      operator || 'system'
    );
    
    const updatedAppointment = await getQuery('SELECT * FROM appointments WHERE id = ?', [id]);
    
    res.json({
      success: true,
      data: updatedAppointment,
      note: '人工修正已绕过规则校验，请谨慎使用'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      message: error.message
    });
  }
});

router.get('/export/calendar', async (req, res) => {
  try {
    const { start_date, end_date, status } = req.query;
    
    let sql = 'SELECT * FROM appointments WHERE 1=1';
    const params = [];
    
    if (start_date) {
      sql += ' AND window_start >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      sql += ' AND window_end <= ?';
      params.push(end_date);
    }
    
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    } else {
      sql += " AND status IN ('approved', 'confirmed')";
    }
    
    const appointments = await allQuery(sql, params);
    
    const events = appointments.map(apt => {
      const start = moment(apt.window_start);
      const end = moment(apt.window_end);
      
      return {
        title: `[${apt.risk_level.toUpperCase()}] ${apt.service_name}`,
        description: `状态: ${apt.status}\n风险等级: ${apt.risk_level}\n依赖服务: ${apt.dependent_services || '无'}\n结论: ${apt.conclusion || ''}`,
        start: [start.year(), start.month() + 1, start.date(), start.hour(), start.minute()],
        end: [end.year(), end.month() + 1, end.date(), end.hour(), end.minute()],
        uid: apt.id.toString(),
        categories: ['变更窗口', apt.risk_level],
        status: apt.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'
      };
    });
    
    const { error, value } = ics.createEvents(events);
    
    if (error) {
      throw error;
    }
    
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=change-windows.ics');
    res.send(value);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '导出日历失败',
      message: error.message
    });
  }
});

router.get('/export/json', async (req, res) => {
  try {
    const { start_date, end_date, status } = req.query;
    
    let sql = 'SELECT * FROM appointments WHERE 1=1';
    const params = [];
    
    if (start_date) {
      sql += ' AND window_start >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      sql += ' AND window_end <= ?';
      params.push(end_date);
    }
    
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    
    const appointments = await allQuery(sql, params);
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=change-windows.json');
    res.json({
      export_time: new Date().toISOString(),
      count: appointments.length,
      data: appointments
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '导出JSON失败',
      message: error.message
    });
  }
});

router.get('/audit-logs', async (req, res) => {
  try {
    const { appointment_id, action, page = 1, limit = 50 } = req.query;
    
    let sql = 'SELECT * FROM audit_logs WHERE 1=1';
    const params = [];
    
    if (appointment_id) {
      sql += ' AND appointment_id = ?';
      params.push(appointment_id);
    }
    
    if (action) {
      sql += ' AND action = ?';
      params.push(action);
    }
    
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
    
    const logs = await allQuery(sql, params);
    
    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      message: error.message
    });
  }
});

module.exports = router;
