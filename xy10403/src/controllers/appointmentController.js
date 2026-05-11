const db = require('../config/database');
const moment = require('moment');

const generateVisitorCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

const createAppointment = (req, res) => {
  const {
    visitor_name,
    id_card,
    phone,
    company,
    visit_purpose,
    visitor_count,
    employee_id,
    visit_start_time,
    visit_end_time,
    access_gates,
    vehicles
  } = req.body;

  if (!visitor_name || !id_card || !employee_id || !visit_start_time || !visit_end_time) {
    return res.status(400).json({ code: 400, message: '必填参数缺失' });
  }

  const now = moment();
  const startTime = moment(visit_start_time);
  const endTime = moment(visit_end_time);

  if (!startTime.isValid() || !endTime.isValid()) {
    return res.status(400).json({ code: 400, message: '访问时间格式错误' });
  }

  if (endTime.isBefore(startTime)) {
    return res.status(400).json({ code: 400, message: '结束时间不能早于开始时间' });
  }

  if (endTime.diff(startTime, 'hours') > 24) {
    return res.status(400).json({ code: 400, message: '单次访问时间不能超过24小时' });
  }

  db.get('SELECT * FROM employees WHERE id = ? AND status = "active"', [employee_id], (err, employee) => {
    if (err) {
      return res.status(500).json({ code: 500, message: '服务器错误', error: err.message });
    }

    if (!employee) {
      return res.status(400).json({ code: 400, message: '被访人无效或已停用' });
    }

    db.all(`SELECT * FROM visitor_appointments 
      WHERE id_card = ? 
      AND status NOT IN ('cancelled', 'rejected', 'checkout', 'expired')
      AND (
        (visit_start_time <= ? AND visit_end_time >= ?) OR
        (visit_start_time >= ? AND visit_start_time < ?)
      )`, [id_card, endTime.format('YYYY-MM-DD HH:mm:ss'), startTime.format('YYYY-MM-DD HH:mm:ss'), startTime.format('YYYY-MM-DD HH:mm:ss'), endTime.format('YYYY-MM-DD HH:mm:ss')], (err, existingAppointments) => {
      if (err) {
        return res.status(500).json({ code: 500, message: '服务器错误', error: err.message });
      }

      if (existingAppointments.length > 0) {
        return res.status(400).json({ 
          code: 400, 
          message: '该访客在同一时间段已有有效预约',
          data: { conflictingAppointment: existingAppointments[0] }
        });
      }

      if (vehicles && vehicles.length > 0) {
        const plateNumbers = vehicles.map(v => v.plate_number);
        const placeholders = plateNumbers.map(() => '?').join(',');
        
        db.all(`SELECT v.* FROM vehicles v
          JOIN visitor_appointments a ON v.appointment_id = a.id
          WHERE v.plate_number IN (${placeholders})
          AND a.status NOT IN ('cancelled', 'rejected', 'checkout', 'expired')
          AND (
            (a.visit_start_time <= ? AND a.visit_end_time >= ?) OR
            (a.visit_start_time >= ? AND a.visit_start_time < ?)
          )`, [...plateNumbers, endTime.format('YYYY-MM-DD HH:mm:ss'), startTime.format('YYYY-MM-DD HH:mm:ss'), startTime.format('YYYY-MM-DD HH:mm:ss'), endTime.format('YYYY-MM-DD HH:mm:ss')], (err, conflictingVehicles) => {
          if (err) {
            return res.status(500).json({ code: 500, message: '服务器错误', error: err.message });
          }

          if (conflictingVehicles.length > 0) {
            return res.status(400).json({ 
              code: 400, 
              message: '部分车牌在该时间段已被占用',
              data: { conflictingVehicles }
            });
          }

          createAppointmentWithVehicles();
        });
      } else {
        createAppointmentWithVehicles();
      }

      function createAppointmentWithVehicles() {
        const visitor_code = generateVisitorCode();
        const gatesString = access_gates ? JSON.stringify(access_gates) : null;

        const stmt = db.prepare(`INSERT INTO visitor_appointments 
          (visitor_name, id_card, phone, company, visit_purpose, visitor_count, 
           employee_id, visit_start_time, visit_end_time, access_gates, visitor_code, status, updated_at) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)`);
        
        stmt.run(visitor_name, id_card, phone, company, visit_purpose, visitor_count || 1, 
          employee_id, startTime.format('YYYY-MM-DD HH:mm:ss'), endTime.format('YYYY-MM-DD HH:mm:ss'), 
          gatesString, visitor_code, function(err) {
          if (err) {
            return res.status(500).json({ code: 500, message: '服务器错误', error: err.message });
          }

          const appointmentId = this.lastID;

          if (vehicles && vehicles.length > 0) {
            const vehicleStmt = db.prepare(`INSERT INTO vehicles 
              (appointment_id, plate_number, vehicle_type, color) 
              VALUES (?, ?, ?, ?)`);
            
            vehicles.forEach(vehicle => {
              vehicleStmt.run(appointmentId, vehicle.plate_number, vehicle.vehicle_type, vehicle.color);
            });
            
            vehicleStmt.finalize();
          }

          db.get(`SELECT a.*, 
            e.employee_no, e.name as employee_name, e.department,
            (SELECT json_group_array(json_object(
              'id', v.id,
              'plate_number', v.plate_number,
              'vehicle_type', v.vehicle_type,
              'color', v.color
            )) FROM vehicles v WHERE v.appointment_id = a.id) as vehicles
            FROM visitor_appointments a
            LEFT JOIN employees e ON a.employee_id = e.id
            WHERE a.id = ?`, [appointmentId], (err, appointment) => {
            if (err) {
              return res.status(500).json({ code: 500, message: '服务器错误', error: err.message });
            }
            
            if (appointment.vehicles) {
              appointment.vehicles = JSON.parse(appointment.vehicles);
            }
            
            res.json({
              code: 200,
              message: '预约创建成功',
              data: appointment
            });
          });
        });
        stmt.finalize();
      }
    });
  });
};

const getAppointments = (req, res) => {
  const { status, visitor_name, id_card, employee_id, start_date, end_date, page = 1, pageSize = 10 } = req.query;
  const offset = (page - 1) * pageSize;
  
  let query = `SELECT a.*, 
    e.employee_no, e.name as employee_name, e.department
    FROM visitor_appointments a
    LEFT JOIN employees e ON a.employee_id = e.id
    WHERE 1=1`;
  let params = [];
  
  if (status) {
    query += ' AND a.status = ?';
    params.push(status);
  }
  
  if (visitor_name) {
    query += ' AND a.visitor_name LIKE ?';
    params.push(`%${visitor_name}%`);
  }
  
  if (id_card) {
    query += ' AND a.id_card = ?';
    params.push(id_card);
  }
  
  if (employee_id) {
    query += ' AND a.employee_id = ?';
    params.push(employee_id);
  }
  
  if (start_date) {
    query += ' AND DATE(a.visit_start_time) >= ?';
    params.push(start_date);
  }
  
  if (end_date) {
    query += ' AND DATE(a.visit_start_time) <= ?';
    params.push(end_date);
  }
  
  query += ' ORDER BY a.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(pageSize), offset);

  db.all(query, params, (err, appointments) => {
    if (err) {
      return res.status(500).json({ code: 500, message: '服务器错误', error: err.message });
    }

    let countQuery = `SELECT COUNT(*) as total FROM visitor_appointments a WHERE 1=1`;
    let countParams = params.slice(0, -2);
    
    db.get(countQuery, countParams, (err, result) => {
      if (err) {
        return res.status(500).json({ code: 500, message: '服务器错误', error: err.message });
      }

      res.json({
        code: 200,
        message: '获取成功',
        data: {
          list: appointments,
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

const getAppointmentById = (req, res) => {
  const { id } = req.params;

  db.get(`SELECT a.*, 
    e.employee_no, e.name as employee_name, e.department, e.phone as employee_phone,
    (SELECT json_group_array(json_object(
      'id', v.id,
      'plate_number', v.plate_number,
      'vehicle_type', v.vehicle_type,
      'color', v.color
    )) FROM vehicles v WHERE v.appointment_id = a.id) as vehicles
    FROM visitor_appointments a
    LEFT JOIN employees e ON a.employee_id = e.id
    WHERE a.id = ?`, [id], (err, appointment) => {
    if (err) {
      return res.status(500).json({ code: 500, message: '服务器错误', error: err.message });
    }

    if (!appointment) {
      return res.status(404).json({ code: 404, message: '预约不存在' });
    }

    if (appointment.vehicles) {
      appointment.vehicles = JSON.parse(appointment.vehicles);
    }

    res.json({
      code: 200,
      message: '获取成功',
      data: appointment
    });
  });
};

const updateAppointment = (req, res) => {
  const { id } = req.params;
  const { visit_start_time, visit_end_time, access_gates } = req.body;

  db.get('SELECT * FROM visitor_appointments WHERE id = ?', [id], (err, appointment) => {
    if (err) {
      return res.status(500).json({ code: 500, message: '服务器错误', error: err.message });
    }

    if (!appointment) {
      return res.status(404).json({ code: 404, message: '预约不存在' });
    }

    if (appointment.status !== 'pending' && appointment.status !== 'approved') {
      return res.status(400).json({ code: 400, message: '只能编辑待审批或已审批状态的预约' });
    }

    const startTime = visit_start_time ? moment(visit_start_time) : moment(appointment.visit_start_time);
    const endTime = visit_end_time ? moment(visit_end_time) : moment(appointment.visit_end_time);
    const gatesString = access_gates ? JSON.stringify(access_gates) : appointment.access_gates;

    db.all(`SELECT * FROM visitor_appointments 
      WHERE id_card = ? AND id != ?
      AND status NOT IN ('cancelled', 'rejected', 'checkout', 'expired')
      AND (
        (visit_start_time <= ? AND visit_end_time >= ?) OR
        (visit_start_time >= ? AND visit_start_time < ?)
      )`, [appointment.id_card, id, endTime.format('YYYY-MM-DD HH:mm:ss'), startTime.format('YYYY-MM-DD HH:mm:ss'), startTime.format('YYYY-MM-DD HH:mm:ss'), endTime.format('YYYY-MM-DD HH:mm:ss')], (err, conflicts) => {
      if (err) {
        return res.status(500).json({ code: 500, message: '服务器错误', error: err.message });
      }

      if (conflicts.length > 0) {
        return res.status(400).json({ code: 400, message: '时间冲突，该访客在同一时间段已有其他预约' });
      }

      db.run(`UPDATE visitor_appointments SET 
        visit_start_time = ?,
        visit_end_time = ?,
        access_gates = ?,
        updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`, [startTime.format('YYYY-MM-DD HH:mm:ss'), endTime.format('YYYY-MM-DD HH:mm:ss'), gatesString, id], (err) => {
        if (err) {
          return res.status(500).json({ code: 500, message: '服务器错误', error: err.message });
        }

        db.get(`SELECT a.*, 
          e.employee_no, e.name as employee_name, e.department
          FROM visitor_appointments a
          LEFT JOIN employees e ON a.employee_id = e.id
          WHERE a.id = ?`, [id], (err, updatedAppointment) => {
          if (err) {
            return res.status(500).json({ code: 500, message: '服务器错误', error: err.message });
          }
          res.json({
            code: 200,
            message: '更新成功',
            data: updatedAppointment
          });
        });
      });
    });
  });
};

const cancelAppointment = (req, res) => {
  const { id } = req.params;

  db.get('SELECT * FROM visitor_appointments WHERE id = ?', [id], (err, appointment) => {
    if (err) {
      return res.status(500).json({ code: 500, message: '服务器错误', error: err.message });
    }

    if (!appointment) {
      return res.status(404).json({ code: 404, message: '预约不存在' });
    }

    if (appointment.status === 'checkin') {
      return res.status(400).json({ code: 400, message: '访客已入园，无法取消预约' });
    }

    if (appointment.status === 'checkout' || appointment.status === 'cancelled' || appointment.status === 'expired') {
      return res.status(400).json({ code: 400, message: '预约已结束或已取消' });
    }

    db.run(`UPDATE visitor_appointments SET 
      status = 'cancelled',
      cancelled_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`, [id], (err) => {
      if (err) {
        return res.status(500).json({ code: 500, message: '服务器错误', error: err.message });
      }

      res.json({
        code: 200,
        message: '预约已取消'
      });
    });
  });
};

module.exports = {
  createAppointment,
  getAppointments,
  getAppointmentById,
  updateAppointment,
  cancelAppointment
};
