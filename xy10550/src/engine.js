'use strict';

const utils = require('./utils');
const storage = require('./storage');

const SEVERITY = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
};

function isNightShift(shiftType, config) {
  const shift = config.shiftTypes?.[shiftType];
  return shift?.isNight === true;
}

function sortDates(dates) {
  return [...dates].sort((a, b) => 
    utils.parseDate(a) - utils.parseDate(b)
  );
}

function getAgentSchedulesByDate(agentId, schedules) {
  const result = {};
  for (const s of schedules) {
    if (s.agentId === agentId) {
      result[s.date] = s;
    }
  }
  return result;
}

function getAgentsWithSkill(skillId, agents) {
  return agents.filter(a => 
    Array.isArray(a.skills) && a.skills.includes(skillId)
  );
}

function isOnLeave(agentId, date, leaves) {
  const d = utils.parseDate(date);
  return leaves.some(l => {
    if (l.agentId !== agentId) return false;
    const start = utils.parseDate(l.startDate);
    const end = utils.parseDate(l.endDate);
    return d >= start && d <= end;
  });
}

function isHoliday(date, holidays) {
  return holidays.some(h => h.date === date);
}

function isLocked(agentId, date, shiftType, locks) {
  return locks.some(l => 
    l.agentId === agentId && 
    l.date === date && 
    l.shiftType === shiftType
  );
}

function checkConsecutiveNightShifts(agentId, schedules, config) {
  const conflicts = [];
  const maxConsecutive = config.rules.maxConsecutiveNightShifts || 2;
  
  const agentSchedules = schedules
    .filter(s => s.agentId === agentId)
    .sort((a, b) => utils.parseDate(a.date) - utils.parseDate(b.date));
  
  let consecutiveNights = 0;
  let nightSequence = [];
  
  for (let i = 0; i < agentSchedules.length; i++) {
    const s = agentSchedules[i];
    if (isNightShift(s.shiftType, config)) {
      if (nightSequence.length === 0) {
        nightSequence = [s];
        consecutiveNights = 1;
      } else {
        const prevDate = utils.parseDate(nightSequence[nightSequence.length - 1].date);
        const currDate = utils.parseDate(s.date);
        const diffDays = Math.round((currDate - prevDate) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) {
          nightSequence.push(s);
          consecutiveNights++;
          
          if (consecutiveNights > maxConsecutive) {
            conflicts.push({
              type: 'consecutive_night_shifts',
              severity: SEVERITY.HIGH,
              agentId,
              dates: nightSequence.slice(-(maxConsecutive + 1)).map(x => x.date),
              shiftType: 'night',
              message: `连续 ${consecutiveNights} 个夜班，超过限制 ${maxConsecutive}`,
              affectedSchedules: nightSequence.slice(-(maxConsecutive + 1)).map(x => x.id)
            });
          }
        } else {
          nightSequence = [s];
          consecutiveNights = 1;
        }
      }
    } else {
      nightSequence = [];
      consecutiveNights = 0;
    }
  }
  
  return conflicts;
}

function checkConsecutiveWorkDays(agentId, schedules, config) {
  const conflicts = [];
  const maxConsecutive = config.rules.maxConsecutiveWorkDays || 6;
  
  const scheduleDates = new Set(
    schedules.filter(s => s.agentId === agentId).map(s => s.date)
  );
  
  const sortedDates = sortDates([...scheduleDates]);
  
  let consecutiveDays = 0;
  let workSequence = [];
  
  for (let i = 0; i < sortedDates.length; i++) {
    const currDate = sortedDates[i];
    if (workSequence.length === 0) {
      workSequence = [currDate];
      consecutiveDays = 1;
    } else {
      const prevDate = utils.parseDate(workSequence[workSequence.length - 1]);
      const curr = utils.parseDate(currDate);
      const diffDays = Math.round((curr - prevDate) / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        workSequence.push(currDate);
        consecutiveDays++;
        
        if (consecutiveDays > maxConsecutive) {
          conflicts.push({
            type: 'consecutive_work_days',
            severity: SEVERITY.MEDIUM,
            agentId,
            dates: workSequence.slice(-(maxConsecutive + 1)),
            message: `连续 ${consecutiveDays} 个工作日，超过限制 ${maxConsecutive}`,
            affectedSchedules: schedules
              .filter(s => s.agentId === agentId && workSequence.slice(-(maxConsecutive + 1)).includes(s.date))
              .map(s => s.id)
          });
        }
      } else {
        workSequence = [currDate];
        consecutiveDays = 1;
      }
    }
  }
  
  return conflicts;
}

function checkLeaveConflicts(schedules, leaves, config) {
  const conflicts = [];
  
  for (const s of schedules) {
    if (isOnLeave(s.agentId, s.date, leaves)) {
      const matchingLeave = leaves.find(l => {
        const d = utils.parseDate(s.date);
        const start = utils.parseDate(l.startDate);
        const end = utils.parseDate(l.endDate);
        return l.agentId === s.agentId && d >= start && d <= end;
      });
      
      conflicts.push({
        type: 'leave_conflict',
        severity: SEVERITY.CRITICAL,
        agentId: s.agentId,
        date: s.date,
        scheduleId: s.id,
        leaveId: matchingLeave?.id,
        message: `${s.date} 排了班，但该日期在请假范围内`,
        affectedSchedules: [s.id]
      });
    }
  }
  
  return conflicts;
}

function checkSkillCoverage(schedules, agents, skills, config) {
  const conflicts = [];
  
  if (!config.rules.requireSkillCoverage) return conflicts;
  
  const dates = [...new Set(schedules.map(s => s.date))];
  const shiftTypes = Object.keys(config.shiftTypes || {});
  const minAgents = config.rules.minAgentsPerSkillPerShift || 1;
  
  for (const skill of skills) {
    if (!skill.requiresMinCoverage) continue;
    
    const skilledAgents = new Set(getAgentsWithSkill(skill.id, agents).map(a => a.id));
    
    for (const date of dates) {
      for (const shiftType of shiftTypes) {
        const scheduledOnShift = schedules.filter(s => 
          s.date === date && 
          s.shiftType === shiftType &&
          skilledAgents.has(s.agentId)
        );
        
        if (scheduledOnShift.length < minAgents) {
          conflicts.push({
            type: 'skill_gap',
            severity: SEVERITY.HIGH,
            skillId: skill.id,
            skillName: skill.name,
            date,
            shiftType,
            scheduled: scheduledOnShift.length,
            required: minAgents,
            message: `${date} ${shiftType} 班次，${skill.name} 技能组仅 ${scheduledOnShift.length} 人，需要至少 ${minAgents} 人`,
            missing: minAgents - scheduledOnShift.length
          });
        }
      }
    }
  }
  
  return conflicts;
}

function checkHolidayRotation(schedules, agents, holidays, config) {
  const conflicts = [];
  
  const holidayDates = holidays
    .filter(h => h.requiresCoverage !== false)
    .map(h => h.date);
  
  if (holidayDates.length === 0) return conflicts;
  
  const agentHolidayShifts = {};
  for (const a of agents) {
    agentHolidayShifts[a.id] = 0;
  }
  
  for (const s of schedules) {
    if (holidayDates.includes(s.date)) {
      agentHolidayShifts[s.agentId] = (agentHolidayShifts[s.agentId] || 0) + 1;
    }
  }
  
  const counts = Object.values(agentHolidayShifts).filter(c => c > 0);
  if (counts.length === 0) return conflicts;
  
  const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
  
  for (const [agentId, count] of Object.entries(agentHolidayShifts)) {
    if (count === 0 && Object.keys(agentHolidayShifts).length > 1) {
      const hasAgentsWithShifts = counts.some(c => c > 0);
      if (hasAgentsWithShifts) {
        conflicts.push({
          type: 'holiday_uneven',
          severity: SEVERITY.LOW,
          agentId,
          holidayShifts: 0,
          average: avg.toFixed(1),
          message: `该员工没有节假日班次，平均值为 ${avg.toFixed(1)}`
        });
      }
    } else if (count > avg + 2) {
      conflicts.push({
        type: 'holiday_uneven',
        severity: SEVERITY.MEDIUM,
        agentId,
        holidayShifts: count,
        average: avg.toFixed(1),
        message: `该员工节假日班次 ${count} 次，高于平均值 ${avg.toFixed(1)}`
      });
    }
  }
  
  return conflicts;
}

function checkLockCompliance(schedules, locks) {
  const conflicts = [];
  
  for (const lock of locks) {
    const matching = schedules.find(s =>
      s.agentId === lock.agentId &&
      s.date === lock.date &&
      s.shiftType === lock.shiftType
    );
    
    if (!matching) {
      conflicts.push({
        type: 'lock_violation',
        severity: SEVERITY.CRITICAL,
        agentId: lock.agentId,
        date: lock.date,
        shiftType: lock.shiftType,
        lockId: lock.id,
        message: `${lock.date} ${lock.shiftType} 是锁定班次，但排班表中未匹配`
      });
    }
  }
  
  return conflicts;
}

function checkNightShiftDistribution(schedules, agents, config) {
  const conflicts = [];
  const maxNightShifts = config.rules.maxNightShiftsPerPerson || 8;
  
  const nightShiftCounts = {};
  for (const a of agents) {
    nightShiftCounts[a.id] = 0;
  }
  
  for (const s of schedules) {
    if (isNightShift(s.shiftType, config)) {
      nightShiftCounts[s.agentId] = (nightShiftCounts[s.agentId] || 0) + 1;
    }
  }
  
  const counts = Object.values(nightShiftCounts).filter(c => c > 0);
  const avg = counts.length > 0 
    ? counts.reduce((a, b) => a + b, 0) / counts.length 
    : 0;
  
  for (const [agentId, count] of Object.entries(nightShiftCounts)) {
    if (count > maxNightShifts) {
      conflicts.push({
        type: 'night_shift_over_limit',
        severity: SEVERITY.HIGH,
        agentId,
        nightShifts: count,
        limit: maxNightShifts,
        message: `夜班 ${count} 次，超过限制 ${maxNightShifts}`
      });
    }
    
    if (count > 0 && count > avg + 2 && avg > 0) {
      conflicts.push({
        type: 'night_shift_uneven',
        severity: SEVERITY.MEDIUM,
        agentId,
        nightShifts: count,
        average: avg.toFixed(1),
        message: `夜班 ${count} 次，高于平均值 ${avg.toFixed(1)}`
      });
    }
  }
  
  return conflicts;
}

function runAllChecks(config, schedules, agents, skills, holidays, leaves, locks) {
  const allConflicts = [];
  
  for (const agent of agents) {
    allConflicts.push(...checkConsecutiveNightShifts(agent.id, schedules, config));
    allConflicts.push(...checkConsecutiveWorkDays(agent.id, schedules, config));
  }
  
  allConflicts.push(...checkLeaveConflicts(schedules, leaves, config));
  allConflicts.push(...checkSkillCoverage(schedules, agents, skills, config));
  allConflicts.push(...checkHolidayRotation(schedules, agents, holidays, config));
  allConflicts.push(...checkLockCompliance(schedules, locks));
  allConflicts.push(...checkNightShiftDistribution(schedules, agents, config));
  
  return allConflicts;
}

function calculateFairnessScore(config, schedules, agents, skills, holidays, leaves, conflicts) {
  let score = 100;
  const breakdown = [];
  
  const criticalCount = conflicts.filter(c => c.severity === SEVERITY.CRITICAL).length;
  const highCount = conflicts.filter(c => c.severity === SEVERITY.HIGH).length;
  const mediumCount = conflicts.filter(c => c.severity === SEVERITY.MEDIUM).length;
  const lowCount = conflicts.filter(c => c.severity === SEVERITY.LOW).length;
  
  score -= criticalCount * 20;
  score -= highCount * 10;
  score -= mediumCount * 5;
  score -= lowCount * 2;
  
  breakdown.push({ factor: 'critical_conflicts', count: criticalCount, penalty: criticalCount * 20 });
  breakdown.push({ factor: 'high_conflicts', count: highCount, penalty: highCount * 10 });
  breakdown.push({ factor: 'medium_conflicts', count: mediumCount, penalty: mediumCount * 5 });
  breakdown.push({ factor: 'low_conflicts', count: lowCount, penalty: lowCount * 2 });
  
  const nightShiftCounts = {};
  for (const a of agents) nightShiftCounts[a.id] = 0;
  
  for (const s of schedules) {
    if (isNightShift(s.shiftType, config)) {
      nightShiftCounts[s.agentId] = (nightShiftCounts[s.agentId] || 0) + 1;
    }
  }
  
  const counts = Object.values(nightShiftCounts).filter(c => c > 0);
  if (counts.length > 1) {
    const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
    const variance = counts.reduce((sum, c) => sum + Math.pow(c - avg, 2), 0) / counts.length;
    const stdDev = Math.sqrt(variance);
    
    if (stdDev > 1.5) {
      const penalty = Math.min(15, (stdDev - 1.5) * 5);
      score -= penalty;
      breakdown.push({ factor: 'night_shift_variance', stdDev: stdDev.toFixed(2), penalty: penalty.toFixed(1) });
    }
  }
  
  if (score < 0) score = 0;
  
  let level = 'excellent';
  if (score < 60) level = 'poor';
  else if (score < 80) level = 'fair';
  else if (score < 90) level = 'good';
  
  return {
    score: Math.round(score * 10) / 10,
    level,
    breakdown,
    totalSchedules: schedules.length,
    totalAgents: agents.length,
    conflictSummary: {
      critical: criticalCount,
      high: highCount,
      medium: mediumCount,
      low: lowCount
    }
  };
}

function calculateCoverage(config, schedules, agents, skills) {
  const dates = [...new Set(schedules.map(s => s.date))].sort();
  const shiftTypes = Object.keys(config.shiftTypes || {});
  
  const coverage = {
    overall: 0,
    byDate: {},
    bySkill: {},
    byShift: {}
  };
  
  let totalSlots = 0;
  let coveredSlots = 0;
  
  for (const skill of skills) {
    coverage.bySkill[skill.id] = { name: skill.name, slots: 0, covered: 0, percentage: 0 };
    
    if (!skill.requiresMinCoverage) {
      coverage.bySkill[skill.id].percentage = 100;
      continue;
    }
    
    const minAgents = config.rules.minAgentsPerSkillPerShift || 1;
    const skilledAgents = new Set(getAgentsWithSkill(skill.id, agents).map(a => a.id));
    
    for (const date of dates) {
      if (!coverage.byDate[date]) coverage.byDate[date] = { slots: 0, covered: 0 };
      
      for (const shiftType of shiftTypes) {
        if (!coverage.byShift[shiftType]) coverage.byShift[shiftType] = { slots: 0, covered: 0 };
        
        const slots = minAgents;
        totalSlots += slots;
        coverage.bySkill[skill.id].slots += slots;
        coverage.byDate[date].slots += slots;
        coverage.byShift[shiftType].slots += slots;
        
        const scheduled = schedules.filter(s =>
          s.date === date &&
          s.shiftType === shiftType &&
          skilledAgents.has(s.agentId)
        ).length;
        
        if (scheduled >= minAgents) {
          coveredSlots += slots;
          coverage.bySkill[skill.id].covered += slots;
          coverage.byDate[date].covered += slots;
          coverage.byShift[shiftType].covered += slots;
        } else {
          const partial = scheduled;
          if (partial > 0) {
            coverage.bySkill[skill.id].covered += partial;
            coverage.byDate[date].covered += partial;
            coverage.byShift[shiftType].covered += partial;
            coveredSlots += partial;
          }
        }
      }
    }
    
    if (coverage.bySkill[skill.id].slots > 0) {
      coverage.bySkill[skill.id].percentage = Math.round(
        (coverage.bySkill[skill.id].covered / coverage.bySkill[skill.id].slots) * 100
      );
    }
  }
  
  for (const date of Object.keys(coverage.byDate)) {
    if (coverage.byDate[date].slots > 0) {
      coverage.byDate[date].percentage = Math.round(
        (coverage.byDate[date].covered / coverage.byDate[date].slots) * 100
      );
    } else {
      coverage.byDate[date].percentage = 100;
    }
  }
  
  for (const shiftType of Object.keys(coverage.byShift)) {
    if (coverage.byShift[shiftType].slots > 0) {
      coverage.byShift[shiftType].percentage = Math.round(
        (coverage.byShift[shiftType].covered / coverage.byShift[shiftType].slots) * 100
      );
    } else {
      coverage.byShift[shiftType].percentage = 100;
    }
  }
  
  coverage.overall = totalSlots > 0 ? Math.round((coveredSlots / totalSlots) * 100) : 100;
  
  return coverage;
}

function findSwapSuggestions(config, schedules, agents, skills, holidays, leaves, locks, conflicts) {
  const suggestions = [];
  
  const lockViolations = conflicts.filter(c => c.type === 'lock_violation');
  for (const conflict of lockViolations) {
    suggestions.push({
      type: 'assign_locked_shift',
      priority: 1,
      conflict,
      agentId: conflict.agentId,
      date: conflict.date,
      shiftType: conflict.shiftType,
      action: `为 ${conflict.agentId} 分配锁定班次 ${conflict.date} ${conflict.shiftType}`,
      impact: '恢复锁定班次合规'
    });
  }
  
  const leaveConflicts = conflicts.filter(c => c.type === 'leave_conflict');
  for (const conflict of leaveConflicts) {
    const originalSchedule = schedules.find(s => s.id === conflict.scheduleId);
    if (!originalSchedule) continue;
    
    const candidates = agents.filter(a => {
      if (a.id === conflict.agentId) return false;
      if (a.status !== 'active') return false;
      if (isOnLeave(a.id, conflict.date, leaves)) return false;
      
      const existing = schedules.find(s => s.agentId === a.id && s.date === conflict.date);
      if (existing) return false;
      
      return true;
    });
    
    for (const candidate of candidates.slice(0, 3)) {
      suggestions.push({
        type: 'swap_for_leave',
        priority: 2,
        conflict,
        fromAgentId: conflict.agentId,
        toAgentId: candidate.id,
        date: conflict.date,
        shiftType: originalSchedule.shiftType,
        scheduleId: conflict.scheduleId,
        action: `将 ${conflict.date} ${originalSchedule.shiftType} 从 ${conflict.agentId} 换给 ${candidate.id}`,
        impact: '解决请假冲突'
      });
    }
  }
  
  const skillGaps = conflicts.filter(c => c.type === 'skill_gap');
  for (const gap of skillGaps) {
    const candidates = agents.filter(a => {
      if (!Array.isArray(a.skills) || !a.skills.includes(gap.skillId)) return false;
      if (a.status !== 'active') return false;
      if (isOnLeave(a.id, gap.date, leaves)) return false;
      
      const existing = schedules.find(s => s.agentId === a.id && s.date === gap.date);
      if (existing && existing.shiftType !== gap.shiftType) return false;
      
      return true;
    });
    
    for (const candidate of candidates.slice(0, 3)) {
      const hasExisting = schedules.find(s => s.agentId === candidate.id && s.date === gap.date);
      
      suggestions.push({
        type: hasExisting ? 'swap_skill' : 'assign_skill',
        priority: 3,
        conflict: gap,
        agentId: candidate.id,
        skillId: gap.skillId,
        skillName: gap.skillName,
        date: gap.date,
        shiftType: gap.shiftType,
        action: hasExisting
          ? `让 ${candidate.id} 在 ${gap.date} 调整为 ${gap.shiftType}（拥有 ${gap.skillName} 技能）`
          : `安排 ${candidate.id} 在 ${gap.date} ${gap.shiftType}（拥有 ${gap.skillName} 技能）`,
        impact: `弥补 ${gap.skillName} 技能缺口`
      });
    }
  }
  
  const nightIssues = conflicts.filter(c => 
    c.type === 'consecutive_night_shifts' || c.type === 'night_shift_over_limit'
  );
  
  for (const issue of nightIssues) {
    const agentId = issue.agentId;
    
    const candidates = agents.filter(a => {
      if (a.id === agentId) return false;
      if (a.status !== 'active') return false;
      
      const agentNights = schedules.filter(s => 
        s.agentId === a.id && isNightShift(s.shiftType, config)
      ).length;
      if (agentNights >= (config.rules.maxNightShiftsPerPerson || 8) - 1) return false;
      
      return true;
    });
    
    const dateToSwap = issue.dates?.[0] || issue.date;
    if (dateToSwap) {
      const targetSchedule = schedules.find(s => 
        s.agentId === agentId && s.date === dateToSwap
      );
      
      if (targetSchedule) {
        for (const candidate of candidates.slice(0, 3)) {
          suggestions.push({
            type: 'swap_night_shift',
            priority: 4,
            conflict: issue,
            fromAgentId: agentId,
            toAgentId: candidate.id,
            date: dateToSwap,
            shiftType: targetSchedule.shiftType,
            scheduleId: targetSchedule.id,
            action: `将 ${dateToSwap} 夜班从 ${agentId} 换给 ${candidate.id}`,
            impact: issue.type === 'consecutive_night_shifts' 
              ? '打破连续夜班' 
              : '减少单人夜班总数'
          });
        }
      }
    }
  }
  
  return suggestions.sort((a, b) => a.priority - b.priority);
}

function generateFullReport(config, schedules, agents, skills, holidays, leaves, locks) {
  const conflicts = runAllChecks(config, schedules, agents, skills, holidays, leaves, locks);
  const fairness = calculateFairnessScore(config, schedules, agents, skills, holidays, leaves, conflicts);
  const coverage = calculateCoverage(config, schedules, agents, skills);
  const suggestions = findSwapSuggestions(config, schedules, agents, skills, holidays, leaves, locks, conflicts);
  
  const agentStats = {};
  for (const agent of agents) {
    const agentSchedules = schedules.filter(s => s.agentId === agent.id);
    const nightShifts = agentSchedules.filter(s => isNightShift(s.shiftType, config)).length;
    const holidayShifts = agentSchedules.filter(s => holidays.some(h => h.date === s.date)).length;
    const onLeaveDays = utils.datesInRange(
      leaves.filter(l => l.agentId === agent.id).reduce((min, l) => {
        const start = utils.parseDate(l.startDate);
        return !min || start < utils.parseDate(min) ? l.startDate : min;
      }, null) || new Date().toISOString().split('T')[0],
      leaves.filter(l => l.agentId === agent.id).reduce((max, l) => {
        const end = utils.parseDate(l.endDate);
        return !max || end > utils.parseDate(max) ? l.endDate : max;
      }, null) || new Date().toISOString().split('T')[0]
    ).filter(d => leaves.some(l => {
      const start = utils.parseDate(l.startDate);
      const end = utils.parseDate(l.endDate);
      const curr = utils.parseDate(d);
      return l.agentId === agent.id && curr >= start && curr <= end;
    })).length;
    
    agentStats[agent.id] = {
      id: agent.id,
      name: agent.name,
      skills: agent.skills || [],
      totalShifts: agentSchedules.length,
      nightShifts,
      holidayShifts,
      leaveDays: onLeaveDays,
      conflicts: conflicts.filter(c => c.agentId === agent.id).length
    };
  }
  
  const skillStats = {};
  for (const skill of skills) {
    const skilledAgents = getAgentsWithSkill(skill.id, agents);
    skillStats[skill.id] = {
      id: skill.id,
      name: skill.name,
      agentCount: skilledAgents.length,
      coverage: coverage.bySkill[skill.id]?.percentage || 0,
      requiresMinCoverage: skill.requiresMinCoverage
    };
  }
  
  return {
    generatedAt: new Date().toISOString(),
    config: {
      targetMonth: config.targetMonth,
      rules: config.rules
    },
    fairness,
    coverage,
    conflicts,
    suggestions,
    statistics: {
      agents: agentStats,
      skills: skillStats,
      totals: {
        agents: agents.length,
        skills: skills.length,
        schedules: schedules.length,
        holidays: holidays.length,
        leaves: leaves.length,
        locks: locks.length
      }
    }
  };
}

module.exports = {
  SEVERITY,
  isNightShift,
  checkConsecutiveNightShifts,
  checkConsecutiveWorkDays,
  checkLeaveConflicts,
  checkSkillCoverage,
  checkHolidayRotation,
  checkLockCompliance,
  checkNightShiftDistribution,
  runAllChecks,
  calculateFairnessScore,
  calculateCoverage,
  findSwapSuggestions,
  generateFullReport
};
