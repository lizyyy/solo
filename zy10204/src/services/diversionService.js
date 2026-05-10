const { createHash } = require('crypto');
const models = require('../models/types');
const diversionRepo = require('../storage/diversionRepository');
const lineRepo = require('../storage/lineRepository');
const stopRepo = require('../storage/stopRepository');
const studentRepo = require('../storage/studentRepository');
const notificationService = require('./notificationService');

function createDiversionHash(date, reason, lineChanges) {
  const sortedChanges = [...lineChanges].sort((a, b) => {
    if (a.lineCode !== b.lineCode) return a.lineCode.localeCompare(b.lineCode);
    if (a.originalStopCode !== b.originalStopCode) return a.originalStopCode.localeCompare(b.originalStopCode);
    return 0;
  });

  const hashInput = JSON.stringify({
    date,
    reason,
    changes: sortedChanges
  });

  return createHash('sha256').update(hashInput).digest('hex');
}

function createDiversion(date, reason, lineChanges) {
  const inputHash = createDiversionHash(date, reason, lineChanges);

  const existingDiversion = diversionRepo.findDiversionByDate(date);
  if (existingDiversion) {
    const existingLines = diversionRepo.getDiversionLines(existingDiversion.id);
    const existingChanges = existingLines.map(dl => ({
      lineCode: dl.lineCode,
      originalStopCode: dl.originalStopCode,
      newStopCode: dl.newStopCode,
      isSkipped: dl.isSkipped
    }));
    const existingHash = createDiversionHash(date, existingDiversion.reason, existingChanges);

    if (existingHash === inputHash) {
      return {
        success: true,
        diversion: existingDiversion,
        diversionLines: existingLines,
        isDuplicate: true,
        message: '改线记录已存在，内容完全一致，跳过重复处理'
      };
    }

    return {
      success: false,
      error: `日期 ${date} 已有改线记录，请使用不同的日期或更新现有记录`
    };
  }

  const diversion = models.createDiversion(date, reason);
  diversionRepo.insertDiversion(diversion);

  const createdLines = [];
  const errors = [];
  const warnings = [];

  for (const change of lineChanges) {
    const result = _processLineChange(diversion.id, change);
    if (result.success) {
      createdLines.push(result.line);
      if (result.warning) {
        warnings.push(result.warning);
      }
    } else {
      errors.push(result.error);
    }
  }

  if (errors.length > 0) {
    return {
      success: false,
      error: '部分线路改线处理失败',
      errors,
      partialSuccess: createdLines,
      diversion
    };
  }

  return {
    success: true,
    diversion,
    diversionLines: createdLines,
    warnings,
    isDuplicate: false
  };
}

function _processLineChange(diversionId, change) {
  const line = lineRepo.findLineByCode(change.lineCode);
  if (!line) {
    return {
      success: false,
      error: `线路 ${change.lineCode} 不存在`
    };
  }

  const originalStop = stopRepo.findStopByCode(line.id, change.originalStopCode);
  if (!originalStop) {
    return {
      success: false,
      error: `原站点 ${change.originalStopCode} 不在线路 ${change.lineCode} 上`
    };
  }

  let newStopId = null;
  const isSkipped = change.isSkipped === true;

  if (!isSkipped && change.newStopCode) {
    const newStop = stopRepo.findStopByCode(line.id, change.newStopCode);
    if (!newStop) {
      return {
        success: false,
        error: `新站点 ${change.newStopCode} 不在线路 ${change.lineCode} 上`
      };
    }
    newStopId = newStop.id;
  }

  const diversionLine = models.createDiversionLine(
    diversionId,
    line.id,
    originalStop.id,
    newStopId,
    isSkipped
  );
  diversionRepo.insertDiversionLine(diversionLine);

  const allStudents = studentRepo.getAllStudents();
  const studentsAtStop = [];
  for (const student of allStudents) {
    const studentLines = studentRepo.getStudentLines(student.id);
    const assignment = studentLines.find(sl =>
      sl.lineId === line.id && sl.stopId === originalStop.id
    );
    if (assignment) {
      studentsAtStop.push({
        student,
        assignment
      });
    }
  }

  const result = {
    success: true,
    line: {
      ...diversionLine,
      lineCode: line.code,
      lineName: line.name,
      originalStopCode: originalStop.code,
      originalStopName: originalStop.name,
      newStopCode: change.newStopCode || null,
      newStopName: newStopId ? stopRepo.findStopById(newStopId).name : null,
      affectedStudents: studentsAtStop.length
    }
  };

  if (studentsAtStop.length > 0 && isSkipped) {
    result.warning = {
      lineCode: line.code,
      originalStopCode: originalStop.code,
      studentCount: studentsAtStop.length,
      message: `站点被跳过但有 ${studentsAtStop.length} 名学生`
    };
  }

  return result;
}

function getDiversion(date) {
  return diversionRepo.findDiversionByDate(date);
}

function getDiversionWithDetails(date) {
  const diversion = diversionRepo.findDiversionByDate(date);
  if (!diversion) {
    return null;
  }

  const diversionLines = diversionRepo.getDiversionLines(diversion.id);
  const leaves = diversionRepo.getLeavesByDate(date);
  const hasNotifications = diversionRepo.hasNotificationsForDiversion(diversion.id);

  return {
    diversion,
    diversionLines,
    leaves,
    hasNotifications
  };
}

function generateNotifications(date) {
  const diversionDetails = getDiversionWithDetails(date);
  if (!diversionDetails) {
    return {
      success: false,
      error: `日期 ${date} 没有改线记录`
    };
  }

  const { diversion, diversionLines, leaves } = diversionDetails;

  if (diversionRepo.hasNotificationsForDiversion(diversion.id)) {
    return {
      success: true,
      isDuplicate: true,
      message: '该改线的通知已生成过，跳过重复生成'
    };
  }

  const leaveStudentIds = new Set(leaves.map(l => l.studentId));
  const processed = new Map();
  const skippedBecauseOfLeave = [];

  for (const dl of diversionLines) {
    const affectedStudents = _getStudentsForStop(dl.lineId, dl.originalStopId);

    for (const { student, assignment } of affectedStudents) {
      if (leaveStudentIds.has(student.id)) {
        skippedBecauseOfLeave.push({
          student: student.name,
          lineCode: dl.lineCode,
          stopCode: dl.originalStopCode,
          reason: '请假'
        });
        continue;
      }

      const key = `${student.id}-${dl.lineId}`;
      if (!processed.has(key)) {
        processed.set(key, {
          student,
          assignment,
          lineCode: dl.lineCode,
          lineName: dl.lineName,
          originalStopCode: dl.originalStopCode,
          originalStopName: dl.originalStopName,
          newStopCode: dl.isSkipped ? null : dl.newStopCode,
          newStopName: dl.isSkipped ? null : dl.newStopName,
          isSkipped: dl.isSkipped
        });
      }
    }
  }

  const generatedNotifications = [];
  const parents = studentRepo.getParentsByStudentId;

  for (const [, info] of processed) {
    const studentParents = studentRepo.getParentsByStudentId(info.student.id);

    if (studentParents.length === 0) {
      continue;
    }

    for (const parent of studentParents) {
      const content = notificationService.generateParentContent({
        diversion,
        student: info.student,
        parent,
        lineCode: info.lineCode,
        originalStopName: info.originalStopName,
        newStopName: info.newStopName,
        isSkipped: info.isSkipped
      });

      const notification = models.createNotification(
        info.student.id,
        diversion.id,
        parent.id,
        'parent',
        content
      );
      const created = diversionRepo.insertNotification(notification);
      if (created) {
        generatedNotifications.push({
          ...notification,
          studentName: info.student.name,
          parentName: parent.name,
          parentPhone: parent.phone
        });
      }
    }
  }

  return {
    success: true,
    diversion,
    notificationCount: generatedNotifications.length,
    skippedBecauseOfLeave,
    isDuplicate: false
  };
}

function _getStudentsForStop(lineId, stopId) {
  const result = [];
  const allStudents = studentRepo.getAllStudents();

  for (const student of allStudents) {
    const studentLines = studentRepo.getStudentLines(student.id);
    const assignment = studentLines.find(sl =>
      sl.lineId === lineId && sl.stopId === stopId
    );
    if (assignment) {
      result.push({ student, assignment });
    }
  }

  return result;
}

module.exports = {
  createDiversion,
  getDiversion,
  getDiversionWithDetails,
  generateNotifications,
  createDiversionHash
};
