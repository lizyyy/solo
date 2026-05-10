const { db } = require('./database');
const dayjs = require('dayjs');

const validateSkillMatch = (employeeId, requiredSkillId) => {
  if (!requiredSkillId) return { valid: true };
  
  const skill = db.employeeSkills.find(
    es => es.employee_id === employeeId && es.skill_id === requiredSkillId
  );

  if (!skill) {
    return {
      valid: false,
      message: '员工不具备借调所需的技能'
    };
  }
  return { valid: true };
};

const validateWorkingHours = (employeeId, date, startTime, endTime) => {
  const employee = db.employees.find(e => e.id === employeeId);
  if (!employee) return { valid: false, message: '员工不存在' };

  const day = dayjs(date);
  const weekStart = day.startOf('week').format('YYYY-MM-DD');
  const weekEnd = day.endOf('week').format('YYYY-MM-DD');

  const existingSchedules = db.schedules.filter(
    s => s.employee_id === employeeId && 
         s.date >= weekStart && s.date <= weekEnd &&
         s.status !== 'cancelled'
  );

  const approvedTransfers = db.transferRequests.filter(
    tr => tr.employee_id === employeeId &&
          tr.date >= weekStart && tr.date <= weekEnd &&
          tr.status === 'approved'
  );

  const calculateHours = (sTime, eTime) => {
    const [sHour, sMin] = sTime.split(':').map(Number);
    const [eHour, eMin] = eTime.split(':').map(Number);
    return (eHour * 60 + eMin - sHour * 60 - sMin) / 60;
  };

  let totalHours = 0;
  
  existingSchedules.forEach(schedule => {
    totalHours += calculateHours(schedule.start_time, schedule.end_time);
  });

  approvedTransfers.forEach(transfer => {
    totalHours += calculateHours(transfer.start_time, transfer.end_time);
  });

  const newHours = calculateHours(startTime, endTime);
  
  if (totalHours + newHours > employee.max_hours_per_week) {
    return {
      valid: false,
      message: `工时将超过每周上限${employee.max_hours_per_week}小时（当前累计${totalHours.toFixed(1)}小时，新增${newHours.toFixed(1)}小时）`
    };
  }

  return { valid: true, remainingHours: (employee.max_hours_per_week - totalHours).toFixed(1) };
};

const validateTimeConflict = (employeeId, date, startTime, endTime, excludeTransferId = null) => {
  const conflicts = [];

  const schedules = db.schedules.filter(
    s => s.employee_id === employeeId && 
         s.date === date && 
         s.status !== 'cancelled'
  ).map(s => {
    const store = db.stores.find(st => st.id === s.store_id);
    return { ...s, store_name: store?.name };
  });

  const transfers = db.transferRequests.filter(
    tr => tr.employee_id === employeeId &&
          tr.date === date &&
          tr.status === 'approved' &&
          (excludeTransferId === null || tr.id !== excludeTransferId)
  ).map(tr => {
    const store = db.stores.find(st => st.id === tr.to_store_id);
    return { ...tr, to_store_name: store?.name };
  });

  const timeOverlaps = (s1, e1, s2, e2) => {
    return s1 < e2 && s2 < e1;
  };

  [...schedules, ...transfers].forEach(item => {
    if (timeOverlaps(startTime, endTime, item.start_time, item.end_time)) {
      const type = item.store_name ? '原排班' : '已审批借调';
      const storeName = item.store_name || item.to_store_name;
      conflicts.push({
        type,
        storeName,
        date: item.date,
        time: `${item.start_time} - ${item.end_time}`
      });
    }
  });

  if (conflicts.length > 0) {
    return {
      valid: false,
      message: '存在时间冲突',
      conflicts
    };
  }

  return { valid: true };
};

const validateDuplicateTransfer = (employeeId, date, startTime, endTime, toStoreId) => {
  const existing = db.transferRequests.find(
    tr => tr.employee_id === employeeId &&
          tr.date === date &&
          tr.start_time === startTime &&
          tr.end_time === endTime &&
          tr.to_store_id === toStoreId &&
          ['pending', 'approved'].includes(tr.status)
  );

  if (existing) {
    return {
      valid: false,
      message: '相同的借调申请已存在或已审批',
      existingStatus: existing.status
    };
  }

  return { valid: true };
};

const validateTransferRequest = (requestData, excludeTransferId = null) => {
  const errors = [];
  const warnings = [];

  const skillResult = validateSkillMatch(requestData.employee_id, requestData.skill_required);
  if (!skillResult.valid) {
    errors.push(skillResult.message);
  }

  const hoursResult = validateWorkingHours(
    requestData.employee_id,
    requestData.date,
    requestData.start_time,
    requestData.end_time
  );
  if (!hoursResult.valid) {
    errors.push(hoursResult.message);
  } else if (hoursResult.remainingHours && parseFloat(hoursResult.remainingHours) < 8) {
    warnings.push(`本周剩余可用工时：${hoursResult.remainingHours}小时`);
  }

  const conflictResult = validateTimeConflict(
    requestData.employee_id,
    requestData.date,
    requestData.start_time,
    requestData.end_time,
    excludeTransferId
  );
  if (!conflictResult.valid) {
    errors.push(conflictResult.message);
    errors.push(...conflictResult.conflicts.map(c => 
      `${c.type}冲突：${c.storeName} ${c.date} ${c.time}`
    ));
  }

  if (!excludeTransferId) {
    const duplicateResult = validateDuplicateTransfer(
      requestData.employee_id,
      requestData.date,
      requestData.start_time,
      requestData.end_time,
      requestData.to_store_id
    );
    if (!duplicateResult.valid) {
      errors.push(duplicateResult.message);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
};

module.exports = {
  validateSkillMatch,
  validateWorkingHours,
  validateTimeConflict,
  validateDuplicateTransfer,
  validateTransferRequest
};
