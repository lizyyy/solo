const { v4: uuidv4 } = require('uuid');
const {
  Batch,
  RepairRequest,
  Worker,
  Rating,
  ProcessLog
} = require('../models');
const {
  parseRepairCSV,
  parseRatingCSV,
  parseWorkerJSON,
  validateRepairRecord,
  validateWorkerRecord,
  validateRatingRecord
} = require('../utils/parser');
const { writeProcessLog } = require('../utils/logger');

exports.createBatch = async (req, res) => {
  const { batchType, fileName, content, importedBy } = req.body;

  if (!batchType || !content || !importedBy) {
    return res.status(400).json({
      success: false,
      error: 'batchType, content, importedBy 均为必填'
    });
  }

  const validTypes = ['报修记录', '维修工', '评分记录'];
  if (!validTypes.includes(batchType)) {
    return res.status(400).json({
      success: false,
      error: `batchType 必须是 ${validTypes.join('/')} 之一`
    });
  }

  let parsedRecords = [];
  try {
    if (batchType === '报修记录') {
      parsedRecords = parseRepairCSV(content);
    } else if (batchType === '维修工') {
      parsedRecords = parseWorkerJSON(content);
    } else if (batchType === '评分记录') {
      parsedRecords = parseRatingCSV(content);
    }
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: '解析失败: ' + err.message
    });
  }

  const errors = [];
  parsedRecords.forEach(({ row, data }) => {
    let errs = [];
    if (batchType === '报修记录') errs = validateRepairRecord(data);
    else if (batchType === '维修工') errs = validateWorkerRecord(data);
    else if (batchType === '评分记录') errs = validateRatingRecord(data);
    errs.forEach(e => errors.push({ row, field: 'validation', message: e }));
  });

  const batchId = uuidv4();
  const batch = new Batch({
    batchId,
    batchType,
    fileName: fileName || null,
    recordCount: parsedRecords.length,
    importedBy,
    importStatus: errors.length > 0 ? '待确认' : '待确认',
    errors,
    rawContent: content,
    parsedData: parsedRecords
  });

  await batch.save();

  res.json({
    success: true,
    data: {
      batchId,
      batchType,
      recordCount: parsedRecords.length,
      errorCount: errors.length,
      errors,
      importStatus: batch.importStatus,
      message: '批次创建成功，请确认后入库'
    }
  });
};

exports.confirmBatch = async (req, res) => {
  const { batchId, confirmedBy } = req.body;
  const operator = req.operator || confirmedBy || 'unknown';

  if (!batchId) {
    return res.status(400).json({ success: false, error: 'batchId 必填' });
  }

  const batch = await Batch.findOne({ batchId });
  if (!batch) {
    return res.status(404).json({ success: false, error: '批次不存在' });
  }

  if (batch.importStatus === '已作废') {
    return res.status(400).json({ success: false, error: '批次已作废，无法确认' });
  }

  if (batch.importStatus === '全部成功' || batch.importStatus === '部分成功') {
    return res.status(400).json({ success: false, error: '批次已确认过' });
  }

  if (!batch.parsedData || batch.parsedData.length === 0) {
    return res.status(400).json({
      success: false,
      error: '批次无解析数据，请重新创建批次'
    });
  }

  const parsedRecords = batch.parsedData;
  let successCount = 0;
  let failCount = 0;
  const importErrors = [...batch.errors];

  for (const { row, data } of parsedRecords) {
    try {
      if (batch.batchType === '报修记录') {
        const errs = validateRepairRecord(data);
        if (errs.length > 0) {
          failCount++;
          continue;
        }
        const exists = await RepairRequest.findOne({ requestId: data.requestId });
        if (exists) {
          importErrors.push({
            row, field: 'requestId', message: `报修单号 ${data.requestId} 已存在`
          });
          failCount++;
          continue;
        }
        const record = new RepairRequest({ ...data, batchId });
        await record.save();
        await writeProcessLog({
          targetType: 'RepairRequest',
          targetId: data.requestId,
          action: '导入',
          reason: `批次 ${batchId} 导入`,
          operator
        });
        successCount++;
      } else if (batch.batchType === '维修工') {
        const errs = validateWorkerRecord(data);
        if (errs.length > 0) {
          failCount++;
          continue;
        }
        const exists = await Worker.findOne({ workerId: data.workerId });
        if (exists) {
          importErrors.push({
            row, field: 'workerId', message: `工号 ${data.workerId} 已存在`
          });
          failCount++;
          continue;
        }
        const record = new Worker(data);
        await record.save();
        await writeProcessLog({
          targetType: 'RepairRequest',
          targetId: data.workerId,
          action: '导入',
          reason: `批次 ${batchId} 导入维修工`,
          operator
        });
        successCount++;
      } else if (batch.batchType === '评分记录') {
        const errs = validateRatingRecord(data);
        if (errs.length > 0) {
          failCount++;
          continue;
        }
        const exists = await Rating.findOne({ ratingId: data.ratingId });
        if (exists) {
          importErrors.push({
            row, field: 'ratingId', message: `评分单号 ${data.ratingId} 已存在`
          });
          failCount++;
          continue;
        }
        const record = new Rating(data);
        await record.save();
        await writeProcessLog({
          targetType: 'Rating',
          targetId: data.ratingId,
          action: '导入',
          reason: `批次 ${batchId} 导入评分`,
          operator
        });
        successCount++;
      }
    } catch (err) {
      importErrors.push({ row, field: 'system', message: err.message });
      failCount++;
    }
  }

  batch.importStatus = failCount === 0 ? '全部成功' : (successCount > 0 ? '部分成功' : '待确认');
  batch.confirmedAt = new Date();
  batch.confirmedBy = operator;
  batch.errors = importErrors;
  await batch.save();

  await writeProcessLog({
    targetType: 'Batch',
    targetId: batchId,
    action: '确认导入',
    reason: `确认批次导入，成功 ${successCount} 条，失败 ${failCount} 条`,
    operator
  });

  res.json({
    success: true,
    data: {
      batchId,
      successCount,
      failCount,
      importStatus: batch.importStatus,
      errors: importErrors
    }
  });
};

exports.voidBatch = async (req, res) => {
  const { batchId } = req.body;
  const operator = req.operator;

  if (!batchId) {
    return res.status(400).json({ success: false, error: 'batchId 必填' });
  }

  const batch = await Batch.findOne({ batchId });
  if (!batch) {
    return res.status(404).json({ success: false, error: '批次不存在' });
  }

  batch.importStatus = '已作废';
  await batch.save();

  await writeProcessLog({
    targetType: 'Batch',
    targetId: batchId,
    action: '作废批次',
    reason: '操作人主动作废批次',
    operator
  });

  res.json({ success: true, data: { batchId, importStatus: '已作废' } });
};

exports.getBatch = async (req, res) => {
  const { batchId } = req.params;
  const batch = await Batch.findOne({ batchId }).lean();
  if (!batch) {
    return res.status(404).json({ success: false, error: '批次不存在' });
  }
  res.json({ success: true, data: batch });
};

exports.listBatches = async (req, res) => {
  const { batchType, importStatus, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (batchType) filter.batchType = batchType;
  if (importStatus) filter.importStatus = importStatus;

  const total = await Batch.countDocuments(filter);
  const list = await Batch.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit, 10))
    .lean();

  res.json({ success: true, data: { total, page: parseInt(page, 10), limit: parseInt(limit, 10), list } });
};
