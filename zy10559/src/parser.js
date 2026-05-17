const fs = require('fs');
const readline = require('readline');

const STATE = {
  IDLE: 'idle',
  IN_SQL: 'in_sql'
};

function parseTimeString(timeStr) {
  if (!timeStr) return null;
  
  const match = timeStr.match(/(\d+\.?\d*)/);
  if (match) {
    return parseFloat(match[1]);
  }
  
  return null;
}

class SlowQueryLogParser {
  constructor(options = {}) {
    this.options = {
      encoding: 'utf8',
      ...options
    };
    this.reset();
  }

  reset() {
    this.entries = [];
    this.errors = [];
    this.currentEntry = null;
    this.state = STATE.IDLE;
    this.lineNumber = 0;
  }

  async parseFile(filePath) {
    this.reset();
    
    const rl = readline.createInterface({
      input: fs.createReadStream(filePath, this.options.encoding),
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      this.lineNumber++;
      this.processLine(line);
    }

    this.finalizeCurrentEntry();
    rl.close();

    return {
      entries: this.entries,
      errors: this.errors,
      totalLines: this.lineNumber
    };
  }

  processLine(line) {
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith('# Time:') || 
        trimmedLine.startsWith('# Query_time:') ||
        trimmedLine.startsWith('# User@Host:') ||
        trimmedLine.startsWith('# Schema:') ||
        trimmedLine.startsWith('# Rows_sent:') ||
        trimmedLine.startsWith('# Rows_examined:')) {
      
      this.finalizeCurrentEntry();
      this.currentEntry = {
        rawLines: [],
        metadata: {},
        sqlLines: [],
        startLine: this.lineNumber,
        endLine: this.lineNumber
      };
      this.state = STATE.IDLE;
      
      this.parseMetadataLine(trimmedLine);
      this.currentEntry.rawLines.push(line);
      return;
    }

    if (trimmedLine.startsWith('SET timestamp=')) {
      if (this.currentEntry) {
        this.currentEntry.rawLines.push(line);
        const match = trimmedLine.match(/SET timestamp=(\d+)/);
        if (match) {
          this.currentEntry.metadata.timestamp = parseInt(match[1], 10);
        }
      }
      return;
    }

    if (this.currentEntry && trimmedLine && !trimmedLine.startsWith('#')) {
      this.state = STATE.IN_SQL;
      this.currentEntry.sqlLines.push(line);
      this.currentEntry.rawLines.push(line);
      this.currentEntry.endLine = this.lineNumber;
    }
  }

  parseMetadataLine(line) {
    if (line.startsWith('# Time:')) {
      const timeStr = line.replace('# Time:', '').trim();
      this.currentEntry.metadata.time = timeStr;
    }
    
    if (line.startsWith('# Query_time:')) {
      const match = line.match(/# Query_time:\s*([\d.]+)\s*Lock_time:\s*([\d.]+)\s*Rows_sent:\s*(\d+)\s*Rows_examined:\s*(\d+)/);
      if (match) {
        this.currentEntry.metadata.queryTime = parseFloat(match[1]);
        this.currentEntry.metadata.lockTime = parseFloat(match[2]);
        this.currentEntry.metadata.rowsSent = parseInt(match[3], 10);
        this.currentEntry.metadata.rowsExamined = parseInt(match[4], 10);
      }
    }
    
    if (line.startsWith('# User@Host:')) {
      const match = line.match(/# User@Host:\s*([^\[]*)\[([^\]]*)\]\s*@\s*([^\s]*)/);
      if (match) {
        this.currentEntry.metadata.user = match[1].trim();
        this.currentEntry.metadata.host = match[3].trim();
      }
    }
    
    if (line.startsWith('# Schema:')) {
      const match = line.match(/# Schema:\s*([^\s]+)/);
      if (match) {
        this.currentEntry.metadata.schema = match[1];
      }
    }
  }

  finalizeCurrentEntry() {
    if (!this.currentEntry) return;

    const sql = this.currentEntry.sqlLines
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (sql && !sql.startsWith('#')) {
      const entry = {
        sql,
        metadata: this.currentEntry.metadata,
        rawLines: this.currentEntry.rawLines,
        startLine: this.currentEntry.startLine,
        endLine: this.currentEntry.endLine,
        queryTime: this.currentEntry.metadata.queryTime || 0,
        lockTime: this.currentEntry.metadata.lockTime || 0,
        rowsSent: this.currentEntry.metadata.rowsSent || 0,
        rowsExamined: this.currentEntry.metadata.rowsExamined || 0
      };

      if (this.isValidEntry(entry)) {
        this.entries.push(entry);
      } else {
        this.errors.push({
          type: 'invalid_entry',
          reason: '缺少必要的元数据字段或SQL内容',
          startLine: this.currentEntry.startLine,
          endLine: this.currentEntry.endLine,
          rawLines: this.currentEntry.rawLines
        });
      }
    }

    this.currentEntry = null;
    this.state = STATE.IDLE;
  }

  isValidEntry(entry) {
    return entry.sql && 
           entry.sql.length > 0 && 
           entry.queryTime !== undefined;
  }
}

class SimpleTextParser {
  constructor(options = {}) {
    this.options = options;
  }

  async parseFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const entries = [];
    const errors = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        const parts = line.split(/\s*[|,;\t]\s*/);
        
        let sql = null;
        let queryTime = null;
        let params = null;

        for (const part of parts) {
          if (part.match(/^\d+(\.\d+)?s?$/)) {
            queryTime = parseFloat(part.replace('s', ''));
          } else if (part.toUpperCase().includes('SELECT') || 
                     part.toUpperCase().includes('INSERT') ||
                     part.toUpperCase().includes('UPDATE') ||
                     part.toUpperCase().includes('DELETE')) {
            sql = part;
          } else if (part.includes('=') && !part.includes(' ')) {
            params = part;
          }
        }

        if (sql && queryTime !== null) {
          entries.push({
            sql,
            queryTime,
            params,
            startLine: i + 1,
            endLine: i + 1,
            rawLines: [lines[i]]
          });
        } else if (sql || line.length > 50) {
          entries.push({
            sql: sql || line,
            queryTime: queryTime || 0,
            startLine: i + 1,
            endLine: i + 1,
            rawLines: [lines[i]]
          });
        }
      } catch (e) {
        errors.push({
          type: 'parse_error',
          reason: e.message,
          startLine: i + 1,
          endLine: i + 1,
          rawLines: [lines[i]]
        });
      }
    }

    return {
      entries,
      errors,
      totalLines: lines.length
    };
  }
}

function createParser(format = 'mysql-slow', options = {}) {
  switch (format) {
    case 'mysql-slow':
      return new SlowQueryLogParser(options);
    case 'simple':
      return new SimpleTextParser(options);
    default:
      return new SlowQueryLogParser(options);
  }
}

module.exports = {
  SlowQueryLogParser,
  SimpleTextParser,
  createParser,
  parseTimeString
};
