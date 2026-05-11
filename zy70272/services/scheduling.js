const models = require('../models');
const dayjs = require('dayjs');

const { coaches, students, flightRequests } = models;

function getAvailableCoaches(date, timeSlot, studentLevel, weatherId) {
  const levelOrder = { beginner: 0, intermediate: 1, advanced: 2 };
  
  const available = coaches.filter(c => {
    const schedule = c.schedules.find(s => s.date === date && s.timeSlot === timeSlot);
    if (!schedule || !schedule.isAvailable) return false;
    
    if (levelOrder[c.level] < levelOrder[studentLevel]) {
      return false;
    }
    
    const hasConflict = flightRequests.some(fr => 
      fr.coachId === c.id && 
      fr.date === date && 
      fr.timeSlot === timeSlot &&
      ['pending_approval', 'approved', 'in_progress'].includes(fr.status)
    );
    
    return !hasConflict;
  });

  return {
    date,
    timeSlot,
    studentLevel,
    coaches: available,
    count: available.length
  };
}

function checkCoachAvailability(coachId, date, timeSlot) {
  const coach = coaches.find(c => c.id === coachId);
  if (!coach) {
    return { success: false, error: '教练不存在' };
  }

  const schedule = coach.schedules.find(s => s.date === date && s.timeSlot === timeSlot);
  if (!schedule) {
    return { 
      success: false, 
      error: '教练无此时段排班',
      needsReview: true 
    };
  }

  if (!schedule.isAvailable) {
    return {
      success: false,
      error: `教练不可用：${schedule.reason || '未知原因'}`,
      needsReview: schedule.reason === '培训' || schedule.reason === '休息'
    };
  }

  const hasConflict = flightRequests.some(fr => 
    fr.coachId === coachId && 
    fr.date === date && 
    fr.timeSlot === timeSlot &&
    ['pending_approval', 'approved', 'in_progress'].includes(fr.status)
  );

  if (hasConflict) {
    return {
      success: false,
      error: '该时段教练已有飞行安排',
      needsReview: true
    };
  }

  return {
    success: true,
    coach,
    schedule,
    details: '教练时段可用'
  };
}

function checkLevelCompatibility(coachId, studentId) {
  const coach = coaches.find(c => c.id === coachId);
  const student = students.find(s => s.id === studentId);

  if (!coach || !student) {
    return { success: false, error: '教练或学员不存在' };
  }

  const levelOrder = { beginner: 0, intermediate: 1, advanced: 2 };

  if (levelOrder[coach.level] < levelOrder[student.level]) {
    return {
      success: false,
      error: '教练等级不足，无法带教该学员',
      details: `教练${coach.name}等级：${coach.level}，学员${student.name}等级：${student.level}`,
      needsReview: student.level === 'advanced'
    };
  }

  if (student.totalFlights < 3 && coach.level !== 'advanced') {
    return {
      success: false,
      error: '新手学员必须由高级教练带教',
      details: `学员${student.name}仅${student.totalFlights}次飞行经验`,
      needsReview: true
    };
  }

  return {
    success: true,
    details: '教练学员等级匹配'
  };
}

function checkStudentRequirements(studentId) {
  const student = students.find(s => s.id === studentId);
  if (!student) {
    return { success: false, error: '学员不存在' };
  }

  const issues = [];
  const warnings = [];

  if (student.age < 16) {
    issues.push('学员年龄小于16岁，不适合滑翔伞运动');
  }

  const lastFlightDays = dayjs().diff(dayjs(student.lastFlightDate), 'day');
  if (lastFlightDays > 30) {
    warnings.push(`学员已${lastFlightDays}天未飞行，建议课前复习`);
  }

  if (student.totalFlights < 5) {
    warnings.push('学员飞行经验不足5次，需额外关注');
  }

  if (issues.length > 0) {
    return {
      success: false,
      error: '学员不符合基本要求',
      issues,
      needsReview: true
    };
  }

  return {
    success: true,
    warnings,
    details: '学员基本符合要求'
  };
}

module.exports = {
  getAvailableCoaches,
  checkCoachAvailability,
  checkLevelCompatibility,
  checkStudentRequirements
};
