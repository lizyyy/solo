const fs = require('fs');
const path = require('path');
const logger = require('./logger');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    logger.error(`读取文件失败: ${filePath}`, error.message);
    return null;
  }
}

function writeJson(filePath, data, pretty = true) {
  ensureDir(path.dirname(filePath));
  const content = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
  fs.writeFileSync(filePath, content, 'utf8');
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
}

function getCurrentAuditId(workDir) {
  const currentFile = path.join(workDir, '.current');
  if (fs.existsSync(currentFile)) {
    return fs.readFileSync(currentFile, 'utf8').trim();
  }
  return null;
}

function setCurrentAuditId(workDir, auditId) {
  const currentFile = path.join(workDir, '.current');
  ensureDir(workDir);
  fs.writeFileSync(currentFile, auditId, 'utf8');
}

function getAuditDir(workDir, auditId) {
  return path.join(workDir, 'audits', auditId);
}

function getAuditData(workDir, auditId) {
  const auditDir = getAuditDir(workDir, auditId);
  const auditFile = path.join(auditDir, 'audit.json');
  return readJson(auditFile);
}

function saveAuditData(workDir, auditId, data) {
  const auditDir = getAuditDir(workDir, auditId);
  const auditFile = path.join(auditDir, 'audit.json');
  writeJson(auditFile, data);
}

function getAuditDataFile(workDir, auditId, dataType) {
  const auditDir = getAuditDir(workDir, auditId);
  const dataDir = path.join(auditDir, 'data');
  ensureDir(dataDir);
  return path.join(dataDir, `${dataType}.json`);
}

function readDataType(workDir, auditId, dataType) {
  const filePath = getAuditDataFile(workDir, auditId, dataType);
  return readJson(filePath) || [];
}

function writeDataType(workDir, auditId, dataType, data) {
  const filePath = getAuditDataFile(workDir, auditId, dataType);
  writeJson(filePath, data);
}

function getLogFile(workDir, auditId) {
  const auditDir = getAuditDir(workDir, auditId);
  return path.join(auditDir, 'log.json');
}

function readLog(workDir, auditId) {
  const logFile = getLogFile(workDir, auditId);
  return readJson(logFile) || [];
}

function writeLog(workDir, auditId, logs) {
  const logFile = getLogFile(workDir, auditId);
  writeJson(logFile, logs);
}

function addLogEntry(workDir, auditId, entry) {
  const logs = readLog(workDir, auditId);
  logs.push({
    id: generateId(),
    timestamp: new Date().toISOString(),
    ...entry
  });
  writeLog(workDir, auditId, logs);
}

function listAudits(workDir) {
  const auditsDir = path.join(workDir, 'audits');
  if (!fs.existsSync(auditsDir)) {
    return [];
  }
  
  const auditIds = fs.readdirSync(auditsDir).filter(item => {
    const itemPath = path.join(auditsDir, item);
    return fs.statSync(itemPath).isDirectory();
  });
  
  const audits = [];
  for (const auditId of auditIds) {
    const auditData = getAuditData(workDir, auditId);
    if (auditData) {
      audits.push({
        id: auditId,
        ...auditData
      });
    }
  }
  
  return audits.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

module.exports = {
  ensureDir,
  readJson,
  writeJson,
  generateId,
  getCurrentAuditId,
  setCurrentAuditId,
  getAuditDir,
  getAuditData,
  saveAuditData,
  getAuditDataFile,
  readDataType,
  writeDataType,
  getLogFile,
  readLog,
  writeLog,
  addLogEntry,
  listAudits
};
