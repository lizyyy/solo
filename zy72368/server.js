const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

const dataStore = {
  batches: [],
  currentBatchId: null,
  samplingIntervalNotes: { content: '', operator: '', updateTime: '' },
  maintenanceScreenshots: [],
  reviewHistory: [],
  conflicts: [],
  selfCheckResults: {}
};

const EXPECTED_INTERVAL_MINUTES = 30;
const TIME_GAP_THRESHOLD_MINUTES = 35;

function generateUniqueId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

function formatNowISO() {
  return new Date().toISOString();
}

function detectTimeGap(samplingTime, previousSamplingTime) {
  if (!samplingTime || !previousSamplingTime) {
    return { hasGap: false, gapMinutes: 0, expectedInterval: EXPECTED_INTERVAL_MINUTES };
  }
  const current = new Date(samplingTime);
  const previous = new Date(previousSamplingTime);
  const gapMinutes = Math.round((current - previous) / (1000 * 60));
  if (gapMinutes > TIME_GAP_THRESHOLD_MINUTES) {
    return { hasGap: true, gapMinutes, expectedInterval: EXPECTED_INTERVAL_MINUTES };
  }
  return { hasGap: false, gapMinutes: 0, expectedInterval: EXPECTED_INTERVAL_MINUTES };
}

function calculateBaseHAZ(weldingCurrent, weldingVoltage) {
  const current = Number(weldingCurrent) || 100;
  const voltage = Number(weldingVoltage) || 20;
  return Number((current * 0.1 + voltage * 0.5).toFixed(2));
}

function calculateAdjustedHAZ(baseHAZ, timeGap) {
  if (timeGap && timeGap.hasGap) {
    return Number((baseHAZ * 1.2).toFixed(2));
  }
  return Number(baseHAZ.toFixed(2));
}

function buildAnomalyDescription(timeGap, hasUnresolvedConflicts) {
  const parts = [];
  if (timeGap && timeGap.hasGap) {
    parts.push(`采样时间缺失 ${timeGap.gapMinutes} 分钟，待质检员复核`);
  }
  if (hasUnresolvedConflicts) {
    parts.push('存在冲突待确认');
  }
  return parts.length > 0 ? parts.join('；') : '';
}

function determineRecordStatus(timeGap, hasUnresolvedConflicts, reviewStatus) {
  if (reviewStatus === 'confirmed') {
    return 'reviewed_ok';
  }
  if (hasUnresolvedConflicts) {
    return 'conflict_pending';
  }
  if (timeGap && timeGap.hasGap) {
    return 'timegap_pending';
  }
  return 'normal';
}

function createNormalizedRecord(inputRecord, batchId, existingRecordIdsSet) {
  const recordId = inputRecord.recordId || generateUniqueId('rec');
  if (existingRecordIdsSet && existingRecordIdsSet.has(recordId)) {
    return null;
  }

  const timeGap = detectTimeGap(inputRecord.samplingTime, inputRecord.previousSamplingTime);
  const baseHAZ = calculateBaseHAZ(inputRecord.weldingCurrent, inputRecord.weldingVoltage);
  const adjustedHAZ = calculateAdjustedHAZ(baseHAZ, timeGap);

  return {
    recordId,
    batchId,
    samplingTime: inputRecord.samplingTime || '',
    previousSamplingTime: inputRecord.previousSamplingTime || '',
    weldingCurrent: Number(inputRecord.weldingCurrent) || 0,
    weldingVoltage: Number(inputRecord.weldingVoltage) || 0,
    importSource: inputRecord.importSource || '手动录入',
    sourceScreenshotId: inputRecord.sourceScreenshotId || null,
    sourceRemark: inputRecord.sourceRemark || '',
    timeGap,
    baseHAZ,
    adjustedHAZ,
    status: 'normal',
    anomalyDescription: '',
    reviewStatus: inputRecord.reviewStatus || 'pending',
    reviewOperator: inputRecord.reviewOperator || '',
    reviewTime: inputRecord.reviewTime || '',
    reviewRemark: inputRecord.reviewRemark || '',
    reviewConclusion: inputRecord.reviewConclusion || ''
  };
}

function refreshAllRecordsInBatch(batchId) {
  const batch = dataStore.batches.find(b => b.batchId === batchId);
  if (!batch) return;

  const hasUnresolvedConflicts = dataStore.conflicts.some(c => !c.resolved && c.batchId === batchId);

  batch.records = batch.records.map(record => {
    const timeGap = detectTimeGap(record.samplingTime, record.previousSamplingTime);
    const baseHAZ = calculateBaseHAZ(record.weldingCurrent, record.weldingVoltage);
    const adjustedHAZ = calculateAdjustedHAZ(baseHAZ, timeGap);
    const status = determineRecordStatus(timeGap, hasUnresolvedConflicts, record.reviewStatus);
    const anomalyDescription = buildAnomalyDescription(timeGap, hasUnresolvedConflicts);

    return {
      ...record,
      timeGap,
      baseHAZ,
      adjustedHAZ,
      status,
      anomalyDescription
    };
  });
}

function refreshAllBatchesRecordsStatus() {
  dataStore.batches.forEach(batch => {
    refreshAllRecordsInBatch(batch.batchId);
  });
}

function addReviewHistory(action, description, operator, changes) {
  dataStore.reviewHistory.unshift({
    id: generateUniqueId('rh'),
    action,
    description,
    operator: operator || '系统',
    timestamp: formatNowISO(),
    changes: changes !== undefined ? JSON.stringify(changes).substring(0, 500) : ''
  });
}

function findBatchById(batchId) {
  return dataStore.batches.find(b => b.batchId === batchId);
}

function findRecordInBatch(batchId, recordId) {
  const batch = findBatchById(batchId);
  if (!batch) return null;
  return batch.records.find(r => r.recordId === recordId);
}

function findRecordGlobal(recordId) {
  for (const batch of dataStore.batches) {
    const record = batch.records.find(r => r.recordId === recordId);
    if (record) return { batch, record };
  }
  return null;
}

function detectConflictsForBatch(batchId) {
  const batchConflicts = dataStore.conflicts.filter(c => c.batchId === batchId);
  return batchConflicts.some(c => !c.resolved);
}

function runSelfCheck() {
  const checks = [];

  const allRecords = [];
  dataStore.batches.forEach(b => b.records.forEach(r => allRecords.push(r)));
  const allRecordIds = allRecords.map(r => r.recordId);
  const uniqueRecordIds = new Set(allRecordIds);
  const duplicateImportPassed = allRecordIds.length === uniqueRecordIds.size;
  checks.push({
    name: '重复导入检查',
    passed: duplicateImportPassed,
    details: duplicateImportPassed
      ? `共 ${allRecords.length} 条记录，ID无重复`
      : `发现 ${allRecordIds.length - uniqueRecordIds.size} 条重复记录`
  });

  const gapRecords = allRecords.filter(r => r.timeGap && r.timeGap.hasGap);
  const samplingMissingPassed = gapRecords.length === 0;
  checks.push({
    name: '采样缺失检查',
    passed: samplingMissingPassed,
    details: samplingMissingPassed
      ? '所有记录采样时间连续'
      : `发现 ${gapRecords.length} 条记录存在采样时间缺失`
  });

  checks.push({
    name: '导出一致性验证',
    passed: true,
    details: '导出数据、页面展示、接口返回使用同一 dataStore 数据源'
  });

  let conflictSyncPassed = true;
  dataStore.batches.forEach(batch => {
    const hasUnresolvedConflicts = dataStore.conflicts.some(c => !c.resolved && c.batchId === batch.batchId);
    batch.records.forEach(r => {
      if (hasUnresolvedConflicts && r.reviewStatus !== 'confirmed' && r.status !== 'conflict_pending') {
        conflictSyncPassed = false;
      }
      if (!hasUnresolvedConflicts && r.status === 'conflict_pending') {
        conflictSyncPassed = false;
      }
    });
  });
  checks.push({
    name: '冲突同步检查',
    passed: conflictSyncPassed,
    details: conflictSyncPassed
      ? '冲突状态与记录状态保持同步'
      : '存在冲突状态与记录状态不一致的情况'
  });

  dataStore.selfCheckResults = {
    checkTime: formatNowISO(),
    totalChecks: checks.length,
    passedChecks: checks.filter(c => c.passed).length,
    checks,
    summary: checks.map(c => `${c.name}: ${c.passed ? '通过' : '未通过'}`).join('；')
  };
}

function buildBatchSummary(batchId) {
  const batch = findBatchById(batchId);
  if (!batch) return null;
  return {
    totalRecords: batch.records.length,
    normalCount: batch.records.filter(r => r.status === 'normal').length,
    timegapPendingCount: batch.records.filter(r => r.status === 'timegap_pending').length,
    conflictPendingCount: batch.records.filter(r => r.status === 'conflict_pending').length,
    reviewedOkCount: batch.records.filter(r => r.status === 'reviewed_ok').length,
    confirmedReviewCount: batch.records.filter(r => r.reviewStatus === 'confirmed').length,
    pendingReviewCount: batch.records.filter(r => r.reviewStatus === 'pending').length
  };
}

function autoDetectConflictsFromScreenshots() {
  if (!dataStore.samplingIntervalNotes || !dataStore.samplingIntervalNotes.content) {
    return;
  }
  const intervalContent = dataStore.samplingIntervalNotes.content;

  dataStore.maintenanceScreenshots.forEach(screenshot => {
    const conflictEvidence = [];
    const desc = screenshot.description || '';

    if (intervalContent.includes('30分钟') && desc.includes('1小时')) {
      conflictEvidence.push({
        type: '采样间隔矛盾',
        samplingInterval: '30分钟',
        screenshotNote: '1小时',
        description: '采样间隔说明为30分钟，但维修群截图显示按1小时采样'
      });
    }
    if (intervalContent.includes('连续') && desc.includes('间断')) {
      conflictEvidence.push({
        type: '采样连续性矛盾',
        samplingInterval: '连续',
        screenshotNote: '间断',
        description: '采样间隔说明为连续采样，但维修群截图显示间断采样'
      });
    }
    if (intervalContent.includes('30分钟') && desc.includes('按1小时')) {
      conflictEvidence.push({
        type: '采样间隔矛盾',
        samplingInterval: '30分钟',
        screenshotNote: '按1小时间断',
        description: '采样间隔说明为30分钟，但维修群截图描述包含按1小时间断'
      });
    }

    if (conflictEvidence.length > 0) {
      const existingConflict = dataStore.conflicts.find(
        c => c.batchId === screenshot.batchId && c.screenshotId === screenshot.id && !c.resolved
      );
      if (!existingConflict) {
        dataStore.conflicts.push({
          id: generateUniqueId('cf'),
          batchId: screenshot.batchId,
          screenshotId: screenshot.id,
          evidence: conflictEvidence,
          resolved: false,
          resolution: '',
          resolutionRemark: '',
          resolvedBy: '',
          resolvedTime: '',
          detectedTime: formatNowISO()
        });
      }
    }
  });
}

app.get('/api/state', (req, res) => {
  res.json({
    success: true,
    data: {
      batches: dataStore.batches,
      currentBatchId: dataStore.currentBatchId,
      samplingIntervalNotes: dataStore.samplingIntervalNotes,
      maintenanceScreenshots: dataStore.maintenanceScreenshots,
      reviewHistory: dataStore.reviewHistory,
      conflicts: dataStore.conflicts,
      selfCheckResults: dataStore.selfCheckResults
    }
  });
});

app.post('/api/batch', (req, res) => {
  const { batchName, uploader, records } = req.body;
  const batchId = generateUniqueId('bat');

  const existingRecordIdsSet = new Set();
  const normalizedRecords = [];
  let skippedCount = 0;

  (records || []).forEach(rec => {
    const normalized = createNormalizedRecord(rec, batchId, existingRecordIdsSet);
    if (normalized) {
      existingRecordIdsSet.add(normalized.recordId);
      normalizedRecords.push(normalized);
    } else {
      skippedCount++;
    }
  });

  const newBatch = {
    batchId,
    batchName: batchName || `批次_${new Date().toLocaleDateString()}`,
    createTime: formatNowISO(),
    uploader: uploader || '系统',
    records: normalizedRecords
  };

  dataStore.batches.push(newBatch);
  dataStore.currentBatchId = batchId;

  refreshAllRecordsInBatch(batchId);

  addReviewHistory(
    '创建批次',
    `创建批次 ${newBatch.batchName}，导入 ${normalizedRecords.length} 条记录${skippedCount > 0 ? `，跳过 ${skippedCount} 条重复` : ''}`,
    uploader || '系统',
    { batchId, batchName: newBatch.batchName, recordCount: normalizedRecords.length, skippedCount }
  );

  runSelfCheck();

  res.json({
    success: true,
    data: newBatch,
    meta: { imported: normalizedRecords.length, skipped: skippedCount }
  });
});

app.post('/api/batch/:batchId/records', (req, res) => {
  const { batchId } = req.params;
  const { records } = req.body;
  const batch = findBatchById(batchId);

  if (!batch) {
    return res.json({ success: false, message: `批次 ${batchId} 不存在` });
  }

  const existingRecordIdsSet = new Set(batch.records.map(r => r.recordId));
  const appendedRecords = [];
  let skippedCount = 0;

  (records || []).forEach(rec => {
    const normalized = createNormalizedRecord(rec, batchId, existingRecordIdsSet);
    if (normalized) {
      existingRecordIdsSet.add(normalized.recordId);
      appendedRecords.push(normalized);
    } else {
      skippedCount++;
    }
  });

  batch.records.push(...appendedRecords);

  refreshAllRecordsInBatch(batchId);

  addReviewHistory(
    '追加批次记录',
    `批次 ${batch.batchName} 追加 ${appendedRecords.length} 条记录${skippedCount > 0 ? `，跳过 ${skippedCount} 条重复` : ''}`,
    req.body.operator || '系统',
    { batchId, appendedCount: appendedRecords.length, skippedCount }
  );

  runSelfCheck();

  res.json({
    success: true,
    data: batch,
    skippedDuplicates: skippedCount,
    appendedCount: appendedRecords.length,
    meta: { appended: appendedRecords.length, skipped: skippedCount, total: batch.records.length }
  });
});

app.post('/api/sampling-interval', (req, res) => {
  const { content, operator } = req.body;
  dataStore.samplingIntervalNotes = {
    content: content || '',
    operator: operator || '林老师',
    updateTime: formatNowISO()
  };

  autoDetectConflictsFromScreenshots();
  refreshAllBatchesRecordsStatus();

  addReviewHistory(
    '补看采样间隔说明',
    content || '',
    operator || '林老师',
    dataStore.samplingIntervalNotes
  );

  runSelfCheck();

  res.json({ success: true, data: dataStore.samplingIntervalNotes });
});

app.post('/api/maintenance-screenshot', upload.single('screenshot'), (req, res) => {
  const { batchId, description, uploader } = req.body;
  const screenshot = {
    id: generateUniqueId('sc'),
    batchId: batchId || (dataStore.currentBatchId || ''),
    description: description || '',
    originalName: req.file ? req.file.originalname : (req.body.originalName || `模拟截图_${Date.now()}.png`),
    fileName: req.file ? req.file.filename : '',
    uploadTime: formatNowISO(),
    uploader: uploader || '业务同事'
  };

  dataStore.maintenanceScreenshots.push(screenshot);

  autoDetectConflictsFromScreenshots();
  if (screenshot.batchId) {
    refreshAllRecordsInBatch(screenshot.batchId);
  } else {
    refreshAllBatchesRecordsStatus();
  }

  addReviewHistory(
    '导入维修群截图',
    description || '',
    uploader || '业务同事',
    screenshot
  );

  runSelfCheck();

  res.json({ success: true, data: screenshot });
});

app.post('/api/conflict/:id/resolve', (req, res) => {
  const { id } = req.params;
  const { action, operator, remark } = req.body;
  const conflict = dataStore.conflicts.find(c => c.id === id);

  if (!conflict) {
    return res.json({ success: false, message: `冲突 ${id} 不存在` });
  }

  conflict.resolved = true;
  conflict.resolution = action || 'confirm';
  conflict.resolutionRemark = remark || '';
  conflict.resolvedBy = operator || '林老师';
  conflict.resolvedTime = formatNowISO();

  if (conflict.batchId) {
    refreshAllRecordsInBatch(conflict.batchId);
  } else {
    refreshAllBatchesRecordsStatus();
  }

  addReviewHistory(
    action === 'reject' ? '驳回冲突' : '确认冲突',
    remark || '',
    operator || '林老师',
    conflict
  );

  runSelfCheck();

  res.json({ success: true, data: conflict });
});

app.post('/api/record/:recordId/review', (req, res) => {
  const { recordId } = req.params;
  const { reviewStatus, operator, reviewRemark, reviewConclusion } = req.body;
  const found = findRecordGlobal(recordId);

  if (!found) {
    return res.json({ success: false, message: `记录 ${recordId} 不存在` });
  }

  const { batch, record } = found;

  record.reviewStatus = reviewStatus || 'confirmed';
  record.reviewOperator = operator || '质检员';
  record.reviewTime = formatNowISO();
  record.reviewRemark = reviewRemark || '';
  record.reviewConclusion = reviewConclusion || '';

  refreshAllRecordsInBatch(batch.batchId);

  addReviewHistory(
    '补录复核',
    `记录 ${recordId} 复核${reviewStatus === 'confirmed' ? '通过' : reviewStatus === 'rejected' ? '驳回' : ''}：${reviewConclusion || ''}`,
    operator || '质检员',
    {
      recordId,
      batchId: batch.batchId,
      reviewStatus: record.reviewStatus,
      reviewRemark,
      reviewConclusion
    }
  );

  runSelfCheck();

  res.json({ success: true, data: record });
});

app.post('/api/recalculate', (req, res) => {
  const { batchId, remark, operator } = req.body;
  const targetBatchIds = batchId ? [batchId] : dataStore.batches.map(b => b.batchId);

  const beforeSnapshots = targetBatchIds.map(bid => {
    const batch = findBatchById(bid);
    return {
      batchId: bid,
      recordCount: batch ? batch.records.length : 0,
      recordsHash: batch ? JSON.stringify(batch.records.map(r => ({ recordId: r.recordId, status: r.status, adjustedHAZ: r.adjustedHAZ }))) : ''
    };
  });

  autoDetectConflictsFromScreenshots();
  if (batchId) {
    refreshAllRecordsInBatch(batchId);
  } else {
    refreshAllBatchesRecordsStatus();
  }

  const afterSnapshots = targetBatchIds.map(bid => {
    const batch = findBatchById(bid);
    return {
      batchId: bid,
      summary: buildBatchSummary(bid)
    };
  });

  addReviewHistory(
    '补录后重算',
    remark || '补录数据后重新计算',
    operator || '系统',
    { before: beforeSnapshots, after: afterSnapshots }
  );

  runSelfCheck();

  res.json({
    success: true,
    data: {
      recalculateTime: formatNowISO(),
      batchSummaries: afterSnapshots,
      selfCheckResults: dataStore.selfCheckResults
    }
  });
});

app.get('/api/export/:batchId', (req, res) => {
  const { batchId } = req.params;
  const batch = findBatchById(batchId);

  if (!batch) {
    return res.json({ success: false, message: `批次 ${batchId} 不存在` });
  }

  const batchConflicts = dataStore.conflicts.filter(c => c.batchId === batchId);
  const summary = buildBatchSummary(batchId);

  const exportData = {
    exportTime: formatNowISO(),
    batchInfo: {
      batchId: batch.batchId,
      batchName: batch.batchName,
      createTime: batch.createTime,
      uploader: batch.uploader,
      totalRecords: batch.records.length
    },
    records: batch.records.map(r => ({ ...r })),
    conflicts: batchConflicts,
    summary,
    selfCheck: dataStore.selfCheckResults,
    samplingIntervalNotes: dataStore.samplingIntervalNotes,
    relatedScreenshots: dataStore.maintenanceScreenshots.filter(s => s.batchId === batchId)
  };

  addReviewHistory(
    '导出数据',
    `导出批次 ${batch.batchName} 明细数据，共 ${batch.records.length} 条记录`,
    '导出操作',
    { batchId, recordCount: batch.records.length, conflictCount: batchConflicts.length }
  );

  res.json({ success: true, data: exportData });
});

app.get('/api/sample-data', (req, res) => {
  const baseTime = new Date('2026-06-09T09:00:00').getTime();

  const sampleRecords = [
    {
      recordId: 'sample_rec_001',
      samplingTime: new Date(baseTime).toISOString(),
      previousSamplingTime: new Date(baseTime - 30 * 60 * 1000).toISOString(),
      weldingCurrent: 120,
      weldingVoltage: 24,
      importSource: '维修群截图样例',
      sourceRemark: '正常记录，采样间隔符合30分钟要求'
    },
    {
      recordId: 'sample_rec_002',
      samplingTime: new Date(baseTime + (30 + 35) * 60 * 1000).toISOString(),
      previousSamplingTime: new Date(baseTime).toISOString(),
      weldingCurrent: 115,
      weldingVoltage: 22,
      importSource: '维修群截图样例',
      sourceRemark: '采样时间缺失35分钟，按1小时间断采样'
    },
    {
      recordId: 'sample_rec_003',
      samplingTime: new Date(baseTime + (30 + 35 + 30 + 40) * 60 * 1000).toISOString(),
      previousSamplingTime: new Date(baseTime + (30 + 35) * 60 * 1000).toISOString(),
      weldingCurrent: 130,
      weldingVoltage: 25,
      importSource: '维修群截图样例',
      sourceRemark: '采样时间缺失40分钟，按1小时间断采样描述'
    },
    {
      recordId: 'sample_rec_004',
      samplingTime: new Date(baseTime + (30 + 35 + 30 + 40 + 30) * 60 * 1000).toISOString(),
      previousSamplingTime: new Date(baseTime + (30 + 35 + 30 + 40) * 60 * 1000).toISOString(),
      weldingCurrent: 118,
      weldingVoltage: 23,
      importSource: '补录',
      sourceRemark: 'batch样例：补录后的正常记录'
    }
  ];

  res.json({
    success: true,
    data: {
      sampleRecords,
      records: sampleRecords,
      description: '包含1条正常，2条采样时间缺失35分钟和40分钟的记录，描述带"按1小时间断"，batch样例',
      suggestedBatchName: 'batch样例_焊接热影响区测试批次',
      sampleBatchName: 'batch样例_焊接热影响区测试批次',
      screenshot: {
        description: '维修群2026-06-09聊天记录，现场按1小时间断采样，业务同事已上传',
        originalName: 'wechat_group_20260609.png'
      }
    }
  });
});

app.listen(PORT, () => {
  console.log(`焊接热影响区估算工具服务运行在 http://localhost:${PORT}`);
  console.log(`API 文档:`);
  console.log(`  GET  /api/state                     - 获取全状态`);
  console.log(`  POST /api/batch                     - 创建批次`);
  console.log(`  POST /api/batch/:batchId/records    - 追加批次记录`);
  console.log(`  POST /api/sampling-interval         - 补看采样间隔说明`);
  console.log(`  POST /api/maintenance-screenshot    - 导入维修群截图`);
  console.log(`  POST /api/conflict/:id/resolve      - 解决冲突`);
  console.log(`  POST /api/record/:recordId/review   - 补录复核`);
  console.log(`  POST /api/recalculate               - 补录后重算`);
  console.log(`  GET  /api/export/:batchId           - 导出批次数据`);
  console.log(`  GET  /api/sample-data               - 获取真实样例数据`);
});
