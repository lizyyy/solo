const fs = require('fs');
const store = require('../models/store');
const { parseAppointmentCSV, parseJSON } = require('../utils/parser');
const { processAppointments } = require('../utils/rulesEngine');

const uploadAppointments = async (req, res) => {
  try {
    if (!req.files || !req.files.appointments || req.files.appointments.length === 0) {
      return res.status(400).json({
        error: '缺少预约CSV文件',
        code: 'MISSING_APPOINTMENTS_FILE'
      });
    }

    const files = req.files.appointments;
    const batchId = store.generateBatchId(files);

    if (store.isBatchProcessed(batchId)) {
      const existingResult = store.getProcessResult(batchId);
      return res.status(200).json({
        batchId,
        isDuplicateBatch: true,
        message: '该批文件已处理过，以下是历史处理结果',
        processedAt: store.processedBatches.get(batchId).processedAt,
        result: existingResult
      });
    }

    if (req.files.inventory && req.files.inventory.length > 0) {
      try {
        const inventoryData = await parseJSON(req.files.inventory[0].path);
        store.updateVaccineInventory(inventoryData.vaccines || inventoryData);
      } catch (e) {
        console.error('库存文件解析错误:', e.message);
      }
    }

    if (req.files.rules && req.files.rules.length > 0) {
      try {
        const rulesData = await parseJSON(req.files.rules[0].path);
        store.updateContraindicationRules(rulesData.rules || rulesData);
      } catch (e) {
        console.error('规则文件解析错误:', e.message);
      }
    }

    const allAppointments = [];
    const allParseErrors = [];

    for (const file of files) {
      try {
        const { success, parseErrors } = await parseAppointmentCSV(file.path);
        allAppointments.push(...success);
        allParseErrors.push(...parseErrors.map(e => ({
          ...e,
          fileName: file.originalname
        })));
      } catch (e) {
        return res.status(400).json({
          error: `文件 ${file.originalname} 解析失败: ${e.message}`,
          code: 'CSV_PARSE_ERROR'
        });
      }
    }

    const result = processAppointments(allAppointments);

    const finalResult = {
      ...result,
      parseErrors: allParseErrors
    };

    store.markBatchProcessed(batchId, {
      fileCount: files.length,
      totalRecords: allAppointments.length
    });
    store.saveProcessResult(batchId, finalResult);

    files.forEach(file => {
      fs.unlink(file.path, () => {});
    });
    if (req.files.inventory) {
      req.files.inventory.forEach(file => fs.unlink(file.path, () => {}));
    }
    if (req.files.rules) {
      req.files.rules.forEach(file => fs.unlink(file.path, () => {}));
    }

    res.status(200).json({
      batchId,
      isDuplicateBatch: false,
      message: allParseErrors.length > 0 ? '处理完成，但有部分记录解析失败' : '处理完成',
      result: finalResult
    });

  } catch (error) {
    console.error('处理预约时出错:', error);
    res.status(500).json({
      error: '服务器内部错误',
      code: 'INTERNAL_ERROR',
      message: error.message
    });
  }
};

const getBatchResult = (req, res) => {
  const { batchId } = req.params;
  
  if (!store.isBatchProcessed(batchId)) {
    return res.status(404).json({
      error: '未找到该批次',
      code: 'BATCH_NOT_FOUND'
    });
  }

  const result = store.getProcessResult(batchId);
  const batchInfo = store.processedBatches.get(batchId);

  res.status(200).json({
    batchId,
    processedAt: batchInfo.processedAt,
    metadata: batchInfo.metadata,
    result
  });
};

const getVaccineInventory = (req, res) => {
  const vaccines = store.getAllVaccines();
  res.status(200).json({
    total: vaccines.length,
    vaccines
  });
};

const getContraindicationRules = (req, res) => {
  const rules = store.getContraindicationRules();
  res.status(200).json({
    total: rules.length,
    rules
  });
};

const updateInventory = async (req, res) => {
  try {
    const inventoryData = req.body;
    const vaccines = inventoryData.vaccines || inventoryData;
    
    if (!Array.isArray(vaccines)) {
      return res.status(400).json({
        error: '库存数据格式错误，应为数组',
        code: 'INVALID_FORMAT'
      });
    }

    store.updateVaccineInventory(vaccines);
    
    res.status(200).json({
      message: '疫苗库存更新成功',
      updatedCount: vaccines.length,
      vaccines: store.getAllVaccines()
    });
  } catch (error) {
    res.status(500).json({
      error: '更新库存失败',
      message: error.message
    });
  }
};

const updateRules = async (req, res) => {
  try {
    const rulesData = req.body;
    const rules = rulesData.rules || rulesData;
    
    if (!Array.isArray(rules)) {
      return res.status(400).json({
        error: '规则数据格式错误，应为数组',
        code: 'INVALID_FORMAT'
      });
    }

    store.updateContraindicationRules(rules);
    
    res.status(200).json({
      message: '禁忌规则更新成功',
      updatedCount: rules.length,
      rules: store.getContraindicationRules()
    });
  } catch (error) {
    res.status(500).json({
      error: '更新规则失败',
      message: error.message
    });
  }
};

module.exports = {
  uploadAppointments,
  getBatchResult,
  getVaccineInventory,
  getContraindicationRules,
  updateInventory,
  updateRules
};
