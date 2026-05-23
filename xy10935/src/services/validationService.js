const moment = require('moment');
const { get } = require('../db');

const LATE_PICKUP_RATE = 2.0;
const LATE_PICKUP_GRACE_MINUTES = 10;

const isStudentOnLeave = async (studentId, date) => {
  const leave = await get(
    'SELECT * FROM leave_records WHERE student_id = ? AND date = ? AND status = "approved"',
    [studentId, date]
  );
  return !!leave;
};

const isGuardianAuthorized = async (studentId, guardianId, date, time) => {
  const auth = await get(
    `SELECT * FROM authorization_slots 
     WHERE student_id = ? AND guardian_id = ? AND date = ? AND status = 'valid'
     AND start_time <= ? AND end_time >= ?`,
    [studentId, guardianId, date, time, time]
  );
  return !!auth;
};

const getAuthorization = async (studentId, guardianId, date, time) => {
  return await get(
    `SELECT * FROM authorization_slots 
     WHERE student_id = ? AND guardian_id = ? AND date = ? AND status = 'valid'
     AND start_time <= ? AND end_time >= ?`,
    [studentId, guardianId, date, time, time]
  );
};

const calculateLateFee = (scheduledTime, actualTime) => {
  const scheduled = moment(scheduledTime, 'HH:mm');
  const actual = moment(actualTime, 'HH:mm');
  
  let lateMinutes = actual.diff(scheduled, 'minutes');
  
  if (lateMinutes <= LATE_PICKUP_GRACE_MINUTES) {
    return { lateMinutes: 0, feeAmount: 0 };
  }
  
  const billableMinutes = lateMinutes - LATE_PICKUP_GRACE_MINUTES;
  const feeAmount = Math.ceil(billableMinutes / 30) * LATE_PICKUP_RATE * 30;
  
  return {
    lateMinutes,
    feeAmount: parseFloat(feeAmount.toFixed(2))
  };
};

const validatePickup = async (studentId, guardianId, date, pickupTime) => {
  const errors = [];
  
  const student = await get('SELECT * FROM students WHERE id = ?', [studentId]);
  if (!student) {
    errors.push('学生不存在');
  }
  
  const guardian = await get('SELECT * FROM guardians WHERE id = ?', [guardianId]);
  if (!guardian) {
    errors.push('接送人不存在');
  }
  
  const onLeave = await isStudentOnLeave(studentId, date);
  if (onLeave) {
    errors.push('该学生今日已请假');
  }
  
  const isAuthorized = await isGuardianAuthorized(studentId, guardianId, date, pickupTime);
  if (!isAuthorized) {
    errors.push('该接送人此时段无授权');
  }
  
  const existingPickup = await get(
    'SELECT * FROM pickup_records WHERE student_id = ? AND date = ?',
    [studentId, date]
  );
  if (existingPickup) {
    errors.push('该学生今日已有接送记录');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    authorization: await getAuthorization(studentId, guardianId, date, pickupTime)
  };
};

module.exports = {
  isStudentOnLeave,
  isGuardianAuthorized,
  getAuthorization,
  calculateLateFee,
  validatePickup,
  LATE_PICKUP_RATE,
  LATE_PICKUP_GRACE_MINUTES
};
