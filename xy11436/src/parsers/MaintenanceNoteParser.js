const { BaseParser } = require('./BaseParser');
const { SourceEvidence, SOURCE_TYPES, Task } = require('../models/Task');

class MaintenanceNoteParser extends BaseParser {
  constructor() {
    super(SOURCE_TYPES.MAINTENANCE_NOTE);
  }

  parse(filePath, operator = 'system') {
    const { content, fileName } = this.readFile(filePath);
    const lines = this.parseLines(content);
    const results = {
      success: [],
      failed: [],
      source: this.sourceType,
      fileName
    };

    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      try {
        const task = this.parseLine(line, fileName, lineNumber, operator);
        if (task) {
          results.success.push({ task, lineNumber, raw: line });
        }
      } catch (error) {
        results.failed.push({
          lineNumber,
          raw: line,
          error: error.message
        });
      }
    });

    return results;
  }

  parseLine(line, fileName, lineNumber, operator) {
    const roomNumber = this.extractRoomNumber(line);
    const dateMatch = line.match(/(\d{1,2}[-/月]\d{1,2})/);
    const issueMatch = line.match(/(漏水|空调|灯坏|门锁|马桶|热水器|电视|网络|冰箱|洗衣机)/);
    const priorityMatch = line.match(/(紧急|高|中|低)/);

    if (!roomNumber) {
      throw new Error('无法提取房间号');
    }

    let dateStr = dateMatch ? dateMatch[1] : null;
    if (!dateStr) {
      const today = new Date();
      dateStr = `${today.getMonth() + 1}-${today.getDate()}`;
    }
    
    dateStr = dateStr.replace(/[月/]/g, '-');
    const currentYear = new Date().getFullYear();
    const fullDateStr = `${currentYear}-${dateStr}`;
    
    if (!this.validateDate(fullDateStr)) {
      throw new Error(`日期无效: ${dateStr}`);
    }

    const issue = issueMatch ? issueMatch[1] : '其他维修';
    const priority = priorityMatch ? priorityMatch[1] : '中';

    const parsedValue = {
      roomNumber,
      date: this.normalizeDate(fullDateStr),
      issue,
      priority,
      description: line,
      needCleaning: this.needCleaning(line)
    };

    const evidence = new SourceEvidence(
      this.sourceType,
      fileName,
      lineNumber,
      line,
      parsedValue
    );

    if (parsedValue.needCleaning) {
      const task = new Task(
        roomNumber,
        this.normalizeDate(fullDateStr),
        '维修后清洁',
        evidence,
        operator
      );
      task.maintenanceIssue = issue;
      task.priority = priority;
      task.maintenanceNote = line;
      return task;
    }

    return null;
  }

  needCleaning(line) {
    const noNeedKeywords = ['不需清洁', '不用打扫', '直接维修'];
    const needKeywords = ['需要清洁', '打扫后', '清洁后', '清理'];
    
    if (noNeedKeywords.some(k => line.includes(k))) {
      return false;
    }
    if (needKeywords.some(k => line.includes(k))) {
      return true;
    }
    return true;
  }
}

module.exports = { MaintenanceNoteParser };
