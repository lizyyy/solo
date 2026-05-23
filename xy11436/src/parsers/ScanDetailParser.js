const { BaseParser } = require('./BaseParser');
const { SourceEvidence, SOURCE_TYPES, Task } = require('../models/Task');

class ScanDetailParser extends BaseParser {
  constructor() {
    super(SOURCE_TYPES.SCAN_DETAIL);
  }

  parse(filePath, operator = 'system') {
    const { content, fileName } = this.readFile(filePath);
    const records = this.parseCSV(content);
    const results = {
      success: [],
      failed: [],
      source: this.sourceType,
      fileName
    };

    records.forEach((record, index) => {
      const lineNumber = index + 2;
      try {
        const verification = this.parseRecord(record, fileName, lineNumber);
        results.success.push({ verification, lineNumber, raw: record });
      } catch (error) {
        results.failed.push({
          lineNumber,
          raw: record,
          error: error.message
        });
      }
    });

    return results;
  }

  parseRecord(record, fileName, lineNumber) {
    const roomNumber = record.房间号 || record.roomNumber || this.extractRoomNumber(record.房源 || '');
    const scanTime = record.扫码时间 || record.scanTime || record.time;
    const cleaner = record.保洁员 || record.cleaner || '未知';
    const action = record.操作类型 || record.action || '开始清洁';

    if (!roomNumber) {
      throw new Error('无法提取房间号');
    }
    if (!scanTime) {
      throw new Error('缺少扫码时间');
    }

    const normalizedDate = this.normalizeDate(scanTime);

    const parsedValue = {
      roomNumber,
      scanTime: scanTime,
      normalizedDate,
      cleaner,
      action,
      isVerified: action.includes('完成') || action.includes('结束')
    };

    const evidence = new SourceEvidence(
      this.sourceType,
      fileName,
      lineNumber,
      JSON.stringify(record),
      parsedValue
    );

    return {
      roomNumber,
      date: normalizedDate,
      cleaner,
      action,
      scanTime,
      isVerified: parsedValue.isVerified,
      evidence
    };
  }
}

module.exports = { ScanDetailParser };
