const fs = require('fs');
const path = require('path');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function readJSON(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const content = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(content);
}

function writeJSON(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function parseTime(timeStr) {
  if (!timeStr) return null;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return { hours, minutes };
}

function isTimeBefore(time1, time2) {
  const t1 = parseTime(time1);
  const t2 = parseTime(time2);
  if (!t1 || !t2) return false;
  if (t1.hours < t2.hours) return true;
  if (t1.hours === t2.hours && t1.minutes < t2.minutes) return true;
  return false;
}

function formatNumber(num, decimals = 2) {
  return Number(num).toFixed(decimals);
}

function formatPercent(num) {
  return `${formatNumber(num * 100, 1)}%`;
}

function getYesterday(dateStr) {
  const date = new Date(dateStr);
  date.setDate(date.getDate() - 1);
  return date.toISOString().split('T')[0];
}

module.exports = {
  ensureDir,
  readJSON,
  writeJSON,
  parseTime,
  isTimeBefore,
  formatNumber,
  formatPercent,
  getYesterday
};
