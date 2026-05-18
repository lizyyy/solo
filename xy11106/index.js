#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const REQUIRED_COLUMNS = ['门店编号', '衣物编号', '衣物类型', '客户姓名', '取衣日期', '状态', '扫码时间'];

class LaundryLabelReprint {
  constructor(inputFile, outputDir = './output') {
    this.inputFile = inputFile;
    this.outputDir = outputDir;
    this.results = [];
    this.errors = [];
    this.warnings = [];
    this.duplicateScans = [];
    this.cancelledOrders = [];
    this.rowNumber = 0;

    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  async process() {
    console.log(`\n=== 连锁洗衣店洗衣标签补打工具 ===`);
    console.log(`输入文件: ${this.inputFile}`);
    console.log(`开始处理...\n`);

    try {
      await this.validateFileExists();
      await this.parseCsv();
      this.detectDuplicateScans();
      this.detectCancelledOrders();
      await this.generateOutputs();
      this.printSummary();
      return { success: true, errors: this.errors, warnings: this.warnings };
    } catch (error) {
      console.error(`处理失败: ${error.message}`);
      return { success: false, errors: [error.message], warnings: this.warnings };
    }
  }

  validateFileExists() {
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(this.inputFile)) {
        reject(new Error(`文件不存在: ${this.inputFile}`));
      }
      resolve();
    });
  }

  parseCsv() {
    return new Promise((resolve, reject) => {
      const stream = fs.createReadStream(this.inputFile, { encoding: 'utf8' });
      
      stream.on('error', (error) => {
        if (error.message.includes('encoding') || error.code === 'ENOENT') {
          this.errors.push({
            file: this.inputFile,
            row: 0,
            type: '编码异常',
            message: `文件编码错误，请使用 UTF-8 编码: ${error.message}`
          });
        }
        reject(error);
      });

      stream
        .pipe(csv())
        .on('headers', (headers) => {
          const missing = REQUIRED_COLUMNS.filter(col => !headers.includes(col));
          if (missing.length > 0) {
            this.errors.push({
              file: this.inputFile,
              row: 1,
              type: '缺列',
              message: `缺少必需列: ${missing.join(', ')}`
            });
          }
        })
        .on('data', (data) => {
          this.rowNumber++;
          try {
            this.validateRow(data, this.rowNumber + 1);
            this.results.push({ ...data, _row: this.rowNumber + 1 });
          } catch (error) {
            this.errors.push({
              file: this.inputFile,
              row: this.rowNumber + 1,
              type: '数据异常',
              message: error.message
            });
          }
        })
        .on('end', () => {
          resolve();
        })
        .on('error', (error) => {
          this.errors.push({
            file: this.inputFile,
            row: this.rowNumber + 1,
            type: '解析错误',
            message: error.message
          });
          resolve();
        });
    });
  }

  validateRow(data, rowNum) {
    const emptyCols = REQUIRED_COLUMNS.filter(col => !data[col] || data[col].trim() === '');
    if (emptyCols.length > 0) {
      throw new Error(`列值为空: ${emptyCols.join(', ')}`);
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(data['取衣日期'])) {
      throw new Error(`取衣日期格式错误，应为 YYYY-MM-DD: ${data['取衣日期']}`);
    }

    if (!['待洗', '洗涤中', '已完成', '已取消', '已取走'].includes(data['状态'])) {
      throw new Error(`无效状态: ${data['状态']}`);
    }
  }

  detectDuplicateScans() {
    const scanMap = new Map();
    
    this.results.forEach((item) => {
      const key = `${item['门店编号']}-${item['衣物编号']}`;
      if (scanMap.has(key)) {
        const existing = scanMap.get(key);
        this.duplicateScans.push({
          file: this.inputFile,
          rows: [existing._row, item._row],
          type: '同件衣物多次扫码',
          message: `衣物编号 ${item['衣物编号']} 在门店 ${item['门店编号']} 被多次扫码`,
          门店编号: item['门店编号'],
          衣物编号: item['衣物编号'],
          客户姓名: item['客户姓名'],
          扫码时间1: existing['扫码时间'],
          扫码时间2: item['扫码时间']
        });
        this.warnings.push(this.duplicateScans[this.duplicateScans.length - 1]);
      } else {
        scanMap.set(key, item);
      }
    });
  }

  detectCancelledOrders() {
    this.cancelledOrders = this.results
      .filter(item => item['状态'] === '已取消')
      .map(item => ({
        file: this.inputFile,
        row: item._row,
        type: '撤单',
        message: `订单已撤单: ${item['衣物编号']} - ${item['客户姓名']}`,
        门店编号: item['门店编号'],
        衣物编号: item['衣物编号'],
        客户姓名: item['客户姓名'],
        取衣日期: item['取衣日期']
      }));

    this.warnings.push(...this.cancelledOrders);
  }

  async generateOutputs() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const baseName = path.basename(this.inputFile, '.csv');

    const validItems = this.results.filter(item => 
      item['状态'] !== '已取消' && 
      !this.duplicateScans.some(d => d['衣物编号'] === item['衣物编号'] && d['门店编号'] === item['门店编号'])
    );

    const reprintItems = validItems.map(item => ({
      门店编号: item['门店编号'],
      衣物编号: item['衣物编号'],
      衣物类型: item['衣物类型'],
      客户姓名: item['客户姓名'],
      取衣日期: item['取衣日期'],
      状态: item['状态'],
      扫码时间: item['扫码时间']
    }));

    const reprintFile = path.join(this.outputDir, `${baseName}_补打标签_${timestamp}.csv`);
    const csvWriter = createCsvWriter({
      path: reprintFile,
      header: [
        { id: '门店编号', title: '门店编号' },
        { id: '衣物编号', title: '衣物编号' },
        { id: '衣物类型', title: '衣物类型' },
        { id: '客户姓名', title: '客户姓名' },
        { id: '取衣日期', title: '取衣日期' },
        { id: '状态', title: '状态' },
        { id: '扫码时间', title: '扫码时间' }
      ]
    });
    await csvWriter.writeRecords(reprintItems);
    console.log(`✓ 补打标签文件已生成: ${reprintFile}`);

    const summaryFile = path.join(this.outputDir, `${baseName}_异常摘要_${timestamp}.csv`);
    const summaryWriter = createCsvWriter({
      path: summaryFile,
      header: [
        { id: 'file', title: '来源文件' },
        { id: 'row', title: '行号' },
        { id: 'rows', title: '涉及行号' },
        { id: 'type', title: '异常类型' },
        { id: 'message', title: '详细信息' },
        { id: '门店编号', title: '门店编号' },
        { id: '衣物编号', title: '衣物编号' },
        { id: '客户姓名', title: '客户姓名' }
      ]
    });

    const allIssues = [
      ...this.errors.map(e => ({ ...e, row: e.row || '', rows: '' })),
      ...this.warnings.map(w => ({ 
        ...w, 
        row: w.row || '', 
        rows: w.rows ? w.rows.join(',') : '' 
      }))
    ];
    await summaryWriter.writeRecords(allIssues);
    console.log(`✓ 异常摘要文件已生成: ${summaryFile}`);

    const manifestFile = path.join(this.outputDir, `${baseName}_处理记录_${timestamp}.json`);
    const manifest = {
      输入文件: this.inputFile,
      处理时间: new Date().toISOString(),
      总行数: this.rowNumber,
      有效记录数: reprintItems.length,
      错误数: this.errors.length,
      警告数: this.warnings.length,
      重复扫码数: this.duplicateScans.length,
      撤单数: this.cancelledOrders.length,
      输出文件: {
        补打标签: reprintFile,
        异常摘要: summaryFile
      }
    };
    fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2), 'utf8');
    console.log(`✓ 处理记录已生成: ${manifestFile}`);

    return { reprintFile, summaryFile, manifestFile };
  }

  printSummary() {
    console.log('\n' + '='.repeat(50));
    console.log('处理摘要:');
    console.log('='.repeat(50));
    console.log(`总行数: ${this.rowNumber}`);
    console.log(`错误数: ${this.errors.length}`);
    console.log(`警告数: ${this.warnings.length}`);
    console.log(`  - 重复扫码: ${this.duplicateScans.length}`);
    console.log(`  - 撤单: ${this.cancelledOrders.length}`);
    console.log(`可补打标签数: ${this.results.length - this.cancelledOrders.length - this.duplicateScans.length}`);
    
    if (this.errors.length > 0) {
      console.log('\n错误列表:');
      this.errors.forEach((e, i) => {
        console.log(`  ${i + 1}. [行${e.row}] ${e.type}: ${e.message}`);
      });
    }

    if (this.duplicateScans.length > 0) {
      console.log('\n重复扫码列表 (需人工确认):');
      this.duplicateScans.forEach((d, i) => {
        console.log(`  ${i + 1}. [行${d.rows.join(',')}] ${d.message}`);
      });
    }

    if (this.cancelledOrders.length > 0) {
      console.log('\n撤单列表 (已排除):');
      this.cancelledOrders.forEach((c, i) => {
        console.log(`  ${i + 1}. [行${c.row}] ${c.message}`);
      });
    }

    console.log('\n' + '='.repeat(50));
    console.log('可复跑说明: 再次运行本工具会生成新的时间戳文件，不会覆盖之前结果');
    console.log('运营同事: 请查看"异常摘要"CSV文件，按来源文件和行号修正数据');
    console.log('='.repeat(50) + '\n');
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
连锁洗衣店洗衣标签补打 CLI

用法:
  node index.js <输入CSV文件> [输出目录]

示例:
  node index.js ./samples/洗衣店数据.csv ./my-output

功能:
  - 检测缺列、编码异常
  - 识别同件衣物多次扫码
  - 排除已撤单订单
  - 生成可复跑输出（带时间戳）
  - 输出异常摘要（含来源文件和行号）

输出文件:
  - *_补打标签_*.csv: 可直接打印的标签数据
  - *_异常摘要_*.csv: 异常清单（运营同事用）
  - *_处理记录_*.json: 处理日志
`);
    process.exit(0);
  }

  const inputFile = args[0];
  const outputDir = args[1] || './output';

  const app = new LaundryLabelReprint(inputFile, outputDir);
  app.process().then(result => {
    process.exit(result.success && result.errors.length === 0 ? 0 : 1);
  });
}

module.exports = LaundryLabelReprint;
