const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const importBatchModel = require('../models/importBatch');
const hazardModel = require('../models/hazard');
const photoModel = require('../models/photo');
const { validateHazard, validatePhoto, suggestFix } = require('../utils/validator');
const { BATCH_SIZE } = require('../utils/constants');

class ImportService {
  async importHazardsFromCSV(filePath, operator = 'system') {
    const fileName = path.basename(filePath);
    const batchId = await importBatchModel.createBatch('hazards', fileName);

    const records = [];
    let rowNumber = 0;

    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => {
          rowNumber++;
          records.push({ rowNumber, rawData: data });
        })
        .on('end', async () => {
          try {
            await importBatchModel.addRecords(batchId, records);
            await importBatchModel.startBatch(batchId, records.length);

            const result = await this.processHazardBatch(batchId, operator);
            resolve(result);
          } catch (err) {
            reject(err);
          }
        })
        .on('error', reject);
    });
  }

  async processHazardBatch(batchId, operator) {
    let hasMore = true;

    while (hasMore) {
      const pendingRecords = await importBatchModel.getPendingRecords(batchId, BATCH_SIZE);
      
      if (pendingRecords.length === 0) {
        hasMore = false;
        break;
      }

      for (const record of pendingRecords) {
        try {
          const rawData = JSON.parse(record.raw_data);
          const data = this.transformHazardData(rawData);
          const validation = validateHazard(data);

          if (!validation.isValid) {
            const errorMsg = validation.errors.map(e => e.message).join('; ');
            const suggestions = validation.errors
              .map(e => `${e.field}: ${suggestFix(e.field, e.message)}`)
              .join('; ');
            await importBatchModel.markRecordFailed(record.id, errorMsg, suggestions);
            continue;
          }

          const existing = await hazardModel.findByCode(data.hazardCode);
          if (existing) {
            await importBatchModel.markRecordSkipped(record.id, `隐患编号 ${data.hazardCode} 已存在`);
            continue;
          }

          const result = await hazardModel.create(data);
          await importBatchModel.markRecordSuccess(record.id, result.hazardCode);

        } catch (err) {
          await importBatchModel.markRecordFailed(
            record.id, 
            err.message, 
            '请检查数据格式是否正确，或联系技术支持'
          );
        }
      }
    }

    return await importBatchModel.completeBatch(batchId);
  }

  transformHazardData(rawData) {
    return {
      hazardCode: rawData.隐患编号 || rawData.hazardCode || rawData.code || '',
      title: rawData.隐患标题 || rawData.title || '',
      description: rawData.隐患描述 || rawData.description || '',
      location: rawData.隐患位置 || rawData.location || '',
      level: (rawData.隐患级别 || rawData.level || 'medium').toLowerCase(),
      discoverDate: this.parseDate(rawData.发现日期 || rawData.discoverDate || rawData.date),
      discoverer: rawData.发现人 || rawData.discoverer || '',
      department: rawData.所属部门 || rawData.department || '',
      responsiblePerson: rawData.整改责任人 || rawData.responsiblePerson || '',
      deadline: this.parseDate(rawData.整改期限 || rawData.deadline)
    };
  }

  async importPhotosFromJSON(filePath, operator = 'system') {
    const fileName = path.basename(filePath);
    const batchId = await importBatchModel.createBatch('photos', fileName);

    const content = fs.readFileSync(filePath, 'utf8');
    const photoData = JSON.parse(content);
    
    const records = photoData.map((item, index) => ({
      rowNumber: index + 1,
      rawData: item
    }));

    await importBatchModel.addRecords(batchId, records);
    await importBatchModel.startBatch(batchId, records.length);

    return await this.processPhotoBatch(batchId, operator);
  }

  async processPhotoBatch(batchId, operator) {
    let hasMore = true;

    while (hasMore) {
      const pendingRecords = await importBatchModel.getPendingRecords(batchId, BATCH_SIZE);
      
      if (pendingRecords.length === 0) {
        hasMore = false;
        break;
      }

      for (const record of pendingRecords) {
        try {
          const rawData = JSON.parse(record.raw_data);
          const data = this.transformPhotoData(rawData);
          const validation = validatePhoto(data);

          if (!validation.isValid) {
            const errorMsg = validation.errors.map(e => e.message).join('; ');
            await importBatchModel.markRecordFailed(record.id, errorMsg, '请检查照片数据格式');
            continue;
          }

          const hazard = await hazardModel.findByCode(data.hazardCode);
          if (!hazard) {
            await importBatchModel.markRecordSkipped(
              record.id, 
              `关联的隐患不存在: ${data.hazardCode}`
            );
            continue;
          }

          const result = await photoModel.create(data);
          await importBatchModel.markRecordSuccess(record.id, result.photoId);

        } catch (err) {
          await importBatchModel.markRecordFailed(
            record.id, 
            err.message, 
            '请检查照片数据格式是否正确'
          );
        }
      }
    }

    return await importBatchModel.completeBatch(batchId);
  }

  transformPhotoData(rawData) {
    return {
      photoId: rawData.照片ID || rawData.photoId || rawData.id || '',
      hazardCode: rawData.隐患编号 || rawData.hazardCode || '',
      photoType: (rawData.照片类型 || rawData.photoType || 'inspection').toLowerCase(),
      filePath: rawData.文件路径 || rawData.filePath || rawData.path || '',
      uploadDate: this.parseDate(rawData.上传日期 || rawData.uploadDate),
      uploader: rawData.上传人 || rawData.uploader || '',
      description: rawData.描述 || rawData.description || ''
    };
  }

  async importReviewsFromCSV(filePath, operator = 'system') {
    const fileName = path.basename(filePath);
    const batchId = await importBatchModel.createBatch('reviews', fileName);

    const records = [];
    let rowNumber = 0;

    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => {
          rowNumber++;
          records.push({ rowNumber, rawData: data });
        })
        .on('end', async () => {
          try {
            await importBatchModel.addRecords(batchId, records);
            await importBatchModel.startBatch(batchId, records.length);

            const result = await this.processReviewBatch(batchId, operator);
            resolve(result);
          } catch (err) {
            reject(err);
          }
        })
        .on('error', reject);
    });
  }

  async processReviewBatch(batchId, operator) {
    let hasMore = true;

    while (hasMore) {
      const pendingRecords = await importBatchModel.getPendingRecords(batchId, BATCH_SIZE);
      
      if (pendingRecords.length === 0) {
        hasMore = false;
        break;
      }

      for (const record of pendingRecords) {
        try {
          const rawData = JSON.parse(record.raw_data);
          const data = this.transformReviewData(rawData);

          if (!data.hazardCode) {
            await importBatchModel.markRecordFailed(record.id, '隐患编号不能为空', '请填写有效的隐患编号');
            continue;
          }

          if (!data.reviewer) {
            await importBatchModel.markRecordFailed(record.id, '复查人不能为空', '请填写复查人姓名');
            continue;
          }

          if (!['pass', 'fail', 'reopen'].includes(data.result)) {
            await importBatchModel.markRecordFailed(
              record.id, 
              `复查结果无效: ${data.result}`, 
              '复查结果应为: pass/fail/reopen'
            );
            continue;
          }

          const hazard = await hazardModel.findByCode(data.hazardCode);
          if (!hazard) {
            await importBatchModel.markRecordSkipped(
              record.id, 
              `隐患不存在: ${data.hazardCode}`
            );
            continue;
          }

          await hazardModel.review(data.hazardCode, data.result, data.reviewer, data.comments);
          await importBatchModel.markRecordSuccess(record.id, data.hazardCode);

        } catch (err) {
          await importBatchModel.markRecordFailed(
            record.id, 
            err.message, 
            '请检查复查记录格式'
          );
        }
      }
    }

    return await importBatchModel.completeBatch(batchId);
  }

  transformReviewData(rawData) {
    return {
      hazardCode: rawData.隐患编号 || rawData.hazardCode || '',
      reviewer: rawData.复查人 || rawData.reviewer || '',
      result: (rawData.复查结果 || rawData.result || 'pass').toLowerCase(),
      comments: rawData.复查意见 || rawData.comments || '',
      reviewDate: this.parseDate(rawData.复查日期 || rawData.reviewDate)
    };
  }

  parseDate(dateStr) {
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      return isNaN(date.getTime()) ? null : date;
    } catch {
      return null;
    }
  }

  async retryBatch(batchId, operator = 'system') {
    const batch = await importBatchModel.getBatch(batchId);
    if (!batch) {
      throw new Error(`批次不存在: ${batchId}`);
    }

    const pendingRecords = await importBatchModel.retryFailedRecords(batchId);
    
    if (pendingRecords.length === 0) {
      return { message: '没有需要重试的记录' };
    }

    if (batch.import_type === 'hazards') {
      return await this.processHazardBatch(batchId, operator);
    } else if (batch.import_type === 'photos') {
      return await this.processPhotoBatch(batchId, operator);
    } else if (batch.import_type === 'reviews') {
      return await this.processReviewBatch(batchId, operator);
    }

    throw new Error(`不支持的导入类型: ${batch.import_type}`);
  }

  async getFailedRecords(batchId) {
    return await importBatchModel.getFailedRecords(batchId);
  }

  async getBatchInfo(batchId) {
    const batch = await importBatchModel.getBatch(batchId);
    if (!batch) {
      throw new Error(`批次不存在: ${batchId}`);
    }
    const stats = await importBatchModel.getBatchStats(batchId);
    return { ...batch, ...stats };
  }
}

module.exports = new ImportService();
