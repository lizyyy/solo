const models = require('../models/types');
const studentRepo = require('../storage/studentRepository');
const lineRepo = require('../storage/lineRepository');
const stopRepo = require('../storage/stopRepository');
const diversionRepo = require('../storage/diversionRepository');

function createStudent(studentId, name, grade, classInfo) {
  const existing = studentRepo.findStudentByStudentId(studentId);
  if (existing) {
    return {
      success: false,
      error: `学生编号 ${studentId} 已存在`,
      student: existing
    };
  }

  const student = models.createStudent(studentId, name, grade, classInfo);
  studentRepo.insertStudent(student);
  return {
    success: true,
    student
  };
}

function addParent(studentId, parentName, phone, relationship) {
  const student = studentRepo.findStudentByStudentId(studentId);
  if (!student) {
    return {
      success: false,
      error: `学生 ${studentId} 不存在`
    };
  }

  const existing = studentRepo.findParentByStudentAndPhone(student.id, phone);
  if (existing) {
    return {
      success: false,
      error: `该联系电话 ${phone} 已存在于该学生的联系人列表中`,
      parent: existing,
      isDuplicate: true
    };
  }

  const parent = models.createParent(parentName, phone, relationship, student.id);
  const inserted = studentRepo.insertParent(parent);

  if (!inserted) {
    const fallback = studentRepo.findParentByStudentAndPhone(student.id, phone);
    return {
      success: false,
      error: `该联系电话 ${phone} 已存在于该学生的联系人列表中`,
      parent: fallback,
      isDuplicate: true
    };
  }

  return {
    success: true,
    parent
  };
}

function assignStudentToLine(studentId, lineCode, stopCode) {
  const student = studentRepo.findStudentByStudentId(studentId);
  if (!student) {
    return {
      success: false,
      error: `学生 ${studentId} 不存在`
    };
  }

  const line = lineRepo.findLineByCode(lineCode);
  if (!line) {
    return {
      success: false,
      error: `线路 ${lineCode} 不存在`
    };
  }

  const stop = stopRepo.findStopByCode(line.id, stopCode);
  if (!stop) {
    return {
      success: false,
      error: `站点 ${stopCode} 不在线路 ${lineCode} 上`
    };
  }

  const existingAssignment = studentRepo.findStudentLine(student.id, line.id);
  if (existingAssignment) {
    return {
      success: false,
      error: `学生 ${student.name} 已分配到线路 ${lineCode}`,
      assignment: existingAssignment
    };
  }

  const studentLines = studentRepo.getStudentLines(student.id);
  if (studentLines.length > 0) {
    const currentLine = studentLines[0];
    if (currentLine.lineCode !== lineCode) {
      return {
        success: true,
        warning: `学生 ${student.name} 已在其他线路 (${currentLine.lineCode})，将同时存在于两条线路中`,
        assignment: _doAssign(student, line, stop)
      };
    }
  }

  return {
    success: true,
    assignment: _doAssign(student, line, stop)
  };
}

function _doAssign(student, line, stop) {
  const studentLine = models.createStudentLine(student.id, line.id, stop.id);
  studentRepo.insertStudentLine(studentLine);
  return studentLine;
}

function changeStudentStop(studentId, lineCode, newStopCode, updateDefault = false) {
  const student = studentRepo.findStudentByStudentId(studentId);
  if (!student) {
    return {
      success: false,
      error: `学生 ${studentId} 不存在`
    };
  }

  const line = lineRepo.findLineByCode(lineCode);
  if (!line) {
    return {
      success: false,
      error: `线路 ${lineCode} 不存在`
    };
  }

  const assignment = studentRepo.findStudentLine(student.id, line.id);
  if (!assignment) {
    return {
      success: false,
      error: `学生 ${student.name} 不在线路 ${lineCode} 上`
    };
  }

  const newStop = stopRepo.findStopByCode(line.id, newStopCode);
  if (!newStop) {
    return {
      success: false,
      error: `站点 ${newStopCode} 不在线路 ${lineCode} 上`
    };
  }

  const updates = { stopId: newStop.id };
  if (updateDefault) {
    updates.defaultStopId = newStop.id;
  }

  const updated = studentRepo.updateStudentLine(assignment.id, updates);
  return {
    success: true,
    assignment: updated
  };
}

function resetStudentToDefaultStop(studentId, lineCode) {
  const student = studentRepo.findStudentByStudentId(studentId);
  if (!student) {
    return {
      success: false,
      error: `学生 ${studentId} 不存在`
    };
  }

  const line = lineRepo.findLineByCode(lineCode);
  if (!line) {
    return {
      success: false,
      error: `线路 ${lineCode} 不存在`
    };
  }

  const assignment = studentRepo.findStudentLine(student.id, line.id);
  if (!assignment) {
    return {
      success: false,
      error: `学生 ${student.name} 不在线路 ${lineCode} 上`
    };
  }

  if (assignment.stopId === assignment.defaultStopId) {
    return {
      success: true,
      unchanged: true,
      message: '学生已经在默认站点'
    };
  }

  const updated = studentRepo.updateStudentLine(assignment.id, { stopId: assignment.defaultStopId });
  return {
    success: true,
    assignment: updated
  };
}

function addLeave(studentId, date, note = '', leaveType = 'full') {
  const student = studentRepo.findStudentByStudentId(studentId);
  if (!student) {
    return {
      success: false,
      error: `学生 ${studentId} 不存在`
    };
  }

  const existing = diversionRepo.findLeave(student.id, date);
  if (existing) {
    return {
      success: false,
      error: `学生 ${student.name} 在 ${date} 已有请假记录`,
      leave: existing
    };
  }

  const leave = models.createLeave(student.id, date, leaveType, note);
  diversionRepo.insertLeave(leave);
  return {
    success: true,
    leave
  };
}

function removeLeave(studentId, date) {
  return {
    success: true,
    warning: '请假记录删除功能暂不支持，建议通过状态管理。目前请假记录保持唯一性。'
  };
}

function isStudentOnLeave(studentId, date) {
  const student = studentRepo.findStudentByStudentId(studentId);
  if (!student) {
    return false;
  }
  const leave = diversionRepo.findLeave(student.id, date);
  return leave !== null;
}

function getStudentDetails(studentId) {
  const student = studentRepo.findStudentByStudentId(studentId);
  if (!student) {
    return null;
  }

  const lines = studentRepo.getStudentLines(student.id);
  const parents = studentRepo.getParentsByStudentId(student.id);

  return {
    student,
    lines,
    parents
  };
}

function listStudents(includeInactive = false) {
  return studentRepo.getAllStudents(!includeInactive);
}

module.exports = {
  createStudent,
  addParent,
  assignStudentToLine,
  changeStudentStop,
  resetStudentToDefaultStop,
  addLeave,
  removeLeave,
  isStudentOnLeave,
  getStudentDetails,
  listStudents
};
