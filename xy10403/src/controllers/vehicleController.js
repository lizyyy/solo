const db = require('../config/database');
const moment = require('moment');

const addVehicles = (req, res) => {
  const { appointment_id } = req.params;
  const { vehicles } = req.body;

  if (!vehicles || !Array.isArray(vehicles) || vehicles.length === 0) {
    return res.status(400).json({ code: 400, message: '车辆信息不能为空' });
  }

  db.get('SELECT * FROM visitor_appointments WHERE id = ?', [appointment_id], (err, appointment) => {
    if (err) {
      return res.status(500).json({ code: 500, message: '服务器错误', error: err.message });
    }

    if (!appointment) {
      return res.status(404).json({ code: 404, message: '预约不存在' });
    }

    if (appointment.status === 'checkout' || appointment.status === 'expired' || appointment.status === 'cancelled') {
      return res.status(400).json({ code: 400, message: '预约已结束，无法添加车辆' });
    }

    const startTime = moment(appointment.visit_start_time);
    const endTime = moment(appointment.visit_end_time);
    const plateNumbers = vehicles.map(v => v.plate_number);
    const placeholders = plateNumbers.map(() => '?').join(',');

    db.all(`SELECT v.* FROM vehicles v
      JOIN visitor_appointments a ON v.appointment_id = a.id
      WHERE v.plate_number IN (${placeholders})
      AND a.id != ?
      AND a.status NOT IN ('cancelled', 'rejected', 'checkout', 'expired')
      AND (
        (a.visit_start_time <= ? AND a.visit_end_time >= ?) OR
        (a.visit_start_time >= ? AND a.visit_start_time < ?)
      )`, [...plateNumbers, appointment_id, endTime.format('YYYY-MM-DD HH:mm:ss'), startTime.format('YYYY-MM-DD HH:mm:ss'), startTime.format('YYYY-MM-DD HH:mm:ss'), endTime.format('YYYY-MM-DD HH:mm:ss')], (err, conflicts) => {
      if (err) {
        return res.status(500).json({ code: 500, message: '服务器错误', error: err.message });
      }

      if (conflicts.length > 0) {
        return res.status(400).json({ 
          code: 400, 
          message: '部分车牌在该时间段已被占用',
          data: { conflictingVehicles: conflicts }
        });
      }

      const stmt = db.prepare(`INSERT INTO vehicles (appointment_id, plate_number, vehicle_type, color) VALUES (?, ?, ?, ?)`);
      
      vehicles.forEach(vehicle => {
        stmt.run(appointment_id, vehicle.plate_number, vehicle.vehicle_type, vehicle.color);
      });
      
      stmt.finalize((err) => {
        if (err) {
          return res.status(500).json({ code: 500, message: '服务器错误', error: err.message });
        }

        db.all('SELECT * FROM vehicles WHERE appointment_id = ?', [appointment_id], (err, allVehicles) => {
          if (err) {
            return res.status(500).json({ code: 500, message: '服务器错误', error: err.message });
          }
          
          res.json({
            code: 200,
            message: '车辆添加成功',
            data: allVehicles
          });
        });
      });
    });
  });
};

const removeVehicle = (req, res) => {
  const { appointment_id, vehicle_id } = req.params;

  db.get('SELECT * FROM visitor_appointments WHERE id = ?', [appointment_id], (err, appointment) => {
    if (err) {
      return res.status(500).json({ code: 500, message: '服务器错误', error: err.message });
    }

    if (!appointment) {
      return res.status(404).json({ code: 404, message: '预约不存在' });
    }

    if (appointment.status === 'checkin' || appointment.status === 'checkout') {
      return res.status(400).json({ code: 400, message: '访客已入园，无法移除车辆' });
    }

    db.get('SELECT * FROM vehicles WHERE id = ? AND appointment_id = ?', [vehicle_id, appointment_id], (err, vehicle) => {
      if (err) {
        return res.status(500).json({ code: 500, message: '服务器错误', error: err.message });
      }

      if (!vehicle) {
        return res.status(404).json({ code: 404, message: '车辆不存在' });
      }

      db.run('DELETE FROM vehicles WHERE id = ?', [vehicle_id], (err) => {
        if (err) {
          return res.status(500).json({ code: 500, message: '服务器错误', error: err.message });
        }

        res.json({
          code: 200,
          message: '车辆移除成功'
        });
      });
    });
  });
};

const getVehicles = (req, res) => {
  const { appointment_id } = req.params;

  db.all('SELECT * FROM vehicles WHERE appointment_id = ?', [appointment_id], (err, vehicles) => {
    if (err) {
      return res.status(500).json({ code: 500, message: '服务器错误', error: err.message });
    }

    res.json({
      code: 200,
      message: '获取成功',
      data: vehicles
    });
  });
};

module.exports = {
  addVehicles,
  removeVehicle,
  getVehicles
};
