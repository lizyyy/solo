const fs = require('fs');
const path = require('path');
const diversionRepo = require('../storage/diversionRepository');
const notificationService = require('./notificationService');

function exportDiversionArchive(date, outputDir) {
  const diversion = diversionRepo.findDiversionByDate(date);
  if (!diversion) {
    return {
      success: false,
      error: `日期 ${date} 没有改线记录`
    };
  }

  const diversionLines = diversionRepo.getDiversionLines(diversion.id);
  const leaves = diversionRepo.getLeavesByDate(date);
  const notifications = diversionRepo.getNotifications(diversion.id);
  const driverNotif = notificationService.generateDriverNotification(date);
  const teacherNotif = notificationService.generateTeacherNotification(date);

  const archive = {
    date,
    diversion: {
      id: diversion.id,
      date: diversion.date,
      reason: diversion.reason,
      diversionType: diversion.diversionType,
      createdAt: diversion.createdAt
    },
    diversionLines: diversionLines.map(dl => ({
      lineCode: dl.lineCode,
      lineName: dl.lineName,
      originalStopCode: dl.originalStopCode,
      originalStopName: dl.originalStopName,
      newStopCode: dl.newStopCode,
      newStopName: dl.newStopName,
      isSkipped: dl.isSkipped
    })),
    leaves: leaves.map(l => ({
      studentId: l.studentSchoolId,
      studentName: l.studentName,
      leaveType: l.leaveType,
      note: l.note
    })),
    notifications: notifications.map(n => ({
      studentId: n.studentSchoolId,
      studentName: n.studentName,
      parentName: n.parentName,
      parentPhone: n.parentPhone,
      type: n.notificationType,
      content: n.content,
      status: n.status,
      createdAt: n.createdAt
    })),
    driverNotifications: driverNotif ? driverNotif.driverNotifications : [],
    teacherSummary: teacherNotif ? {
      totalLines: teacherNotif.summary.totalLines,
      totalStops: teacherNotif.summary.totalStops,
      totalAffectedStudents: teacherNotif.summary.totalAffectedStudents,
      totalLeaves: teacherNotif.summary.totalLeaves,
      totalParentNotifications: teacherNotif.summary.totalParentNotifications
    } : null,
    exportedAt: new Date().toISOString()
  };

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const jsonPath = path.join(outputDir, `diversion_${date}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(archive, null, 2), 'utf-8');

  const textPath = path.join(outputDir, `diversion_${date}.txt`);
  let textContent = `\n========================================\n`;
  textContent += `    校车临时改线存档 - ${date}\n`;
  textContent += `========================================\n\n`;

  textContent += `改线原因：${diversion.reason}\n`;
  textContent += `存档时间：${archive.exportedAt}\n\n`;

  textContent += `【站点变更详情】\n`;
  const linesByCode = new Map();
  for (const dl of archive.diversionLines) {
    if (!linesByCode.has(dl.lineCode)) {
      linesByCode.set(dl.lineCode, { name: dl.lineName, stops: [] });
    }
    linesByCode.get(dl.lineCode).stops.push(dl);
  }

  for (const [lineCode, info] of linesByCode) {
    textContent += `\n  线路：${lineCode} - ${info.name}\n`;
    for (const stop of info.stops) {
      const action = stop.isSkipped ? '→ 跳过' : `→ ${stop.newStopName}`;
      textContent += `    - ${stop.originalStopName} ${action}\n`;
    }
  }

  if (archive.leaves.length > 0) {
    textContent += `\n【今日请假】\n`;
    for (const leave of archive.leaves) {
      textContent += `  - ${leave.studentName} (${leave.studentId}) ${leave.note || ''}\n`;
    }
  }

  if (archive.notifications.length > 0) {
    textContent += `\n【通知记录】\n`;
    const parentNotifications = archive.notifications.filter(n => n.type === 'parent');
    textContent += `  家长通知：${parentNotifications.length} 条\n`;
    for (const n of parentNotifications) {
      textContent += `\n  收件人：${n.parentName} (${n.parentPhone})\n`;
      textContent += `  学生：${n.studentName}\n`;
      textContent += `  内容：${n.content}\n`;
    }
  }

  if (teacherNotif && teacherNotif.lineSummaries) {
    textContent += `\n【各线路学生汇总】\n`;
    for (const ls of teacherNotif.lineSummaries) {
      textContent += `\n  ${ls.lineCode} - ${ls.lineName} (${ls.totalStudents}人受影响)\n`;
      for (const [, students] of Object.entries(ls.students || {})) {
        for (const s of students) {
          const status = s.isSkipped ? '【站点跳过】' : `→ ${s.newStopName}`;
          const parents = s.parents && s.parents.length > 0
            ? s.parents.map(p => `${p.name}-${p.phone}`).join(', ')
            : '无联系方式';
          textContent += `    - ${s.name} (${s.grade}${s.class}) ${s.originalStopName} ${status} [${parents}]\n`;
        }
      }
    }
  }

  textContent += `\n========================================\n`;
  textContent += `    存档结束\n`;
  textContent += `========================================\n`;

  fs.writeFileSync(textPath, textContent, 'utf-8');

  return {
    success: true,
    jsonPath,
    textPath,
    summary: {
      diversionLines: archive.diversionLines.length,
      leaves: archive.leaves.length,
      notifications: archive.notifications.length
    }
  };
}

module.exports = {
  exportDiversionArchive
};
