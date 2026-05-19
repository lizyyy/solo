const fs = require('fs');
const csv = require('csv-parser');
const Room = require('../models/Room');
const CleaningRecord = require('../models/CleaningRecord');
const ImportBatch = require('../models/ImportBatch');
const OperationLog = require('../models/OperationLog');

class ImportService {
  static async importCleaningRecords(filePath, fileName, importedBy, ipAddress) {
    const results = [];
    const normalRecords = [];
    const abnormalRecords = [];
    const errors = [];

    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', resolve)
        .on('error', reject);
    });

    const batchNumber = ImportBatch.generateBatchNumber();

    for (let i = 0; i < results.length; i++) {
      const row = results[i];
      const lineNumber = i + 2;

      try {
        const validation = this.validateCleaningRow(row, lineNumber);
        
        if (!validation.isValid) {
          abnormalRecords.push({
            lineNumber,
            data: row,
            reason: validation.errors.join('; ')
          });
          errors.push(...validation.errors);
          continue;
        }

        const room = await Room.findByNumber(row.room_number.trim());
        let roomId = null;
        
        if (!room) {
          const newRoom = await Room.create({
            room_number: row.room_number.trim(),
            room_type: row.room_type || 'standard',
            floor: parseInt(row.floor) || 1
          });
          roomId = newRoom.id;
        } else {
          roomId = room.id;
        }

        const hasIssue = this.detectIssue(row);
        const status = hasIssue ? 'pending' : 'approved';

        const recordData = {
          room_id: roomId,
          room_number: row.room_number.trim(),
          cleaner_name: row.cleaner_name.trim(),
          check_date: row.check_date.trim(),
          check_time: row.check_time || null,
          status: status,
          photo_urls: row.photo_urls || null,
          quality_score: parseInt(row.quality_score) || null,
          has_issue: hasIssue ? 1 : 0,
          issue_description: hasIssue ? this.getIssueDescription(row) : null
        };

        const record = await CleaningRecord.create(recordData);
        
        normalRecords.push({
          lineNumber,
          recordId: record.id,
          data: recordData
        });

        await OperationLog.log(
          'import',
          'cleaning_records',
          record.id,
          importedBy,
          `批次${batchNumber}导入保洁记录-${row.room_number}`
        );

      } catch (error) {
        abnormalRecords.push({
          lineNumber,
          data: row,
          reason: error.message
        });
        errors.push(`行${lineNumber}: ${error.message}`);
      }
    }

    await ImportBatch.create({
      batch_number: batchNumber,
      file_name: fileName,
      total_records: results.length,
      normal_records: normalRecords.length,
      abnormal_records: abnormalRecords.length,
      imported_by: importedBy
    });

    await OperationLog.log(
      'batch_import',
      'import_batches',
      null,
      importedBy,
      `完成导入批次${batchNumber}，共${results.length}条记录，正常${normalRecords.length}条，异常${abnormalRecords.length}条`,
      null,
      null,
      ipAddress
    );

    return {
      batchNumber,
      total: results.length,
      normal: normalRecords.length,
      abnormal: abnormalRecords.length,
      normalRecords,
      abnormalRecords,
      errors
    };
  }

  static validateCleaningRow(row, lineNumber) {
    const errors = [];

    if (!row.room_number || !row.room_number.trim()) {
      errors.push(`行${lineNumber}: 房间号不能为空`);
    }

    if (!row.cleaner_name || !row.cleaner_name.trim()) {
      errors.push(`行${lineNumber}: 保洁员姓名不能为空`);
    }

    if (!row.check_date || !row.check_date.trim()) {
      errors.push(`行${lineNumber}: 保洁日期不能为空`);
    } else {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(row.check_date.trim())) {
        errors.push(`行${lineNumber}: 日期格式不正确，应为YYYY-MM-DD`);
      }
    }

    if (row.quality_score) {
      const score = parseInt(row.quality_score);
      if (isNaN(score) || score < 0 || score > 100) {
        errors.push(`行${lineNumber}: 质量分数应在0-100之间`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static detectIssue(row) {
    const issues = [];

    if (row.quality_score) {
      const score = parseInt(row.quality_score);
      if (score < 80) {
        issues.push(`质量分数过低(${score})`);
      }
    }

    if (!row.photo_urls || !row.photo_urls.trim()) {
      issues.push('缺少保洁照片');
    }

    if (row.has_issue && row.has_issue.toLowerCase() === 'true') {
      issues.push('标记为有问题');
    }

    if (row.issue_description && row.issue_description.trim()) {
      issues.push(row.issue_description.trim());
    }

    return issues.length > 0;
  }

  static getIssueDescription(row) {
    const issues = [];

    if (row.quality_score) {
      const score = parseInt(row.quality_score);
      if (score < 80) {
        issues.push(`质量分数${score}`);
      }
    }

    if (!row.photo_urls || !row.photo_urls.trim()) {
      issues.push('无保洁照片');
    }

    if (row.issue_description && row.issue_description.trim()) {
      issues.push(row.issue_description.trim());
    }

    return issues.join('; ');
  }

  static async getAbnormalRecords(batchNumber) {
    const batch = await ImportBatch.findByBatchNumber(batchNumber);
    if (!batch) {
      throw new Error('批次不存在');
    }

    return {
      batch,
      abnormalCount: batch.abnormal_records
    };
  }
}

module.exports = ImportService;