const { BaseParser } = require('./BaseParser');
const { SourceEvidence, SOURCE_TYPES, Task } = require('../models/Task');

class CleaningGroupParser extends BaseParser {
  constructor() {
    super(SOURCE_TYPES.CLEANING_GROUP);
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
    const dateMatch = line.match(/(\d{1,2}[-/月]\d{1,2})/);
    const roomMatch = line.match(/(\d{3,4})[号房]?/g);
    const typeMatch = line.match(/(退房|续住|日常|钟点|加清洁)/);
    const linenMatch = line.match(/(换布草|不换布草)/);

    if (!roomMatch || roomMatch.length === 0) {
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

    const cleaningType = typeMatch ? typeMatch[1] + '清洁' : '退房清洁';
    const needLinenChange = linenMatch ? linenMatch[1] === '换布草' : true;

    const parsedValue = {
      date: this.normalizeDate(fullDateStr),
      rooms: roomMatch,
      cleaningType,
      needLinenChange,
      rawLine: line
    };

    const tasks = roomMatch.map(room => {
      const evidence = new SourceEvidence(
        this.sourceType,
        fileName,
        lineNumber,
        line,
        { ...parsedValue, roomNumber: room }
      );

      const task = new Task(
        room,
        this.normalizeDate(fullDateStr),
        cleaningType,
        evidence,
        operator
      );
      task.needLinenChange = needLinenChange;
      task.isFromGroup = true;
      return task;
    });

    return tasks.length === 1 ? tasks[0] : tasks;
  }
}

module.exports = { CleaningGroupParser };
