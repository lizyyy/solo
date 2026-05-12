'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function formatDate(date) {
  if (typeof date === 'string') return date;
  return date.toISOString().split('T')[0];
}

function parseDate(dateStr) {
  if (dateStr instanceof Date) return dateStr;
  return new Date(dateStr);
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function datesInRange(startDate, endDate) {
  const dates = [];
  let current = parseDate(startDate);
  const end = parseDate(endDate);
  while (current <= end) {
    dates.push(formatDate(current));
    current = addDays(current, 1);
  }
  return dates;
}

function isWeekend(dateStr) {
  const d = parseDate(dateStr);
  const day = d.getDay();
  return day === 0 || day === 6;
}

function generateId(prefix = 'id') {
  return `${prefix}-${crypto.randomBytes(4).toString('hex')}-${Date.now()}`;
}

function hashObject(obj) {
  const str = JSON.stringify(obj, Object.keys(obj).sort());
  return crypto.createHash('sha256').update(str).digest('hex');
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function readJSON(filePath, defaultValue = null) {
  try {
    if (!fs.existsSync(filePath)) return defaultValue;
    const content = fs.readFileSync(filePath, 'utf8');
    if (!content.trim()) return defaultValue;
    return JSON.parse(content);
  } catch (e) {
    return defaultValue;
  }
}

function writeJSON(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function diffObjects(before, after) {
  const diff = {
    added: {},
    removed: {},
    changed: {}
  };
  
  const allKeys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  
  for (const key of allKeys) {
    const beforeVal = before?.[key];
    const afterVal = after?.[key];
    
    if (beforeVal === undefined && afterVal !== undefined) {
      diff.added[key] = afterVal;
    } else if (afterVal === undefined && beforeVal !== undefined) {
      diff.removed[key] = beforeVal;
    } else if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
      diff.changed[key] = { before: beforeVal, after: afterVal };
    }
  }
  
  return diff;
}

function padString(str, length, char = ' ') {
  if (str.length >= length) return str.slice(0, length);
  return str + char.repeat(length - str.length);
}

function printTable(headers, rows) {
  const colWidths = headers.map((h, i) => {
    const headerLen = String(h).length;
    const maxRowLen = Math.max(...rows.map(r => String(r[i] ?? '').length), 0);
    return Math.max(headerLen, maxRowLen) + 2;
  });
  
  const headerLine = headers.map((h, i) => padString(String(h), colWidths[i])).join('|');
  const separator = colWidths.map(w => '-'.repeat(w)).join('+');
  
  console.log(separator);
  console.log(headerLine);
  console.log(separator);
  
  for (const row of rows) {
    const line = row.map((cell, i) => padString(String(cell ?? ''), colWidths[i])).join('|');
    console.log(line);
  }
  console.log(separator);
}

function logInfo(msg) {
  console.log(`[INFO] ${new Date().toISOString()} ${msg}`);
}

function logWarn(msg) {
  console.log(`[WARN] ${new Date().toISOString()} ${msg}`);
}

function logError(msg) {
  console.error(`[ERROR] ${new Date().toISOString()} ${msg}`);
}

function logSuccess(msg) {
  console.log(`[OK] ${new Date().toISOString()} ${msg}`);
}

module.exports = {
  formatDate,
  parseDate,
  addDays,
  datesInRange,
  isWeekend,
  generateId,
  hashObject,
  deepClone,
  readJSON,
  writeJSON,
  diffObjects,
  printTable,
  logInfo,
  logWarn,
  logError,
  logSuccess
};
