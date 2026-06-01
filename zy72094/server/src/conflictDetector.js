const { parseTime, calculateOverlap, getDayOfWeek } = require('./timeUtils');

function validateData(courses, selections) {
  const errors = [];
  const warnings = [];
  const seenCourseIds = new Set();
  const seenSelectionIds = new Set();

  courses.forEach((course, index) => {
    if (!course.id || course.id.trim() === '') {
      errors.push({
        type: 'MISSING_COURSE_ID',
        message: `第 ${index + 1} 条课程记录缺少课程编号`,
        source: `courses[${index}]`,
        severity: 'high'
      });
    }

    if (!course.name || course.name.trim() === '') {
      warnings.push({
        type: 'EMPTY_COURSE_NAME',
        message: `课程 ${course.id || index + 1} 名称为空`,
        source: `courses[${index}].name`,
        severity: 'medium'
      });
    }

    if (course.credits === null || course.credits === undefined || course.credits === '') {
      warnings.push({
        type: 'NULL_CREDITS',
        message: `课程 ${course.name || course.id || index + 1} 学分为空`,
        source: `courses[${index}].credits`,
        severity: 'medium'
      });
    }

    if (course.id && seenCourseIds.has(course.id)) {
      warnings.push({
        type: 'DUPLICATE_COURSE',
        message: `发现重复课程编号: ${course.id}`,
        source: `courses[${index}].id`,
        severity: 'medium',
        duplicateId: course.id
      });
    }
    if (course.id) seenCourseIds.add(course.id);
  });

  selections.forEach((selection, index) => {
    if (!selection.studentId || selection.studentId === '') {
      errors.push({
        type: 'MISSING_STUDENT_ID',
        message: `第 ${index + 1} 条选课记录缺少学号`,
        source: `selections[${index}]`,
        severity: 'high'
      });
    }

    if (!selection.courseId || selection.courseId === '') {
      errors.push({
        type: 'MISSING_COURSE_ID_SELECTION',
        message: `第 ${index + 1} 条选课记录缺少课程编号`,
        source: `selections[${index}]`,
        severity: 'high'
      });
    }

    if (selection.id && seenSelectionIds.has(selection.id)) {
      warnings.push({
        type: 'DUPLICATE_SELECTION',
        message: `发现重复选课记录: ${selection.id}`,
        source: `selections[${index}].id`,
        severity: 'medium'
      });
    }
    if (selection.id) seenSelectionIds.add(selection.id);
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats: {
      totalCourses: courses.length,
      totalSelections: selections.length,
      uniqueStudents: new Set(selections.filter(s => s.studentId).map(s => s.studentId)).size,
      uniqueCourses: seenCourseIds.size
    }
  };
}

function calculateConflictSeverity(type, impact) {
  const severityWeights = {
    TIME_CONFLICT: 10,
    CREDIT_OVERLOAD: 8,
    CREDIT_UNDERLOAD: 3,
    DUPLICATE_SELECTION: 6,
    COURSE_CAPACITY_EXCEEDED: 7,
    COURSE_RATIO_HIGH: 4,
    DAILY_LIMIT_EXCEEDED: 5
  };

  const weight = severityWeights[type] || 5;
  
  if (weight >= 8) return 'high';
  if (weight >= 5) return 'medium';
  return 'low';
}

function detectConflicts(courses, selections, params, filterOptions = {}) {
  const conflicts = [];
  const trace = [];
  const courseMap = new Map();
  const studentSelections = new Map();

  let traceStep = 1;
  trace.push({
    step: traceStep++,
    action: '数据加载',
    detail: `加载 ${courses.length} 门课程，${selections.length} 条选课记录`,
    timestamp: new Date().toISOString()
  });

  courses.forEach(course => {
    if (course.id) {
      courseMap.set(course.id, {
        ...course,
        parsedTime: parseTime(course.time)
      });
    }
  });

  trace.push({
    step: traceStep++,
    action: '课程数据处理',
    detail: `成功解析 ${courseMap.size} 门课程的时间信息`,
    timestamp: new Date().toISOString()
  });

  selections.forEach(selection => {
    if (!selection.studentId) return;
    if (!studentSelections.has(selection.studentId)) {
      studentSelections.set(selection.studentId, []);
    }
    studentSelections.get(selection.studentId).push({
      ...selection,
      course: courseMap.get(selection.courseId)
    });
  });

  trace.push({
    step: traceStep++,
    action: '学生选课分组',
    detail: `共 ${studentSelections.size} 名学生有选课记录`,
    timestamp: new Date().toISOString()
  });

  trace.push({
    step: traceStep++,
    action: '参数加载',
    detail: `使用参数：最大学分 ${params.maxCreditsPerSemester.value}${params.maxCreditsPerSemester.unit}，最小学分 ${params.minCreditsPerSemester.value}${params.minCreditsPerSemester.unit}，单日选课上限 ${params.maxCoursesPerDay.value}${params.maxCoursesPerDay.unit}`,
    timestamp: new Date().toISOString()
  });

  trace.push({
    step: traceStep++,
    action: '筛选条件应用',
    detail: filterOptions.studentId 
      ? `筛选学生: ${filterOptions.studentId}` 
      : filterOptions.conflictType
        ? `筛选冲突类型: ${filterOptions.conflictType}`
        : '无筛选条件',
    timestamp: new Date().toISOString()
  });

  for (const [studentId, studentCourses] of studentSelections) {
    if (filterOptions.studentId && filterOptions.studentId !== studentId) continue;

    let totalCredits = 0;
    const dailyCourseCount = {};
    const courseSelectionCount = {};

    studentCourses.forEach(sc => {
      if (sc.course && sc.course.credits) {
        totalCredits += Number(sc.course.credits) || 0;
      }
      
      if (sc.course && sc.course.parsedTime) {
        sc.course.parsedTime.forEach(timeSlot => {
          const dayKey = timeSlot.day;
          if (!dailyCourseCount[dayKey]) dailyCourseCount[dayKey] = 0;
          dailyCourseCount[dayKey]++;
        });
      }

      if (sc.courseId) {
        if (!courseSelectionCount[sc.courseId]) courseSelectionCount[sc.courseId] = 0;
        courseSelectionCount[sc.courseId]++;
      }
    });

    if (totalCredits > params.maxCreditsPerSemester.value) {
      if (!filterOptions.conflictType || filterOptions.conflictType === 'CREDIT_OVERLOAD') {
        conflicts.push({
          id: `CREDIT_OVERLOAD_${studentId}`,
          type: 'CREDIT_OVERLOAD',
          studentId,
          severity: calculateConflictSeverity('CREDIT_OVERLOAD'),
          title: '学分超量',
          reason: `学生 ${studentId} 本学期已选 ${totalCredits} 学分，超过上限 ${params.maxCreditsPerSemester.value}${params.maxCreditsPerSemester.unit}`,
          formula: `${totalCredits} ${params.maxCreditsPerSemester.unit} > ${params.maxCreditsPerSemester.value} ${params.maxCreditsPerSemester.unit}`,
          formulaDetail: params.maxCreditsPerSemester.formula,
          value: totalCredits,
          threshold: params.maxCreditsPerSemester.value,
          unit: params.maxCreditsPerSemester.unit,
          source: params.maxCreditsPerSemester.source,
          affectedCourses: studentCourses.map(sc => sc.courseId),
          traceId: traceStep
        });
        trace.push({
          step: traceStep++,
          action: '检测学分超量',
          detail: `学生 ${studentId}: ${totalCredits} > ${params.maxCreditsPerSemester.value}`,
          timestamp: new Date().toISOString()
        });
      }
    }

    if (totalCredits > 0 && totalCredits < params.minCreditsPerSemester.value) {
      if (!filterOptions.conflictType || filterOptions.conflictType === 'CREDIT_UNDERLOAD') {
        conflicts.push({
          id: `CREDIT_UNDERLOAD_${studentId}`,
          type: 'CREDIT_UNDERLOAD',
          studentId,
          severity: calculateConflictSeverity('CREDIT_UNDERLOAD'),
          title: '学分不足',
          reason: `学生 ${studentId} 本学期仅选 ${totalCredits} 学分，低于建议下限 ${params.minCreditsPerSemester.value}${params.minCreditsPerSemester.unit}`,
          formula: `${totalCredits} ${params.minCreditsPerSemester.unit} < ${params.minCreditsPerSemester.value} ${params.minCreditsPerSemester.unit}`,
          formulaDetail: params.minCreditsPerSemester.formula,
          value: totalCredits,
          threshold: params.minCreditsPerSemester.value,
          unit: params.minCreditsPerSemester.unit,
          source: params.minCreditsPerSemester.source,
          affectedCourses: studentCourses.map(sc => sc.courseId),
          traceId: traceStep
        });
        trace.push({
          step: traceStep++,
          action: '检测学分不足',
          detail: `学生 ${studentId}: ${totalCredits} < ${params.minCreditsPerSemester.value}`,
          timestamp: new Date().toISOString()
        });
      }
    }

    for (const [day, count] of Object.entries(dailyCourseCount)) {
      if (count > params.maxCoursesPerDay.value) {
        if (!filterOptions.conflictType || filterOptions.conflictType === 'DAILY_LIMIT_EXCEEDED') {
          conflicts.push({
            id: `DAILY_LIMIT_${studentId}_${day}`,
            type: 'DAILY_LIMIT_EXCEEDED',
            studentId,
            severity: calculateConflictSeverity('DAILY_LIMIT_EXCEEDED'),
            title: '单日选课超限',
            reason: `学生 ${studentId} ${day} 已选 ${count} 门课，超过单日上限 ${params.maxCoursesPerDay.value}${params.maxCoursesPerDay.unit}`,
            formula: `${count} ${params.maxCoursesPerDay.unit} > ${params.maxCoursesPerDay.value} ${params.maxCoursesPerDay.unit}`,
            formulaDetail: params.maxCoursesPerDay.formula,
            value: count,
            threshold: params.maxCoursesPerDay.value,
            unit: params.maxCoursesPerDay.unit,
            source: params.maxCoursesPerDay.source,
            day,
            traceId: traceStep
          });
          trace.push({
            step: traceStep++,
            action: '检测单日选课超限',
            detail: `学生 ${studentId} ${day}: ${count} > ${params.maxCoursesPerDay.value}`,
            timestamp: new Date().toISOString()
          });
        }
      }
    }

    for (const [courseId, count] of Object.entries(courseSelectionCount)) {
      if (count > params.sameTeacherLimit.value) {
        if (!filterOptions.conflictType || filterOptions.conflictType === 'DUPLICATE_SELECTION') {
          const course = courseMap.get(courseId);
          conflicts.push({
            id: `DUPLICATE_${studentId}_${courseId}`,
            type: 'DUPLICATE_SELECTION',
            studentId,
            severity: calculateConflictSeverity('DUPLICATE_SELECTION'),
            title: '重复选课',
            reason: `学生 ${studentId} 重复选择课程 ${course?.name || courseId} 共 ${count} 次`,
            formula: `${count} ${params.sameTeacherLimit.unit} > ${params.sameTeacherLimit.value} ${params.sameTeacherLimit.unit}`,
            formulaDetail: params.sameTeacherLimit.formula,
            value: count,
            threshold: params.sameTeacherLimit.value,
            unit: params.sameTeacherLimit.unit,
            source: params.sameTeacherLimit.source,
            courseId,
            courseName: course?.name,
            traceId: traceStep
          });
          trace.push({
            step: traceStep++,
            action: '检测重复选课',
            detail: `学生 ${studentId} 课程 ${courseId}: ${count} > ${params.sameTeacherLimit.value}`,
            timestamp: new Date().toISOString()
          });
        }
      }
    }

    const validCourses = studentCourses.filter(sc => sc.course && sc.course.parsedTime);
    for (let i = 0; i < validCourses.length; i++) {
      for (let j = i + 1; j < validCourses.length; j++) {
        const course1 = validCourses[i];
        const course2 = validCourses[j];
        
        const overlap = calculateOverlap(
          course1.course.parsedTime,
          course2.course.parsedTime
        );

        if (overlap.minutes > params.timeConflictTolerance.value) {
          if (!filterOptions.conflictType || filterOptions.conflictType === 'TIME_CONFLICT') {
            conflicts.push({
              id: `TIME_${studentId}_${course1.courseId}_${course2.courseId}`,
              type: 'TIME_CONFLICT',
              studentId,
              severity: calculateConflictSeverity('TIME_CONFLICT'),
              title: '时间冲突',
              reason: `学生 ${studentId} 的课程 ${course1.course.name} 与 ${course2.course.name} 时间重叠 ${overlap.minutes}${params.timeConflictTolerance.unit}`,
              formula: `${overlap.minutes} ${params.timeConflictTolerance.unit} > ${params.timeConflictTolerance.value} ${params.timeConflictTolerance.unit}`,
              formulaDetail: params.timeConflictTolerance.formula,
              value: overlap.minutes,
              threshold: params.timeConflictTolerance.value,
              unit: params.timeConflictTolerance.unit,
              source: params.timeConflictTolerance.source,
              overlapDetails: overlap.details,
              affectedCourses: [course1.courseId, course2.courseId],
              courseNames: [course1.course.name, course2.course.name],
              traceId: traceStep
            });
            trace.push({
              step: traceStep++,
              action: '检测时间冲突',
              detail: `学生 ${studentId}: ${course1.course.name} vs ${course2.course.name}, 重叠 ${overlap.minutes} 分钟`,
              timestamp: new Date().toISOString()
            });
          }
        }
      }
    }
  }

  for (const [courseId, course] of courseMap) {
    if (course.capacity && course.enrolled) {
      const ratio = course.enrolled / course.capacity;
      
      if (course.enrolled > course.capacity) {
        if (!filterOptions.conflictType || filterOptions.conflictType === 'COURSE_CAPACITY_EXCEEDED') {
          conflicts.push({
            id: `CAPACITY_${courseId}`,
            type: 'COURSE_CAPACITY_EXCEEDED',
            courseId,
            severity: calculateConflictSeverity('COURSE_CAPACITY_EXCEEDED'),
            title: '课程容量超限',
            reason: `课程 ${course.name} 已选 ${course.enrolled} 人，超过容量 ${course.capacity} 人`,
            formula: `${course.enrolled} > ${course.capacity}`,
            formulaDetail: '已选人数 > 课程容量',
            value: course.enrolled,
            threshold: course.capacity,
            unit: '人',
            source: '课程设置',
            courseName: course.name,
            traceId: traceStep
          });
          trace.push({
            step: traceStep++,
            action: '检测课程容量超限',
            detail: `课程 ${course.name}: ${course.enrolled} > ${course.capacity}`,
            timestamp: new Date().toISOString()
          });
        }
      } else if (ratio > params.maxConcurrentEnrollmentRatio.value) {
        if (!filterOptions.conflictType || filterOptions.conflictType === 'COURSE_RATIO_HIGH') {
          conflicts.push({
            id: `RATIO_${courseId}`,
            type: 'COURSE_RATIO_HIGH',
            courseId,
            severity: calculateConflictSeverity('COURSE_RATIO_HIGH'),
            title: '选课率预警',
            reason: `课程 ${course.name} 选课率达到 ${(ratio * 100).toFixed(1)}%，超过预警阈值 ${(params.maxConcurrentEnrollmentRatio.value * 100).toFixed(0)}%`,
            formula: `${course.enrolled} / ${course.capacity} = ${(ratio * 100).toFixed(1)}% > ${(params.maxConcurrentEnrollmentRatio.value * 100).toFixed(0)}%`,
            formulaDetail: params.maxConcurrentEnrollmentRatio.formula,
            value: ratio,
            threshold: params.maxConcurrentEnrollmentRatio.value,
            unit: '%',
            source: params.maxConcurrentEnrollmentRatio.source,
            courseName: course.name,
            traceId: traceStep
          });
          trace.push({
            step: traceStep++,
            action: '检测选课率预警',
            detail: `课程 ${course.name}: ${(ratio * 100).toFixed(1)}% > ${(params.maxConcurrentEnrollmentRatio.value * 100).toFixed(0)}%`,
            timestamp: new Date().toISOString()
          });
        }
      }
    }
  }

  trace.push({
    step: traceStep++,
    action: '冲突检测完成',
    detail: `共检测到 ${conflicts.length} 个冲突`,
    timestamp: new Date().toISOString()
  });

  const statistics = {
    totalConflicts: conflicts.length,
    bySeverity: {
      high: conflicts.filter(c => c.severity === 'high').length,
      medium: conflicts.filter(c => c.severity === 'medium').length,
      low: conflicts.filter(c => c.severity === 'low').length
    },
    byType: {},
    byStudent: {}
  };

  conflicts.forEach(c => {
    statistics.byType[c.type] = (statistics.byType[c.type] || 0) + 1;
    if (c.studentId) {
      statistics.byStudent[c.studentId] = (statistics.byStudent[c.studentId] || 0) + 1;
    }
  });

  return {
    conflicts,
    statistics,
    trace
  };
}

module.exports = {
  validateData,
  detectConflicts,
  calculateConflictSeverity
};
