import { parse } from 'csv-parse/sync';
import fs from 'fs/promises';
import path from 'path';

const REQUIRED_FIELDS = [
  'template_id',
  'template_name',
  'chat_id',
  'chat_name',
  'variables',
  'touch_status',
  'touch_time'
];

export const BUSINESS_FIELDS = {
  TEMPLATE_ID: 'template_id',
  TEMPLATE_NAME: 'template_name',
  CHAT_ID: 'chat_id',
  CHAT_NAME: 'chat_name',
  VARIABLES: 'variables',
  TOUCH_STATUS: 'touch_status',
  TOUCH_TIME: 'touch_time'
};

export class Parser {
  constructor(options = {}) {
    this.requiredFields = options.requiredFields || REQUIRED_FIELDS;
    this.errors = [];
    this.warnings = [];
  }

  async parseDirectory(dirPath) {
    const results = [];
    const errors = [];
    const warnings = [];

    try {
      const files = await fs.readdir(dirPath);
      const csvFiles = files.filter(f => f.endsWith('.csv'));

      if (csvFiles.length === 0) {
        warnings.push({
          type: 'EMPTY_DIRECTORY',
          path: dirPath,
          message: '目录中没有找到CSV文件',
          timestamp: new Date().toISOString()
        });
        return { records: [], errors, warnings };
      }

      for (const file of csvFiles) {
        const filePath = path.join(dirPath, file);
        try {
          const fileResult = await this.parseFile(filePath);
          results.push(...fileResult.records);
          errors.push(...fileResult.errors.map(e => ({ ...e, file })));
          warnings.push(...fileResult.warnings.map(w => ({ ...w, file })));
        } catch (error) {
          errors.push({
            type: 'FILE_PARSE_FAILED',
            file,
            path: filePath,
            message: error.message,
            timestamp: new Date().toISOString()
          });
        }
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        errors.push({
          type: 'DIRECTORY_NOT_FOUND',
          path: dirPath,
          message: '目录不存在',
          timestamp: new Date().toISOString()
        });
      } else {
        errors.push({
          type: 'DIRECTORY_READ_FAILED',
          path: dirPath,
          message: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }

    return { records: results, errors, warnings };
  }

  async parseFile(filePath) {
    const records = [];
    const errors = [];
    const warnings = [];

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const rows = parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        quote: '"',
        escape: '"'
      });

      if (rows.length > 0) {
        const headers = Object.keys(rows[0] || {});
        const missingFields = this.requiredFields.filter(f => !headers.includes(f));

        if (missingFields.length > 0) {
          errors.push({
            type: 'MISSING_REQUIRED_FIELDS',
            path: filePath,
            missingFields,
            message: `缺少必需字段: ${missingFields.join(', ')}`,
            timestamp: new Date().toISOString()
          });
        }
      }

      const seenKeys = new Set();

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const lineNumber = i + 2;
        const record = this.normalizeRecord(row);
        const recordKey = `${record.templateId}_${record.chatId}`;

        if (seenKeys.has(recordKey)) {
          warnings.push({
            type: 'DUPLICATE_RECORD',
            path: filePath,
            line: lineNumber,
            templateId: record.templateId,
            chatId: record.chatId,
            message: `重复记录: template_id=${record.templateId}, chat_id=${record.chatId}`,
            timestamp: new Date().toISOString()
          });
          continue;
        }
        seenKeys.add(recordKey);

        records.push(record);
      }

    } catch (error) {
      errors.push({
        type: 'CORRUPTED_FILE',
        path: filePath,
        message: 'CSV文件格式损坏，无法解析',
        timestamp: new Date().toISOString()
      });
    }

    return { records, errors, warnings };
  }

  normalizeRecord(row) {
    return {
      templateId: String(row.template_id || ''),
      templateName: String(row.template_name || ''),
      chatId: String(row.chat_id || ''),
      chatName: String(row.chat_name || ''),
      variables: this.parseVariables(row.variables),
      touchStatus: String(row.touch_status || 'unknown'),
      touchTime: String(row.touch_time || ''),
      raw: row
    };
  }

  parseVariables(variablesStr) {
    if (!variablesStr) return {};
    try {
      if (typeof variablesStr === 'object') return variablesStr;
      return JSON.parse(variablesStr);
    } catch {
      return { _raw: variablesStr };
    }
  }
}

export default Parser;
