const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const storage = require('../utils/storage');
const rules = require('../utils/rules');

const FILE_APPOINTMENTS = 'appointments';
const FILE_VEHICLES = 'vehicles';
const FILE_SALESPERSONS = 'salespersons';
const FILE_ACCIDENTS = 'accidents';

function createTimelineEntry(type, action, reason, operator, oldValue = null, newValue = null) {
  return {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    type,
    action,
    reason,
    operator,
    oldValue,
    newValue
  };
}

function createAppointment(data, operator = 'system') {
  const { customerName, customerPhone, licenseNumber, licenseExpiryDate, customerAge,
          vehicleId, salespersonId, startTime, endTime, hasAccidentHistory = false } = data;
  
  const vehicles = storage.readData(FILE_VEHICLES);
  const salespersons = storage.readData(FILE_SALESPERSONS);
  const appointments = storage.readData(FILE_APPOINTMENTS);
  
  const vehicle = vehicles.find(v => v.id === vehicleId);
  const salesperson = salespersons.find(s => s.id === salespersonId);
  
  const timeline = [];
  
  const licenseCheck = rules.validateLicenseExpiry({ expiryDate: licenseExpiryDate });
  timeline.push(createTimelineEntry(
    'validation',
    '驾照效期检查',
    licenseCheck.reason,
    operator,
    null,
    { licenseNumber, expiryDate: licenseExpiryDate, valid: licenseCheck.valid, warning: licenseCheck.warning }
  ));
  
  if (!licenseCheck.valid) {
    const appointment = {
      id: uuidv4(),
      status: 'rejected',
      customerName,
      customerPhone,
      license: { number: licenseNumber, expiryDate: licenseExpiryDate, valid: false },
      customerAge,
      vehicleId,
      salespersonId,
      startTime,
      endTime,
      hasAccidentHistory,
      licenseCheck,
      vehicleCheck: null,
      insuranceCheck: null,
      salespersonCheck: null,
      timeline,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    appointments.push(appointment);
    storage.writeData(FILE_APPOINTMENTS, appointments);
    return { success: false, appointment, reason: licenseCheck.reason };
  }
  
  const vehicleCheck = rules.checkVehicleAvailability(vehicle, startTime);
  timeline.push(createTimelineEntry(
    'validation',
    '试驾车可用性检查',
    vehicleCheck.reason,
    operator,
    vehicle ? { id: vehicle.id, status: vehicle.status, model: vehicle.model } : null,
    { available: vehicleCheck.available, reason: vehicleCheck.reason }
  ));
  
  if (!vehicleCheck.available) {
    const appointment = {
      id: uuidv4(),
      status: 'rejected',
      customerName,
      customerPhone,
      license: { number: licenseNumber, expiryDate: licenseExpiryDate, valid: licenseCheck.valid },
      customerAge,
      vehicleId,
      salespersonId,
      startTime,
      endTime,
      hasAccidentHistory,
      licenseCheck,
      vehicleCheck,
      insuranceCheck: null,
      salespersonCheck: null,
      timeline,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    appointments.push(appointment);
    storage.writeData(FILE_APPOINTMENTS, appointments);
    return { success: false, appointment, reason: vehicleCheck.reason };
  }
  
  const insuranceCheck = rules.validateInsuranceRules(vehicle, customerAge, hasAccidentHistory);
  timeline.push(createTimelineEntry(
    'validation',
    '保险规则检查',
    insuranceCheck.valid ? '保险规则检查通过' : insuranceCheck.violations[0]?.reason,
    operator,
    vehicle ? { insurance: vehicle.insurance, model: vehicle.model } : null,
    { valid: insuranceCheck.valid, violations: insuranceCheck.violations, warnings: insuranceCheck.warnings }
  ));
  
  if (!insuranceCheck.valid) {
    const appointment = {
      id: uuidv4(),
      status: 'rejected',
      customerName,
      customerPhone,
      license: { number: licenseNumber, expiryDate: licenseExpiryDate, valid: licenseCheck.valid },
      customerAge,
      vehicleId,
      salespersonId,
      startTime,
      endTime,
      hasAccidentHistory,
      licenseCheck,
      vehicleCheck,
      insuranceCheck,
      salespersonCheck: null,
      timeline,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    appointments.push(appointment);
    storage.writeData(FILE_APPOINTMENTS, appointments);
    return { success: false, appointment, reason: insuranceCheck.violations[0]?.reason || '保险规则检查失败' };
  }
  
  const salespersonCheck = rules.validateSalespersonSchedule(salesperson, { id: null, startTime, endTime });
  timeline.push(createTimelineEntry(
    'validation',
    '销售日程检查',
    salespersonCheck.reason,
    operator,
    salesperson ? { id: salesperson.id, name: salesperson.name, schedule: salesperson.schedule } : null,
    { available: salespersonCheck.available, conflicts: salespersonCheck.conflicts }
  ));
  
  if (!salespersonCheck.available) {
    const appointment = {
      id: uuidv4(),
      status: 'rejected',
      customerName,
      customerPhone,
      license: { number: licenseNumber, expiryDate: licenseExpiryDate, valid: licenseCheck.valid },
      customerAge,
      vehicleId,
      salespersonId,
      startTime,
      endTime,
      hasAccidentHistory,
      licenseCheck,
      vehicleCheck,
      insuranceCheck,
      salespersonCheck,
      timeline,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    appointments.push(appointment);
    storage.writeData(FILE_APPOINTMENTS, appointments);
    return { success: false, appointment, reason: salespersonCheck.reason };
  }
  
  const finalStatus = 'pending';
  timeline.push(createTimelineEntry(
    'status_change',
    '创建预约',
    '所有规则检查通过，创建预约并进入待确认状态',
    operator,
    null,
    { status: finalStatus }
  ));
  
  const appointment = {
    id: uuidv4(),
    status: finalStatus,
    customerName,
    customerPhone,
    license: { 
      number: licenseNumber, 
      expiryDate: licenseExpiryDate, 
      valid: licenseCheck.valid,
      warning: licenseCheck.warning,
      warningLevel: licenseCheck.warningLevel
    },
    customerAge,
    vehicleId,
    vehicleSnapshot: vehicle ? { ...vehicle } : null,
    salespersonId,
    salespersonSnapshot: salesperson ? { ...salesperson } : null,
    startTime,
    endTime,
    hasAccidentHistory,
    licenseCheck,
    vehicleCheck,
    insuranceCheck,
    salespersonCheck,
    operationHistory: [],
    timeline,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  appointments.push(appointment);
  storage.writeData(FILE_APPOINTMENTS, appointments);
  
  if (salesperson) {
    if (!salesperson.schedule) salesperson.schedule = [];
    salesperson.schedule.push({
      id: appointment.id,
      startTime,
      endTime,
      type: 'test-drive',
      customerName
    });
    storage.writeData(FILE_SALESPERSONS, salespersons);
  }
  
  return { success: true, appointment };
}

function advanceAppointment(id, action, operator = 'system', operationId = null) {
  const appointments = storage.readData(FILE_APPOINTMENTS);
  const index = appointments.findIndex(a => a.id === id);
  
  if (index === -1) {
    return { success: false, reason: '预约不存在' };
  }
  
  const appointment = appointments[index];
  
  if (operationId) {
    const duplicateCheck = rules.validateRepeatOperation(
      appointment.operationHistory,
      operationId,
      action
    );
    if (duplicateCheck.isDuplicate) {
      return { 
        success: true, 
        appointment, 
        isDuplicate: true,
        message: duplicateCheck.message,
        existingOperation: duplicateCheck.existingOperation
      };
    }
  }
  
  const oldStatus = appointment.status;
  let newStatus = null;
  let reason = '';
  const timelineEntry = {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    type: 'status_change',
    action: '',
    reason: '',
    operator,
    oldValue: { status: oldStatus },
    newValue: null
  };
  
  switch (action) {
    case 'confirm':
      if (oldStatus !== 'pending') {
        return { success: false, reason: `当前状态 [${oldStatus}] 无法确认` };
      }
      newStatus = 'confirmed';
      reason = '销售顾问已确认预约，车辆和销售日程已锁定';
      timelineEntry.action = '确认预约';
      break;
      
    case 'checkin':
      if (oldStatus !== 'confirmed') {
        return { success: false, reason: `当前状态 [${oldStatus}] 无法签到` };
      }
      newStatus = 'in_progress';
      reason = '客户已到店签到，试驾开始';
      timelineEntry.action = '签到开始';
      break;
      
    case 'complete':
      if (oldStatus !== 'in_progress') {
        return { success: false, reason: `当前状态 [${oldStatus}] 无法完成` };
      }
      newStatus = 'completed';
      reason = '试驾顺利完成，客户已确认返回';
      timelineEntry.action = '完成试驾';
      break;
      
    case 'release_no_show':
      if (oldStatus !== 'confirmed') {
        return { success: false, reason: `当前状态 [${oldStatus}] 无法执行爽约释放` };
      }
      const releaseCheck = rules.checkNoShowRelease(appointment);
      if (!releaseCheck.shouldRelease) {
        return { success: false, reason: releaseCheck.reason };
      }
      newStatus = 'no_show_released';
      reason = `爽约释放：${releaseCheck.reason}`;
      timelineEntry.action = '爽约释放';
      break;
      
    case 'cancel':
      if (!['pending', 'confirmed'].includes(oldStatus)) {
        return { success: false, reason: `当前状态 [${oldStatus}] 无法取消` };
      }
      newStatus = 'cancelled';
      reason = '预约已取消，车辆和销售日程已释放';
      timelineEntry.action = '取消预约';
      break;
      
    default:
      return { success: false, reason: `未知操作类型: ${action}` };
  }
  
  timelineEntry.reason = reason;
  timelineEntry.newValue = { status: newStatus };
  
  appointment.status = newStatus;
  appointment.timeline.push(timelineEntry);
  if (operationId) {
    appointment.operationHistory.push({
      operationId,
      operationType: action,
      executedAt: new Date().toISOString()
    });
  }
  appointment.updatedAt = new Date().toISOString();
  
  appointments[index] = appointment;
  storage.writeData(FILE_APPOINTMENTS, appointments);
  
  if (['completed', 'cancelled', 'no_show_released'].includes(newStatus)) {
    const salespersons = storage.readData(FILE_SALESPERSONS);
    const salesperson = salespersons.find(s => s.id === appointment.salespersonId);
    if (salesperson && salesperson.schedule) {
      salesperson.schedule = salesperson.schedule.filter(s => s.id !== appointment.id);
      storage.writeData(FILE_SALESPERSONS, salespersons);
    }
  }
  
  return { success: true, appointment };
}

function correctAppointment(id, updates, operator = 'system', correctReason) {
  const appointments = storage.readData(FILE_APPOINTMENTS);
  const index = appointments.findIndex(a => a.id === id);
  
  if (index === -1) {
    return { success: false, reason: '预约不存在' };
  }
  
  const appointment = appointments[index];
  const oldValues = {};
  const newValues = {};
  const timelineEntries = [];
  
  if (updates.licenseExpiryDate !== undefined) {
    oldValues.license = { 
      ...appointment.license, 
      expiryDate: appointment.license.expiryDate 
    };
    const newCheck = rules.validateLicenseExpiry({ expiryDate: updates.licenseExpiryDate });
    
    appointment.license.expiryDate = updates.licenseExpiryDate;
    appointment.license.valid = newCheck.valid;
    appointment.license.warning = newCheck.warning;
    appointment.license.warningLevel = newCheck.warningLevel;
    appointment.licenseCheck = newCheck;
    
    newValues.license = { ...appointment.license };
    
    timelineEntries.push(createTimelineEntry(
      'correction',
      '修正驾照效期',
      correctReason || '人工修正驾照有效期',
      operator,
      oldValues.license,
      newValues.license
    ));
  }
  
  if (updates.vehicleId !== undefined && updates.vehicleId !== appointment.vehicleId) {
    const vehicles = storage.readData(FILE_VEHICLES);
    const newVehicle = vehicles.find(v => v.id === updates.vehicleId);
    
    oldValues.vehicle = { 
      id: appointment.vehicleId, 
      snapshot: appointment.vehicleSnapshot 
    };
    
    const vehicleCheck = rules.checkVehicleAvailability(newVehicle, appointment.startTime);
    const insuranceCheck = rules.validateInsuranceRules(newVehicle, appointment.customerAge, appointment.hasAccidentHistory);
    
    appointment.vehicleId = updates.vehicleId;
    appointment.vehicleSnapshot = newVehicle ? { ...newVehicle } : null;
    appointment.vehicleCheck = vehicleCheck;
    appointment.insuranceCheck = insuranceCheck;
    
    newValues.vehicle = { 
      id: updates.vehicleId, 
      snapshot: appointment.vehicleSnapshot,
      available: vehicleCheck.available,
      insuranceValid: insuranceCheck.valid
    };
    
    timelineEntries.push(createTimelineEntry(
      'correction',
      '修正试驾车',
      correctReason || '人工修正试驾车辆',
      operator,
      oldValues.vehicle,
      newValues.vehicle
    ));
  }
  
  if (updates.salespersonId !== undefined && updates.salespersonId !== appointment.salespersonId) {
    const salespersons = storage.readData(FILE_SALESPERSONS);
    const oldSalesperson = salespersons.find(s => s.id === appointment.salespersonId);
    const newSalesperson = salespersons.find(s => s.id === updates.salespersonId);
    
    oldValues.salesperson = { 
      id: appointment.salespersonId, 
      snapshot: appointment.salespersonSnapshot 
    };
    
    if (oldSalesperson && oldSalesperson.schedule) {
      oldSalesperson.schedule = oldSalesperson.schedule.filter(s => s.id !== appointment.id);
    }
    
    if (newSalesperson) {
      if (!newSalesperson.schedule) newSalesperson.schedule = [];
      newSalesperson.schedule.push({
        id: appointment.id,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        type: 'test-drive',
        customerName: appointment.customerName
      });
    }
    
    storage.writeData(FILE_SALESPERSONS, salespersons);
    
    const scheduleCheck = rules.validateSalespersonSchedule(
      newSalesperson, 
      { id: appointment.id, startTime: appointment.startTime, endTime: appointment.endTime }
    );
    
    appointment.salespersonId = updates.salespersonId;
    appointment.salespersonSnapshot = newSalesperson ? { ...newSalesperson } : null;
    appointment.salespersonCheck = scheduleCheck;
    
    newValues.salesperson = { 
      id: updates.salespersonId, 
      snapshot: appointment.salespersonSnapshot,
      available: scheduleCheck.available
    };
    
    timelineEntries.push(createTimelineEntry(
      'correction',
      '修正销售顾问',
      correctReason || '人工修正销售顾问',
      operator,
      oldValues.salesperson,
      newValues.salesperson
    ));
  }
  
  if (timelineEntries.length === 0) {
    return { success: false, reason: '没有提供有效的修正字段' };
  }
  
  appointment.timeline.push(...timelineEntries);
  appointment.updatedAt = new Date().toISOString();
  
  appointments[index] = appointment;
  storage.writeData(FILE_APPOINTMENTS, appointments);
  
  return { success: true, appointment, timelineEntries };
}

function getAppointment(id) {
  return storage.findById(FILE_APPOINTMENTS, id);
}

function listAppointments(filters = {}) {
  let appointments = storage.readData(FILE_APPOINTMENTS);
  
  if (filters.status) {
    appointments = appointments.filter(a => a.status === filters.status);
  }
  if (filters.customerName) {
    appointments = appointments.filter(a => 
      a.customerName.includes(filters.customerName)
    );
  }
  if (filters.vehicleId) {
    appointments = appointments.filter(a => a.vehicleId === filters.vehicleId);
  }
  if (filters.salespersonId) {
    appointments = appointments.filter(a => a.salespersonId === filters.salespersonId);
  }
  if (filters.startDate) {
    const start = dayjs(filters.startDate).startOf('day');
    appointments = appointments.filter(a => dayjs(a.startTime).isAfter(start));
  }
  if (filters.endDate) {
    const end = dayjs(filters.endDate).endOf('day');
    appointments = appointments.filter(a => dayjs(a.endTime).isBefore(end));
  }
  
  return appointments.sort((a, b) => 
    new Date(b.createdAt) - new Date(a.createdAt)
  );
}

function registerAccident(appointmentId, accidentData, operator = 'system') {
  const appointments = storage.readData(FILE_APPOINTMENTS);
  const appointment = appointments.find(a => a.id === appointmentId);
  
  if (!appointment) {
    return { success: false, reason: '预约不存在' };
  }
  
  if (!['in_progress', 'completed'].includes(appointment.status)) {
    return { success: false, reason: `当前状态 [${appointment.status}] 无法登记事故` };
  }
  
  const accidents = storage.readData(FILE_ACCIDENTS);
  const accident = {
    id: uuidv4(),
    appointmentId,
    customerName: appointment.customerName,
    vehicleId: appointment.vehicleId,
    salespersonId: appointment.salespersonId,
    ...accidentData,
    status: 'pending_review',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  accidents.push(accident);
  storage.writeData(FILE_ACCIDENTS, accidents);
  
  appointment.timeline.push(createTimelineEntry(
    'accident',
    '事故登记',
    accidentData.description || '试驾过程中发生事故，已登记待人工处理',
    operator,
    { status: appointment.status },
    { accidentId: accident.id, accidentStatus: 'pending_review' }
  ));
  appointment.hasAccident = true;
  appointment.accidentId = accident.id;
  appointment.updatedAt = new Date().toISOString();
  
  storage.writeData(FILE_APPOINTMENTS, appointments);
  
  return { success: true, accident };
}

function processAccident(accidentId, decision, notes, operator = 'system') {
  const accidents = storage.readData(FILE_ACCIDENTS);
  const index = accidents.findIndex(a => a.id === accidentId);
  
  if (index === -1) {
    return { success: false, reason: '事故记录不存在' };
  }
  
  const accident = accidents[index];
  const oldStatus = accident.status;
  
  if (!['approve', 'reject', 'pending_followup'].includes(decision)) {
    return { success: false, reason: '无效的处理决策' };
  }
  
  const statusMap = {
    approve: 'resolved',
    reject: 'disputed',
    pending_followup: 'pending_followup'
  };
  
  accident.status = statusMap[decision];
  accident.processedBy = operator;
  accident.processedAt = new Date().toISOString();
  accident.processNotes = notes;
  
  accidents[index] = accident;
  storage.writeData(FILE_ACCIDENTS, accidents);
  
  const appointments = storage.readData(FILE_APPOINTMENTS);
  const appointment = appointments.find(a => a.id === accident.appointmentId);
  if (appointment) {
    appointment.timeline.push(createTimelineEntry(
      'accident',
      '事故人工处理',
      `处理结果: ${accident.status}, 备注: ${notes}`,
      operator,
      { accidentStatus: oldStatus },
      { accidentStatus: accident.status, notes }
    ));
    appointment.updatedAt = new Date().toISOString();
    storage.writeData(FILE_APPOINTMENTS, appointments);
  }
  
  return { success: true, accident };
}

module.exports = {
  createAppointment,
  advanceAppointment,
  correctAppointment,
  getAppointment,
  listAppointments,
  registerAccident,
  processAccident
};
