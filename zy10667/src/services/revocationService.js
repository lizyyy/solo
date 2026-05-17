const { VISITOR_STATUSES, getVisitor, updateVisitor, listVisitors } = require('../models/visitor');
const { BATCH_STATUSES, createBatch, getBatch, updateBatch, listBatches } = require('../models/revocationBatch');
const { Parser } = require('json2csv');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

function validateVisitorForRevocation(visitor) {
  if (!visitor) {
    return { valid: false, reason: '访客不存在' };
  }
  if (visitor.status === VISITOR_STATUSES.ENTERED) {
    return { valid: false, reason: '访客已入园，无法撤销' };
  }
  if (visitor.status === VISITOR_STATUSES.REVOKED) {
    return { valid: false, reason: '访客已撤销，无需重复操作' };
  }
  if (!visitor.canRevoke()) {
    return { valid: false, reason: `当前状态"${visitor.status}"不允许撤销` };
  }
  return { valid: true };
}

async function createRevocationBatch(batchData, visitorIds) {
  const batch = createBatch({
    batchName: batchData.batchName,
    operatorName: batchData.operatorName,
    revocationReason: batchData.revocationReason
  });

  for (const visitorId of visitorIds) {
    const visitor = getVisitor(visitorId);
    if (visitor) {
      batch.addItem({
        visitorId: visitor.id,
        visitorName: visitor.visitorName,
        visitorPhone: visitor.visitorPhone,
        hostName: visitor.hostName,
        qrCode: visitor.qrCode,
        originalStatus: visitor.status
      });
      visitor.batchId = batch.id;
    }
  }

  return batch;
}

async function processRevocationBatch(batchId) {
  const batch = getBatch(batchId);
  if (!batch) {
    throw new Error('批次不存在');
  }

  batch.updateStatus(BATCH_STATUSES.PROCESSING);

  for (const item of batch.items) {
    const visitor = getVisitor(item.visitorId);
    const validation = validateVisitorForRevocation(visitor);

    if (validation.valid) {
      visitor.updateStatus(VISITOR_STATUSES.REVOKED, batch.revocationReason);
      batch.updateItem(item.id, {
        resultStatus: VISITOR_STATUSES.REVOKED,
        success: true
      });
    } else {
      batch.updateItem(item.id, {
        resultStatus: item.originalStatus,
        success: false,
        errorMessage: validation.reason
      });
    }
  }

  const hasFailures = batch.items.some(item => !item.success);
  batch.updateStatus(hasFailures ? BATCH_STATUSES.PARTIAL_FAILED : BATCH_STATUSES.COMPLETED);

  return batch;
}

async function importVisitorsFromCSV(filePath) {
  const results = [];
  const errors = [];
  let rowNumber = 1;

  return new Promise((resolve) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => {
        rowNumber++;
        try {
          if (!data['访客姓名'] || !data['访客手机号'] || !data['被访人姓名']) {
            errors.push({
              row: rowNumber,
              data: data,
              error: '必填字段缺失（访客姓名、访客手机号、被访人姓名）'
            });
            return;
          }

          results.push({
            visitorName: data['访客姓名'],
            visitorPhone: data['访客手机号'],
            hostName: data['被访人姓名'],
            hostDepartment: data['被访人部门'] || '',
            visitStartTime: data['来访开始时间'] || '',
            visitEndTime: data['来访结束时间'] || ''
          });
        } catch (e) {
          errors.push({
            row: rowNumber,
            data: data,
            error: e.message
          });
        }
      })
      .on('end', () => {
        resolve({ success: results, failed: errors });
      });
  });
}

async function processImportAndRevoke(filePath, operatorName) {
  const importResult = await importVisitorsFromCSV(filePath);
  const importedVisitors = [];
  const { addVisitor } = require('../models/visitor');

  for (const item of importResult.success) {
    const visitor = addVisitor(item);
    importedVisitors.push(visitor);
  }

  const batch = await createRevocationBatch({
    batchName: `导入撤销_${new Date().toLocaleDateString()}`,
    operatorName: operatorName,
    revocationReason: '批量导入撤销'
  }, importedVisitors.map(v => v.id));

  await processRevocationBatch(batch.id);

  batch.addEvidenceFile({
    fileName: path.basename(filePath),
    fileType: 'text/csv',
    fileSize: fs.statSync(filePath).size
  });

  return {
    batch: batch.toJSON(),
    importSummary: {
      total: importResult.success.length + importResult.failed.length,
      imported: importResult.success.length,
      failed: importResult.failed.length,
      failedRows: importResult.failed
    }
  };
}

function exportBatchToCSV(batchId) {
  const batch = getBatch(batchId);
  if (!batch) {
    throw new Error('批次不存在');
  }

  const fields = [
    { label: '访客姓名', value: 'visitorName' },
    { label: '访客手机号', value: 'visitorPhone' },
    { label: '被访人姓名', value: 'hostName' },
    { label: '二维码编号', value: 'qrCode' },
    { label: '撤销前状态', value: 'originalStatus' },
    { label: '撤销后状态', value: 'resultStatus' },
    { label: '处理结果', value: (row) => row.success ? '成功' : '失败' },
    { label: '失败原因', value: 'errorMessage' },
    { label: '处理时间', value: 'processedAt' }
  ];

  const json2csvParser = new Parser({ fields });
  return json2csvParser.parse(batch.items);
}

function getBatchWithHistory(batchId) {
  const batch = getBatch(batchId);
  if (!batch) return null;

  const visitors = listVisitors({ batchId: batchId });
  return {
    ...batch.toJSON(),
    visitors: visitors.map(v => v.toJSON())
  };
}

function getAllBatchesWithSummary() {
  const batches = listBatches();
  return batches.map(batch => ({
    id: batch.id,
    batchName: batch.batchName,
    operatorName: batch.operatorName,
    revocationReason: batch.revocationReason,
    status: batch.status,
    totalCount: batch.totalCount,
    successCount: batch.successCount,
    failedCount: batch.failedCount,
    createdAt: batch.createdAt,
    updatedAt: batch.updatedAt
  }));
}

module.exports = {
  validateVisitorForRevocation,
  createRevocationBatch,
  processRevocationBatch,
  importVisitorsFromCSV,
  processImportAndRevoke,
  exportBatchToCSV,
  getBatchWithHistory,
  getAllBatchesWithSummary
};
