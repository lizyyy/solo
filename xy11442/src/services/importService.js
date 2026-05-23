const fs = require('fs');
const path = require('path');
const logger = require('../config/logger');
const { ImportBatch, SupplierDelivery, WeighingRecord, BasketReturn } = require('../models');
const FileHashService = require('./fileHashService');
const ImportParser = require('./importParser');
const config = require('../config');

class ImportService {
  static async importFile(filePath, originalFileName, fileType, importedBy = 'system') {
    const fileHash = await FileHashService.calculateFileHash(filePath);
    
    const existingBatch = await ImportBatch.findOne({ where: { fileHash } });
    if (existingBatch) {
      logger.warn(`文件已存在导入记录: ${fileHash}, 批次: ${existingBatch.id}`);
      return {
        batchId: existingBatch.id,
        isDuplicate: true,
        message: '该文件已导入过',
        batch: existingBatch,
      };
    }

    const batch = await ImportBatch.create({
      sourceFileName: originalFileName,
      sourceFileType: fileType,
      fileHash,
      status: 'processing',
      importedBy,
    });

    try {
      const parseResult = await ImportParser.parseCSV(filePath);
      batch.totalRows = parseResult.totalRows;
      await batch.save();

      let successRows = 0;
      let failedRows = 0;

      for (const row of parseResult.rows) {
        try {
          const normalized = this.normalizeRowByType(row, fileType);
          await this.createRecordByType(batch.id, row.rowNumber, row.originalData, normalized, fileType);
          successRows++;
        } catch (rowError) {
          logger.error(`行 ${row.rowNumber} 导入失败:`, rowError);
          failedRows++;
        }
      }

      batch.successRows = successRows;
      batch.failedRows = failedRows;
      batch.status = 'completed';
      await batch.save();

      logger.info(`导入完成: 成功 ${successRows} 行, 失败 ${failedRows} 行`);
      return {
        batchId: batch.id,
        isDuplicate: false,
        successRows,
        failedRows,
        totalRows: parseResult.totalRows,
        batch,
      };
    } catch (error) {
      logger.error('导入过程出错:', error);
      batch.status = 'failed';
      batch.errorMessage = error.message;
      await batch.save();
      throw error;
    }
  }

  static normalizeRowByType(row, fileType) {
    switch (fileType) {
      case 'delivery_note':
        return ImportParser.normalizeDeliveryRow(row);
      case 'weighing_record':
        return ImportParser.normalizeWeighingRow(row);
      case 'basket_return':
        return ImportParser.normalizeBasketReturnRow(row);
      default:
        throw new Error(`不支持的文件类型: ${fileType}`);
    }
  }

  static async createRecordByType(batchId, rowNumber, originalData, normalized, fileType) {
    const recordData = {
      batchId,
      originalRowNumber: rowNumber,
      originalData,
      ...normalized,
    };

    switch (fileType) {
      case 'delivery_note':
        return await SupplierDelivery.create(recordData);
      case 'weighing_record':
        return await WeighingRecord.create(recordData);
      case 'basket_return':
        return await BasketReturn.create(recordData);
      default:
        throw new Error(`不支持的文件类型: ${fileType}`);
    }
  }

  static async getBatchById(batchId) {
    return await ImportBatch.findByPk(batchId, {
      include: [
        { association: 'deliveries' },
        { association: 'weighingRecords' },
        { association: 'basketReturns' },
      ],
    });
  }

  static async listBatches(params = {}) {
    const { fileType, status, page = 1, pageSize = 20 } = params;
    const where = {};
    if (fileType) where.sourceFileType = fileType;
    if (status) where.status = status;

    return await ImportBatch.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
  }

  static saveUploadedFile(file) {
    const uploadDir = config.upload.dir;
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const uniqueName = `${Date.now()}-${file.originalname}`;
    const targetPath = path.join(uploadDir, uniqueName);
    
    fs.renameSync(file.path, targetPath);
    
    return {
      filePath: targetPath,
      originalFileName: file.originalname,
    };
  }
}

module.exports = ImportService;
