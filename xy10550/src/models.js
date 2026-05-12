'use strict';

const utils = require('./utils');

function validateAgent(agent) {
  const errors = [];
  
  if (!agent.id) errors.push('缺少 id');
  if (!agent.name) errors.push('缺少 name');
  
  if (agent.skills && !Array.isArray(agent.skills)) {
    errors.push('skills 必须是数组');
  }
  
  if (agent.status && !['active', 'inactive', 'on_leave'].includes(agent.status)) {
    errors.push('status 必须是 active/inactive/on_leave');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

function validateSkill(skill) {
  const errors = [];
  
  if (!skill.id) errors.push('缺少 id');
  if (!skill.name) errors.push('缺少 name');
  
  if (skill.priority !== undefined && typeof skill.priority !== 'number') {
    errors.push('priority 必须是数字');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

function validateHoliday(holiday) {
  const errors = [];
  
  if (!holiday.date) errors.push('缺少 date');
  if (!holiday.name) errors.push('缺少 name');
  
  return {
    valid: errors.length === 0,
    errors
  };
}

function validateLeave(leave) {
  const errors = [];
  
  if (!leave.id) errors.push('缺少 id');
  if (!leave.agentId) errors.push('缺少 agentId');
  if (!leave.startDate) errors.push('缺少 startDate');
  if (!leave.endDate) errors.push('缺少 endDate');
  
  if (leave.startDate && leave.endDate) {
    if (utils.parseDate(leave.startDate) > utils.parseDate(leave.endDate)) {
      errors.push('startDate 不能晚于 endDate');
    }
  }
  
  if (leave.type && !['annual', 'sick', 'personal', 'other'].includes(leave.type)) {
    errors.push('type 必须是 annual/sick/personal/other');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

function validateSchedule(schedule) {
  const errors = [];
  
  if (!schedule.id) errors.push('缺少 id');
  if (!schedule.agentId) errors.push('缺少 agentId');
  if (!schedule.date) errors.push('缺少 date');
  if (!schedule.shiftType) errors.push('缺少 shiftType');
  
  return {
    valid: errors.length === 0,
    errors
  };
}

function validateLock(lock) {
  const errors = [];
  
  if (!lock.id) errors.push('缺少 id');
  if (!lock.agentId) errors.push('缺少 agentId');
  if (!lock.date) errors.push('缺少 date');
  if (!lock.shiftType) errors.push('缺少 shiftType');
  
  return {
    valid: errors.length === 0,
    errors
  };
}

function normalizeAgent(agent) {
  return {
    id: agent.id || utils.generateId('agent'),
    name: agent.name,
    skills: Array.isArray(agent.skills) ? agent.skills : [],
    status: agent.status || 'active',
    preferences: agent.preferences || {},
    notes: agent.notes || '',
    createdAt: agent.createdAt || new Date().toISOString()
  };
}

function normalizeSkill(skill) {
  return {
    id: skill.id || utils.generateId('skill'),
    name: skill.name,
    description: skill.description || '',
    priority: skill.priority || 1,
    requiresMinCoverage: skill.requiresMinCoverage !== false
  };
}

function normalizeHoliday(holiday) {
  return {
    id: holiday.id || utils.generateId('holiday'),
    date: utils.formatDate(holiday.date),
    name: holiday.name,
    type: holiday.type || 'public',
    requiresCoverage: holiday.requiresCoverage !== false
  };
}

function normalizeLeave(leave) {
  return {
    id: leave.id || utils.generateId('leave'),
    agentId: leave.agentId,
    startDate: utils.formatDate(leave.startDate),
    endDate: utils.formatDate(leave.endDate),
    type: leave.type || 'personal',
    reason: leave.reason || '',
    status: leave.status || 'approved',
    createdAt: leave.createdAt || new Date().toISOString()
  };
}

function normalizeSchedule(schedule) {
  return {
    id: schedule.id || utils.generateId('schedule'),
    agentId: schedule.agentId,
    date: utils.formatDate(schedule.date),
    shiftType: schedule.shiftType,
    notes: schedule.notes || '',
    source: schedule.source || 'manual',
    createdAt: schedule.createdAt || new Date().toISOString()
  };
}

function normalizeLock(lock) {
  return {
    id: lock.id || utils.generateId('lock'),
    agentId: lock.agentId,
    date: utils.formatDate(lock.date),
    shiftType: lock.shiftType,
    reason: lock.reason || '',
    operator: lock.operator || 'system',
    createdAt: lock.createdAt || new Date().toISOString()
  };
}

module.exports = {
  validateAgent,
  validateSkill,
  validateHoliday,
  validateLeave,
  validateSchedule,
  validateLock,
  normalizeAgent,
  normalizeSkill,
  normalizeHoliday,
  normalizeLeave,
  normalizeSchedule,
  normalizeLock
};
