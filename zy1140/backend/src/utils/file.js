const fs = require('fs-extra');
const path = require('path');

async function ensureDirectories(directories) {
  for (const dir of directories) {
    await fs.ensureDir(dir);
  }
}

function getFileExtension(filename) {
  return path.extname(filename).toLowerCase().slice(1);
}

function detectFileType(filename, content = '') {
  const ext = getFileExtension(filename);
  
  if (ext === 'xml') {
    if (content.includes('<HealthData') || content.includes('<Record') || content.includes('<Workout')) {
      return 'apple-health-xml';
    }
    return 'xml';
  }
  
  if (ext === 'gpx') {
    return 'gpx';
  }
  
  if (ext === 'csv') {
    if (content.includes('date') && content.includes('note')) {
      return 'daily-notes';
    }
    return 'csv';
  }
  
  if (ext === 'json') {
    try {
      const parsed = JSON.parse(content);
      if (parsed.thresholds || (parsed.category && parsed.key) || Array.isArray(parsed)) {
        return 'thresholds';
      }
    } catch (e) {}
    return 'json';
  }
  
  return 'unknown';
}

async function readFileWithEncoding(filePath) {
  let content = await fs.readFile(filePath, 'utf8');
  
  if (content.startsWith('\uFEFF')) {
    content = content.slice(1);
  }
  
  return content;
}

module.exports = {
  ensureDirectories,
  getFileExtension,
  detectFileType,
  readFileWithEncoding,
};
