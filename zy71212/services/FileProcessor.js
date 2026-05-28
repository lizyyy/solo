const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const { createModelFromData, identifyInputType, INPUT_TYPE_NAMES } = require('../models');

class FileProcessor {
  constructor(options = {}) {
    this.stopOnError = options.stopOnError || false;
    this.supportedExtensions = ['.json', '.csv', '.xlsx', '.xls', '.txt'];
    this.results = {
      success: [],
      failed: [],
      skipped: [],
      totalFiles: 0,
      totalRecords: 0,
      startTime: null,
      endTime: null
    };
  }

  async processDirectory(dirPath) {
    this.resetResults();
    this.results.startTime = new Date();

    const files = await this.listFiles(dirPath);
    this.results.totalFiles = files.length;

    for (const file of files) {
      try {
        const fileResult = await this.processFile(file);
        if (fileResult.success) {
          this.results.success.push(fileResult);
          this.results.totalRecords += fileResult.records.length;
        } else {
          this.results.failed.push(fileResult);
        }
      } catch (error) {
        const failedResult = {
          file,
          success: false,
          error: error.message,
          records: []
        };
        this.results.failed.push(failedResult);
        
        if (this.stopOnError) {
          this.results.endTime = new Date();
          throw new Error(`处理文件 ${file} 失败: ${error.message}`);
        }
      }
    }

    this.results.endTime = new Date();
    return this.getResults();
  }

  async processFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    
    if (!this.supportedExtensions.includes(ext)) {
      return {
        file: filePath,
        success: false,
        error: `不支持的文件格式: ${ext}`,
        records: []
      };
    }

    try {
      const data = await this.parseFile(filePath, ext);
      const records = this.normalizeAndValidate(data, filePath);
      
      return {
        file: filePath,
        success: true,
        records,
        count: records.length
      };
    } catch (error) {
      return {
        file: filePath,
        success: false,
        error: error.message,
        records: []
      };
    }
  }

  async listFiles(dirPath) {
    return new Promise((resolve, reject) => {
      fs.readdir(dirPath, (err, files) => {
        if (err) {
          reject(err);
          return;
        }

        const filePaths = files
          .filter(file => {
            const ext = path.extname(file).toLowerCase();
            return this.supportedExtensions.includes(ext);
          })
          .map(file => path.join(dirPath, file));

        resolve(filePaths);
      });
    });
  }

  async parseFile(filePath, ext) {
    return new Promise((resolve, reject) => {
      fs.readFile(filePath, (err, content) => {
        if (err) {
          reject(new Error(`读取文件失败: ${err.message}`));
          return;
        }

        try {
          let data;
          
          switch (ext) {
            case '.json':
              data = this.parseJSON(content.toString());
              break;
            case '.csv':
              data = this.parseCSV(content.toString());
              break;
            case '.xlsx':
            case '.xls':
              data = this.parseExcel(filePath);
              break;
            case '.txt':
              data = this.parseText(content.toString());
              break;
            default:
              reject(new Error(`不支持的文件格式: ${ext}`));
              return;
          }

          resolve(data);
        } catch (parseError) {
          reject(new Error(`解析文件失败: ${parseError.message}`));
        }
      });
    });
  }

  parseJSON(content) {
    try {
      const data = JSON.parse(content);
      return Array.isArray(data) ? data : [data];
    } catch (error) {
      throw new Error(`JSON解析错误: ${error.message}`);
    }
  }

  parseCSV(content) {
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];

    const headers = this.parseCSVLine(lines[0]);
    const data = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      if (values.length === headers.length) {
        const row = {};
        headers.forEach((header, index) => {
          row[header.trim()] = this.parseValue(values[index]);
        });
        data.push(row);
      }
    }

    return data;
  }

  parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    
    return result;
  }

  parseExcel(filePath) {
    try {
      const workbook = xlsx.readFile(filePath);
      const data = [];

      workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        const sheetData = xlsx.utils.sheet_to_json(sheet, { defval: '' });
        data.push(...sheetData);
      });

      return data;
    } catch (error) {
      throw new Error(`Excel解析错误: ${error.message}`);
    }
  }

  parseText(content) {
    const lines = content.split('\n').filter(line => line.trim());
    const data = [];

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        data.push(parsed);
      } catch {
        const parts = line.split(/[,\t|;]/).map(p => p.trim());
        if (parts.length >= 2) {
          const row = {};
          parts.forEach((part, index) => {
            const [key, value] = part.split(':').map(s => s.trim());
            if (key && value !== undefined) {
              row[key] = this.parseValue(value);
            } else {
              row[`field${index}`] = this.parseValue(part);
            }
          });
          data.push(row);
        }
      }
    }

    return data;
  }

  parseValue(value) {
    if (value === null || value === undefined || value === '') return '';
    
    const num = Number(value);
    if (!isNaN(num) && value.trim() !== '') return num;
    
    if (value.toLowerCase() === 'true' || value.toLowerCase() === 'false') {
      return value.toLowerCase() === 'true';
    }
    
    return value;
  }

  normalizeAndValidate(data, filePath) {
    const records = [];

    for (const row of data) {
      try {
        const inputType = identifyInputType(row);
        const model = createModelFromData(row, inputType);
        
        if (!model) {
          records.push({
            raw: row,
            type: null,
            typeName: '未知类型',
            valid: false,
            missingFields: [],
            error: '无法识别的数据类型',
            model: null
          });
          continue;
        }

        const isValid = model.validate();
        
        records.push({
          raw: row,
          type: inputType,
          typeName: INPUT_TYPE_NAMES[inputType] || '未知类型',
          valid: isValid,
          missingFields: model.missingFields,
          error: isValid ? null : `缺少必填字段: ${model.missingFields.join(', ')}`,
          model: model.toJSON()
        });
      } catch (error) {
        records.push({
          raw: row,
          type: null,
          typeName: '未知类型',
          valid: false,
          missingFields: [],
          error: `处理记录失败: ${error.message}`,
          model: null
        });
      }
    }

    return records;
  }

  resetResults() {
    this.results = {
      success: [],
      failed: [],
      skipped: [],
      totalFiles: 0,
      totalRecords: 0,
      startTime: null,
      endTime: null
    };
  }

  getResults() {
    return {
      ...this.results,
      duration: this.results.startTime && this.results.endTime
        ? (this.results.endTime - this.results.startTime) / 1000
        : 0,
      successCount: this.results.success.length,
      failedCount: this.results.failed.length,
      skippedCount: this.results.skipped.length
    };
  }
}

module.exports = FileProcessor;
