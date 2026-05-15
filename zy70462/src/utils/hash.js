const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function calculateFileHash(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

function calculateContentHash(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function generateFileSummary(filePath) {
  const stats = fs.statSync(filePath);
  const content = fs.readFileSync(filePath, 'utf8');
  const firstLine = content.split('\n')[0].substring(0, 100);
  
  return `${path.basename(filePath)} | ${stats.size} bytes | 首行: ${firstLine}...`;
}

function generateContentSummary(fileName, content) {
  const firstLine = content.split('\n')[0].substring(0, 100);
  return `${fileName} | ${content.length} chars | 首行: ${firstLine}...`;
}

module.exports = {
  calculateFileHash,
  calculateContentHash,
  generateFileSummary,
  generateContentSummary
};