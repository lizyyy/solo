import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import { parse, isValid } from 'date-fns';

class LogParser {
  constructor(config) {
    this.config = config;
    this.errors = [];
  }

  async parseFile(filePath) {
    const records = [];
    const fileErrors = [];
    const fileName = path.basename(filePath);

    return new Promise((resolve) => {
      fs.createReadStream(filePath, { encoding: this.config.input.encoding })
        .pipe(csv())
        .on('headers', (headers) => {
          this.fieldMapping = this.buildFieldMapping(headers);
        })
        .on('data', (row) => {
          try {
            const record = this.parseRow(row, fileName);
            if (record) {
              records.push(record);
            }
          } catch (error) {
            fileErrors.push({
              row: records.length + 1,
              error: error.message,
              data: JSON.stringify(row)
            });
          }
        })
        .on('end', () => {
          resolve({
            records,
            errors: fileErrors,
            fileName,
            successCount: records.length,
            errorCount: fileErrors.length
          });
        })
        .on('error', (error) => {
          resolve({
            records: [],
            errors: [{ row: 0, error: `文件读取失败: ${error.message}`, data: '' }],
            fileName,
            successCount: 0,
            errorCount: 1
          });
        });
    });
  }

  buildFieldMapping(headers) {
    const mapping = {};
    const fieldConfig = this.config.fields.mapping;

    for (const header of headers) {
      const trimmedHeader = header.trim();
      let matched = false;

      for (const [standardField, aliases] of Object.entries(fieldConfig)) {
        if (aliases.some(alias => alias.toLowerCase() === trimmedHeader.toLowerCase())) {
          mapping[header] = standardField;
          matched = true;
          break;
        }
      }

      if (!matched) {
        mapping[header] = trimmedHeader;
      }
    }

    return mapping;
  }

  parseRow(row, fileName) {
    const record = {};

    for (const [originalField, standardField] of Object.entries(this.fieldMapping)) {
      record[standardField] = row[originalField]?.trim() || '';
    }

    record.sourceFile = fileName;
    record.rawData = JSON.stringify(row);

    this.validateRequiredFields(record);
    record.accessTime = this.parseDateTime(record.accessTime);

    return record;
  }

  validateRequiredFields(record) {
    const required = this.config.fields.required;
    const missing = [];

    for (const field of required) {
      if (!record[field]) {
        missing.push(field);
      }
    }

    if (missing.length > 0) {
      throw new Error(`缺少必填字段: ${missing.join(', ')}`);
    }
  }

  parseDateTime(dateTimeStr) {
    for (const format of this.config.dateFormats) {
      const parsed = parse(dateTimeStr, format, new Date());
      if (isValid(parsed)) {
        return parsed;
      }
    }
    throw new Error(`无法解析日期时间: ${dateTimeStr}`);
  }

  async parseDirectory(directory) {
    const results = [];
    const allErrors = [];
    const files = this.findLogFiles(directory);

    for (const file of files) {
      try {
        const result = await this.parseFile(file);
        results.push(result);
        if (result.errors.length > 0) {
          allErrors.push({
            fileName: result.fileName,
            errors: result.errors
          });
        }
      } catch (error) {
        allErrors.push({
          fileName: path.basename(file),
          errors: [{ row: 0, error: `处理失败: ${error.message}`, data: '' }]
        });
      }
    }

    return {
      results,
      errors: allErrors,
      totalRecords: results.reduce((sum, r) => sum + r.successCount, 0),
      totalErrors: allErrors.reduce((sum, e) => sum + e.errors.length, 0)
    };
  }

  findLogFiles(directory) {
    const files = [];
    const pattern = this.config.input.filePattern;
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$', 'i');

    if (fs.existsSync(directory)) {
      const items = fs.readdirSync(directory);
      for (const item of items) {
        const fullPath = path.join(directory, item);
        const stat = fs.statSync(fullPath);
        if (stat.isFile() && regex.test(item)) {
          files.push(fullPath);
        }
      }
    }

    return files;
  }
}

export default LogParser;
