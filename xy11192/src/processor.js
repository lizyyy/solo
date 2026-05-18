const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const iconv = require('iconv-lite');
const { checkMissingColumns, findDuplicateRows, validateRow, validateBulbLife } = require('./validator');

class InspectionProcessor {
  constructor(config, outputDir) {
    this.config = config;
    this.outputDir = outputDir || process.cwd();
    this.results = {
      normal: [],
      setMissingItems: [],
      bulbLifeReport: [],
      rerunNeeded: [],
      errors: [],
      statistics: {
        total: 0,
        processed: 0,
        failed: 0,
        missingColumns: [],
        duplicates: []
      }
    };
  }

  async processFile(filePath) {
    const rows = [];
    let headers = [];
    
    try {
      const data = await this.readFileWithEncoding(filePath);
      const lines = data.split('\n');
      
      if (lines.length === 0 || (lines.length === 1 && lines[0].trim() === '')) {
        this.results.errors.push({
          file: path.basename(filePath),
          type: 'empty_file',
          message: '文件为空，没有数据'
        });
        this.results.statistics.failed++;
        return this.results;
      }
      
      headers = lines[0].split(',').map(h => h.trim());
      
      const columnCheck = checkMissingColumns(headers, this.config.requiredColumns);
      if (columnCheck.hasMissing) {
        this.results.statistics.missingColumns.push({
          file: path.basename(filePath),
          missing: columnCheck.missingColumns
        });
        columnCheck.missingColumns.forEach(col => {
          this.results.errors.push({
            file: path.basename(filePath),
            type: 'missing_column',
            column: col,
            message: `缺少必填列: ${col}`
          });
        });
      }
      
      for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim() === '') continue;
        
        const values = lines[i].split(',').map(v => v.trim());
        const row = {};
        headers.forEach((header, idx) => {
          row[header] = values[idx] || '';
        });
        row._rowIndex = i + 1;
        row._file = path.basename(filePath);
        rows.push(row);
      }
      
    } catch (e) {
      this.results.errors.push({
        file: path.basename(filePath),
        type: 'read_error',
        message: `文件读取失败: ${e.message}`
      });
      this.results.statistics.failed++;
      return this.results;
    }
    
    this.results.statistics.total += rows.length;
    
    const duplicateCheck = findDuplicateRows(rows, this.config.validation.duplicateCheckColumns);
    if (duplicateCheck.hasDuplicates) {
      this.results.statistics.duplicates.push({
        file: path.basename(filePath),
        duplicates: duplicateCheck.duplicates
      });
      duplicateCheck.duplicates.forEach(d => {
        this.results.errors.push({
          file: path.basename(filePath),
          type: 'duplicate_row',
          rowIndex: d.rowIndex,
          duplicateWith: d.duplicateWith,
          message: `第 ${d.rowIndex} 行与第 ${d.duplicateWith} 行重复`
        });
      });
    }
    
    for (const row of rows) {
      await this.processRow(row);
    }
    
    return this.results;
  }

  async processRow(row) {
    const rowIndex = row._rowIndex;
    
    try {
      const validation = validateRow(row, rowIndex, this.config);
      
      if (!validation.isValid) {
        validation.errors.forEach(err => {
          this.results.errors.push({
            file: row._file,
            ...err,
            rowIndex
          });
        });
        this.results.rerunNeeded.push({
          ...row,
          错误原因: validation.errors.map(e => e.message).join('; ')
        });
        return;
      }
      
      if (row['套装编号']) {
        const setItems = row['套装编号'].split(';').filter(i => i);
        if (setItems.length < 2) {
          this.results.setMissingItems.push({
            设备编号: row['设备编号'],
            设备名称: row['设备名称'],
            套装编号: row['套装编号'],
            问题: '套装设备数量不足',
            详情: `当前套装仅包含 ${setItems.length} 件设备，需要补充完整`
          });
          this.results.rerunNeeded.push({
            ...row,
            错误原因: '套装设备数量不足，需要补充完整'
          });
          return;
        }
      }
      
      const bulbCheck = validateBulbLife(row, this.config);
      if (bulbCheck.hasIssues) {
        this.results.bulbLifeReport.push({
          设备编号: row['设备编号'],
          设备名称: row['设备名称'],
          灯泡使用时长: row['灯泡使用时长'] || '未知',
          问题级别: bulbCheck.issues[0].severity,
          问题描述: bulbCheck.issues[0].message
        });
      }
      
      this.results.normal.push(row);
      this.results.statistics.processed++;
      
    } catch (e) {
      this.results.errors.push({
        file: row._file,
        type: 'process_error',
        rowIndex,
        message: `处理失败: ${e.message}`
      });
      this.results.statistics.failed++;
      this.results.rerunNeeded.push({
        ...row,
        错误原因: e.message
      });
    }
  }

  async readFileWithEncoding(filePath) {
    const buffer = fs.readFileSync(filePath);
    
    if (buffer.length === 0) {
      return '';
    }
    
    const encodings = [this.config.encoding.default, ...this.config.encoding.fallback];
    
    for (const encoding of encodings) {
      try {
        const decoded = iconv.decode(buffer, encoding);
        if (decoded && decoded.length > 0) {
          return decoded;
        }
      } catch (e) {
        continue;
      }
    }
    
    throw new Error('无法识别文件编码');
  }

  async writeResults() {
    await this.writeCsv(
      this.config.output.normalResult,
      this.config.requiredColumns,
      this.results.normal
    );
    
    await this.writeCsv(
      this.config.output.setMissingItems,
      ['设备编号', '设备名称', '套装编号', '问题', '详情'],
      this.results.setMissingItems
    );
    
    await this.writeCsv(
      this.config.output.bulbLifeReport,
      ['设备编号', '设备名称', '灯泡使用时长', '问题级别', '问题描述'],
      this.results.bulbLifeReport
    );
    
    await this.writeCsv(
      this.config.output.rerunOutput,
      [...this.config.requiredColumns, '错误原因'],
      this.results.rerunNeeded
    );
    
    await this.writeCsv(
      this.config.output.errors,
      ['file', 'type', 'rowIndex', 'column', 'message'],
      this.results.errors
    );
  }

  async writeCsv(filename, columns, data) {
    if (data.length === 0) return;
    
    const filePath = path.join(this.outputDir, filename);
    const csvWriter = createCsvWriter({
      path: filePath,
      header: columns.map(col => ({ id: col, title: col }))
    });
    
    await csvWriter.writeRecords(data);
  }

  getStatistics() {
    return {
      ...this.results.statistics,
      normalCount: this.results.normal.length,
      setMissingCount: this.results.setMissingItems.length,
      bulbLifeCount: this.results.bulbLifeReport.length,
      rerunCount: this.results.rerunNeeded.length,
      errorCount: this.results.errors.length
    };
  }
}

module.exports = { InspectionProcessor };
