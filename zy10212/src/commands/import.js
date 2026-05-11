const fs = require('fs');
const path = require('path');
const { generateId, now, parseDate, logSuccess, logError, logInfo } = require('../utils');
const store = require('../store');

function parseCsv(content) {
  const lines = content.trim().split('\n');
  if (lines.length === 0) return [];

  const headers = lines[0].split(',').map(h => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    if (values.length === 0 || (values.length === 1 && values[0] === '')) continue;

    const row = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] || '';
    });
    rows.push(row);
  }

  return rows;
}

function getFileHash(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return `${content.length}|${content.substring(0, 100)}`;
}

function isDuplicateImport(storeType, importType, filePath) {
  const batches = store.getImportBatches(storeType);
  const fileHash = getFileHash(filePath);

  return batches.some(
    b => b.importType === importType && b.fileHash === fileHash
  );
}

function importSpecs(filePath) {
  const batches = store.getImportBatches('pending');
  const fileHash = getFileHash(filePath);

  const existing = batches.find(
    b => b.importType === 'specs' && b.fileHash === fileHash
  );
  if (existing) {
    logInfo(`规格数据已在批次 [${existing.id}] 导入过，跳过重复导入`);
    return existing;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const rows = parseCsv(content);

  if (rows.length === 0) {
    logError('CSV文件为空');
    return null;
  }

  const specs = store.getSpecs('pending');
  const existingIds = new Set(specs.map(s => s.id));

  const newSpecs = rows.filter(r => !existingIds.has(r.id)).map(r => ({
    id: r.id || generateId('S'),
    name: r.name,
    unit: r.unit || '张',
    importedAt: now()
  }));

  if (newSpecs.length > 0) {
    store.saveSpecs('pending', [...specs, ...newSpecs]);
  }

  const batchId = generateId('B');
  const batch = {
    id: batchId,
    importType: 'specs',
    importedAt: now(),
    sourceFile: path.basename(filePath),
    fileHash,
    recordCount: newSpecs.length,
    status: 'pending'
  };

  store.saveImportBatches('pending', [...batches, batch]);
  logSuccess(`导入规格: ${newSpecs.length} 条 (批次: ${batchId})`);

  return batch;
}

function importCourses(filePath) {
  const batches = store.getImportBatches('pending');
  const fileHash = getFileHash(filePath);

  const existing = batches.find(
    b => b.importType === 'courses' && b.fileHash === fileHash
  );
  if (existing) {
    logInfo(`课程数据已在批次 [${existing.id}] 导入过，跳过重复导入`);
    return existing;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const rows = parseCsv(content);

  if (rows.length === 0) {
    logError('CSV文件为空');
    return null;
  }

  const courses = store.getCourses('pending');
  const existingIds = new Set(courses.map(c => c.id));

  const newCourses = rows.filter(r => !existingIds.has(r.id)).map(r => ({
    id: r.id || generateId('C'),
    studentId: r.studentId,
    studentName: r.studentName,
    courseName: r.courseName,
    lessonNumber: r.lessonNumber ? parseInt(r.lessonNumber) : null,
    date: parseDate(r.date),
    status: r.status || 'upcoming',
    importedAt: now()
  }));

  if (newCourses.length > 0) {
    store.saveCourses('pending', [...courses, ...newCourses]);
  }

  const batchId = generateId('B');
  const batch = {
    id: batchId,
    importType: 'courses',
    importedAt: now(),
    sourceFile: path.basename(filePath),
    fileHash,
    recordCount: newCourses.length,
    status: 'pending'
  };

  store.saveImportBatches('pending', [...batches, batch]);
  logSuccess(`导入课程: ${newCourses.length} 条 (批次: ${batchId})`);

  return batch;
}

function importTransactions(filePath, type) {
  const batches = store.getImportBatches('pending');
  const fileHash = getFileHash(filePath);

  const existing = batches.find(
    b => b.importType === type && b.fileHash === fileHash
  );
  if (existing) {
    logInfo(`${type}数据已在批次 [${existing.id}] 导入过，跳过重复导入`);
    return existing;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const rows = parseCsv(content);

  if (rows.length === 0) {
    logError('CSV文件为空');
    return null;
  }

  if (type === 'reissues') {
    const invalidRows = rows.filter(r => !r.approvedBy || !r.approvedAt || !r.reasonText);
    if (invalidRows.length > 0) {
      logError(`补发记录必须提供审批人、审批时间和补发原因，${invalidRows.length} 条记录无效`);
      invalidRows.forEach((r, idx) => {
        const missing = [];
        if (!r.approvedBy) missing.push('审批人(approvedBy)');
        if (!r.approvedAt) missing.push('审批时间(approvedAt)');
        if (!r.reasonText) missing.push('补发原因(reasonText)');
        logError(`  第${idx + 1}行缺失: ${missing.join(', ')}`);
      });
      return null;
    }
  }

  const transactions = store.getTransactions('pending');

  const qtyMultiplier = type === 'issues' ? -1 : type === 'inventory' ? 1 : type === 'reissues' ? -1 : 1;

  const newTransactions = rows.map(r => ({
    id: generateId('T'),
    type: type === 'issues' ? 'issue' : type === 'inventory' ? 'inventory_check' : type === 'reissues' ? 'reissue' : type === 'refunds' ? 'refund' : type,
    specId: r.specId,
    studentId: r.studentId || null,
    studentName: r.studentName || null,
    courseId: r.courseId || null,
    quantity: (parseInt(r.quantity) || 0) * qtyMultiplier,
    reasonCode: r.reasonCode || null,
    reasonText: r.reasonText || null,
    approvedBy: r.approvedBy || null,
    approvedAt: r.approvedAt ? parseDate(r.approvedAt) : null,
    status: 'pending',
    importSourceFile: path.basename(filePath),
    importedAt: now()
  }));

  store.saveTransactions('pending', [...transactions, ...newTransactions]);

  const batchId = generateId('B');
  const batch = {
    id: batchId,
    importType: type,
    importedAt: now(),
    sourceFile: path.basename(filePath),
    fileHash,
    recordCount: newTransactions.length,
    status: 'pending'
  };

  store.saveImportBatches('pending', [...batches, batch]);
  logSuccess(`导入${type === 'issues' ? '发放' : type === 'inventory' ? '盘点' : type === 'reissues' ? '补发' : '退费'}记录: ${newTransactions.length} 条 (批次: ${batchId})`);

  return batch;
}

function importIssues(filePath) {
  return importTransactions(filePath, 'issues');
}

function importInventory(filePath) {
  return importTransactions(filePath, 'inventory');
}

function importReissues(filePath) {
  return importTransactions(filePath, 'reissues');
}

function importRefunds(filePath) {
  return importTransactions(filePath, 'refunds');
}

module.exports = {
  importSpecs,
  importCourses,
  importIssues,
  importInventory,
  importReissues,
  importRefunds,
  isDuplicateImport,
  parseCsv
};
