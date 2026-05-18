const fs = require('fs').promises;
const path = require('path');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');
const chalk = require('chalk');

const LEDGER_COLUMNS = [
  '序号',
  '购买日期',
  '购买人姓名',
  '身份证号',
  '联系电话',
  '住址',
  '农资名称',
  '规格型号',
  '数量',
  '单位',
  '单价',
  '金额',
  '生产厂家',
  '农药登记证号',
  '销售人',
  '备注',
  '记录状态',
  '_源文件',
  '_源行号',
  '_修改次数'
];

const BUSINESS_KEYS = ['购买人姓名', '农资名称', '购买日期'];

class LedgerRecord {
  constructor(data, sourceFile, sourceLine) {
    this.data = { ...data };
    this.sourceFile = sourceFile;
    this.sourceLine = sourceLine;
    this.modifyCount = 1;
    this.modifyHistory = [{ sourceFile, sourceLine, data: { ...data } }];
  }

  update(newData, sourceFile, sourceLine) {
    this.modifyCount++;
    this.modifyHistory.push({ sourceFile, sourceLine, data: { ...newData } });
    this.data = { ...newData };
    this.sourceFile = sourceFile;
    this.sourceLine = sourceLine;
  }

  hasIdCardTailMissing() {
    const idCard = this.data['身份证号'] || '';
    return idCard.length > 0 && idCard.length < 18;
  }

  isReturnRecord() {
    const remark = (this.data['备注'] || '').toLowerCase();
    const quantity = parseFloat(this.data['数量']) || 0;
    return remark.includes('退') || quantity < 0;
  }

  getStableKey() {
    return BUSINESS_KEYS.map(key => this.data[key] || '').join('|');
  }

  toRow() {
    return {
      ...this.data,
      '记录状态': this.getStatus(),
      '_源文件': this.sourceFile,
      '_源行号': this.sourceLine,
      '_修改次数': this.modifyCount
    };
  }

  getStatus() {
    const statuses = [];
    if (this.modifyCount > 1) statuses.push('已修改');
    if (this.hasIdCardTailMissing()) statuses.push('身份证尾号缺失');
    if (this.isReturnRecord()) statuses.push('退货记录');
    return statuses.length > 0 ? statuses.join(',') : '正常';
  }
}

class LedgerProcessor {
  constructor(options = {}) {
    this.options = {
      verbose: false,
      keepAll: false,
      ...options
    };
    this.records = [];
    this.recordMap = new Map();
    this.stats = {
      total: 0,
      duplicates: 0,
      idCardMissing: 0,
      returns: 0,
      modified: 0
    };
  }

  log(message, isVerbose = false) {
    if (isVerbose && !this.options.verbose) return;
    console.log(message);
  }

  async load(inputFile) {
    this.log(chalk.blue(`正在加载文件: ${inputFile}`));
    const content = await fs.readFile(inputFile, 'utf-8');
    const rows = parse(content, {
      columns: true,
      skip_empty_lines: true
    });

    const filename = path.basename(inputFile);
    rows.forEach((row, index) => {
      const lineNum = index + 2;
      const record = new LedgerRecord(row, filename, lineNum);
      this.records.push(record);
      this.stats.total++;
    });

    this.log(chalk.green(`加载完成，共 ${this.stats.total} 条记录`), true);
  }

  process() {
    this.log(chalk.blue('开始处理数据...'));

    if (!this.options.keepAll) {
      this.mergeDuplicates();
    }
    
    this.detectIssues();
    this.stableSort();
  }

  mergeDuplicates() {
    this.log(chalk.yellow('合并重复修改的记录...'), true);

    this.records.forEach(record => {
      const key = record.getStableKey();
      
      if (this.recordMap.has(key)) {
        const existing = this.recordMap.get(key);
        existing.update(record.data, record.sourceFile, record.sourceLine);
        this.stats.duplicates++;
        this.stats.modified++;
        this.log(chalk.gray(`  合并记录: ${key} (第${record.sourceLine}行)`), true);
      } else {
        this.recordMap.set(key, record);
      }
    });

    if (!this.options.keepAll) {
      this.records = Array.from(this.recordMap.values());
    }

    this.log(chalk.green(`合并完成: ${this.stats.duplicates} 条重复记录被合并`));
  }

  detectIssues() {
    this.log(chalk.yellow('检测问题记录...'), true);

    this.records.forEach(record => {
      if (record.hasIdCardTailMissing()) {
        this.stats.idCardMissing++;
        this.log(chalk.yellow(`  身份证尾号缺失: ${record.data['购买人姓名']} - ${record.data['身份证号']}`), true);
      }
      
      if (record.isReturnRecord()) {
        this.stats.returns++;
        this.log(chalk.magenta(`  退货记录: ${record.data['购买人姓名']} - ${record.data['农资名称']}`), true);
      }
    });

    this.log(chalk.green(`检测完成: ${this.stats.idCardMissing} 条身份证尾号缺失, ${this.stats.returns} 条退货记录`));
  }

  stableSort() {
    this.log(chalk.yellow('稳定排序...'), true);
    
    this.records.sort((a, b) => {
      const dateA = a.data['购买日期'] || '';
      const dateB = b.data['购买日期'] || '';
      if (dateA !== dateB) return dateA.localeCompare(dateB);

      const nameA = a.data['购买人姓名'] || '';
      const nameB = b.data['购买人姓名'] || '';
      if (nameA !== nameB) return nameA.localeCompare(nameB);

      const productA = a.data['农资名称'] || '';
      const productB = b.data['农资名称'] || '';
      return productA.localeCompare(productB);
    });
  }

  async saveOutput(outputPath) {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    const rows = this.records.map(record => record.toRow());
    const output = stringify(rows, {
      header: true,
      columns: LEDGER_COLUMNS
    });

    await fs.writeFile(outputPath, output, 'utf-8');
    this.log(chalk.green(`输出文件已保存: ${outputPath}`));
  }
}

module.exports = LedgerProcessor;
module.exports.LedgerRecord = LedgerRecord;
module.exports.LEDGER_COLUMNS = LEDGER_COLUMNS;