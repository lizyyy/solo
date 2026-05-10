const models = require('../models/types');
const driverRepo = require('../storage/driverRepository');
const lineRepo = require('../storage/lineRepository');

function createDriver(driverId, name, phone, licensePlate = '') {
  const existing = driverRepo.findDriverByDriverId(driverId);
  if (existing) {
    return {
      success: false,
      error: `司机编号 ${driverId} 已存在`,
      driver: existing
    };
  }

  const driver = models.createDriver(driverId, name, phone, licensePlate);
  driverRepo.insertDriver(driver);
  return {
    success: true,
    driver
  };
}

function createShift(code, name, startTime, endTime) {
  const existing = driverRepo.findShiftByCode(code);
  if (existing) {
    return {
      success: false,
      error: `班次代码 ${code} 已存在`,
      shift: existing
    };
  }

  const shift = models.createShift(code, name, startTime, endTime);
  driverRepo.insertShift(shift);
  return {
    success: true,
    shift
  };
}

function assignDriverToLine(driverId, lineCode, shiftCode, effectiveDate) {
  const driver = driverRepo.findDriverByDriverId(driverId);
  if (!driver) {
    return {
      success: false,
      error: `司机 ${driverId} 不存在`
    };
  }

  const line = lineRepo.findLineByCode(lineCode);
  if (!line) {
    return {
      success: false,
      error: `线路 ${lineCode} 不存在`
    };
  }

  const shift = driverRepo.findShiftByCode(shiftCode);
  if (!shift) {
    return {
      success: false,
      error: `班次 ${shiftCode} 不存在`
    };
  }

  const existing = driverRepo.findDriverAssignment(driver.id, line.id, shift.id, effectiveDate);
  if (existing) {
    return {
      success: false,
      error: `司机 ${driver.name} 在 ${effectiveDate} 的该班次已存在分配记录`,
      assignment: existing,
      isDuplicate: true
    };
  }

  const assignment = models.createDriverAssignment(
    driver.id,
    line.id,
    shift.id,
    effectiveDate
  );
  const inserted = driverRepo.insertDriverAssignment(assignment);

  if (!inserted) {
    const fallback = driverRepo.findDriverAssignment(driver.id, line.id, shift.id, effectiveDate);
    return {
      success: false,
      error: `司机 ${driver.name} 在 ${effectiveDate} 的该班次已存在分配记录`,
      assignment: fallback,
      isDuplicate: true
    };
  }

  return {
    success: true,
    assignment: {
      ...assignment,
      driverName: driver.name,
      driverPhone: driver.phone,
      licensePlate: driver.licensePlate,
      lineCode: line.code,
      lineName: line.name,
      shiftCode: shift.code,
      shiftName: shift.name,
      startTime: shift.startTime,
      endTime: shift.endTime
    }
  };
}

function getDriverSchedule(date) {
  return driverRepo.getDriverAssignments(date);
}

function getLineDrivers(lineCode, date) {
  const line = lineRepo.findLineByCode(lineCode);
  if (!line) {
    return [];
  }
  return driverRepo.getAssignmentsByLine(line.id, date);
}

function listDrivers(includeInactive = false) {
  return driverRepo.getAllDrivers(!includeInactive);
}

module.exports = {
  createDriver,
  createShift,
  assignDriverToLine,
  getDriverSchedule,
  getLineDrivers,
  listDrivers
};
