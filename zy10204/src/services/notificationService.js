const { format } = require('date-fns');
const { zhCN } = require('date-fns/locale');
const diversionRepo = require('../storage/diversionRepository');
const driverService = require('./driverService');
const lineService = require('./lineService');
const studentService = require('./studentService');
const studentRepo = require('../storage/studentRepository');
const lineRepo = require('../storage/lineRepository');

function generateParentContent({ diversion, student, parent, lineCode, originalStopName, newStopName, isSkipped }) {
  const dateStr = diversion.date;

  if (isSkipped) {
    return `【临时改线通知】${dateStr} 因${diversion.reason}，您的孩子${student.name}所在的${lineCode}线路有站点调整。原站点「${originalStopName}」今日暂停停靠，请提前安排接送。`;
  }

  return `【临时改线通知】${dateStr} 因${diversion.reason}，您的孩子${student.name}所在的${lineCode}线路有站点调整。原站点「${originalStopName}」今日改为「${newStopName}」，请留意。`;
}

function generateDriverNotification(date) {
  const diversionDetails = diversionRepo.findDiversionByDate(date);
  if (!diversionDetails) {
    return null;
  }

  const diversionLines = diversionRepo.getDiversionLines(diversionDetails.id);
  const driverSchedule = driverService.getDriverSchedule(date);

  const linesByLineId = new Map();
  for (const dl of diversionLines) {
    if (!linesByLineId.has(dl.lineId)) {
      linesByLineId.set(dl.lineId, []);
    }
    linesByLineId.get(dl.lineId).push(dl);
  }

  const driverNotifications = [];
  const leaves = diversionRepo.getLeavesByDate(date);
  const leaveStudentIds = new Set(leaves.map(l => l.studentId));

  for (const assignment of driverSchedule) {
    const lineDiversions = linesByLineId.get(assignment.lineId);
    if (!lineDiversions || lineDiversions.length === 0) {
      continue;
    }

    const lineStudents = _getLineStudentsWithDiversions(
      assignment.lineId,
      date,
      lineDiversions,
      leaveStudentIds
    );

    driverNotifications.push({
      date,
      reason: diversionDetails.reason,
      driverName: assignment.driverName,
      driverPhone: assignment.driverPhone,
      licensePlate: assignment.licensePlate,
      lineCode: assignment.lineCode,
      lineName: assignment.lineName,
      shiftCode: assignment.shiftCode,
      shiftName: assignment.shiftName,
      startTime: assignment.startTime,
      endTime: assignment.endTime,
      diversions: lineDiversions.map(dl => ({
        originalStopCode: dl.originalStopCode,
        originalStopName: dl.originalStopName,
        newStopCode: dl.isSkipped ? '（跳过）' : dl.newStopCode,
        newStopName: dl.isSkipped ? '今日跳过' : dl.newStopName,
        isSkipped: dl.isSkipped
      })),
      studentSummary: lineStudents
    });
  }

  return {
    date,
    reason: diversionDetails.reason,
    driverNotifications,
    leaves
  };
}

function _getLineStudentsWithDiversions(lineId, date, diversions, leaveStudentIds) {
  const line = lineRepo.findLineById(lineId);
  if (!line) return [];

  const allStudents = studentRepo.getAllStudents();
  const stopMap = new Map();

  for (const dl of diversions) {
    stopMap.set(dl.originalStopId, {
      originalStopCode: dl.originalStopCode,
      originalStopName: dl.originalStopName,
      newStopCode: dl.isSkipped ? null : dl.newStopCode,
      newStopName: dl.isSkipped ? null : dl.newStopName,
      isSkipped: dl.isSkipped
    });
  }

  const affectedStudents = [];
  for (const student of allStudents) {
    if (leaveStudentIds.has(student.id)) continue;

    const studentLines = studentRepo.getStudentLines(student.id);
    const assignment = studentLines.find(sl => sl.lineId === lineId);

    if (assignment && stopMap.has(assignment.stopId)) {
      const diversion = stopMap.get(assignment.stopId);
      affectedStudents.push({
        studentId: student.studentId,
        name: student.name,
        grade: student.grade,
        class: student.class,
        originalStopCode: diversion.originalStopCode,
        originalStopName: diversion.originalStopName,
        newStopCode: diversion.newStopCode,
        newStopName: diversion.newStopName,
        isSkipped: diversion.isSkipped
      });
    }
  }

  return affectedStudents;
}

function generateTeacherNotification(date) {
  const diversionDetails = diversionRepo.findDiversionByDate(date);
  if (!diversionDetails) {
    return null;
  }

  const diversionLines = diversionRepo.getDiversionLines(diversionDetails.id);
  const leaves = diversionRepo.getLeavesByDate(date);
  const notifications = diversionRepo.getNotifications(diversionDetails.id, 'parent');
  const driverSchedule = driverService.getDriverSchedule(date);

  const linesByCode = new Map();
  for (const dl of diversionLines) {
    if (!linesByCode.has(dl.lineCode)) {
      linesByCode.set(dl.lineCode, {
        lineCode: dl.lineCode,
        lineName: dl.lineName,
        stops: []
      });
    }
    linesByCode.get(dl.lineCode).stops.push({
      originalStopCode: dl.originalStopCode,
      originalStopName: dl.originalStopName,
      newStopCode: dl.isSkipped ? '（跳过）' : dl.newStopCode,
      newStopName: dl.isSkipped ? '今日跳过' : dl.newStopName,
      isSkipped: dl.isSkipped
    });
  }

  const driversByLineCode = new Map();
  for (const assignment of driverSchedule) {
    if (!driversByLineCode.has(assignment.lineCode)) {
      driversByLineCode.set(assignment.lineCode, []);
    }
    driversByLineCode.get(assignment.lineCode).push({
      driverName: assignment.driverName,
      driverPhone: assignment.driverPhone,
      licensePlate: assignment.licensePlate,
      shiftName: assignment.shiftName,
      startTime: assignment.startTime
    });
  }

  const studentsByLine = new Map();
  const allStudents = studentRepo.getAllStudents();
  const leaveStudentIds = new Set(leaves.map(l => l.studentId));

  for (const dl of diversionLines) {
    const key = `${dl.lineCode}-${dl.originalStopCode}`;
    for (const student of allStudents) {
      if (leaveStudentIds.has(student.id)) continue;

      const studentLines = studentRepo.getStudentLines(student.id);
      const assignment = studentLines.find(sl =>
        sl.lineId === dl.lineId && sl.stopId === dl.originalStopId
      );

      if (assignment) {
        if (!studentsByLine.has(dl.lineCode)) {
          studentsByLine.set(dl.lineCode, new Map());
        }
        if (!studentsByLine.get(dl.lineCode).has(dl.originalStopCode)) {
          studentsByLine.get(dl.lineCode).set(dl.originalStopCode, []);
        }

        const parents = studentRepo.getParentsByStudentId(student.id);
        studentsByLine.get(dl.lineCode).get(dl.originalStopCode).push({
          studentId: student.studentId,
          name: student.name,
          grade: student.grade,
          class: student.class,
          originalStopCode: dl.originalStopCode,
          originalStopName: dl.originalStopName,
          newStopCode: dl.isSkipped ? null : dl.newStopCode,
          newStopName: dl.isSkipped ? null : dl.newStopName,
          isSkipped: dl.isSkipped,
          parents: parents.map(p => ({
            name: p.name,
            phone: p.phone,
            relationship: p.relationship
          }))
        });
      }
    }
  }

  const lineSummaries = [];
  for (const [lineCode, stops] of linesByCode) {
    const lineStudents = studentsByLine.get(lineCode);
    const totalStudents = lineStudents ?
      Array.from(lineStudents.values()).reduce((sum, arr) => sum + arr.length, 0) : 0;

    lineSummaries.push({
      lineCode,
      lineName: stops.lineName,
      stops: stops.stops,
      drivers: driversByLineCode.get(lineCode) || [],
      totalStudents,
      students: lineStudents ? Object.fromEntries(lineStudents) : {}
    });
  }

  return {
    date,
    reason: diversionDetails.reason,
    diversionCreatedAt: diversionDetails.createdAt,
    lineSummaries,
    leaves,
    parentNotifications: notifications,
    summary: {
      totalLines: lineSummaries.length,
      totalStops: diversionLines.length,
      totalAffectedStudents: lineSummaries.reduce((sum, ls) => sum + ls.totalStudents, 0),
      totalLeaves: leaves.length,
      totalParentNotifications: notifications.length
    }
  };
}

function formatDriverNotification(driverNotif) {
  if (!driverNotif) return '';

  const { date, reason, driverNotifications } = driverNotif;
  let output = `\n========== 司机版通知 - ${date} ==========\n`;
  output += `改线原因：${reason}\n`;
  output += `共 ${driverNotifications.length} 名司机涉及改线\n\n`;

  for (const dn of driverNotifications) {
    output += `──────────\n`;
    output += `司机：${dn.driverName} (${dn.driverPhone})\n`;
    output += `车牌：${dn.licensePlate || '未知'}\n`;
    output += `线路：${dn.lineCode} - ${dn.lineName}\n`;
    output += `班次：${dn.shiftName} (${dn.startTime} - ${dn.endTime})\n`;
    output += `\n站点变更：\n`;

    for (const d of dn.diversions) {
      const action = d.isSkipped ? '→ 跳过' : `→ ${d.newStopName}`;
      output += `  - ${d.originalStopName} ${action}\n`;
    }

    if (dn.studentSummary.length > 0) {
      output += `\n受影响学生 (${dn.studentSummary.length}人)：\n`;
      for (const s of dn.studentSummary) {
        const status = s.isSkipped ? '【站点跳过】' : `→ ${s.newStopName}`;
        output += `  - ${s.name} (${s.grade}${s.class}) ${s.originalStopName} ${status}\n`;
      }
    }
    output += '\n';
  }

  return output;
}

function formatTeacherNotification(teacherNotif) {
  if (!teacherNotif) return '';

  const { date, reason, lineSummaries, leaves, summary } = teacherNotif;
  let output = `\n========== 值班老师版汇总 - ${date} ==========\n`;
  output += `改线原因：${reason}\n`;
  output += `\n【汇总统计】\n`;
  output += `  涉及线路：${summary.totalLines} 条\n`;
  output += `  站点变更：${summary.totalStops} 处\n`;
  output += `  受影响学生：${summary.totalAffectedStudents} 人\n`;
  output += `  今日请假：${summary.totalLeaves} 人\n`;
  output += `  家长通知：${summary.totalParentNotifications} 条\n`;

  output += `\n【线路详情】\n`;
  for (const ls of lineSummaries) {
    output += `\n────────── ${ls.lineCode} - ${ls.lineName} ──────────\n`;

    if (ls.drivers.length > 0) {
      output += `司机安排：\n`;
      for (const d of ls.drivers) {
        output += `  - ${d.driverName} (${d.driverPhone}) ${d.shiftName} ${d.startTime || ''}\n`;
      }
    }

    output += `\n站点变更：\n`;
    for (const stop of ls.stops) {
      const action = stop.isSkipped ? '→ 跳过' : `→ ${stop.newStopName}`;
      output += `  - ${stop.originalStopName} ${action}\n`;
    }

    output += `\n受影响学生 (${ls.totalStudents}人)：\n`;
    for (const [stopCode, students] of Object.entries(ls.students || {})) {
      for (const s of students) {
        const status = s.isSkipped ? '【站点跳过】' : `→ ${s.newStopName}`;
        const parentInfo = s.parents.length > 0
          ? ` [联系人: ${s.parents.map(p => `${p.name}(${p.relationship})-${p.phone}`).join(', ')}]`
          : '';
        output += `  - ${s.name} (${s.grade}${s.class}) ${s.originalStopName} ${status}${parentInfo}\n`;
      }
    }
  }

  if (leaves.length > 0) {
    output += `\n【今日请假】\n`;
    for (const leave of leaves) {
      output += `  - ${leave.studentName} (${leave.studentSchoolId}) ${leave.note || ''}\n`;
    }
  }

  return output;
}

function formatParentNotifications(date) {
  const diversion = diversionRepo.findDiversionByDate(date);
  if (!diversion) return '';

  const notifications = diversionRepo.getNotifications(diversion.id, 'parent');
  let output = `\n========== 家长版通知 - ${date} ==========\n`;
  output += `改线原因：${diversion.reason}\n`;
  output += `共 ${notifications.length} 条通知\n\n`;

  for (const n of notifications) {
    output += `【${n.parentName} (${n.parentPhone}) - ${n.studentName}】\n`;
    output += `${n.content}\n\n`;
  }

  return output;
}

module.exports = {
  generateParentContent,
  generateDriverNotification,
  generateTeacherNotification,
  formatDriverNotification,
  formatTeacherNotification,
  formatParentNotifications
};
