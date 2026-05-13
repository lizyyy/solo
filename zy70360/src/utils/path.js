const path = require('path');
const os = require('os');

const WORK_DIR = process.cwd();

function getDataDir() {
  return path.join(WORK_DIR, 'data');
}

function getConfigDir() {
  return path.join(WORK_DIR, 'config');
}

function getConfigPath() {
  return path.join(getConfigDir(), 'mq-simulator.json');
}

function getTopicsPath() {
  return path.join(getDataDir(), 'topics.json');
}

function getPlansPath() {
  return path.join(getDataDir(), 'plans.json');
}

function getHistoryPath() {
  return path.join(getDataDir(), 'history.json');
}

function getDeadLettersPath() {
  return path.join(getDataDir(), 'dead-letters.json');
}

function getReportsPath() {
  return path.join(getDataDir(), 'reports');
}

module.exports = {
  WORK_DIR,
  getDataDir,
  getConfigDir,
  getConfigPath,
  getTopicsPath,
  getPlansPath,
  getHistoryPath,
  getDeadLettersPath,
  getReportsPath
};
