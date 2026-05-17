const fs = require('fs');
const readline = require('readline');
const { ERROR_CODES } = require('./config');
const { StitcherError, logger, parseTime, validateEvent } = require('./utils');

class JsonlReader {
  constructor(config) {
    this.config = config;
    this.stats = {
      totalFiles: 0,
      totalLines: 0,
      validEvents: 0,
      invalidEvents: 0,
      fileStats: new Map()
    };
    this.invalidEvents = [];
  }

  async readAllFiles() {
    const events = [];
    this.stats.totalFiles = this.config.files.length;

    for (const filePath of this.config.files) {
      logger.debug(`读取文件: ${filePath}`);
      const fileEvents = await this.readFile(filePath);
      events.push(...fileEvents);
    }

    return events;
  }

  async readFile(filePath) {
    return new Promise((resolve, reject) => {
      const events = [];
      let lineNumber = 0;
      let validCount = 0;
      let invalidCount = 0;

      const fileStats = fs.statSync(filePath);
      
      const rl = readline.createInterface({
        input: fs.createReadStream(filePath, { encoding: this.config.encoding }),
        crlfDelay: Infinity
      });

      rl.on('line', (line) => {
        lineNumber++;
        this.stats.totalLines++;
        
        const sourceInfo = {
          file: filePath,
          line: lineNumber,
          rawContent: line
        };

        if (!line.trim()) {
          invalidCount++;
          this.stats.invalidEvents++;
          this.invalidEvents.push({
            error: '空行',
            ...sourceInfo
          });
          return;
        }

        try {
          const event = JSON.parse(line);
          const validation = validateEvent(event, this.config, sourceInfo);

          if (!validation.valid) {
            invalidCount++;
            this.stats.invalidEvents++;
            this.invalidEvents.push({
              error: validation.errors.join('; '),
              ...sourceInfo
            });
            return;
          }

          event._source = sourceInfo;
          event._parsedTime = parseTime(event[this.config.timeKey], this.config.timeFormat);
          
          events.push(event);
          validCount++;
          this.stats.validEvents++;

        } catch (err) {
          invalidCount++;
          this.stats.invalidEvents++;
          this.invalidEvents.push({
            error: err.message,
            ...sourceInfo
          });
        }
      });

      rl.on('close', () => {
        this.stats.fileStats.set(filePath, {
          lines: lineNumber,
          valid: validCount,
          invalid: invalidCount,
          size: fileStats.size
        });
        resolve(events);
      });

      rl.on('error', (err) => {
        reject(new StitcherError(
          `读取文件失败: ${filePath}`,
          ERROR_CODES.IO_ERROR,
          { error: err.message }
        ));
      });
    });
  }

  getStats() {
    return {
      ...this.stats,
      fileStats: Object.fromEntries(this.stats.fileStats)
    };
  }

  getInvalidEvents() {
    return this.invalidEvents;
  }
}

module.exports = { JsonlReader };