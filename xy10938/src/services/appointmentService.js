const { runQuery, getOne, getAll } = require('../db');
const appConfig = require('../../config/app');
const moment = require('moment');

function generateAppointmentNo() {
  const today = moment().format('YYYYMMDD');
  const lastAppt = getOne(
    `SELECT appointment_no FROM appointments WHERE appointment_no LIKE ? ORDER BY id DESC LIMIT 1`,
    [`A${today}%`]
  );
  
  let seq = 1;
  if (lastAppt) {
    const match = lastAppt.appointment_no.match(/A\d{8}(\d{3})/);
    if (match) {
      seq = parseInt(match[1]) + 1;
    }
  }
  return `A${today}${String(seq).padStart(3, '0')}`;
}

function createAppointment(data) {
  const { member_id, service_type, appointment_date, appointment_time } = data;

  if (!appConfig.serviceTypes.includes(service_type)) {
    throw { status: 400, message: '无效的服务类型', conclusion: '服务类型不在允许列表中' };
  }

  const member = getOne(`SELECT id FROM members WHERE id = ?`, [member_id]);
  if (!member) {
    throw { status: 404, message: '会员不存在', conclusion: '找不到对应会员记录' };
  }

  const existing = getOne(
    `SELECT id FROM appointments 
     WHERE member_id = ? AND appointment_date = ? AND status IN ('待确认', '已确认')
     LIMIT 1`,
    [member_id, appointment_date]
  );

  if (existing) {
    throw { status: 400, message: '该会员今日已有预约', conclusion: '拦截重复预约请求' };
  }

  const appointmentNo = generateAppointmentNo();
  const lockedUntil = moment().add(30, 'minutes').format('YYYY-MM-DD HH:mm:ss');

  const result = runQuery(
    `INSERT INTO appointments (appointment_no, member_id, service_type, appointment_date, appointment_time, locked_until)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [appointmentNo, member_id, service_type, appointment_date, appointment_time, lockedUntil]
  );

  return getOne(`SELECT * FROM appointments WHERE id = ?`, [result.lastInsertRowid]);
}

function lockAppointment(id, stationId) {
  const appointment = getOne(`SELECT * FROM appointments WHERE id = ?`, [id]);
  if (!appointment) {
    throw { status: 404, message: '预约不存在', conclusion: '找不到对应预约记录' };
  }

  if (appointment.status !== '待确认') {
    throw { status: 400, message: '该预约状态不允许锁位', conclusion: '锁位操作失败' };
  }

  const station = getOne(`SELECT id FROM stations WHERE id = ? AND status = '空闲'`, [stationId]);
  if (!station) {
    throw { status: 400, message: '工位不可用', conclusion: '工位状态非空闲' };
  }

  const lockedUntil = moment().add(15, 'minutes').format('YYYY-MM-DD HH:mm:ss');

  runQuery(
    `UPDATE appointments SET station_id = ?, status = '已确认', locked_until = ? WHERE id = ?`,
    [stationId, lockedUntil, id]
  );

  runQuery(`UPDATE stations SET status = '忙碌' WHERE id = ?`, [stationId]);

  return getOne(`SELECT * FROM appointments WHERE id = ?`, [id]);
}

function cancelAppointment(id) {
  const appointment = getOne(`SELECT * FROM appointments WHERE id = ?`, [id]);
  if (!appointment) {
    throw { status: 404, message: '预约不存在', conclusion: '找不到对应预约记录' };
  }

  if (appointment.status === '已完成' || appointment.status === '已取消') {
    throw { status: 400, message: '该状态下无法取消', conclusion: '状态不允许取消操作' };
  }

  if (appointment.station_id) {
    runQuery(`UPDATE stations SET status = '空闲' WHERE id = ?`, [appointment.station_id]);
  }

  runQuery(`UPDATE appointments SET status = '已取消', station_id = NULL WHERE id = ?`, [id]);

  return getOne(`SELECT * FROM appointments WHERE id = ?`, [id]);
}

function getAppointmentList(date = null) {
  let sql = `
    SELECT a.*, m.name as member_name, m.phone, s.name as station_name
    FROM appointments a
    LEFT JOIN members m ON a.member_id = m.id
    LEFT JOIN stations s ON a.station_id = s.id
  `;
  const params = [];

  if (date) {
    sql += ` WHERE a.appointment_date = ?`;
    params.push(date);
  }
  sql += ` ORDER BY a.appointment_date DESC, a.appointment_time ASC`;

  return getAll(sql, params);
}

function getAppointmentById(id) {
  return getOne(
    `SELECT a.*, m.name as member_name, m.phone, s.name as station_name
     FROM appointments a
     LEFT JOIN members m ON a.member_id = m.id
     LEFT JOIN stations s ON a.station_id = s.id
     WHERE a.id = ?`,
    [id]
  );
}

module.exports = {
  createAppointment,
  lockAppointment,
  cancelAppointment,
  getAppointmentList,
  getAppointmentById
};
