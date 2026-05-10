const path = require('path');
const fs = require('fs');
const { PENDING_DIR, CONFIRMED_DIR } = require('../utils/constants');
const helpers = require('../utils/helpers');

function getPendingPath(date) {
  return path.join(PENDING_DIR, `${date}_pending.json`);
}

function getConfirmedPath(date) {
  return path.join(CONFIRMED_DIR, `${date}_review.json`);
}

function isDateConfirmed(date) {
  return fs.existsSync(getConfirmedPath(date));
}

function isDatePending(date) {
  return fs.existsSync(getPendingPath(date));
}

function savePending(date, data) {
  helpers.ensureDir(PENDING_DIR);
  const pendingPath = getPendingPath(date);
  
  const existing = helpers.readJSON(pendingPath);
  if (existing) {
    const mergedData = {
      ...existing.data,
      ...data
    };
    const record = {
      date,
      importedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      data: mergedData
    };
    helpers.writeJSON(pendingPath, record);
    return { status: 'updated', record };
  } else {
    const record = {
      date,
      importedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      data
    };
    helpers.writeJSON(pendingPath, record);
    return { status: 'created', record };
  }
}

function getPending(date) {
  return helpers.readJSON(getPendingPath(date));
}

function getConfirmed(date) {
  return helpers.readJSON(getConfirmedPath(date));
}

function saveConfirmed(date, reviewData) {
  helpers.ensureDir(CONFIRMED_DIR);
  
  if (isDateConfirmed(date)) {
    throw new Error(`日期 ${date} 已存在确认记录，不能重复确认`);
  }
  
  const pending = getPending(date);
  if (!pending) {
    throw new Error(`日期 ${date} 没有待处理数据，请先导入数据`);
  }
  
  const record = {
    date,
    data: pending.data,
    review: reviewData,
    confirmedAt: new Date().toISOString()
  };
  
  helpers.writeJSON(getConfirmedPath(date), record);
  return record;
}

function listConfirmed() {
  if (!fs.existsSync(CONFIRMED_DIR)) {
    return [];
  }
  
  const files = fs.readdirSync(CONFIRMED_DIR)
    .filter(file => file.endsWith('_review.json'))
    .sort();
  
  return files.map(file => {
    const date = file.replace('_review.json', '');
    const record = helpers.readJSON(path.join(CONFIRMED_DIR, file));
    return {
      date,
      confirmedAt: record?.confirmedAt,
      summary: record?.review?.summary
    };
  });
}

function exportData(date, outputPath) {
  const confirmed = getConfirmed(date);
  if (!confirmed) {
    throw new Error(`日期 ${date} 没有确认记录`);
  }
  
  helpers.ensureDir(path.dirname(outputPath));
  helpers.writeJSON(outputPath, confirmed);
  return outputPath;
}

function checkDuplicateImport(date) {
  const isConfirmed = isDateConfirmed(date);
  const isPending = isDatePending(date);
  
  return {
    hasConfirmed: isConfirmed,
    hasPending: isPending,
    canImport: !isConfirmed
  };
}

module.exports = {
  isDateConfirmed,
  isDatePending,
  savePending,
  getPending,
  getConfirmed,
  saveConfirmed,
  listConfirmed,
  exportData,
  checkDuplicateImport,
  getPendingPath,
  getConfirmedPath
};
