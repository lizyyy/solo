const db = require('../config/database');
const moment = require('moment');

const createAccessRecord = (appointmentId, visitorCode, plateNumber, gateId, accessType, operatorId, status, failureReason = null) => {
  return new Promise((resolve, reject) => {
    db.run(`INSERT INTO access_records 
      (appointment_id, visitor_code, plate_number, gate_id, access_type, access_time, operator_id, status, failure_reason)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?)`, 
      [appointmentId, visitorCode, plateNumber, gateId, accessType, operatorId, status, failureReason],
      function(err) {
        if (err) return reject(err);
        resolve(this.lastID);
      }
    );
  });
};

const checkin = (req, res) => {
  const { visitor_code, plate_number, gate_id } = req.body;
  const operatorId = req.user ? req.user.id : null;

  if (!visitor_code && !plate_number) {
    return res.status(400).json({ code: 400, message: '访客码或车牌号不能为空' });
  }

  if (!gate_id) {
    return res.status(400).json({ code: 400, message: '闸口ID不能为空' });
  }

  let query = `SELECT a.*, 
    e.employee_no, e.name as employee_name, e.department,
    (SELECT json_group_array(json_object(
      'id', v.id,
      'plate_number', v.plate_number
    )) FROM vehicles v WHERE v.appointment_id = a.id) as vehicles
    FROM visitor_appointments a
    LEFT JOIN employees e ON a.employee_id = e.id
    WHERE 1=1`;
  let params = [];

  if (visitor_code) {
    query += ' AND a.visitor_code = ?';
    params.push(visitor_code);
  } else if (plate_number) {
    query += ' AND EXISTS (SELECT 1 FROM vehicles v WHERE v.appointment_id = a.id AND v.plate_number = ?)';
    params.push(plate_number);
  }

  db.get(query, params, async (err, appointment) => {
    if (err) {
      return res.status(500).json({ code: 500, message: '服务器错误', error: err.message });
    }

    if (!appointment) {
      await createAccessRecord(null, visitor_code, plate_number, gate_id, 'checkin', operatorId, 'failed', '预约不存在');
      return res.status(400).json({ code: 400, message: '预约不存在' });
    }

    let vehicles = [];
    if (appointment.vehicles) {
      try {
        vehicles = JSON.parse(appointment.vehicles);
      } catch (e) {}
    }

    const now = moment();
    const startTime = moment(appointment.visit_start_time);
    const endTime = moment(appointment.visit_end_time);

    if (appointment.status === 'expired' || endTime.isBefore(now)) {
      await createAccessRecord(appointment.id, appointment.visitor_code, plate_number, gate_id, 'checkin', operatorId, 'failed', '预约已过期');
      return res.status(400).json({ code: 400, message: '预约已过期，无法入园' });
    }

    if (appointment.status === 'checkin') {
      await createAccessRecord(appointment.id, appointment.visitor_code, plate_number, gate_id, 'checkin', operatorId, 'failed', '重复核销：访客已在园内');
      return res.status(400).json({ code: 400, message: '重复核销：访客已在园内' });
    }

    if (appointment.status === 'checkout') {
      await createAccessRecord(appointment.id, appointment.visitor_code, plate_number, gate_id, 'checkin', operatorId, 'failed', '预约已结束');
      return res.status(400).json({ code: 400, message: '预约已结束' });
    }

    if (appointment.status === 'cancelled' || appointment.status === 'rejected') {
      await createAccessRecord(appointment.id, appointment.visitor_code, plate_number, gate_id, 'checkin', operatorId, 'failed', '预约已取消或被拒绝');
      return res.status(400).json({ code: 400, message: '预约已取消或被拒绝' });
    }

    if (appointment.status === 'pending') {
      await createAccessRecord(appointment.id, appointment.visitor_code, plate_number, gate_id, 'checkin', operatorId, 'failed', '预约未审批');
      return res.status(400).json({ code: 400, message: '预约未审批，无法入园' });
    }

    if (now.isBefore(startTime.subtract(30, 'minutes'))) {
      await createAccessRecord(appointment.id, appointment.visitor_code, plate_number, gate_id, 'checkin', operatorId, 'failed', '未到入园时间');
      return res.status(400).json({ code: 400, message: '未到入园时间，可提前30分钟入园' });
    }

    if (now.isAfter(endTime)) {
      await createAccessRecord(appointment.id, appointment.visitor_code, plate_number, gate_id, 'checkin', operatorId, 'failed', '已过访问时间');
      return res.status(400).json({ code: 400, message: '已过访问时间' });
    }

    if (appointment.access_gates) {
      let allowedGates = [];
      try {
        allowedGates = JSON.parse(appointment.access_gates);
      } catch (e) {}
      
      if (allowedGates.length > 0 && !allowedGates.includes(gate_id)) {
        await createAccessRecord(appointment.id, appointment.visitor_code, plate_number, gate_id, 'checkin', operatorId, 'failed', '无权访问该闸口');
        return res.status(400).json({ code: 400, message: '无权访问该闸口' });
      }
    }

    db.run(`UPDATE visitor_appointments SET 
      status = 'checkin',
      checkin_time = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`, [appointment.id], async (err) => {
      if (err) {
        await createAccessRecord(appointment.id, appointment.visitor_code, plate_number, gate_id, 'checkin', operatorId, 'failed', '系统错误');
        return res.status(500).json({ code: 500, message: '服务器错误', error: err.message });
      }

      await createAccessRecord(appointment.id, appointment.visitor_code, plate_number, gate_id, 'checkin', operatorId, 'success');

      db.get(`SELECT * FROM visitor_appointments WHERE id = ?`, [appointment.id], (err, updatedAppointment) => {
        if (err) {
          return res.status(500).json({ code: 500, message: '服务器错误', error: err.message });
        }
        
        res.json({
          code: 200,
          message: '入园成功',
          data: {
            appointment: updatedAppointment,
            checkin_time: updatedAppointment.checkin_time
          }
        });
      });
    });
  });
};

const checkout = (req, res) => {
  const { visitor_code, plate_number, gate_id } = req.body;
  const operatorId = req.user ? req.user.id : null;

  if (!visitor_code && !plate_number) {
    return res.status(400).json({ code: 400, message: '访客码或车牌号不能为空' });
  }

  if (!gate_id) {
    return res.status(400).json({ code: 400, message: '闸口ID不能为空' });
  }

  let query = `SELECT a.*, 
    e.employee_no, e.name as employee_name, e.department
    FROM visitor_appointments a
    LEFT JOIN employees e ON a.employee_id = e.id
    WHERE 1=1`;
  let params = [];

  if (visitor_code) {
    query += ' AND a.visitor_code = ?';
    params.push(visitor_code);
  } else if (plate_number) {
    query += ' AND EXISTS (SELECT 1 FROM vehicles v WHERE v.appointment_id = a.id AND v.plate_number = ?)';
    params.push(plate_number);
  }

  db.get(query, params, async (err, appointment) => {
    if (err) {
      return res.status(500).json({ code: 500, message: '服务器错误', error: err.message });
    }

    if (!appointment) {
      await createAccessRecord(null, visitor_code, plate_number, gate_id, 'checkout', operatorId, 'failed', '预约不存在');
      return res.status(400).json({ code: 400, message: '预约不存在' });
    }

    if (appointment.status === 'checkout') {
      await createAccessRecord(appointment.id, appointment.visitor_code, plate_number, gate_id, 'checkout', operatorId, 'failed', '重复核销：访客已离园');
      return res.status(400).json({ code: 400, message: '重复核销：访客已离园' });
    }

    if (appointment.status !== 'checkin') {
      await createAccessRecord(appointment.id, appointment.visitor_code, plate_number, gate_id, 'checkout', operatorId, 'failed', '访客未入园');
      return res.status(400).json({ code: 400, message: '访客未入园，无法离园' });
    }

    db.run(`UPDATE visitor_appointments SET 
      status = 'checkout',
      checkout_time = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`, [appointment.id], async (err) => {
      if (err) {
        await createAccessRecord(appointment.id, appointment.visitor_code, plate_number, gate_id, 'checkout', operatorId, 'failed', '系统错误');
        return res.status(500).json({ code: 500, message: '服务器错误', error: err.message });
      }

      await createAccessRecord(appointment.id, appointment.visitor_code, plate_number, gate_id, 'checkout', operatorId, 'success');

      db.get(`SELECT * FROM visitor_appointments WHERE id = ?`, [appointment.id], (err, updatedAppointment) => {
        if (err) {
          return res.status(500).json({ code: 500, message: '服务器错误', error: err.message });
        }
        
        res.json({
          code: 200,
          message: '离园成功',
          data: {
            appointment: updatedAppointment,
            checkout_time: updatedAppointment.checkout_time
          }
        });
      });
    });
  });
};

const getGates = (req, res) => {
  db.all('SELECT * FROM gates WHERE status = "active" ORDER BY gate_code', (err, gates) => {
    if (err) {
      return res.status(500).json({ code: 500, message: '服务器错误', error: err.message });
    }

    res.json({
      code: 200,
      message: '获取成功',
      data: gates
    });
  });
};

module.exports = {
  checkin,
  checkout,
  getGates
};
