const { createObjectCsvWriter } = require('csv-writer');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

const EXPORT_DIR = path.join(os.tmpdir(), 'logistics-exports');

if (!fs.existsSync(EXPORT_DIR)) {
  fs.mkdirSync(EXPORT_DIR, { recursive: true });
}

function ensureExportDir() {
  if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
  }
}

async function exportRepairsToCSV(records, extraFields = {}) {
  ensureExportDir();
  const fileName = `repairs_${uuidv4()}.csv`;
  const filePath = path.join(EXPORT_DIR, fileName);

  const csvWriter = createObjectCsvWriter({
    path: filePath,
    header: [
      { id: 'requestId', title: '报修单号' },
      { id: 'building', title: '宿舍楼栋' },
      { id: 'room', title: '房间号' },
      { id: 'repairType', title: '报修类型' },
      { id: 'description', title: '报修内容' },
      { id: 'reporter', title: '报修人' },
      { id: 'reportedAt', title: '报修时间' },
      { id: 'assignedWorkerId', title: '维修工号' },
      { id: 'status', title: '状态' },
      { id: 'completedAt', title: '完成时间' },
      { id: 'isDuplicate', title: '是否重复' },
      { id: 'duplicateReason', title: '重复原因' },
      { id: 'batchId', title: '批次号' },
      ...(extraFields.columns || [])
    ]
  });

  await csvWriter.writeRecords(records);
  return { filePath, fileName, recordCount: records.length };
}

async function exportRatingsToCSV(records) {
  ensureExportDir();
  const fileName = `ratings_${uuidv4()}.csv`;
  const filePath = path.join(EXPORT_DIR, fileName);

  const csvWriter = createObjectCsvWriter({
    path: filePath,
    header: [
      { id: 'ratingId', title: '评分单号' },
      { id: 'requestId', title: '报修单号' },
      { id: 'workerId', title: '维修工号' },
      { id: 'score', title: '评分' },
      { id: 'comment', title: '评价' },
      { id: 'ratedBy', title: '评分人' },
      { id: 'ratedAt', title: '评分时间' },
      { id: 'isMalicious', title: '是否恶意' },
      { id: 'maliciousReason', title: '恶意原因' },
      { id: 'appealStatus', title: '申诉状态' }
    ]
  });

  await csvWriter.writeRecords(records);
  return { filePath, fileName, recordCount: records.length };
}

async function exportAppealsToCSV(records) {
  ensureExportDir();
  const fileName = `appeals_${uuidv4()}.csv`;
  const filePath = path.join(EXPORT_DIR, fileName);

  const csvWriter = createObjectCsvWriter({
    path: filePath,
    header: [
      { id: 'appealId', title: '申诉单号' },
      { id: 'ratingId', title: '评分单号' },
      { id: 'requestId', title: '报修单号' },
      { id: 'workerId', title: '维修工号' },
      { id: 'appellant', title: '申诉人' },
      { id: 'appellantRole', title: '申诉人角色' },
      { id: 'appealReason', title: '申诉理由' },
      { id: 'appealStatus', title: '申诉状态' },
      { id: 'reviewReason', title: '审核意见' },
      { id: 'reviewedBy', title: '审核人' },
      { id: 'reviewedAt', title: '审核时间' }
    ]
  });

  await csvWriter.writeRecords(records);
  return { filePath, fileName, recordCount: records.length };
}

function getExportFilePath(fileName) {
  return path.join(EXPORT_DIR, fileName);
}

module.exports = {
  exportRepairsToCSV,
  exportRatingsToCSV,
  exportAppealsToCSV,
  getExportFilePath,
  EXPORT_DIR
};
