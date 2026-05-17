const fs = require('fs');
const path = require('path');
const { filesize } = require('filesize');
const chalk = require('chalk');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  return dirPath;
}

function formatSize(bytes, options = {}) {
  return filesize(bytes, {
    base: 2,
    standard: 'jedec',
    ...options
  });
}

function formatPercent(value) {
  return (value * 100).toFixed(2) + '%';
}

function getRelativePath(filePath, baseDir) {
  return path.relative(baseDir, filePath);
}

function safeRequire(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return require(filePath);
    }
  } catch (e) {}
  return null;
}

function getTimestamp() {
  const now = new Date();
  return now.toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .slice(0, 19);
}

function parseSize(sizeStr) {
  const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*([KMGT]?B)$/i);
  if (!match) return parseInt(sizeStr, 10);
  
  const [, num, unit] = match;
  const units = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4 };
  return parseFloat(num) * (units[unit.toUpperCase()] || 1);
}

function groupBy(arr, keyFn) {
  return arr.reduce((acc, item) => {
    const key = keyFn(item);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}

function sumBy(arr, keyFn) {
  return arr.reduce((sum, item) => sum + (keyFn(item) || 0), 0);
}

function sortBySize(arr, descending = true) {
  return [...arr].sort((a, b) => 
    descending ? b.size - a.size : a.size - b.size
  );
}

function logError(message, error) {
  console.error(chalk.red(`✖ ${message}`));
  if (error) {
    console.error(chalk.gray(error.message));
  }
}

function logWarning(message) {
  console.warn(chalk.yellow(`⚠ ${message}`));
}

function logSuccess(message) {
  console.log(chalk.green(`✓ ${message}`));
}

function logInfo(message) {
  console.log(chalk.blue(`ℹ ${message}`));
}

module.exports = {
  ensureDir,
  formatSize,
  formatPercent,
  getRelativePath,
  safeRequire,
  getTimestamp,
  parseSize,
  groupBy,
  sumBy,
  sortBySize,
  logError,
  logWarning,
  logSuccess,
  logInfo
};
