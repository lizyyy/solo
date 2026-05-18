const path = require('path');
const fs = require('fs-extra');
const xlsx = require('xlsx');
const csv = require('csv-parser');
const crypto = require('crypto');

const FIELD_MAPPINGS = {
  设备编号: ['设备编号', 'equipment_id', '设备ID', '设备编码'],
  设备名称: ['设备名称', 'equipment_name', '设备名'],
  计划巡检时间: ['计划巡检时间', '计划时间', 'plan_time', '计划巡检日期'],
  实际巡检时间: ['实际巡检时间', '补录时间', 'actual_time', '实际巡检日期', '补录日期'],
  巡检人员: ['巡检人员', 'inspector', '巡检员', '操作人员'],
  巡检状态: ['巡检状态', 'status', '状态'],
  设备状态: ['设备状态', 'equipment_status', '设备运行状态']
};

class InspectionValidator {
  constructor(options) {
    this.inputDir = options.inputDir;
    this.outputDir = options.outputDir;
    this.force = options.force;
    this.results = {
      totalFiles: 0,
      totalRecords: 0,
      normalCount: 0,
      errorCount: 0,
      errorDetails: [],
      reportPath: null
    };
    this.processedFiles = new Set();
    this.fileHashes = {};
    this.cachedResults = {};
  }

  async run() {
    await fs.ensureDir(this.outputDir);
    
    const stateFile = path.join(this.outputDir, '.processing-state.json');
    await this.loadState(stateFile);

    const files = await this.getInputFiles();
    this.results.totalFiles = files.length;

    for (const file of files) {
      await this.processFile(file);
    }

    await this.generateReport();
    await this.saveState(stateFile);

    return this.results;
  }

  async loadState(stateFile) {
    if (await fs.pathExists(stateFile) && !this.force) {
      try {
        const state = await fs.readJson(stateFile);
        this.processedFiles = new Set(state.processedFiles || []);
        this.fileHashes = state.fileHashes || {};
        this.cachedResults = state.cachedResults || {};
      } catch (e) {
        console.log('状态文件损坏，将重新处理所有文件');
      }
    }
  }

  async saveState(stateFile) {
    const state = {
      processedFiles: Array.from(this.processedFiles),
      fileHashes: this.fileHashes,
      cachedResults: this.cachedResults,
      timestamp: new Date().toISOString()
    };
    await fs.writeJson(stateFile, state, { spaces: 2 });
  }

  async getInputFiles() {
    const files = await fs.readdir(this.inputDir);
    return files
      .filter(f => f.endsWith('.xlsx') || f.endsWith('.xls') || f.endsWith('.csv'))
      .filter(f => !f.startsWith('~$'))
      .map(f => path.join(this.inputDir, f));
  }

  async getFileHash(filePath) {
    const content = await fs.readFile(filePath);
    return crypto.createHash('md5').update(content).digest('hex');
  }

  async shouldProcessFile(filePath) {
    if (this.force) return { process: true, fileName: path.basename(filePath) };
    
    const fileName = path.basename(filePath);
    const fileHash = await this.getFileHash(filePath);
    
    if (this.processedFiles.has(fileName) && this.fileHashes[fileName] === fileHash) {
      console.log(`  ⏭  跳过已处理文件: ${fileName}`);
      return { process: false, fileName, cached: this.cachedResults[fileName] };
    }
    
    this.fileHashes[fileName] = fileHash;
    return { process: true, fileName };
  }

  async processFile(filePath) {
    const result = await this.shouldProcessFile(filePath);
    
    if (!result.process) {
      if (result.cached) {
        this.results.totalRecords += result.cached.totalRecords;
        this.results.normalCount += result.cached.normalCount;
        this.results.errorCount += result.cached.errorCount;
        this.results.errorDetails.push(...result.cached.errorDetails);
      }
      return;
    }

    const fileName = result.fileName;
    console.log(`  📄 处理文件: ${fileName}`);
    
    let records;
    if (filePath.endsWith('.csv')) {
      records = await this.parseCSV(filePath);
    } else {
      records = await this.parseExcel(filePath);
    }

    const beforeRecords = this.results.totalRecords;
    const beforeNormal = this.results.normalCount;
    const beforeErrors = this.results.errorCount;
    const beforeErrorDetailsLen = this.results.errorDetails.length;

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const lineNumber = i + 2;
      await this.validateRecord(record, fileName, lineNumber);
    }

    this.cachedResults[fileName] = {
      totalRecords: this.results.totalRecords - beforeRecords,
      normalCount: this.results.normalCount - beforeNormal,
      errorCount: this.results.errorCount - beforeErrors,
      errorDetails: this.results.errorDetails.slice(beforeErrorDetailsLen)
    };

    this.processedFiles.add(fileName);
  }

  async parseExcel(filePath) {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
    
    if (data.length < 2) return [];
    
    const headers = this.normalizeHeaders(data[0]);
    const records = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row && row.length > 0) {
        const record = {};
        headers.forEach((header, idx) => {
          record[header] = row[idx];
        });
        records.push(record);
      }
    }
    
    return records;
  }

  async parseCSV(filePath) {
    return new Promise((resolve, reject) => {
      const records = [];
      let headers = null;
      
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('headers', (headerList) => {
          headers = this.normalizeHeaders(headerList);
        })
        .on('data', (row) => {
          const record = {};
          Object.keys(row).forEach((key, idx) => {
            if (headers && headers[idx]) {
              record[headers[idx]] = row[key];
            }
          });
          records.push(record);
        })
        .on('end', () => resolve(records))
        .on('error', reject);
    });
  }

  normalizeHeaders(headers) {
    return headers.map(header => {
      if (!header) return '';
      const h = String(header).trim();
      for (const [standard, variants] of Object.entries(FIELD_MAPPINGS)) {
        if (variants.some(v => v.toLowerCase() === h.toLowerCase())) {
          return standard;
        }
      }
      return h;
    });
  }

  async validateRecord(record, fileName, lineNumber) {
    this.results.totalRecords++;
    
    const errors = [];

    if (this.isEarlySupplement(record)) {
      errors.push({
        type: '补录早于计划',
        message: `实际巡检时间(${record['实际巡检时间']})早于计划巡检时间(${record['计划巡检时间']})`,
        file: fileName,
        line: lineNumber,
        record: this.sanitizeRecord(record)
      });
    }

    if (this.isEquipmentDeactivated(record)) {
      errors.push({
        type: '设备停用',
        message: `设备状态为"${record['设备状态'] || '停用'}"，但存在巡检补录记录`,
        file: fileName,
        line: lineNumber,
        record: this.sanitizeRecord(record)
      });
    }

    if (errors.length > 0) {
      this.results.errorCount += errors.length;
      this.results.errorDetails.push(...errors);
    } else {
      this.results.normalCount++;
    }
  }

  sanitizeRecord(record) {
    const clean = {};
    for (const key of Object.keys(FIELD_MAPPINGS)) {
      if (record[key] !== undefined) {
        clean[key] = record[key];
      }
    }
    return clean;
  }

  parseDate(dateStr) {
    if (!dateStr) return null;
    
    if (typeof dateStr === 'number') {
      return new Date((dateStr - 25569) * 86400 * 1000);
    }
    
    const str = String(dateStr).trim();
    
    const excelNum = parseFloat(str);
    if (!isNaN(excelNum) && excelNum > 10000 && excelNum < 100000) {
      return new Date((excelNum - 25569) * 86400 * 1000);
    }
    
    const date = new Date(str);
    if (!isNaN(date.getTime())) {
      return date;
    }
    
    return null;
  }

  isEarlySupplement(record) {
    const planTime = this.parseDate(record['计划巡检时间']);
    const actualTime = this.parseDate(record['实际巡检时间']);
    
    if (!planTime || !actualTime) return false;
    
    return actualTime < planTime;
  }

  isEquipmentDeactivated(record) {
    const status = String(record['设备状态'] || '').trim();
    const deactivatedKeywords = ['停用', '报废', '拆除', '已停用', '已报废', '已拆除'];
    
    return deactivatedKeywords.some(keyword => 
      status.includes(keyword) || status === keyword
    );
  }

  async generateReport() {
    const timestamp = new Date().toISOString().slice(0, 10);
    const reportFileName = `维保巡检补录校验报告_${timestamp}.xlsx`;
    const reportPath = path.join(this.outputDir, reportFileName);
    
    const wb = xlsx.utils.book_new();
    
    const summaryData = [
      ['维保巡检导出漏检补录校验报告', ''],
      ['生成时间', new Date().toLocaleString('zh-CN')],
      ['', ''],
      ['统计汇总', ''],
      ['处理文件数', this.results.totalFiles],
      ['总记录数', this.results.totalRecords],
      ['正常记录数', this.results.normalCount],
      ['异常记录数', this.results.errorCount],
      ['', ''],
      ['异常类型统计', '数量'],
      ['补录早于计划', this.results.errorDetails.filter(e => e.type === '补录早于计划').length],
      ['设备停用', this.results.errorDetails.filter(e => e.type === '设备停用').length]
    ];
    const summarySheet = xlsx.utils.aoa_to_sheet(summaryData);
    xlsx.utils.book_append_sheet(wb, summarySheet, '汇总');
    
    const errorHeaders = ['序号', '异常类型', '文件名', '行号', '异常描述', '设备编号', '设备名称', '计划巡检时间', '实际巡检时间', '巡检人员', '设备状态'];
    const errorData = [errorHeaders];
    
    this.results.errorDetails.forEach((error, idx) => {
      const row = [
        idx + 1,
        error.type,
        error.file,
        error.line,
        error.message,
        error.record['设备编号'] || '',
        error.record['设备名称'] || '',
        error.record['计划巡检时间'] || '',
        error.record['实际巡检时间'] || '',
        error.record['巡检人员'] || '',
        error.record['设备状态'] || ''
      ];
      errorData.push(row);
    });
    
    const errorSheet = xlsx.utils.aoa_to_sheet(errorData);
    xlsx.utils.book_append_sheet(wb, errorSheet, '异常明细');

    xlsx.writeFile(wb, reportPath);
    this.results.reportPath = reportPath;
    this.results.hasErrors = this.results.errorCount > 0;
    
    return reportPath;
  }
}

module.exports = InspectionValidator;
