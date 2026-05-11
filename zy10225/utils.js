const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

function generateId() {
  return uuidv4();
}

function hashFile(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

function hashString(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

function formatCurrency(amount, currency = 'CNY') {
  const formatter = new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: currency
  });
  return formatter.format(amount || 0);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return moment(dateStr).format('YYYY-MM-DD');
}

function formatDateTime(dateStr) {
  if (!dateStr) return '';
  return moment(dateStr).format('YYYY-MM-DD HH:mm:ss');
}

function parseDate(dateInput) {
  if (!dateInput) return null;
  
  const formats = [
    'YYYY-MM-DD',
    'YYYY/MM/DD',
    'YYYY.MM.DD',
    'MM/DD/YYYY',
    'DD/MM/YYYY',
    'YYYYMMDD'
  ];
  
  for (const format of formats) {
    const m = moment(dateInput, format, true);
    if (m.isValid()) {
      return m.format('YYYY-MM-DD');
    }
  }
  
  return null;
}

function parseAmount(amountInput) {
  if (amountInput === null || amountInput === undefined || amountInput === '') return null;
  
  if (typeof amountInput === 'number') {
    return amountInput;
  }
  
  const cleaned = String(amountInput)
    .replace(/[￥¥$€, ]/g, '')
    .replace(/^\s+|\s+$/g, '');
  
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function roundAmount(amount, decimals = 2) {
  return Math.round(amount * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

function isValidEmail(email) {
  if (!email) return true;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function isValidPhone(phone) {
  if (!phone) return true;
  const phoneRegex = /^[\d+\-() ]{7,20}$/;
  return phoneRegex.test(phone);
}

function ensureDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  return dirPath;
}

function getFileExtension(filePath) {
  return path.extname(filePath).toLowerCase().replace('.', '');
}

function isCsvFile(filePath) {
  const ext = getFileExtension(filePath);
  return ext === 'csv';
}

function isJsonFile(filePath) {
  const ext = getFileExtension(filePath);
  return ext === 'json';
}

function findDuplicates(arr, keyFn) {
  const seen = new Map();
  const duplicates = [];
  
  arr.forEach((item, index) => {
    const key = keyFn(item);
    if (seen.has(key)) {
      duplicates.push({ item, index, originalIndex: seen.get(key) });
    } else {
      seen.set(key, index);
    }
  });
  
  return duplicates;
}

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  generateId,
  hashFile,
  hashString,
  formatCurrency,
  formatDate,
  formatDateTime,
  parseDate,
  parseAmount,
  roundAmount,
  isValidEmail,
  isValidPhone,
  ensureDirectory,
  getFileExtension,
  isCsvFile,
  isJsonFile,
  findDuplicates,
  chunkArray,
  sleep
};
