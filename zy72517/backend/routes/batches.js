const express = require('express');
const multer = require('multer');
const csvParser = require('csv-parser');
const { Readable } = require('stream');
const { Parser } = require('json2csv');

const { readBatches, writeBatches, readRecords, writeRecords, generateId } = require('../services/dataStore');
const { STATUS, STATUS_LABELS, checkDuplicateImport, runFullCheck, applyAutoStatus } = require('../services/selfCheck');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/', (req, res) => {
  const batches = readBatches();
  const records = readRecords();
  
  const batchesWithStats = batches.map(batch => {
    const batchRecords = records.filter(r => r.batchId === batch.id);
    return {
      ...batch,
      recordCount: batchRecords.length,
      issueCount: batchRecords.filter(r => 
        r.status === STATUS.DUPLICATE_USER || r.status === STATUS.NEEDS_REVIEW
      ).length
    };
  });
  
  res.json(batchesWithStats);
});

router.post('/', upload.single('file'), async (req, res) => {
  try {
    const { batchName, operator } = req.body;
    
    if (!batchName) {
      return res.status(400).json({ error: '批次名称不能为空' });
    }
    
    if (!req.file) {
      return res.status(400).json({ error: '请上传CSV文件' });
    }
    
    const existingBatches = readBatches();
    const duplicateBatch = existingBatches.find(b => b.name === batchName);
    if (duplicateBatch) {
      return res.status(400).json({ error: '批次名称已存在，请换个名称' });
    }
    
    const rows = [];
    const fileContent = req.file.buffer.toString('utf8');
    
    await new Promise((resolve, reject) => {
      Readable.from(fileContent)
        .pipe(csvParser())
        .on('data', (row) => rows.push(row))
        .on('end', resolve)
        .on('error', reject);
    });
    
    if (rows.length === 0) {
      return res.status(400).json({ error: 'CSV文件为空或格式错误' });
    }
    
    const batchId = generateId();
    const existingRecords = readRecords();
    const duplicateIssues = checkDuplicateImport(batchId, existingRecords, rows);
    
    const batch = {
      id: batchId,
      name: batchName,
      createdAt: new Date().toISOString(),
      createdBy: operator || 'system',
      fileName: req.file.originalname,
      rowCount: rows.length,
      importNotes: ''
    };
    
    let newRecords = rows.map((row, idx) => ({
      id: generateId(),
      batchId,
      originalLineNumber: idx + 2,
      questionText: row.question || row.问题 || '',
      userId: row.user_id || row.用户ID || row.userId || '',
      userName: row.user_name || row.用户名 || '',
      feedbackTime: row.feedback_time || row.反馈时间 || '',
      originalData: row,
      status: STATUS.PENDING,
      statusUpdatedAt: new Date().toISOString(),
      statusUpdatedBy: 'system_import',
      manualChanges: [],
      mergedIntoId: null,
      mergedFromIds: [],
      annotatorComment: '',
      reviewComment: ''
    }));
    
    newRecords = applyAutoStatus(newRecords, batchId);
    
    const allRecords = [...existingRecords, ...newRecords];
    const allBatches = [...existingBatches, batch];
    
    writeBatches(allBatches);
    writeRecords(allRecords);
    
    const checkResult = runFullCheck(batchId);
    
    res.json({
      success: true,
      batch,
      importedCount: newRecords.length,
      duplicateIssues,
      checkResult
    });
    
  } catch (error) {
    console.error('导入失败:', error);
    res.status(500).json({ error: '导入失败: ' + error.message });
  }
});

router.get('/:batchId', (req, res) => {
  const { batchId } = req.params;
  const batches = readBatches();
  const batch = batches.find(b => b.id === batchId);
  
  if (!batch) {
    return res.status(404).json({ error: '批次不存在' });
  }
  
  const records = readRecords().filter(r => r.batchId === batchId);
  const checkResult = runFullCheck(batchId);
  
  res.json({
    batch,
    records,
    checkResult
  });
});

router.get('/:batchId/records', (req, res) => {
  const { batchId } = req.params;
  const { status, userId, page = 1, pageSize = 50 } = req.query;
  
  let records = readRecords().filter(r => r.batchId === batchId);
  
  if (status) {
    records = records.filter(r => r.status === status);
  }
  if (userId) {
    records = records.filter(r => r.userId.includes(userId));
  }
  
  const total = records.length;
  const start = (page - 1) * pageSize;
  const paginatedRecords = records.slice(start, start + parseInt(pageSize));
  
  res.json({
    total,
    page: parseInt(page),
    pageSize: parseInt(pageSize),
    records: paginatedRecords
  });
});

router.put('/:batchId/records/:recordId', (req, res) => {
  const { batchId, recordId } = req.params;
  const { status, annotatorComment, reviewComment, operator } = req.body;
  
  const records = readRecords();
  const recordIndex = records.findIndex(r => r.id === recordId && r.batchId === batchId);
  
  if (recordIndex === -1) {
    return res.status(404).json({ error: '记录不存在' });
  }
  
  const oldRecord = records[recordIndex];
  const changes = [];
  
  if (status && status !== oldRecord.status) {
    changes.push({
      field: 'status',
      oldValue: oldRecord.status,
      newValue: status,
      changedAt: new Date().toISOString(),
      changedBy: operator || 'unknown'
    });
  }
  
  if (annotatorComment !== undefined && annotatorComment !== oldRecord.annotatorComment) {
    changes.push({
      field: 'annotatorComment',
      oldValue: oldRecord.annotatorComment,
      newValue: annotatorComment,
      changedAt: new Date().toISOString(),
      changedBy: operator || 'unknown'
    });
  }
  
  if (reviewComment !== undefined && reviewComment !== oldRecord.reviewComment) {
    changes.push({
      field: 'reviewComment',
      oldValue: oldRecord.reviewComment,
      newValue: reviewComment,
      changedAt: new Date().toISOString(),
      changedBy: operator || 'unknown'
    });
  }
  
  records[recordIndex] = {
    ...oldRecord,
    status: status || oldRecord.status,
    annotatorComment: annotatorComment !== undefined ? annotatorComment : oldRecord.annotatorComment,
    reviewComment: reviewComment !== undefined ? reviewComment : oldRecord.reviewComment,
    statusUpdatedAt: new Date().toISOString(),
    statusUpdatedBy: operator || 'unknown',
    manualChanges: [...oldRecord.manualChanges, ...changes]
  };
  
  writeRecords(records);
  
  const checkResult = runFullCheck(batchId);
  
  res.json({
    success: true,
    record: records[recordIndex],
    checkResult
  });
});

router.post('/:batchId/merge', (req, res) => {
  const { batchId } = req.params;
  const { sourceRecordIds, targetRecordId, operator } = req.body;
  
  if (!targetRecordId || !sourceRecordIds || sourceRecordIds.length === 0) {
    return res.status(400).json({ error: '归并参数不完整' });
  }
  
  const records = readRecords();
  
  const targetRecord = records.find(r => r.id === targetRecordId && r.batchId === batchId);
  if (!targetRecord) {
    return res.status(404).json({ error: '目标记录不存在' });
  }
  
  const updatedRecords = [...records];
  
  sourceRecordIds.forEach(sourceId => {
    const sourceIdx = updatedRecords.findIndex(r => r.id === sourceId && r.batchId === batchId);
    if (sourceIdx !== -1 && sourceId !== targetRecordId) {
      const sourceRecord = updatedRecords[sourceIdx];
      updatedRecords[sourceIdx] = {
        ...sourceRecord,
        status: STATUS.MERGED,
        mergedIntoId: targetRecordId,
        statusUpdatedAt: new Date().toISOString(),
        statusUpdatedBy: operator || 'unknown',
        manualChanges: [
          ...sourceRecord.manualChanges,
          {
            field: 'mergedIntoId',
            oldValue: null,
            newValue: targetRecordId,
            changedAt: new Date().toISOString(),
            changedBy: operator || 'unknown'
          }
        ]
      };
      
      const targetIdx = updatedRecords.findIndex(r => r.id === targetRecordId);
      if (targetIdx !== -1) {
        updatedRecords[targetIdx] = {
          ...updatedRecords[targetIdx],
          mergedFromIds: [...(updatedRecords[targetIdx].mergedFromIds || []), sourceId]
        };
      }
    }
  });
  
  writeRecords(updatedRecords);
  
  const checkResult = runFullCheck(batchId);
  
  res.json({
    success: true,
    checkResult
  });
});

router.get('/:batchId/export', (req, res) => {
  const { batchId } = req.params;
  const { format = 'csv' } = req.query;
  
  const batches = readBatches();
  const batch = batches.find(b => b.id === batchId);
  
  if (!batch) {
    return res.status(404).json({ error: '批次不存在' });
  }
  
  const allRecords = readRecords();
  const batchRecords = allRecords.filter(r => r.batchId === batchId);
  
  const exportData = batchRecords.map(r => ({
    原始行号: r.originalLineNumber,
    用户ID: r.userId,
    用户名: r.userName,
    问题文本: r.questionText,
    反馈时间: r.feedbackTime,
    当前状态: STATUS_LABELS[r.status] || r.status,
    标注员留言: r.annotatorComment,
    复核意见: r.reviewComment,
    是否已归并: r.status === STATUS.MERGED ? '是' : '否',
    归并目标ID: r.mergedIntoId || '',
    状态更新时间: r.statusUpdatedAt,
    状态更新人: r.statusUpdatedBy
  }));
  
  const safeFileName = encodeURIComponent(batch.name + '_明细');
  
  if (format === 'json') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${safeFileName}.json`);
    res.json(exportData);
  } else {
    const parser = new Parser({ fields: Object.keys(exportData[0] || {}) });
    const csv = parser.parse(exportData);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${safeFileName}.csv`);
    res.send('\uFEFF' + csv);
  }
});

router.get('/:batchId/check', (req, res) => {
  const { batchId } = req.params;
  const result = runFullCheck(batchId);
  res.json(result);
});

router.post('/:batchId/recheck', (req, res) => {
  const { batchId } = req.params;
  const { operator } = req.body;
  
  let records = readRecords();
  records = applyAutoStatus(records, batchId);
  writeRecords(records);
  
  const checkResult = runFullCheck(batchId);
  
  res.json({
    success: true,
    message: '补录后重算完成，已自动更新异常状态',
    checkResult
  });
});

router.post('/:batchId/notes', (req, res) => {
  const { batchId } = req.params;
  const { importNotes, operator } = req.body;
  
  const batches = readBatches();
  const batchIdx = batches.findIndex(b => b.id === batchId);
  
  if (batchIdx === -1) {
    return res.status(404).json({ error: '批次不存在' });
  }
  
  batches[batchIdx] = {
    ...batches[batchIdx],
    importNotes,
    notesUpdatedAt: new Date().toISOString(),
    notesUpdatedBy: operator || 'unknown'
  };
  
  writeBatches(batches);
  
  res.json({
    success: true,
    batch: batches[batchIdx]
  });
});

module.exports = router;
