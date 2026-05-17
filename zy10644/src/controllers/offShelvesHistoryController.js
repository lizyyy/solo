const { OffShelvesHistory } = require('../models/OffShelvesHistory');
const ExcelJS = require('exceljs');

const getHistoryList = async (req, res) => {
  try {
    const { page = 1, limit = 10, batchId, sku, operatorId, hasConflict, startDate, endDate } = req.query;
    const query = {};
    
    if (batchId) query.batchId = batchId;
    if (sku) query.sku = sku;
    if (operatorId) query['operator.id'] = operatorId;
    if (hasConflict === 'true') query.hasInventoryConflict = true;
    if (hasConflict === 'false') query.hasInventoryConflict = false;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const history = await OffShelvesHistory.find(query)
      .populate('preparedMealId', 'name category')
      .populate('storeId', 'name storeCode')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await OffShelvesHistory.countDocuments(query);

    res.json({
      data: history,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getHistoryByBatchId = async (req, res) => {
  try {
    const { batchId } = req.params;
    const history = await OffShelvesHistory.find({ batchId })
      .populate('preparedMealId', 'name category price')
      .populate('storeId', 'name storeCode address')
      .sort({ createdAt: -1 });

    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getHistoryBySku = async (req, res) => {
  try {
    const { sku } = req.params;
    const history = await OffShelvesHistory.find({ sku })
      .populate('preparedMealId', 'name category')
      .populate('storeId', 'name storeCode')
      .sort({ createdAt: -1 });

    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const exportHistory = async (req, res) => {
  try {
    const { batchId, sku, startDate, endDate } = req.query;
    const query = {};
    
    if (batchId) query.batchId = batchId;
    if (sku) query.sku = sku;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const history = await OffShelvesHistory.find(query)
      .populate('preparedMealId', 'name category price')
      .populate('storeId', 'name storeCode')
      .sort({ createdAt: -1 });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('下架历史记录');

    worksheet.columns = [
      { header: '批次ID', key: 'batchId', width: 36 },
      { header: 'SKU', key: 'sku', width: 15 },
      { header: '菜品名称', key: 'mealName', width: 25 },
      { header: '门店编码', key: 'storeCode', width: 12 },
      { header: '原状态', key: 'previousStatus', width: 15 },
      { header: '新状态', key: 'newStatus', width: 15 },
      { header: '下架原因', key: 'reason', width: 15 },
      { header: '原因详情', key: 'reasonDetail', width: 30 },
      { header: '操作来源', key: 'operationSource', width: 12 },
      { header: '操作者', key: 'operatorName', width: 12 },
      { header: '操作者部门', key: 'operatorDept', width: 15 },
      { header: '是否有库存冲突', key: 'hasConflict', width: 15 },
      { header: '是否强制下架', key: 'forceOffShelves', width: 15 },
      { header: '导入行号', key: 'importRowNumber', width: 10 },
      { header: '导入错误', key: 'importError', width: 30 },
      { header: '备注', key: 'remarks', width: 30 },
      { header: '操作时间', key: 'createdAt', width: 20 }
    ];

    const statusMap = {
      'available': '可售',
      'off_shelves_processing': '下架中',
      'off_shelved': '已下架',
      'recoverable': '可恢复'
    };

    const reasonMap = {
      'quality_issue': '质量问题',
      'supplier_issue': '供应商问题',
      'seasonal': '季节性调整',
      'inventory_clearance': '清库存',
      'strategy_adjustment': '策略调整',
      'customer_complaint': '客户投诉',
      'regulatory_requirement': '合规要求',
      'expired': '过期',
      'other': '其他'
    };

    const sourceMap = {
      'headquarters': '总部',
      'store': '门店',
      'api': 'API',
      'batch_import': '批量导入',
      'system': '系统'
    };

    history.forEach(record => {
      worksheet.addRow({
        batchId: record.batchId,
        sku: record.sku,
        mealName: record.preparedMealId?.name || '',
        storeCode: record.storeCode || '',
        previousStatus: statusMap[record.previousStatus] || record.previousStatus,
        newStatus: statusMap[record.newStatus] || record.newStatus,
        reason: reasonMap[record.reason] || record.reason,
        reasonDetail: record.reasonDetail || '',
        operationSource: sourceMap[record.operationSource] || record.operationSource,
        operatorName: record.operator?.name || '',
        operatorDept: record.operator?.department || '',
        hasConflict: record.hasInventoryConflict ? '是' : '否',
        forceOffShelves: record.forceOffShelves ? '是' : '否',
        importRowNumber: record.importRowNumber || '',
        importError: record.importError || '',
        remarks: record.remarks || '',
        createdAt: record.createdAt.toLocaleString('zh-CN')
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=off_shelves_history_${Date.now()}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const importBatchOffShelves = async (req, res) => {
  const { records, operator } = req.body;
  const batchId = require('uuid').v4();
  const results = {
    success: [],
    failed: [],
    conflicts: [],
    badRows: []
  };

  try {
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const rowNumber = i + 2;

      if (!record.sku || !record.reason) {
        await OffShelvesHistory.create({
          batchId,
          preparedMealId: null,
          sku: record.sku || 'UNKNOWN',
          previousStatus: null,
          newStatus: null,
          reason: record.reason || 'other',
          reasonDetail: record.reasonDetail,
          operationSource: 'batch_import',
          operator,
          importRowNumber: rowNumber,
          importError: '缺少必填字段：SKU或下架原因',
          remarks: '导入失败'
        });

        results.badRows.push({
          row: rowNumber,
          sku: record.sku,
          error: '缺少必填字段：SKU或下架原因'
        });
        continue;
      }

      const preparedMeal = await require('../models/PreparedMeal').PreparedMeal.findOne({ sku: record.sku });
      if (!preparedMeal) {
        await OffShelvesHistory.create({
          batchId,
          preparedMealId: null,
          sku: record.sku,
          previousStatus: null,
          newStatus: null,
          reason: record.reason,
          reasonDetail: record.reasonDetail,
          operationSource: 'batch_import',
          operator,
          importRowNumber: rowNumber,
          importError: 'SKU不存在',
          remarks: '导入失败'
        });

        results.badRows.push({
          row: rowNumber,
          sku: record.sku,
          error: 'SKU不存在'
        });
        continue;
      }

      const inventories = await require('../models/Inventory').find({ sku: record.sku });
      const storesWithInventory = inventories.filter(inv => inv.availableQuantity > 0);

      if (storesWithInventory.length > 0 && !record.forceOffShelves) {
        for (const inv of storesWithInventory) {
          await OffShelvesHistory.create({
            batchId,
            preparedMealId: preparedMeal._id,
            storeId: inv.storeId,
            sku: preparedMeal.sku,
            storeCode: inv.storeCode,
            previousStatus: preparedMeal.status,
            newStatus: preparedMeal.status,
            reason: record.reason,
            reasonDetail: record.reasonDetail,
            operationSource: 'batch_import',
            operator,
            hasInventoryConflict: true,
            inventoryConflictDetail: {
              storeCode: inv.storeCode,
              quantity: inv.quantity,
              availableQuantity: inv.availableQuantity
            },
            forceOffShelves: false,
            importRowNumber: rowNumber
          });

          results.conflicts.push({
            row: rowNumber,
            sku: preparedMeal.sku,
            name: preparedMeal.name,
            storeCode: inv.storeCode,
            availableQuantity: inv.availableQuantity
          });
        }
        continue;
      }

      const previousStatus = preparedMeal.status;
      preparedMeal.status = 'off_shelves_processing';
      preparedMeal.updatedBy = operator.id;
      await preparedMeal.save();

      await OffShelvesHistory.create({
        batchId,
        preparedMealId: preparedMeal._id,
        sku: preparedMeal.sku,
        previousStatus,
        newStatus: 'off_shelves_processing',
        reason: record.reason,
        reasonDetail: record.reasonDetail,
        operationSource: 'batch_import',
        operator,
        hasInventoryConflict: storesWithInventory.length > 0,
        forceOffShelves: record.forceOffShelves || false,
        importRowNumber: rowNumber
      });

      results.success.push({
        row: rowNumber,
        sku: preparedMeal.sku,
        name: preparedMeal.name
      });
    }

    res.json({
      batchId,
      results,
      summary: {
        total: records.length,
        success: results.success.length,
        failed: results.failed.length,
        conflicts: results.conflicts.length,
        badRows: results.badRows.length
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getHistoryList,
  getHistoryByBatchId,
  getHistoryBySku,
  exportHistory,
  importBatchOffShelves
};
