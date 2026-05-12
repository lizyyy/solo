const { v4: uuidv4 } = require('uuid');
const {
  sequelize,
  ImportBatch,
  ImportTimeline,
  ImportError,
  ImportedRecord,
  CompensationRecord,
  Customer,
  Product,
} = require('../models');
const {
  calculateFileHash,
  parseCsv,
  applyMapping,
  precheckData,
  prepareRecordForImport,
  checkFileChanged,
} = require('./validationService');
const { getUniqueKeyField, getAllFields } = require('../utils/fieldDefinitions');

async function createBatch(batchName, batchType, operator) {
  const transaction = await sequelize.transaction();
  
  try {
    const batch = await ImportBatch.create({
      id: uuidv4(),
      batchName,
      batchType,
      uploadedBy: operator,
    }, { transaction });
    
    await ImportTimeline.create({
      batchId: batch.id,
      action: 'upload',
      status: 'success',
      processedCount: 0,
      successCount: 0,
      errorCount: 0,
      operator,
      remark: '创建导入批次',
    }, { transaction });
    
    await transaction.commit();
    return batch;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function uploadData(batchId, dataType, content, fileName, operator) {
  const transaction = await sequelize.transaction();
  
  try {
    const batch = await ImportBatch.findByPk(batchId, { transaction });
    if (!batch) {
      throw new Error('批次不存在');
    }
    
    let rawData;
    let fileHash;
    
    if (dataType === 'csv') {
      rawData = parseCsv(content);
      fileHash = calculateFileHash(content);
    } else if (dataType === 'json') {
      const jsonData = typeof content === 'string' ? JSON.parse(content) : content;
      if (!Array.isArray(jsonData) || jsonData.length === 0) {
        throw new Error('JSON数据必须是非空数组');
      }
      rawData = {
        headers: Object.keys(jsonData[0]),
        rows: jsonData,
      };
      fileHash = calculateFileHash(jsonData);
    } else {
      throw new Error(`不支持的数据类型: ${dataType}`);
    }
    
    await batch.update({
      sourceFileName: fileName || 'import-data',
      sourceFileHash: fileHash,
      rawData: JSON.stringify(rawData),
      totalRows: rawData.rows.length,
    }, { transaction });
    
    await ImportTimeline.create({
      batchId: batch.id,
      action: 'upload',
      status: 'success',
      processedCount: rawData.rows.length,
      successCount: rawData.rows.length,
      errorCount: 0,
      operator,
      remark: `上传数据文件：${fileName || 'import-data'}，共${rawData.rows.length}行`,
    }, { transaction });
    
    await transaction.commit();
    return {
      batch,
      sourceColumns: rawData.headers,
      rowCount: rawData.rows.length,
      previewRows: rawData.rows.slice(0, 5),
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function configureMapping(batchId, mappingConfig, operator) {
  const transaction = await sequelize.transaction();
  
  try {
    const batch = await ImportBatch.findByPk(batchId, { transaction });
    if (!batch) {
      throw new Error('批次不存在');
    }
    
    if (!['uploaded', 'mapping_configured'].includes(batch.status)) {
      throw new Error('当前状态不允许配置字段映射');
    }
    
    const rawData = JSON.parse(batch.rawData || '{"rows":[]}');
    const sourceColumns = rawData.headers || [];
    const targetFields = getAllFields(batch.batchType).map(f => f.key);
    
    Object.keys(mappingConfig).forEach(targetField => {
      if (!targetFields.includes(targetField)) {
        throw new Error(`目标字段"${targetField}"不存在`);
      }
    });
    
    const usedSourceColumns = Object.values(mappingConfig).filter(Boolean);
    const duplicateColumns = usedSourceColumns.filter(
      (col, idx) => usedSourceColumns.indexOf(col) !== idx
    );
    
    if (duplicateColumns.length > 0) {
      throw new Error(`源列不能重复映射: ${duplicateColumns.join(', ')}`);
    }
    
    await batch.update({
      mappingConfig: JSON.stringify(mappingConfig),
      status: 'mapping_configured',
    }, { transaction });
    
    await ImportTimeline.create({
      batchId: batch.id,
      action: 'configure_mapping',
      status: 'success',
      processedCount: Object.keys(mappingConfig).length,
      successCount: Object.keys(mappingConfig).length,
      errorCount: 0,
      operator,
      remark: `配置字段映射，共${Object.keys(mappingConfig).length}个字段`,
    }, { transaction });
    
    await transaction.commit();
    return batch;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function runPrecheck(batchId, operator) {
  const transaction = await sequelize.transaction();
  
  try {
    const batch = await ImportBatch.findByPk(batchId, { transaction });
    if (!batch) {
      throw new Error('批次不存在');
    }
    
    if (!['mapping_configured', 'precheck_failed'].includes(batch.status)) {
      throw new Error('当前状态不允许执行预检');
    }
    
    const rawData = JSON.parse(batch.rawData || '{"rows":[]}');
    const mappingConfig = JSON.parse(batch.mappingConfig || '{}');
    
    const precheckResult = await precheckData(
      rawData,
      mappingConfig,
      batch.batchType,
      rawData.headers
    );
    
    await ImportError.destroy({
      where: { batchId, stage: 'precheck' },
      transaction,
    });
    
    if (precheckResult.errors.length > 0) {
      const errorRecords = precheckResult.errors.map(err => ({
        batchId,
        rowIndex: err.rowIndex,
        stage: err.stage,
        errorType: err.errorType,
        fieldName: err.fieldName,
        errorMessage: err.errorMessage,
        rawValue: err.rawValue,
      }));
      
      await ImportError.bulkCreate(errorRecords, { transaction });
    }
    
    const newStatus = precheckResult.success ? 'precheck_passed' : 'precheck_failed';
    await batch.update({
      status: newStatus,
      totalRows: precheckResult.totalRows,
      validRows: precheckResult.validRows,
      errorRows: precheckResult.errorRows,
      precheckReport: JSON.stringify(precheckResult),
    }, { transaction });
    
    await ImportTimeline.create({
      batchId,
      action: 'precheck',
      status: precheckResult.success ? 'success' : 'failed',
      processedCount: precheckResult.totalRows,
      successCount: precheckResult.validRows,
      errorCount: precheckResult.errorRows,
      operator,
      remark: `预检完成，${precheckResult.success ? '全部通过' : `发现${precheckResult.errors.length}个错误`}`,
    }, { transaction });
    
    await transaction.commit();
    return {
      batch,
      precheckResult,
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function fixError(batchId, errorId, fixedValue, operator) {
  const transaction = await sequelize.transaction();
  
  try {
    const error = await ImportError.findByPk(errorId, { transaction });
    if (!error) {
      throw new Error('错误记录不存在');
    }
    
    if (error.batchId !== batchId) {
      throw new Error('错误记录不属于该批次');
    }
    
    if (error.stage !== 'precheck') {
      throw new Error('只能修正预检阶段的错误');
    }
    
    await error.update({
      isFixed: true,
      fixedValue,
      fixedBy: operator,
      fixedAt: new Date(),
    }, { transaction });
    
    await transaction.commit();
    return error;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function getErrorsWithFixedData(batch, stage) {
  const errors = await ImportError.findAll({
    where: { batchId: batch.id, stage },
    order: [['rowIndex', 'ASC']],
  });
  
  const rawData = JSON.parse(batch.rawData || '{"rows":[]}');
  const mappingConfig = JSON.parse(batch.mappingConfig || '{}');
  const mappedRows = applyMapping(rawData.rows, mappingConfig);
  
  errors.forEach(err => {
    if (err.rowIndex > 0 && err.rowIndex <= mappedRows.length) {
      err.setDataValue('rowData', mappedRows[err.rowIndex - 1]);
    }
  });
  
  return errors;
}

async function runTrialImport(batchId, operator, currentFileHash) {
  const transaction = await sequelize.transaction();
  
  try {
    const batch = await ImportBatch.findByPk(batchId, { transaction });
    if (!batch) {
      throw new Error('批次不存在');
    }
    
    if (batch.status !== 'precheck_passed') {
      throw new Error('当前状态不允许执行试导入');
    }
    
    if (currentFileHash && batch.sourceFileHash && checkFileChanged(currentFileHash, batch.sourceFileHash)) {
      throw new Error('源文件已发生变化，请重新上传或确认文件一致性');
    }
    
    const rawData = JSON.parse(batch.rawData || '{"rows":[]}');
    const mappingConfig = JSON.parse(batch.mappingConfig || '{}');
    const mappedRows = applyMapping(rawData.rows, mappingConfig);
    
    const errors = await getErrorsWithFixedData(batch, 'precheck');
    const fixedErrorMap = new Map();
    errors.filter(e => e.isFixed).forEach(e => {
      const key = `${e.rowIndex}-${e.fieldName}`;
      fixedErrorMap.set(key, e.fixedValue);
    });
    
    mappedRows.forEach((row, idx) => {
      const rowIndex = idx + 1;
      Object.keys(row).forEach(field => {
        const key = `${rowIndex}-${field}`;
        if (fixedErrorMap.has(key)) {
          row[field] = fixedErrorMap.get(key);
        }
      });
    });
    
    const successCount = mappedRows.length;
    const trialReport = {
      totalRows: mappedRows.length,
      willImportRows: mappedRows.length,
      sampleRecords: mappedRows.slice(0, 10).map((row, idx) => ({
        rowIndex: idx + 1,
        data: row,
      })),
      estimate: {
        newRecords: mappedRows.length,
        updateRecords: 0,
        skippedRecords: 0,
      },
    };
    
    await batch.update({
      status: 'trial_imported',
      trialImportReport: JSON.stringify(trialReport),
    }, { transaction });
    
    await ImportTimeline.create({
      batchId,
      action: 'trial_import',
      status: 'success',
      processedCount: mappedRows.length,
      successCount,
      errorCount: 0,
      operator,
      remark: `试导入完成，预计导入${successCount}条记录`,
    }, { transaction });
    
    await transaction.commit();
    return {
      batch,
      trialReport,
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function confirmImport(batchId, operator) {
  const transaction = await sequelize.transaction();
  
  try {
    const batch = await ImportBatch.findByPk(batchId, { transaction });
    if (!batch) {
      throw new Error('批次不存在');
    }
    
    if (batch.status !== 'trial_imported') {
      throw new Error('当前状态不允许确认导入');
    }
    
    const rawData = JSON.parse(batch.rawData || '{"rows":[]}');
    const mappingConfig = JSON.parse(batch.mappingConfig || '{}');
    const mappedRows = applyMapping(rawData.rows, mappingConfig);
    
    const errors = await getErrorsWithFixedData(batch, 'precheck');
    const fixedErrorMap = new Map();
    errors.filter(e => e.isFixed).forEach(e => {
      const key = `${e.rowIndex}-${e.fieldName}`;
      fixedErrorMap.set(key, e.fixedValue);
    });
    
    mappedRows.forEach((row, idx) => {
      const rowIndex = idx + 1;
      Object.keys(row).forEach(field => {
        const key = `${rowIndex}-${field}`;
        if (fixedErrorMap.has(key)) {
          row[field] = fixedErrorMap.get(key);
        }
      });
    });
    
    const Model = batch.batchType === 'customer' ? Customer : Product;
    const uniqueKeyField = getUniqueKeyField(batch.batchType);
    
    const importResults = [];
    const importErrors = [];
    
    for (let i = 0; i < mappedRows.length; i++) {
      const row = mappedRows[i];
      const rowIndex = i + 1;
      
      try {
        const record = prepareRecordForImport(row, batch.batchType);
        record.importedBatchId = batch.id;
        
        const newRecord = await Model.create(record, { transaction });
        
        await ImportedRecord.create({
          batchId: batch.id,
          recordType: batch.batchType,
          rowIndex,
          externalId: record[uniqueKeyField.key],
          internalId: newRecord.id,
          recordData: JSON.stringify(record),
        }, { transaction });
        
        importResults.push({
          rowIndex,
          internalId: newRecord.id,
          success: true,
        });
      } catch (err) {
        importErrors.push({
          rowIndex,
          stage: 'final_import',
          errorType: 'system_error',
          fieldName: null,
          errorMessage: err.message,
          rawValue: JSON.stringify(row),
        });
      }
    }
    
    if (importErrors.length > 0) {
      await ImportError.bulkCreate(importErrors, { transaction });
    }
    
    const finalReport = {
      totalRows: mappedRows.length,
      successRows: importResults.length,
      failedRows: importErrors.length,
      importedRecords: importResults,
      timestamp: new Date().toISOString(),
      operator,
    };
    
    await batch.update({
      status: 'confirmed',
      confirmedBy: operator,
      confirmedAt: new Date(),
      validRows: importResults.length,
      errorRows: importErrors.length,
      finalReport: JSON.stringify(finalReport),
    }, { transaction });
    
    await ImportTimeline.create({
      batchId,
      action: 'confirm',
      status: importErrors.length === 0 ? 'success' : 'partial',
      processedCount: mappedRows.length,
      successCount: importResults.length,
      errorCount: importErrors.length,
      operator,
      remark: `确认导入完成，成功${importResults.length}条，失败${importErrors.length}条`,
    }, { transaction });
    
    await transaction.commit();
    return {
      batch,
      finalReport,
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function rollbackBatch(batchId, reason, operator) {
  const transaction = await sequelize.transaction();
  
  try {
    const batch = await ImportBatch.findByPk(batchId, { transaction });
    if (!batch) {
      throw new Error('批次不存在');
    }
    
    if (batch.status !== 'confirmed') {
      throw new Error('只有已确认的批次才能回滚');
    }
    
    const importedRecords = await ImportedRecord.findAll({
      where: {
        batchId: batch.id,
        isRolledBack: false,
      },
      transaction,
    });
    
    const compensationRecords = [];
    const Model = batch.batchType === 'customer' ? Customer : Product;
    const uniqueKeyField = getUniqueKeyField(batch.batchType);
    
    for (const importedRecord of importedRecords) {
      const internalId = importedRecord.internalId;
      const originalRecord = await Model.findByPk(internalId, { transaction });
      
      if (originalRecord) {
        const compensationRecord = await CompensationRecord.create({
          id: uuidv4(),
          batchId: batch.id,
          importedRecordId: importedRecord.id,
          recordType: batch.batchType,
          compensationType: 'status_change',
          originalInternalId: internalId,
          originalData: importedRecord.recordData,
          operator,
          reason,
        }, { transaction });
        
        compensationRecords.push(compensationRecord);
        
        await Model.update(
          { status: batch.batchType === 'customer' ? 'archived' : 'discontinued' },
          { where: { id: internalId }, transaction }
        );
        
        await importedRecord.update({
          isRolledBack: true,
          rollbackCompensationId: compensationRecord.id,
        }, { transaction });
      }
    }
    
    await batch.update({
      status: 'rolled_back',
      rolledBackBy: operator,
      rolledBackAt: new Date(),
      rollbackReason: reason,
    }, { transaction });
    
    await ImportTimeline.create({
      batchId,
      action: 'rollback',
      status: 'success',
      processedCount: importedRecords.length,
      successCount: compensationRecords.length,
      errorCount: importedRecords.length - compensationRecords.length,
      operator,
      remark: `批次回滚完成，生成${compensationRecords.length}条补偿记录，原因：${reason || '未说明'}`,
    }, { transaction });
    
    await transaction.commit();
    return {
      batch,
      compensationCount: compensationRecords.length,
      compensationRecords,
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function getBatchDetail(batchId) {
  const batch = await ImportBatch.findByPk(batchId, {
    include: [
      { model: ImportTimeline, order: [['createdAt', 'ASC']] },
    ],
  });
  
  if (!batch) return null;
  
  const errors = await ImportError.findAll({
    where: { batchId },
    order: [['rowIndex', 'ASC'], ['createdAt', 'ASC']],
  });
  
  const importedRecords = await ImportedRecord.findAll({
    where: { batchId },
    order: [['rowIndex', 'ASC']],
  });
  
  const compensationRecords = await CompensationRecord.findAll({
    where: { batchId },
    order: [['createdAt', 'ASC']],
  });
  
  return {
    batch,
    timelines: batch.ImportTimelines,
    errors,
    importedRecords,
    compensationRecords,
  };
}

async function listBatches(batchType, status, page = 1, pageSize = 20) {
  const where = {};
  if (batchType) where.batchType = batchType;
  if (status) where.status = status;
  
  const offset = (page - 1) * pageSize;
  
  const result = await ImportBatch.findAndCountAll({
    where,
    order: [['createdAt', 'DESC']],
    limit: pageSize,
    offset,
  });
  
  return {
    total: result.count,
    page,
    pageSize,
    data: result.rows,
  };
}

module.exports = {
  createBatch,
  uploadData,
  configureMapping,
  runPrecheck,
  fixError,
  runTrialImport,
  confirmImport,
  rollbackBatch,
  getBatchDetail,
  listBatches,
};
