const fs = require('fs');
const readline = require('readline');
const { LOG_PATTERNS, EVENT_TYPES } = require('./constants');

class LogParser {
  constructor(options = {}) {
    this.verbose = options.verbose || false;
    this.processedRecords = new Set();
  }

  generateRecordKey(line, fileName, lineNumber) {
    return `${fileName}:${lineNumber}:${line.trim().substring(0, 100)}`;
  }

  parseLine(line, fileName, lineNumber) {
    const key = this.generateRecordKey(line, fileName, lineNumber);
    
    if (this.processedRecords.has(key)) {
      return null;
    }

    const events = [];
    const matchedPatterns = [];

    if (LOG_PATTERNS.OVERFLOW.test(line)) {
      events.push(EVENT_TYPES.OVERFLOW);
      matchedPatterns.push('OVERFLOW');
    }
    if (LOG_PATTERNS.ABANDON.test(line)) {
      events.push(EVENT_TYPES.ABANDON);
      matchedPatterns.push('ABANDON');
    }
    if (LOG_PATTERNS.QUEUE_HOLD.test(line)) {
      events.push(EVENT_TYPES.QUEUE_HOLD);
      matchedPatterns.push('QUEUE_HOLD');
    }
    if (LOG_PATTERNS.VISITOR_REFRESH.test(line)) {
      events.push(EVENT_TYPES.VISITOR_REFRESH);
      matchedPatterns.push('VISITOR_REFRESH');
    }
    if (LOG_PATTERNS.SKILL_GROUP_RENAME.test(line)) {
      events.push(EVENT_TYPES.SKILL_GROUP_RENAME);
      matchedPatterns.push('SKILL_GROUP_RENAME');
    }

    if (events.length === 0) {
      return null;
    }

    this.processedRecords.add(key);

    const timestamp = this.extractTimestamp(line);
    const skillGroup = this.extractSkillGroup(line);
    const visitorId = this.extractVisitorId(line);

    return {
      fileName,
      lineNumber,
      lineContent: line,
      timestamp,
      skillGroup,
      visitorId,
      events,
      matchedPatterns,
      recordKey: key
    };
  }

  extractTimestamp(line) {
    const timestampPattern = /(\d{4}[-/]\d{2}[-/]\d{2}[T\s]\d{2}:\d{2}:\d{2})/;
    const match = line.match(timestampPattern);
    return match ? match[1] : null;
  }

  extractSkillGroup(line) {
    const patterns = [
      /技能组[：:]\s*([^\s,，]+)/i,
      /skillGroup[=:]\s*([^\s,]+)/i,
      /组名[：:]\s*([^\s,，]+)/i
    ];
    
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  extractVisitorId(line) {
    const patterns = [
      /访客ID[：:]\s*([^\s,，]+)/i,
      /visitorId[=:]\s*([^\s,]+)/i,
      /用户ID[：:]\s*([^\s,，]+)/i
    ];
    
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  async parseFile(filePath) {
    const results = [];
    const fileName = filePath.split('/').pop();
    let lineNumber = 0;

    const rl = readline.createInterface({
      input: fs.createReadStream(filePath),
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      lineNumber++;
      const parsed = this.parseLine(line, fileName, lineNumber);
      if (parsed) {
        results.push(parsed);
      }
    }

    return results;
  }

  async parseFiles(filePaths) {
    const allResults = [];
    this.processedRecords.clear();

    for (const filePath of filePaths) {
      if (fs.existsSync(filePath)) {
        const results = await this.parseFile(filePath);
        allResults.push(...results);
      }
    }

    return allResults;
  }

  reset() {
    this.processedRecords.clear();
  }
}

module.exports = LogParser;
