const { AudioRecord } = require('../models/AudioRecord');
const dataStore = require('./dataStore');

class ImportService {
  static importAudioRecords(importDataList, importedBy) {
    const results = {
      success: [],
      failed: [],
      warnings: []
    };

    for (const importData of importDataList) {
      try {
        if (!importData.songName) {
          results.failed.push({
            data: importData,
            error: '缺少歌曲名称'
          });
          continue;
        }

        const record = AudioRecord.createFromImport({
          ...importData,
          importedBy
        });

        const savedRecord = dataStore.addRecord(record);
        results.success.push(savedRecord);

        if (record.status === 'needs_review') {
          results.warnings.push({
            recordId: record.id,
            songName: record.songName,
            message: '同一首歌同时存在现场名和版权名，已标记待音乐老师复核'
          });
        }
      } catch (error) {
        results.failed.push({
          data: importData,
          error: error.message
        });
      }
    }

    return results;
  }

  static importLicenseData(recordId, licenseData, operator) {
    const record = dataStore.getRecordById(recordId);
    if (!record) {
      throw new Error('记录不存在');
    }

    const conflicts = record.applyLicenseData(licenseData, operator);
    dataStore.updateRecord(record);

    return {
      record,
      conflicts,
      hasConflict: conflicts.length > 0
    };
  }

  static batchImportLicenseData(licenseDataList, operator) {
    const results = {
      success: [],
      failed: [],
      conflicts: []
    };

    for (const licenseItem of licenseDataList) {
      try {
        const record = dataStore.getRecordById(licenseItem.recordId);
        if (!record) {
          results.failed.push({
            recordId: licenseItem.recordId,
            error: '记录不存在'
          });
          continue;
        }

        const conflicts = record.applyLicenseData(licenseItem, operator);
        dataStore.updateRecord(record);

        results.success.push(record);
        if (conflicts.length > 0) {
          results.conflicts.push({
            recordId: record.id,
            songName: record.songName,
            conflicts
          });
        }
      } catch (error) {
        results.failed.push({
          recordId: licenseItem.recordId,
          error: error.message
        });
      }
    }

    return results;
  }
}

module.exports = ImportService;
