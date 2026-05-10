const { v4: uuidv4 } = require('uuid');

function generateId() {
  return uuidv4();
}

function createLine(lineCode, lineName, description = '') {
  return {
    id: generateId(),
    code: lineCode,
    name: lineName,
    description,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function createStop(stopCode, stopName, address, lineId, order) {
  return {
    id: generateId(),
    code: stopCode,
    name: stopName,
    address,
    lineId,
    order,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function createStudent(studentId, name, grade, classInfo) {
  return {
    id: generateId(),
    studentId,
    name,
    grade,
    class: classInfo,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function createStudentLine(studentId, lineId, stopId, defaultStopId = null) {
  return {
    id: generateId(),
    studentId,
    lineId,
    stopId,
    defaultStopId: defaultStopId || stopId,
    createdAt: new Date().toISOString()
  };
}

function createParent(name, phone, relationship, studentId) {
  return {
    id: generateId(),
    name,
    phone,
    relationship,
    studentId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function createDriver(driverId, name, phone, licensePlate) {
  return {
    id: generateId(),
    driverId,
    name,
    phone,
    licensePlate,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function createShift(shiftCode, shiftName, startTime, endTime) {
  return {
    id: generateId(),
    code: shiftCode,
    name: shiftName,
    startTime,
    endTime,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function createDriverAssignment(driverId, lineId, shiftId, effectiveDate) {
  return {
    id: generateId(),
    driverId,
    lineId,
    shiftId,
    effectiveDate,
    isActive: true,
    createdAt: new Date().toISOString()
  };
}

function createDiversion(date, reason, diversionType = 'temporary') {
  return {
    id: generateId(),
    date,
    reason,
    diversionType,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function createDiversionLine(diversionId, lineId, originalStopId, newStopId = null, isSkipped = false) {
  return {
    id: generateId(),
    diversionId,
    lineId,
    originalStopId,
    newStopId,
    isSkipped,
    createdAt: new Date().toISOString()
  };
}

function createLeave(studentId, date, leaveType = 'full', note = '') {
  return {
    id: generateId(),
    studentId,
    date,
    leaveType,
    note,
    status: 'approved',
    createdAt: new Date().toISOString()
  };
}

function createNotification(studentId, diversionId, parentId, notificationType, content, status = 'generated') {
  return {
    id: generateId(),
    studentId,
    diversionId,
    parentId,
    notificationType,
    content,
    status,
    createdAt: new Date().toISOString(),
    sentAt: null
  };
}

module.exports = {
  generateId,
  createLine,
  createStop,
  createStudent,
  createStudentLine,
  createParent,
  createDriver,
  createShift,
  createDriverAssignment,
  createDiversion,
  createDiversionLine,
  createLeave,
  createNotification
};
