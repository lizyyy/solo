const express = require('express');
const fs = require('fs');
const path = require('path');
const uploadService = require('../services/uploadService');
const validationService = require('../services/validationService');
const deduplicationService = require('../services/deduplicationService');

module.exports = (upload) => {
  const router = express.Router();

  router.post('/', upload.fields([
    { name: 'borrowReturnCsv', maxCount: 1 },
    { name: 'vehiclesJson', maxCount: 1 },
    { name: 'violationReceipts', maxCount: 10 }
  ]), async (req, res, next) => {
    try {
      const batchId = req.body.batchId || `batch_${Date.now()}`;
      
      if (await deduplicationService.isBatchProcessed(batchId)) {
        return res.status(400).json({
          success: false,
          message: '该批次已处理，请勿重复提交',
          batchId: batchId
        });
      }

      const files = req.files;
      const result = {
        batchId: batchId,
        normalItems: [],
        pendingItems: [],
        failedItems: []
      };

      let vehicleList = [];
      let borrowReturnRecords = [];

      if (files.vehiclesJson && files.vehiclesJson.length > 0) {
        const jsonPath = files.vehiclesJson[0].path;
        const vehicleData = await uploadService.parseJson(jsonPath);
        const validationResult = validationService.validateVehicles(vehicleData);
        result.normalItems.push(...validationResult.normal);
        result.pendingItems.push(...validationResult.pending);
        result.failedItems.push(...validationResult.failed);
        
        vehicleList = Array.isArray(vehicleData) ? vehicleData : (vehicleData.vehicles || [vehicleData]);
      }

      if (files.borrowReturnCsv && files.borrowReturnCsv.length > 0) {
        const csvPath = files.borrowReturnCsv[0].path;
        const csvData = await uploadService.parseCsv(csvPath);
        const validationResult = validationService.validateBorrowReturnRecords(csvData);
        result.normalItems.push(...validationResult.normal);
        result.pendingItems.push(...validationResult.pending);
        result.failedItems.push(...validationResult.failed);
        
        borrowReturnRecords = csvData;
      }

      if (files.violationReceipts && files.violationReceipts.length > 0) {
        for (const receipt of files.violationReceipts) {
          const receiptData = await uploadService.parseReceipt(receipt);
          const validationResult = validationService.validateViolationReceipt(
            receiptData, 
            vehicleList, 
            borrowReturnRecords
          );
          result.normalItems.push(...validationResult.normal);
          result.pendingItems.push(...validationResult.pending);
          result.failedItems.push(...validationResult.failed);
        }
      }

      await deduplicationService.markBatchProcessed(batchId, {
        fileCount: Object.values(files).flat().length,
        processedAt: new Date().toISOString()
      });

      res.json({
        success: true,
        data: {
          batchId: result.batchId,
          summary: {
            total: result.normalItems.length + result.pendingItems.length + result.failedItems.length,
            normal: result.normalItems.length,
            pending: result.pendingItems.length,
            failed: result.failedItems.length
          },
          normalItems: result.normalItems,
          pendingItems: result.pendingItems,
          failedItems: result.failedItems
        }
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
};
