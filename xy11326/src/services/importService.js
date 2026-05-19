const fs = require('fs');
const csv = require('csv-parser');
const XLSX = require('xlsx');
const path = require('path');
const config = require('../config');
const ImportBatch = require('../models/ImportBatch');
const WorkRecord = require('../models/WorkRecord');
const Operator = require('../models/Operator');
const Tractor = require('../models/Tractor');
const OperationLog = require('../models/OperationLog');
const { validateWorkRecord, parseNumber } = require('./validationService');

const ensureUploadDir = () => {
  if (!fs.existsSync(config.uploads.dir)) {
    fs.mkdirSync(config.uploads.dir, { recursive: true });
  }
};

const parseCsvFile = (filePath) => {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
};

const parseExcelFile = (filePath) => {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(worksheet);
};

const parseFile = async (filePath, originalName) => {
  const ext = path.extname(originalName).toLowerCase();
  
  if (ext === '.csv') {
    return parseCsvFile(filePath);
  } else if (['.xlsx', '.xls'].includes(ext)) {
    return parseExcelFile(filePath);
  } else {
    throw new Error('不支持的文件格式，请使用 CSV 或 Excel 文件');
  }
};

const normalizeRecord = (record) => {
  return {
    operatorName: record.机手姓名 || record.operatorName || record.operator || '',
    tractorPlate: record.拖拉机牌号 || record.tractorPlate || record.plate || '',
    workDate: record.作业日期 || record.workDate || record.date || '',
    workType: record.作业类型 || record.workType || record.type || '',
    fieldName: record.地块名称 || record.fieldName || record.field || '',
    hours: parseNumber(record.小时数 || record.hours || record.作业时长),
    acres: parseNumber(record.亩数 || record.acres || record.作业亩数),
    fuelConsumption: parseNumber(record.油耗 || record.fuelConsumption || record.fuel),
    remarks: record.备注 || record.remarks || ''
  };
};

const importWorkRecords = async (filePath, originalName, operator = 'system') => {
  ensureUploadDir();
  
  const batch = await ImportBatch.create({
    fileName: originalName,
    importedBy: operator
  });
  
  try {
    const rawRecords = await parseFile(filePath, originalName);
    const normalizedRecords = rawRecords.map(normalizeRecord);
    
    await ImportBatch.update(batch.id, { totalRecords: normalizedRecords.length });
    
    const results = [];
    let successCount = 0;
    let failedCount = 0;
    
    for (let i = 0; i < normalizedRecords.length; i++) {
      const record = normalizedRecords[i];
      const validation = await validateWorkRecord(record);
      
      if (validation.isValid) {
        const operatorObj = await Operator.findByName(record.operatorName);
        const tractor = await Tractor.findByPlateNumber(record.tractorPlate);
        
        await WorkRecord.create({
          operatorId: operatorObj.id,
          tractorId: tractor.id,
          workDate: record.workDate,
          workType: record.workType,
          fieldName: record.fieldName,
          hours: record.hours,
          acres: record.acres,
          fuelConsumption: record.fuelConsumption,
          remarks: record.remarks,
          status: 'pending',
          importBatchNo: batch.batchNo
        });
        
        successCount++;
        results.push({
          row: i + 2,
          success: true,
          record
        });
      } else {
        failedCount++;
        results.push({
          row: i + 2,
          success: false,
          errors: validation.errors,
          record
        });
      }
    }
    
    await ImportBatch.update(batch.id, {
      successRecords: successCount,
      failedRecords: failedCount,
      status: failedCount === 0 ? 'completed' : 'completed_with_errors'
    });
    
    await OperationLog.create({
      operation: 'import_records',
      operator,
      targetType: 'import_batch',
      targetId: batch.id,
      details: { 
        fileName: originalName,
        total: normalizedRecords.length,
        success: successCount,
        failed: failedCount
      }
    });
    
    return {
      batchNo: batch.batchNo,
      totalRecords: normalizedRecords.length,
      successRecords: successCount,
      failedRecords: failedCount,
      results
    };
    
  } catch (error) {
    await ImportBatch.update(batch.id, { status: 'failed' });
    throw error;
  }
};

const getImportHistory = async (filters = {}) => {
  return ImportBatch.findAll(filters);
};

const getBatchRecords = async (batchNo) => {
  return WorkRecord.findAll({ importBatchNo: batchNo });
};

module.exports = {
  importWorkRecords,
  getImportHistory,
  getBatchRecords
};
