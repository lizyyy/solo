const fs = require('fs-extra');
const csv = require('csv-parser');
const { Parser } = require('json2csv');
const path = require('path');

class CanteenReviewSorter {
  constructor(options = {}) {
    this.inputDir = options.inputDir || './input';
    this.outputDir = options.outputDir || './output';
    this.rulesFile = options.rulesFile || './rules.json';
    this.preview = options.preview || false;
    this.results = {
      valid: [],
      duplicateOrders: [],
      emptyRatingRows: [],
      matchedRules: {},
      statistics: {
        totalRows: 0,
        validRows: 0,
        duplicateCount: 0,
        emptyRatingCount: 0,
        processedAt: new Date().toISOString()
      }
    };
    this.orderIds = new Set();
    this.rules = null;
  }

  async loadRules() {
    if (!await fs.pathExists(this.rulesFile)) {
      throw new Error(`规则文件不存在: ${this.rulesFile}`);
    }
    this.rules = await fs.readJson(this.rulesFile);
    this.rules.categories.forEach(cat => {
      this.results.matchedRules[cat.id] = [];
    });
  }

  async readInputFiles() {
    const files = await fs.readdir(this.inputDir);
    const csvFiles = files.filter(f => f.endsWith('.csv'));
    
    if (csvFiles.length === 0) {
      throw new Error(`输入目录 ${this.inputDir} 中没有找到 CSV 文件`);
    }

    const allRecords = [];
    for (const file of csvFiles) {
      const filePath = path.join(this.inputDir, file);
      const records = await this.parseCsv(filePath);
      records.forEach(r => {
        r.sourceFile = file;
        allRecords.push(r);
      });
    }
    return allRecords;
  }

  async parseCsv(filePath) {
    return new Promise((resolve, reject) => {
      const records = [];
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => records.push(data))
        .on('end', () => resolve(records))
        .on('error', reject);
    });
  }

  detectDuplicates(records) {
    const orderIdField = this.rules.fieldMapping.orderId;
    const duplicates = [];
    
    records.forEach(record => {
      const orderId = record[orderIdField];
      if (this.orderIds.has(orderId)) {
        duplicates.push({
          ...record,
          duplicateReason: `重复订单号: ${orderId}`
        });
      } else {
        this.orderIds.add(orderId);
      }
    });
    
    return duplicates;
  }

  detectEmptyRating(records) {
    const ratingField = this.rules.fieldMapping.rating;
    const emptyRows = [];
    
    records.forEach(record => {
      const rating = record[ratingField];
      if (!rating || rating.trim() === '' || rating === '0') {
        emptyRows.push({
          ...record,
          emptyRatingReason: '评分为空或为0'
        });
      }
    });
    
    return emptyRows;
  }

  matchRules(records) {
    const contentField = this.rules.fieldMapping.content;
    
    records.forEach(record => {
      const content = record[contentField] || '';
      let matched = false;
      
      for (const category of this.rules.categories) {
        for (const keyword of category.keywords) {
          if (content.includes(keyword)) {
            this.results.matchedRules[category.id].push({
              ...record,
              matchedCategory: category.name,
              matchedKeyword: keyword
            });
            matched = true;
            break;
          }
        }
        if (matched) break;
      }
      
      if (!matched) {
        this.results.valid.push(record);
      }
    });
  }

  async process() {
    await this.loadRules();
    const allRecords = await this.readInputFiles();
    
    this.results.statistics.totalRows = allRecords.length;
    
    this.results.duplicateOrders = this.detectDuplicates(allRecords);
    this.results.statistics.duplicateCount = this.results.duplicateOrders.length;
    
    const nonDuplicates = allRecords.filter(r => {
      const orderId = r[this.rules.fieldMapping.orderId];
      let count = 0;
      allRecords.forEach(x => {
        if (x[this.rules.fieldMapping.orderId] === orderId) count++;
      });
      return count === 1;
    });
    
    this.results.emptyRatingRows = this.detectEmptyRating(nonDuplicates);
    this.results.statistics.emptyRatingCount = this.results.emptyRatingRows.length;
    
    const validRecords = nonDuplicates.filter(r => {
      const rating = r[this.rules.fieldMapping.rating];
      return rating && rating.trim() !== '' && rating !== '0';
    });
    
    this.matchRules(validRecords);
    this.results.statistics.validRows = this.results.valid.length;
    
    if (!this.preview) {
      await this.writeOutput();
    }
    
    return this.results;
  }

  async writeOutput() {
    await fs.ensureDir(this.outputDir);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const runDir = path.join(this.outputDir, `run_${timestamp}`);
    await fs.ensureDir(runDir);
    
    const json2csvParser = new Parser();
    
    if (this.results.valid.length > 0) {
      const csv = json2csvParser.parse(this.results.valid);
      await fs.writeFile(path.join(runDir, 'valid_reviews.csv'), csv);
    }
    
    if (this.results.duplicateOrders.length > 0) {
      const csv = json2csvParser.parse(this.results.duplicateOrders);
      await fs.writeFile(path.join(runDir, 'duplicate_orders.csv'), csv);
    }
    
    if (this.results.emptyRatingRows.length > 0) {
      const csv = json2csvParser.parse(this.results.emptyRatingRows);
      await fs.writeFile(path.join(runDir, 'empty_rating_rows.csv'), csv);
    }
    
    for (const [categoryId, records] of Object.entries(this.results.matchedRules)) {
      if (records.length > 0) {
        const category = this.rules.categories.find(c => c.id === categoryId);
        const csv = json2csvParser.parse(records);
        await fs.writeFile(path.join(runDir, `${categoryId}_${category.name}.csv`), csv);
      }
    }
    
    const report = {
      ...this.results.statistics,
      categories: {}
    };
    for (const [categoryId, records] of Object.entries(this.results.matchedRules)) {
      const category = this.rules.categories.find(c => c.id === categoryId);
      report.categories[category.name] = records.length;
    }
    
    await fs.writeJson(path.join(runDir, 'report.json'), report, { spaces: 2 });
    await fs.writeJson(path.join(this.outputDir, 'latest_report.json'), report, { spaces: 2 });
    
    this.currentRunDir = runDir;
    return runDir;
  }

  getLatestReport() {
    const reportPath = path.join(this.outputDir, 'latest_report.json');
    if (fs.existsSync(reportPath)) {
      return fs.readJson(reportPath);
    }
    return null;
  }

  printPreview(results) {
    console.log('\n========== 社区食堂外卖评价分拣预览 ==========\n');
    console.log(`总记录数: ${results.statistics.totalRows}`);
    console.log(`有效记录: ${results.statistics.validRows}`);
    console.log(`重复订单: ${results.statistics.duplicateCount} 条`);
    console.log(`空评分: ${results.statistics.emptyRatingCount} 条`);
    console.log('\n---------- 分类匹配情况 ----------');
    for (const category of this.rules.categories) {
      const count = results.matchedRules[category.id].length;
      console.log(`${category.name}: ${count} 条`);
    }
    console.log('\n========== 预览结束 ==========\n');
  }
}

module.exports = CanteenReviewSorter;
