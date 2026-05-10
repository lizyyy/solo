const models = require('../models/types');
const lineRepo = require('../storage/lineRepository');
const stopRepo = require('../storage/stopRepository');
const studentRepo = require('../storage/studentRepository');

function createLine(code, name, description = '') {
  const existing = lineRepo.findLineByCode(code);
  if (existing) {
    return {
      success: false,
      error: `线路代码 ${code} 已存在`,
      line: existing
    };
  }

  const line = models.createLine(code, name, description);
  lineRepo.insertLine(line);
  return {
    success: true,
    line
  };
}

function addStopToLine(lineCode, stopCode, stopName, address, order) {
  const line = lineRepo.findLineByCode(lineCode);
  if (!line) {
    return {
      success: false,
      error: `线路 ${lineCode} 不存在`
    };
  }

  const existing = stopRepo.findStopByCode(line.id, stopCode);
  if (existing) {
    return {
      success: false,
      error: `站点代码 ${stopCode} 在该线路已存在`,
      stop: existing
    };
  }

  const stop = models.createStop(stopCode, stopName, address, line.id, order);
  stopRepo.insertStop(stop);
  return {
    success: true,
    stop
  };
}

function listLines(includeInactive = false) {
  const lines = lineRepo.getAllLines(!includeInactive);
  return lines;
}

function getLineDetails(lineCode) {
  const line = lineRepo.findLineByCode(lineCode);
  if (!line) {
    return null;
  }

  const stops = stopRepo.getStopsByLineId(line.id, false);
  return {
    line,
    stops
  };
}

function getLineWithStudents(lineCode, date) {
  const line = lineRepo.findLineByCode(lineCode);
  if (!line) {
    return null;
  }

  const stops = stopRepo.getStopsByLineId(line.id);

  const studentsByStop = new Map();
  const allStudents = studentRepo.getAllStudents();

  for (const student of allStudents) {
    const studentLines = studentRepo.getStudentLines(student.id);
    const studentLine = studentLines.find(sl => sl.lineId === line.id);

    if (studentLine) {
      const stopId = studentLine.stopId;
      if (!studentsByStop.has(stopId)) {
        studentsByStop.set(stopId, []);
      }
      studentsByStop.get(stopId).push({
        ...student,
        studentLineId: studentLine.id,
        currentStopCode: studentLine.stopCode,
        currentStopName: studentLine.stopName,
        defaultStopCode: studentLine.defaultStopCode,
        defaultStopName: studentLine.defaultStopName
      });
    }
  }

  const stopsWithStudents = stops.map(stop => ({
    ...stop,
    students: studentsByStop.get(stop.id) || []
  }));

  return {
    line,
    stops: stopsWithStudents
  };
}

function checkLineConsistency(lineCode) {
  const details = getLineDetails(lineCode);
  if (!details) {
    return { valid: false, errors: ['线路不存在'] };
  }

  const errors = [];
  const warnings = [];

  const stops = details.stops;
  const activeStops = stops.filter(s => s.isActive);

  if (activeStops.length === 0) {
    warnings.push('该线路没有活动站点');
  }

  const inactiveStopsWithStudents = [];
  for (const stop of stops) {
    if (!stop.isActive) {
      const allStudents = studentRepo.getAllStudents();
      const studentsAtStop = [];

      for (const student of allStudents) {
        const studentLines = studentRepo.getStudentLines(student.id);
        const studentLine = studentLines.find(sl => sl.stopId === stop.id);
        if (studentLine) {
          studentsAtStop.push(student);
        }
      }

      if (studentsAtStop.length > 0) {
        inactiveStopsWithStudents.push({
          stop: stop.code,
          studentCount: studentsAtStop.length,
          students: studentsAtStop.map(s => s.name)
        });
      }
    }
  }

  if (inactiveStopsWithStudents.length > 0) {
    warnings.push({
      message: '有学生分配到了已停用的站点',
      details: inactiveStopsWithStudents
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    details
  };
}

module.exports = {
  createLine,
  addStopToLine,
  listLines,
  getLineDetails,
  getLineWithStudents,
  checkLineConsistency
};
