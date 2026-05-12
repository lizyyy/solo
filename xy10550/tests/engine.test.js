'use strict';

const test = require('node:test');
const assert = require('node:assert');
const engine = require('../src/engine');
const utils = require('../src/utils');

const baseConfig = {
  targetMonth: '2025-06',
  rules: {
    maxConsecutiveWorkDays: 6,
    maxConsecutiveNightShifts: 2,
    minRestBetweenShifts: 12,
    nightShiftThreshold: 20,
    maxNightShiftsPerPerson: 8,
    requireSkillCoverage: true,
    minAgentsPerSkillPerShift: 1,
    holidayRotationWeeks: 4
  },
  shiftTypes: {
    morning: { name: '早班', start: 8, end: 16, isNight: false },
    afternoon: { name: '中班', start: 14, end: 22, isNight: false },
    night: { name: '晚班', start: 20, end: 4, isNight: true }
  }
};

test('checkConsecutiveNightShifts - 连续2个夜班通过', () => {
  const schedules = [
    { id: 's1', agentId: 'a1', date: '2025-06-01', shiftType: 'night' },
    { id: 's2', agentId: 'a1', date: '2025-06-02', shiftType: 'night' }
  ];
  
  const conflicts = engine.checkConsecutiveNightShifts('a1', schedules, baseConfig);
  assert.strictEqual(conflicts.length, 0);
});

test('checkConsecutiveNightShifts - 连续3个夜班触发冲突', () => {
  const schedules = [
    { id: 's1', agentId: 'a1', date: '2025-06-01', shiftType: 'night' },
    { id: 's2', agentId: 'a1', date: '2025-06-02', shiftType: 'night' },
    { id: 's3', agentId: 'a1', date: '2025-06-03', shiftType: 'night' }
  ];
  
  const conflicts = engine.checkConsecutiveNightShifts('a1', schedules, baseConfig);
  assert.strictEqual(conflicts.length, 1);
  assert.strictEqual(conflicts[0].type, 'consecutive_night_shifts');
  assert.strictEqual(conflicts[0].severity, 'high');
});

test('checkConsecutiveWorkDays - 连续6天通过', () => {
  const schedules = [];
  for (let i = 1; i <= 6; i++) {
    schedules.push({
      id: `s${i}`,
      agentId: 'a1',
      date: `2025-06-${String(i).padStart(2, '0')}`,
      shiftType: 'morning'
    });
  }
  
  const conflicts = engine.checkConsecutiveWorkDays('a1', schedules, baseConfig);
  assert.strictEqual(conflicts.length, 0);
});

test('checkConsecutiveWorkDays - 连续7天触发冲突', () => {
  const schedules = [];
  for (let i = 1; i <= 7; i++) {
    schedules.push({
      id: `s${i}`,
      agentId: 'a1',
      date: `2025-06-${String(i).padStart(2, '0')}`,
      shiftType: 'morning'
    });
  }
  
  const conflicts = engine.checkConsecutiveWorkDays('a1', schedules, baseConfig);
  assert.strictEqual(conflicts.length, 1);
  assert.strictEqual(conflicts[0].type, 'consecutive_work_days');
});

test('checkLeaveConflicts - 请假期间排班触发冲突', () => {
  const schedules = [
    { id: 's1', agentId: 'a1', date: '2025-06-15', shiftType: 'morning' }
  ];
  
  const leaves = [
    { id: 'l1', agentId: 'a1', startDate: '2025-06-14', endDate: '2025-06-16', type: 'annual' }
  ];
  
  const conflicts = engine.checkLeaveConflicts(schedules, leaves, baseConfig);
  assert.strictEqual(conflicts.length, 1);
  assert.strictEqual(conflicts[0].type, 'leave_conflict');
  assert.strictEqual(conflicts[0].severity, 'critical');
});

test('checkLeaveConflicts - 非请假期间不触发', () => {
  const schedules = [
    { id: 's1', agentId: 'a1', date: '2025-06-10', shiftType: 'morning' }
  ];
  
  const leaves = [
    { id: 'l1', agentId: 'a1', startDate: '2025-06-14', endDate: '2025-06-16', type: 'annual' }
  ];
  
  const conflicts = engine.checkLeaveConflicts(schedules, leaves, baseConfig);
  assert.strictEqual(conflicts.length, 0);
});

test('checkSkillCoverage - 技能组覆盖不足触发冲突', () => {
  const skills = [
    { id: 'skill1', name: '测试技能', requiresMinCoverage: true }
  ];
  
  const agents = [
    { id: 'a1', name: 'A1', skills: ['skill1'] },
    { id: 'a2', name: 'A2', skills: [] }
  ];
  
  const schedules = [
    { id: 's1', agentId: 'a2', date: '2025-06-01', shiftType: 'morning' }
  ];
  
  const conflicts = engine.checkSkillCoverage(schedules, agents, skills, baseConfig);
  assert.strictEqual(conflicts.length, 3);
  assert.strictEqual(conflicts[0].type, 'skill_gap');
  assert.strictEqual(conflicts[0].severity, 'high');
});

test('checkSkillCoverage - 技能组覆盖充足通过', () => {
  const skills = [
    { id: 'skill1', name: '测试技能', requiresMinCoverage: true }
  ];
  
  const agents = [
    { id: 'a1', name: 'A1', skills: ['skill1'] }
  ];
  
  const schedules = [
    { id: 's1', agentId: 'a1', date: '2025-06-01', shiftType: 'morning' },
    { id: 's2', agentId: 'a1', date: '2025-06-01', shiftType: 'afternoon' },
    { id: 's3', agentId: 'a1', date: '2025-06-01', shiftType: 'night' }
  ];
  
  const conflicts = engine.checkSkillCoverage(schedules, agents, skills, baseConfig);
  assert.strictEqual(conflicts.length, 0);
});

test('checkLockCompliance - 锁定班次未匹配触发冲突', () => {
  const schedules = [
    { id: 's1', agentId: 'a1', date: '2025-06-01', shiftType: 'morning' }
  ];
  
  const locks = [
    { id: 'lock1', agentId: 'a1', date: '2025-06-01', shiftType: 'afternoon' }
  ];
  
  const conflicts = engine.checkLockCompliance(schedules, locks);
  assert.strictEqual(conflicts.length, 1);
  assert.strictEqual(conflicts[0].type, 'lock_violation');
  assert.strictEqual(conflicts[0].severity, 'critical');
});

test('checkLockCompliance - 锁定班次匹配通过', () => {
  const schedules = [
    { id: 's1', agentId: 'a1', date: '2025-06-01', shiftType: 'afternoon' }
  ];
  
  const locks = [
    { id: 'lock1', agentId: 'a1', date: '2025-06-01', shiftType: 'afternoon' }
  ];
  
  const conflicts = engine.checkLockCompliance(schedules, locks);
  assert.strictEqual(conflicts.length, 0);
});

test('checkNightShiftDistribution - 超过夜班上限触发冲突', () => {
  const schedules = [];
  for (let i = 1; i <= 10; i++) {
    schedules.push({
      id: `s${i}`,
      agentId: 'a1',
      date: `2025-06-${String(i).padStart(2, '0')}`,
      shiftType: 'night'
    });
  }
  
  const agents = [
    { id: 'a1', name: 'A1', skills: [] }
  ];
  
  const conflicts = engine.checkNightShiftDistribution(schedules, agents, baseConfig);
  const overLimit = conflicts.find(c => c.type === 'night_shift_over_limit');
  assert.ok(overLimit);
  assert.strictEqual(overLimit.severity, 'high');
});

test('calculateFairnessScore - 无冲突得100分', () => {
  const schedules = [
    { id: 's1', agentId: 'a1', date: '2025-06-01', shiftType: 'morning' }
  ];
  const agents = [{ id: 'a1', name: 'A1', skills: [] }];
  const skills = [];
  const holidays = [];
  const leaves = [];
  const conflicts = [];
  
  const fairness = engine.calculateFairnessScore(baseConfig, schedules, agents, skills, holidays, leaves, conflicts);
  assert.strictEqual(fairness.score, 100);
  assert.strictEqual(fairness.level, 'excellent');
});

test('calculateFairnessScore - 严重冲突扣分', () => {
  const schedules = [];
  const agents = [{ id: 'a1', name: 'A1', skills: [] }];
  const skills = [];
  const holidays = [];
  const leaves = [];
  const conflicts = [
    { type: 'leave_conflict', severity: 'critical' },
    { type: 'lock_violation', severity: 'critical' },
    { type: 'leave_conflict', severity: 'critical' }
  ];
  
  const fairness = engine.calculateFairnessScore(baseConfig, schedules, agents, skills, holidays, leaves, conflicts);
  assert.strictEqual(fairness.score, 40);
  assert.strictEqual(fairness.level, 'poor');
});

test('calculateCoverage - 计算技能覆盖率', () => {
  const skills = [
    { id: 'skill1', name: 'S1', requiresMinCoverage: true }
  ];
  const agents = [
    { id: 'a1', name: 'A1', skills: ['skill1'] }
  ];
  const schedules = [
    { id: 's1', agentId: 'a1', date: '2025-06-01', shiftType: 'morning' }
  ];
  
  const coverage = engine.calculateCoverage(baseConfig, schedules, agents, skills);
  assert.ok(coverage.overall >= 0 && coverage.overall <= 100);
  assert.ok(coverage.bySkill['skill1']);
});

test('runAllChecks - 完整流程', () => {
  const agents = [
    { id: 'a1', name: 'A1', skills: ['skill1'], status: 'active' }
  ];
  const skills = [
    { id: 'skill1', name: 'S1', requiresMinCoverage: true }
  ];
  const holidays = [];
  const leaves = [];
  const locks = [];
  const schedules = [
    { id: 's1', agentId: 'a1', date: '2025-06-01', shiftType: 'morning' }
  ];
  
  const conflicts = engine.runAllChecks(baseConfig, schedules, agents, skills, holidays, leaves, locks);
  assert.ok(Array.isArray(conflicts));
});

test('generateFullReport - 生成完整报告', () => {
  const agents = [
    { id: 'a1', name: 'A1', skills: ['skill1'], status: 'active' }
  ];
  const skills = [
    { id: 'skill1', name: 'S1', requiresMinCoverage: true }
  ];
  const holidays = [];
  const leaves = [];
  const locks = [];
  const schedules = [
    { id: 's1', agentId: 'a1', date: '2025-06-01', shiftType: 'morning' }
  ];
  
  const report = engine.generateFullReport(baseConfig, schedules, agents, skills, holidays, leaves, locks);
  
  assert.ok(report.fairness);
  assert.ok(report.coverage);
  assert.ok(Array.isArray(report.conflicts));
  assert.ok(Array.isArray(report.suggestions));
  assert.ok(report.statistics);
  assert.ok(report.statistics.agents);
  assert.ok(report.statistics.skills);
});

test('isNightShift - 正确识别夜班', () => {
  assert.strictEqual(engine.isNightShift('night', baseConfig), true);
  assert.strictEqual(engine.isNightShift('morning', baseConfig), false);
  assert.strictEqual(engine.isNightShift('afternoon', baseConfig), false);
});
