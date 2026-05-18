const fs = require('fs');
const path = require('path');
const iconv = require('iconv-lite');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const REQUIRED_COLUMNS = [
  '检测编号',
  '序列号',
  '品牌型号',
  '检测日期',
  '外观成色',
  '屏幕状态',
  '电池健康',
  '功能检测',
  '回收估价'
];

class PhoneReportProcessor {
  constructor(options = {}) {
    this.options = {
      outputDir: './output',
      ...options
    };
    this.errors = [];
    this.warnings = [];
    this.processedRecords = [];
    this.duplicateSerials = new Set();
    this.seenSerials = new Set();
  }

  addError(file, lineNumber, message) {
    this.errors.push({
      file: path.basename(file),
      lineNumber,
      message,
      type: 'error'
    });
  }

  addWarning(file, lineNumber, message) {
    this.warnings.push({
      file: path.basename(file),
      lineNumber,
      message,
      type: 'warning'
    });
  }

  async detectEncoding(filePath) {
    const buffer = fs.readFileSync(filePath);
    const encodings = ['utf-8', 'gbk', 'gb2312', 'big5'];
    
    for (const encoding of encodings) {
      try {
        const decoded = iconv.decode(buffer, encoding);
        if (decoded.includes('检测编号') || decoded.includes('序列号')) {
          return encoding;
        }
      } catch (e) {
        continue;
      }
    }
    return 'utf-8';
  }

  validateColumns(headers, file) {
    const missing = REQUIRED_COLUMNS.filter(col => !headers.includes(col));
    if (missing.length > 0) {
      this.addError(file, 1, `缺少必需列: ${missing.join(', ')}`);
      return false;
    }
    return true;
  }

  validateRecord(record, lineNumber, file) {
    const issues = [];

    if (!record['序列号'] || record['序列号'].trim() === '') {
      issues.push('序列号为空');
    } else {
      const serial = record['序列号'].trim();
      if (this.seenSerials.has(serial)) {
        this.duplicateSerials.add(serial);
        this.addWarning(file, lineNumber, `序列号重复: ${serial}`);
      } else {
        this.seenSerials.add(serial);
      }
    }

    if (record['屏幕状态'] && record['屏幕状态'].includes('暗病')) {
      this.addWarning(file, lineNumber, `屏幕存在暗病: ${record['屏幕状态']}`);
    }

    if (!record['回收估价'] || isNaN(parseFloat(record['回收估价']))) {
      issues.push('回收估价无效');
    }

    return issues;
  }

  async processFile(filePath) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`输入文件不存在: ${filePath}`);
    }

    const encoding = await this.detectEncoding(filePath);
    const results = [];
    let lineNumber = 1;

    return new Promise((resolve, reject) => {
      const stream = fs.createReadStream(filePath)
        .pipe(iconv.decodeStream(encoding))
        .pipe(csv());

      stream.on('headers', (headers) => {
        this.validateColumns(headers, filePath);
        lineNumber++;
      });

      stream.on('data', (data) => {
        const issues = this.validateRecord(data, lineNumber, filePath);
        
        if (issues.length === 0) {
          results.push(data);
        } else {
          this.addError(filePath, lineNumber, issues.join('; '));
        }
        
        lineNumber++;
      });

      stream.on('end', () => {
        this.processedRecords = this.processedRecords.concat(results);
        resolve(results);
      });

      stream.on('error', (error) => {
        this.addError(filePath, lineNumber, `解析错误: ${error.message}`);
        reject(error);
      });
    });
  }

  async processFiles(filePaths) {
    for (const filePath of filePaths) {
      try {
        await this.processFile(filePath);
      } catch (error) {
        if (error.message.includes('输入文件不存在') || error.message.includes('权限')) {
          throw error;
        }
      }
    }
    return this.processedRecords;
  }

  async writeOutput(filename = 'cleaned_report.csv') {
    if (!fs.existsSync(this.options.outputDir)) {
      fs.mkdirSync(this.options.outputDir, { recursive: true });
    }

    const outputPath = path.join(this.options.outputDir, filename);
    
    if (this.processedRecords.length === 0) {
      return null;
    }

    const headers = Object.keys(this.processedRecords[0]).map(key => ({
      id: key,
      title: key
    }));

    const csvWriter = createCsvWriter({
      path: outputPath,
      header: headers,
      encoding: 'utf-8'
    });

    await csvWriter.writeRecords(this.processedRecords);
    return outputPath;
  }

  async writeSummary(filename = 'error_summary.json') {
    if (!fs.existsSync(this.options.outputDir)) {
      fs.mkdirSync(this.options.outputDir, { recursive: true });
    }

    const summaryPath = path.join(this.options.outputDir, filename);
    const summary = {
      processedAt: new Date().toISOString(),
      totalRecords: this.processedRecords.length,
      errorCount: this.errors.length,
      warningCount: this.warnings.length,
      duplicateSerialCount: this.duplicateSerials.size,
      errors: this.errors,
      warnings: this.warnings
    };

    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf-8');
    return summaryPath;
  }

  getSummary() {
    return {
      totalRecords: this.processedRecords.length,
      errors: this.errors.length,
      warnings: this.warnings.length,
      duplicateSerials: this.duplicateSerials.size
    };
  }
}

module.exports = PhoneReportProcessor;
