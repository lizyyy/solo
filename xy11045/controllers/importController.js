const { SupplementRecord } = require('../models/SupplementRecord');
const { validateRecord, addToExistingRecords } = require('../validators/importValidator');

const storedRecords = [];

function importRecords(req, res) {
  try {
    const { records, ignoreWarnings = false, forceUpdate = false, remarks } = req.body;

    if (!records || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({
        success: false,
        errorCode: 'INVALID_REQUEST',
        errorMessage: '请求格式错误',
        details: 'records 字段不能为空，至少需要一条有效记录'
      });
    }

    const errors = [];
    const warnings = [];
    const importedIds = [];
    const importedRecords = [];

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const rowIndex = i + 1;

      const validation = validateRecord(record, rowIndex, {
        ignoreWarnings,
        forceUpdate,
        previousRecords: storedRecords
      });

      if (validation.errors.length > 0) {
        errors.push(...validation.errors);
        continue;
      }

      if (validation.warnings.length > 0 && !ignoreWarnings) {
        warnings.push(...validation.warnings);
        continue;
      }

      const supplementRecord = new SupplementRecord({
        ...record,
        manualRemarks: remarks
      });

      storedRecords.push(supplementRecord.toJSON());
      addToExistingRecords(supplementRecord);
      importedIds.push(supplementRecord.supplementId);
      importedRecords.push(supplementRecord.toJSON());
    }

    const hasErrors = errors.length > 0;
    const hasWarnings = warnings.length > 0 && !ignoreWarnings;

    return res.status(200).json({
      success: !hasErrors && !(hasWarnings && !ignoreWarnings),
      totalCount: records.length,
      successCount: importedIds.length,
      errorCount: errors.length,
      warningCount: warnings.length,
      errors,
      warnings,
      importedIds,
      importedRecords: importedRecords.slice(0, 10)
    });

  } catch (error) {
    console.error('导入错误:', error);
    return res.status(500).json({
      success: false,
      errorCode: 'INTERNAL_SERVER_ERROR',
      errorMessage: '服务器内部错误',
      details: error.message || '处理导入请求时发生未知错误，请稍后重试或联系技术支持'
    });
  }
}

function getImportedRecords(req, res) {
  try {
    const { page = 1, pageSize = 20, batchNumber, status } = req.query;
    let filteredRecords = [...storedRecords];

    if (batchNumber) {
      filteredRecords = filteredRecords.filter(r => r.batchNumber === batchNumber);
    }
    if (status) {
      filteredRecords = filteredRecords.filter(r => r.status === status);
    }

    const startIndex = (page - 1) * pageSize;
    const paginatedRecords = filteredRecords.slice(startIndex, startIndex + parseInt(pageSize));

    return res.status(200).json({
      success: true,
      data: paginatedRecords,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total: filteredRecords.length,
        totalPages: Math.ceil(filteredRecords.length / pageSize)
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      errorCode: 'INTERNAL_SERVER_ERROR',
      errorMessage: '查询失败',
      details: error.message
    });
  }
}

function updateWithRemark(req, res) {
  try {
    const { supplementId } = req.params;
    const { manualRemarks, status } = req.body;

    if (!manualRemarks || manualRemarks.trim() === '') {
      return res.status(400).json({
        success: false,
        errorCode: 'MISSING_REMARK',
        errorMessage: '人工备注不能为空',
        details: '需人工确认的记录必须添加备注后才能继续处理'
      });
    }

    const recordIndex = storedRecords.findIndex(r => r.supplementId === supplementId);
    if (recordIndex === -1) {
      return res.status(404).json({
        success: false,
        errorCode: 'RECORD_NOT_FOUND',
        errorMessage: '记录不存在',
        details: `未找到补寄编号为 ${supplementId} 的记录`
      });
    }

    if (status) {
      storedRecords[recordIndex].status = status;
    }
    storedRecords[recordIndex].manualRemarks = manualRemarks;
    storedRecords[recordIndex].updatedAt = new Date().toISOString();

    return res.status(200).json({
      success: true,
      message: '人工备注已添加，记录已更新',
      data: storedRecords[recordIndex]
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      errorCode: 'INTERNAL_SERVER_ERROR',
      errorMessage: '更新失败',
      details: error.message
    });
  }
}

module.exports = {
  importRecords,
  getImportedRecords,
  updateWithRemark
};
