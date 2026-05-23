const { BaseParser } = require('./BaseParser');
const { SourceEvidence, SOURCE_TYPES, Task } = require('../models/Task');

class OrderCalendarParser extends BaseParser {
  constructor() {
    super(SOURCE_TYPES.ORDER_CALENDAR);
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
        const task = this.parseRecord(record, fileName, lineNumber, operator);
        results.success.push({ task, lineNumber, raw: record });
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

  parseRecord(record, fileName, lineNumber, operator) {
    const roomNumber = record.房间号 || record.roomNumber || this.extractRoomNumber(record.房源 || '');
    const checkInDate = record.入住日期 || record.checkInDate;
    const checkOutDate = record.退房日期 || record.checkOutDate;
    const guestName = record.客人姓名 || record.guestName || '未知客人';

    if (!roomNumber) {
      throw new Error('无法提取房间号');
    }
    if (!this.validateDate(checkInDate)) {
      throw new Error(`入住日期无效: ${checkInDate}`);
    }
    if (!this.validateDate(checkOutDate)) {
      throw new Error(`退房日期无效: ${checkOutDate}`);
    }

    const normalizedCheckIn = this.normalizeDate(checkInDate);
    const normalizedCheckOut = this.normalizeDate(checkOutDate);

    const cleaningDate = normalizedCheckOut;
    const parsedValue = {
      roomNumber,
      checkInDate: normalizedCheckIn,
      checkOutDate: normalizedCheckOut,
      guestName,
      cleaningDate,
      cleaningType: this.determineCleaningType(record),
      needLinenChange: this.needLinenChange(record)
    };

    const evidence = new SourceEvidence(
      this.sourceType,
      fileName,
      lineNumber,
      JSON.stringify(record),
      parsedValue
    );

    const task = new Task(
      roomNumber,
      cleaningDate,
      '退房清洁',
      evidence,
      operator
    );
    task.checkInDate = normalizedCheckIn;
    task.checkOutDate = normalizedCheckOut;
    task.guestName = guestName;
    task.needLinenChange = parsedValue.needLinenChange;

    return task;
  }

  determineCleaningType(record) {
    const stayDays = record.连住天数 || record.stayDays;
    if (stayDays && parseInt(stayDays) >= 3) {
      return '连住清洁';
    }
    return '退房清洁';
  }

  needLinenChange(record) {
    const notes = record.备注 || record.notes || '';
    if (notes.includes('不换布草') || notes.includes('续住')) {
      return false;
    }
    return true;
  }
}

module.exports = { OrderCalendarParser };
