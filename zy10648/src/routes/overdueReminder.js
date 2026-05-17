const express = require('express');
const router = express.Router();
const OverdueReminderService = require('../services/OverdueReminderService');
const ExportService = require('../services/ExportService');
const { ApiResponse } = require('../utils/response');
const db = require('../database/memoryDB');

router.get('/borrows', async (req, res) => {
  try {
    const { status, userId, hasDepartmentConflict } = req.query;
    const filters = {};
    if (status) filters.status = status;
    if (userId) filters.userId = userId;
    if (hasDepartmentConflict !== undefined) filters.hasDepartmentConflict = hasDepartmentConflict === 'true';
    
    const result = await OverdueReminderService.getBorrowList(filters);
    res.json(result);
  } catch (error) {
    res.status(500).json(ApiResponse.error(error.message, 500));
  }
});

router.get('/borrows/:id', async (req, res) => {
  try {
    const result = await OverdueReminderService.getBorrowDetail(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json(ApiResponse.error(error.message, 500));
  }
});

router.get('/reminders', async (req, res) => {
  try {
    const { borrowRecordId } = req.query;
    const result = await OverdueReminderService.getReminderHistory(borrowRecordId);
    res.json(result);
  } catch (error) {
    res.status(500).json(ApiResponse.error(error.message, 500));
  }
});

router.post('/reminders', async (req, res) => {
  try {
    const { borrowRecordId, operatorId } = req.body;
    const result = await OverdueReminderService.createReminder(borrowRecordId, operatorId);
    res.json(result);
  } catch (error) {
    res.status(500).json(ApiResponse.error(error.message, 500));
  }
});

router.post('/reminders/force', async (req, res) => {
  try {
    const { borrowRecordId, operatorId, conflictConfirmed } = req.body;
    const result = await OverdueReminderService.forceCreateReminder(
      borrowRecordId, 
      operatorId, 
      conflictConfirmed
    );
    res.json(result);
  } catch (error) {
    res.status(500).json(ApiResponse.error(error.message, 500));
  }
});

router.post('/borrows/:id/return', async (req, res) => {
  try {
    const result = await OverdueReminderService.processReturn(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json(ApiResponse.error(error.message, 500));
  }
});

router.get('/statistics', async (req, res) => {
  try {
    const result = await OverdueReminderService.getStatistics();
    res.json(result);
  } catch (error) {
    res.status(500).json(ApiResponse.error(error.message, 500));
  }
});

router.get('/export/borrows', async (req, res) => {
  try {
    const { format = 'json', status } = req.query;
    const filters = {};
    if (status) filters.status = status;
    const result = await ExportService.exportBorrowRecords(format, filters);
    res.json(result);
  } catch (error) {
    res.status(500).json(ApiResponse.error(error.message, 500));
  }
});

router.get('/export/reminders', async (req, res) => {
  try {
    const { format = 'json' } = req.query;
    const result = await ExportService.exportReminderHistory(format);
    res.json(result);
  } catch (error) {
    res.status(500).json(ApiResponse.error(error.message, 500));
  }
});

router.get('/export/files', async (req, res) => {
  try {
    const result = await ExportService.getExportFiles();
    res.json(result);
  } catch (error) {
    res.status(500).json(ApiResponse.error(error.message, 500));
  }
});

router.post('/import/test-bad-rows', async (req, res) => {
  try {
    db.clearImportErrors();
    
    const badRows = [
      { rowNumber: 3, rowData: { assetId: '', userId: 'user_1', expectedReturnDate: 'invalid-date' }, errorMessage: '资产ID不能为空' },
      { rowNumber: 5, rowData: { assetId: 'asset_invalid', userId: '', expectedReturnDate: '2024-13-01' }, errorMessage: '用户ID不能为空; 日期格式无效' },
      { rowNumber: 7, rowData: { assetId: 'asset_1', userId: 'user_not_exist', expectedReturnDate: '2024-12-01' }, errorMessage: '用户不存在' }
    ];

    badRows.forEach(row => {
      db.addImportError(row.rowNumber, row.rowData, row.errorMessage);
    });

    res.json(ApiResponse.success({
      importedCount: 0,
      badRowCount: badRows.length,
      badRows: db.getImportErrors()
    }, '测试坏行数据已导入'));
  } catch (error) {
    res.status(500).json(ApiResponse.error(error.message, 500));
  }
});

router.get('/import/errors', async (req, res) => {
  try {
    const errors = db.getImportErrors();
    res.json(ApiResponse.success({
      errors,
      total: errors.length
    }));
  } catch (error) {
    res.status(500).json(ApiResponse.error(error.message, 500));
  }
});

module.exports = router;
