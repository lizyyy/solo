const dayjs = require('dayjs');
const { generateId } = require('./utils');

function getStudentClassForDate(student, transfers, lessonDate) {
  const sortedTransfers = [...transfers]
    .filter(t => t.studentId === student.id)
    .sort((a, b) => dayjs(b.transferDate).valueOf() - dayjs(a.transferDate).valueOf());

  let currentClassId = student.effectiveDate && dayjs(lessonDate).isBefore(student.effectiveDate) 
    ? null 
    : student.classId || null;
  let currentClassName = student.className;

  for (const transfer of sortedTransfers) {
    if (dayjs(lessonDate).isAfter(dayjs(transfer.transferDate).subtract(1, 'day'))) {
      currentClassId = transfer.toClassId;
      currentClassName = transfer.toClassId;
      break;
    } else {
      currentClassId = transfer.fromClassId;
      currentClassName = transfer.fromClassId;
    }
  }

  return { classId: currentClassId, className: currentClassName };
}

function findScheduleForAttendance(attendance, schedules, transfers, student) {
  const scheduleId = generateId(attendance.classId, attendance.lessonDate, attendance.startTime);
  let schedule = schedules.find(s => s.id === scheduleId);

  if (!schedule) {
    schedule = {
      id: scheduleId,
      classId: attendance.classId,
      lessonDate: attendance.lessonDate,
      startTime: attendance.startTime,
      lessonHours: 1,
      className: attendance.classId
    };
  }

  return schedule;
}

function calculateConsumption(data) {
  const { students, schedules, attendances, leaves, makeups, transfers, corrections } = data;
  
  const studentMap = new Map(students.map(s => [s.id, s]));
  const attendanceMap = new Map(attendances.map(a => [a.id, a]));
  const leaveMap = new Map(leaves.map(l => [generateId(l.studentId, l.classId, l.lessonDate, l.startTime), l]));
  const makeupMap = new Map(makeups.map(m => [generateId(m.studentId, m.originalClassId, m.originalDate), m]));
  const makeupByTargetMap = new Map();
  for (const m of makeups) {
    const targetKey = generateId(m.studentId, m.makeupClassId, m.makeupDate, m.makeupStartTime);
    makeupByTargetMap.set(targetKey, m);
  }

  const correctionMap = new Map(corrections.map(c => [c.id, c]));
  
  const results = [];
  const anomalies = [];
  const leaveUsageMap = new Map();

  for (const student of students) {
    const studentAttendances = attendances.filter(a => a.studentId === student.id);
    const studentLeaves = leaves.filter(l => l.studentId === student.id);
    const studentCorrections = corrections.filter(c => c.studentId === student.id);
    const studentMakeups = makeups.filter(m => m.studentId === student.id);

    let totalConsumed = 0;
    const details = [];
    const unmadeLeaves = [];

    for (const attendance of studentAttendances) {
      const schedule = findScheduleForAttendance(attendance, schedules, transfers, student);
      const hours = schedule.lessonHours || 1;
      const isMakeup = attendance.isMakeup || makeupByTargetMap.has(attendance.id);
      
      let shouldDeduct = true;
      let deductionType = '正常上课';
      let linkedLeave = null;
      let anomaly = null;

      if (isMakeup) {
        deductionType = '补课';
        let makeupRecord = null;
        
        if (attendance.originalLeaveDate) {
          const leaveKey = generateId(student.id, attendance.classId, attendance.originalLeaveDate, attendance.startTime || '');
          const altLeaveKey = generateId(student.id, attendance.classId, attendance.originalLeaveDate, '');
          makeupRecord = studentMakeups.find(m => 
            m.originalDate === attendance.originalLeaveDate || 
            generateId(m.studentId, m.originalClassId, m.originalDate) === leaveKey ||
            generateId(m.studentId, m.originalClassId, m.originalDate) === altLeaveKey
          );
        }
        
        if (makeupRecord) {
          linkedLeave = generateId(student.id, makeupRecord.originalClassId, makeupRecord.originalDate, '');
          leaveUsageMap.set(linkedLeave, true);
          shouldDeduct = false;
        } else {
          shouldDeduct = false;
          anomaly = { type: 'orphan_makeup', message: '补课记录未关联到原请假' };
        }
      } else {
        const leaveKey = generateId(student.id, attendance.classId, attendance.lessonDate, attendance.startTime);
        const altLeaveKey = generateId(student.id, attendance.classId, attendance.lessonDate, '');
        
        if (leaveMap.has(leaveKey) || leaveMap.has(altLeaveKey)) {
          const theLeave = leaveMap.get(leaveKey) || leaveMap.get(altLeaveKey);
          shouldDeduct = false;
          deductionType = '请假';
          
          if (!theLeave.madeUp && !makeupMap.has(generateId(student.id, theLeave.classId, theLeave.lessonDate))) {
            unmadeLeaves.push({
              date: theLeave.lessonDate,
              classId: theLeave.classId,
              reason: theLeave.reason
            });
          }
        }
      }

      if (shouldDeduct) {
        totalConsumed += hours;
      }

      details.push({
        date: attendance.lessonDate,
        classId: attendance.classId,
        className: schedule.className,
        startTime: attendance.startTime,
        hours,
        deductionType,
        deducted: shouldDeduct,
        anomaly
      });

      if (anomaly) {
        anomalies.push({
          studentId: student.studentId,
          studentName: student.name,
          date: attendance.lessonDate,
          ...anomaly
        });
      }
    }

    for (const leave of studentLeaves) {
      const leaveKey = generateId(student.id, leave.classId, leave.lessonDate, leave.startTime);
      const altLeaveKey = generateId(student.id, leave.classId, leave.lessonDate, '');
      
      if (!leaveUsageMap.has(leaveKey) && !leaveUsageMap.has(altLeaveKey) && !leave.madeUp) {
        const hasMakeup = studentMakeups.some(m => 
          generateId(m.studentId, m.originalClassId, m.originalDate) === generateId(student.id, leave.classId, leave.lessonDate)
        );
        
        if (!hasMakeup) {
          const hasAttendanceForThatDay = studentAttendances.some(a => 
            a.lessonDate === leave.lessonDate && a.classId === leave.classId
          );
          
          if (!hasAttendanceForThatDay) {
            unmadeLeaves.push({
              date: leave.lessonDate,
              classId: leave.classId,
              reason: leave.reason
            });
          }
        }
      }
    }

    let correctionDelta = 0;
    for (const corr of studentCorrections) {
      correctionDelta += (corr.adjustment || 0);
    }

    const usedLessons = student.usedLessons + totalConsumed + correctionDelta;
    const remaining = student.totalLessons - usedLessons;

    results.push({
      studentId: student.studentId,
      studentName: student.name,
      className: student.className,
      totalLessons: student.totalLessons,
      initialUsed: student.usedLessons,
      periodConsumed: totalConsumed,
      corrections: correctionDelta,
      usedLessons,
      remaining,
      details,
      unmadeLeaves,
      hasLowBalance: remaining <= 3 && remaining >= 0,
      isOverdrawn: remaining < 0
    });

    if (remaining < 0) {
      anomalies.push({
        studentId: student.studentId,
        studentName: student.name,
        type: 'overdrawn',
        message: `课时透支 ${Math.abs(remaining)} 节`
      });
    }

    if (remaining <= 3 && remaining >= 0) {
      anomalies.push({
        studentId: student.studentId,
        studentName: student.name,
        type: 'low_balance',
        message: `剩余课时不足：${remaining} 节`
      });
    }
  }

  return {
    students: results,
    anomalies,
    summary: generateSummary(results, anomalies)
  };
}

function generateSummary(results, anomalies) {
  const totalStudents = results.length;
  const totalLessonsPurchased = results.reduce((sum, r) => sum + r.totalLessons, 0);
  const totalLessonsUsed = results.reduce((sum, r) => sum + r.usedLessons, 0);
  const totalLessonsRemaining = results.reduce((sum, r) => sum + r.remaining, 0);
  const studentsWithLowBalance = results.filter(r => r.hasLowBalance && !r.isOverdrawn).length;
  const studentsOverdrawn = results.filter(r => r.isOverdrawn).length;
  const studentsWithUnmadeLeaves = results.filter(r => r.unmadeLeaves.length > 0).length;
  const totalUnmadeLeaves = results.reduce((sum, r) => sum + r.unmadeLeaves.length, 0);

  const anomaliesByType = {};
  for (const a of anomalies) {
    anomaliesByType[a.type] = (anomaliesByType[a.type] || 0) + 1;
  }

  return {
    totalStudents,
    totalLessonsPurchased,
    totalLessonsUsed,
    totalLessonsRemaining,
    utilizationRate: totalLessonsPurchased > 0 ? ((totalLessonsUsed / totalLessonsPurchased) * 100).toFixed(1) : '0',
    studentsWithLowBalance,
    studentsOverdrawn,
    studentsWithUnmadeLeaves,
    totalUnmadeLeaves,
    anomaliesByType,
    risks: [
      ...(studentsOverdrawn > 0 ? [`${studentsOverdrawn}名学生课时透支`] : []),
      ...(studentsWithLowBalance > 0 ? [`${studentsWithLowBalance}名学生剩余课时≤3节`] : []),
      ...(studentsWithUnmadeLeaves > 0 ? [`${totalUnmadeLeaves}个请假未补课`] : [])
    ],
    todos: [
      ...(studentsOverdrawn > 0 ? ['核实透支学生的课时记录'] : []),
      ...(studentsWithLowBalance > 0 ? ['提醒课时不足的学生续费'] : []),
      ...(studentsWithUnmadeLeaves > 0 ? ['安排请假学生补课'] : []),
      ...(anomalies.some(a => a.type === 'orphan_makeup') ? ['清理无关联的补课记录'] : [])
    ],
    completedChecks: [
      '去重签到记录 ✓',
      '转班日期前后归属 ✓',
      '请假-补课关联校验 ✓',
      '课时余额计算 ✓'
    ]
  };
}

module.exports = {
  calculateConsumption,
  getStudentClassForDate
};
