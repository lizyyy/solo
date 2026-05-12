const fs = require('fs');
const { FILES, ensureDir, DEFAULT_DATA_DIR } = require('./config');

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  return content.trim() ? JSON.parse(content) : [];
}

function writeJsonFile(filePath, data) {
  ensureDir(DEFAULT_DATA_DIR);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function getAllStores() {
  return readJsonFile(FILES.STORES);
}

function saveStores(stores) {
  writeJsonFile(FILES.STORES, stores);
}

function getStoreById(storeId) {
  return getAllStores().find(s => s.id === storeId);
}

function getAllInspections() {
  return readJsonFile(FILES.INSPECTIONS);
}

function saveInspections(inspections) {
  writeJsonFile(FILES.INSPECTIONS, inspections);
}

function getInspectionById(inspectionId) {
  return getAllInspections().find(i => i.id === inspectionId);
}

function getAllIssues() {
  return readJsonFile(FILES.ISSUES);
}

function saveIssues(issues) {
  writeJsonFile(FILES.ISSUES, issues);
}

function getIssueById(issueId) {
  return getAllIssues().find(i => i.id === issueId);
}

function getIssuesByInspection(inspectionId) {
  return getAllIssues().filter(i => i.inspectionId === inspectionId);
}

function getIssuesByStore(storeId) {
  return getAllIssues().filter(i => i.storeId === storeId);
}

function getAllCorrections() {
  return readJsonFile(FILES.CORRECTIONS);
}

function saveCorrections(corrections) {
  writeJsonFile(FILES.CORRECTIONS, corrections);
}

function getCorrectionsByIssue(issueId) {
  return getAllCorrections().filter(c => c.issueId === issueId);
}

function getLatestCorrection(issueId) {
  const corrections = getCorrectionsByIssue(issueId);
  return corrections.length > 0 ? corrections[corrections.length - 1] : null;
}

function getAllReinspections() {
  return readJsonFile(FILES.REINSPECTIONS);
}

function saveReinspections(reinspections) {
  writeJsonFile(FILES.REINSPECTIONS, reinspections);
}

function getReinspectionsByIssue(issueId) {
  return getAllReinspections().filter(r => r.issueId === issueId);
}

function getLatestReinspection(issueId) {
  const reinspections = getReinspectionsByIssue(issueId);
  return reinspections.length > 0 ? reinspections[reinspections.length - 1] : null;
}

function getAllScores() {
  return readJsonFile(FILES.SCORES);
}

function saveScores(scores) {
  writeJsonFile(FILES.SCORES, scores);
}

function getAllLogs() {
  return readJsonFile(FILES.LOGS);
}

function saveLogs(logs) {
  writeJsonFile(FILES.LOGS, logs);
}

function addLog(log) {
  const logs = getAllLogs();
  logs.push({
    ...log,
    timestamp: new Date().toISOString()
  });
  saveLogs(logs);
}

module.exports = {
  readJsonFile,
  writeJsonFile,
  getAllStores,
  saveStores,
  getStoreById,
  getAllInspections,
  saveInspections,
  getInspectionById,
  getAllIssues,
  saveIssues,
  getIssueById,
  getIssuesByInspection,
  getIssuesByStore,
  getAllCorrections,
  saveCorrections,
  getCorrectionsByIssue,
  getLatestCorrection,
  getAllReinspections,
  saveReinspections,
  getReinspectionsByIssue,
  getLatestReinspection,
  getAllScores,
  saveScores,
  getAllLogs,
  saveLogs,
  addLog
};
