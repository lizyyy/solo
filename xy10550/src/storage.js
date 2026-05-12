'use strict';

const path = require('path');
const utils = require('./utils');

const DATA_DIR = path.join(process.cwd(), 'data');
const HISTORY_DIR = path.join(DATA_DIR, 'history');

const FILES = {
  config: path.join(DATA_DIR, 'config.json'),
  agents: path.join(DATA_DIR, 'agents.json'),
  skills: path.join(DATA_DIR, 'skills.json'),
  holidays: path.join(DATA_DIR, 'holidays.json'),
  leaves: path.join(DATA_DIR, 'leaves.json'),
  schedules: path.join(DATA_DIR, 'schedules.json'),
  locks: path.join(DATA_DIR, 'locks.json'),
  state: path.join(DATA_DIR, 'state.json'),
  report: path.join(DATA_DIR, 'report.json')
};

function getDataDir() {
  return DATA_DIR;
}

function isInitialized() {
  return require('fs').existsSync(FILES.config);
}

function initializeConfig(options = {}) {
  const config = {
    period: options.period || 'monthly',
    targetMonth: options.targetMonth || utils.formatDate(new Date()).slice(0, 7),
    rules: {
      maxConsecutiveWorkDays: options.maxConsecutiveWorkDays || 6,
      maxConsecutiveNightShifts: options.maxConsecutiveNightShifts || 2,
      minRestBetweenShifts: options.minRestBetweenShifts || 12,
      nightShiftThreshold: options.nightShiftThreshold || 20,
      maxNightShiftsPerPerson: options.maxNightShiftsPerPerson || 8,
      requireSkillCoverage: options.requireSkillCoverage !== false,
      minAgentsPerSkillPerShift: options.minAgentsPerSkillPerShift || 1,
      holidayRotationWeeks: options.holidayRotationWeeks || 4
    },
    shiftTypes: {
      morning: { name: '早班', start: 8, end: 16, isNight: false },
      afternoon: { name: '中班', start: 14, end: 22, isNight: false },
      night: { name: '晚班', start: 20, end: 4, isNight: true }
    },
    lastUpdated: new Date().toISOString()
  };
  
  utils.writeJSON(FILES.config, config);
  utils.writeJSON(FILES.agents, { agents: [] });
  utils.writeJSON(FILES.skills, { skills: [] });
  utils.writeJSON(FILES.holidays, { holidays: [] });
  utils.writeJSON(FILES.leaves, { leaves: [] });
  utils.writeJSON(FILES.schedules, { schedules: [] });
  utils.writeJSON(FILES.locks, { locks: [] });
  utils.writeJSON(FILES.state, {
    currentVersion: 0,
    initializedAt: new Date().toISOString(),
    importHistory: [],
    checkHistory: [],
    fixHistory: []
  });
  utils.writeJSON(FILES.report, null);
  
  recordHistory('init', { action: 'initialize', config });
  
  return config;
}

function getConfig() {
  return utils.readJSON(FILES.config, null);
}

function updateConfig(updates, operator = 'system') {
  const config = getConfig();
  if (!config) return null;
  
  const before = utils.deepClone(config);
  Object.assign(config, updates);
  config.lastUpdated = new Date().toISOString();
  
  utils.writeJSON(FILES.config, config);
  
  const diff = utils.diffObjects(before, config);
  recordHistory('config_update', {
    operator,
    before,
    after: config,
    diff
  });
  
  return config;
}

function getAgents() {
  const data = utils.readJSON(FILES.agents, { agents: [] });
  return data.agents || [];
}

function saveAgents(agents, operator = 'system', reason = '') {
  const before = getAgents();
  utils.writeJSON(FILES.agents, { agents });
  
  const diff = utils.diffObjects(
    { agents: before },
    { agents }
  );
  
  recordHistory('agents_update', {
    operator,
    reason,
    beforeCount: before.length,
    afterCount: agents.length,
    diff
  });
  
  return agents;
}

function getSkills() {
  const data = utils.readJSON(FILES.skills, { skills: [] });
  return data.skills || [];
}

function saveSkills(skills, operator = 'system', reason = '') {
  const before = getSkills();
  utils.writeJSON(FILES.skills, { skills });
  
  const diff = utils.diffObjects(
    { skills: before },
    { skills }
  );
  
  recordHistory('skills_update', {
    operator,
    reason,
    beforeCount: before.length,
    afterCount: skills.length,
    diff
  });
  
  return skills;
}

function getHolidays() {
  const data = utils.readJSON(FILES.holidays, { holidays: [] });
  return data.holidays || [];
}

function saveHolidays(holidays, operator = 'system', reason = '') {
  const before = getHolidays();
  utils.writeJSON(FILES.holidays, { holidays });
  
  const diff = utils.diffObjects(
    { holidays: before },
    { holidays }
  );
  
  recordHistory('holidays_update', {
    operator,
    reason,
    beforeCount: before.length,
    afterCount: holidays.length,
    diff
  });
  
  return holidays;
}

function getLeaves() {
  const data = utils.readJSON(FILES.leaves, { leaves: [] });
  return data.leaves || [];
}

function saveLeaves(leaves, operator = 'system', reason = '') {
  const before = getLeaves();
  utils.writeJSON(FILES.leaves, { leaves });
  
  const diff = utils.diffObjects(
    { leaves: before },
    { leaves }
  );
  
  recordHistory('leaves_update', {
    operator,
    reason,
    beforeCount: before.length,
    afterCount: leaves.length,
    diff
  });
  
  return leaves;
}

function getSchedules() {
  const data = utils.readJSON(FILES.schedules, { schedules: [] });
  return data.schedules || [];
}

function saveSchedules(schedules, operator = 'system', reason = '') {
  const before = getSchedules();
  utils.writeJSON(FILES.schedules, { schedules });
  
  const diff = utils.diffObjects(
    { schedules: before },
    { schedules }
  );
  
  recordHistory('schedules_update', {
    operator,
    reason,
    beforeCount: before.length,
    afterCount: schedules.length,
    diff
  });
  
  return schedules;
}

function getLocks() {
  const data = utils.readJSON(FILES.locks, { locks: [] });
  return data.locks || [];
}

function saveLocks(locks, operator = 'system', reason = '') {
  const before = getLocks();
  utils.writeJSON(FILES.locks, { locks });
  
  const diff = utils.diffObjects(
    { locks: before },
    { locks }
  );
  
  recordHistory('locks_update', {
    operator,
    reason,
    beforeCount: before.length,
    afterCount: locks.length,
    diff
  });
  
  return locks;
}

function getState() {
  return utils.readJSON(FILES.state, null);
}

function updateState(updates) {
  const state = getState();
  if (!state) return null;
  Object.assign(state, updates);
  utils.writeJSON(FILES.state, state);
  return state;
}

function saveReport(report) {
  utils.writeJSON(FILES.report, report);
  return report;
}

function getReport() {
  return utils.readJSON(FILES.report, null);
}

function recordHistory(type, payload) {
  const fs = require('fs');
  if (!fs.existsSync(HISTORY_DIR)) {
    fs.mkdirSync(HISTORY_DIR, { recursive: true });
  }
  
  const entry = {
    id: utils.generateId('hist'),
    type,
    timestamp: new Date().toISOString(),
    payload: utils.deepClone(payload)
  };
  
  const historyFile = path.join(HISTORY_DIR, `${type}.jsonl`);
  fs.appendFileSync(historyFile, JSON.stringify(entry) + '\n', 'utf8');
  
  return entry;
}

function getHistory(type, limit = 10) {
  const historyFile = path.join(HISTORY_DIR, `${type}.jsonl`);
  const fs = require('fs');
  
  if (!fs.existsSync(historyFile)) return [];
  
  const content = fs.readFileSync(historyFile, 'utf8');
  const lines = content.split('\n').filter(l => l.trim());
  
  return lines
    .slice(-limit)
    .map(line => {
      try { return JSON.parse(line); }
      catch { return null; }
    })
    .filter(Boolean)
    .reverse();
}

function getAllHistoryTypes() {
  const fs = require('fs');
  if (!fs.existsSync(HISTORY_DIR)) return [];
  
  return fs.readdirSync(HISTORY_DIR)
    .filter(f => f.endsWith('.jsonl'))
    .map(f => f.replace('.jsonl', ''));
}

function importData(category, records, operator = 'system', replace = false) {
  const map = {
    agents: { get: getAgents, save: saveAgents },
    skills: { get: getSkills, save: saveSkills },
    holidays: { get: getHolidays, save: saveHolidays },
    leaves: { get: getLeaves, save: saveLeaves },
    schedules: { get: getSchedules, save: saveSchedules },
    locks: { get: getLocks, save: saveLocks }
  };
  
  const handlers = map[category];
  if (!handlers) {
    throw new Error(`Unknown category: ${category}`);
  }
  
  const existing = handlers.get();
  let newRecords;
  
  if (replace) {
    newRecords = records;
  } else {
    const existingIds = new Set(existing.map(r => r.id));
    const toAdd = records.filter(r => !existingIds.has(r.id));
    newRecords = [...existing, ...toAdd];
  }
  
  const result = handlers.save(newRecords, operator, `import_${category}`);
  
  const state = getState();
  if (state) {
    state.importHistory = state.importHistory || [];
    state.importHistory.unshift({
      timestamp: new Date().toISOString(),
      category,
      count: records.length,
      replace,
      operator
    });
    state.importHistory = state.importHistory.slice(0, 50);
    updateState(state);
  }
  
  return {
    total: records.length,
    added: newRecords.length - existing.length,
    replaced: replace ? existing.length : 0
  };
}

module.exports = {
  DATA_DIR,
  HISTORY_DIR,
  FILES,
  getDataDir,
  isInitialized,
  initializeConfig,
  getConfig,
  updateConfig,
  getAgents,
  saveAgents,
  getSkills,
  saveSkills,
  getHolidays,
  saveHolidays,
  getLeaves,
  saveLeaves,
  getSchedules,
  saveSchedules,
  getLocks,
  saveLocks,
  getState,
  updateState,
  saveReport,
  getReport,
  recordHistory,
  getHistory,
  getAllHistoryTypes,
  importData
};
