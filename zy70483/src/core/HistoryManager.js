const chalk = require('chalk');
const Table = require('cli-table3');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

class HistoryManager {
  constructor() {
    this.dataDir = path.join(__dirname, '../../data');
    this.historyFile = path.join(this.dataDir, 'history.json');
    this.ensureDataDir();
    this.records = this.loadRecords();
  }

  ensureDataDir() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  loadRecords() {
    if (fs.existsSync(this.historyFile)) {
      return JSON.parse(fs.readFileSync(this.historyFile, 'utf8'));
    }
    return [];
  }

  saveRecords() {
    fs.writeFileSync(this.historyFile, JSON.stringify(this.records, null, 2));
  }

  record(operationType, operator, result) {
    const record = {
      id: uuidv4(),
      batchId: result.batchId || uuidv4().substring(0, 8),
      operationType,
      operator,
      timestamp: new Date().toISOString(),
      riskType: this.detectRiskType(result),
      success: result.success,
      details: result
    };

    this.records.push(record);
    this.saveRecords();
    return record;
  }

  detectRiskType(result) {
    if (result.failedCount > 0) return 'high';
    if (result.riskType === 'high') return 'high';
    if (result.riskType === 'medium') return 'medium';
    return 'low';
  }

  query(options) {
    let results = [...this.records];

    if (options.batch) {
      results = results.filter(r => r.batchId === options.batch);
    }

    if (options.operator) {
      results = results.filter(r => r.operator === options.operator);
    }

    if (options.risk) {
      results = results.filter(r => r.riskType === options.risk);
    }

    return results;
  }

  printRecords(records) {
    if (records.length === 0) {
      console.log(chalk.yellow('⚠️  未找到匹配的记录'));
      return;
    }

    console.log(chalk.green(`✅ 找到 ${records.length} 条记录\n`));

    const table = new Table({
      head: ['批次ID', '操作类型', '操作者', '时间', '风险', '成功'],
      colWidths: [12, 15, 12, 25, 10, 8]
    });

    records.forEach(r => {
      table.push([
        r.batchId,
        r.operationType,
        r.operator,
        r.timestamp.replace('T', ' ').substring(0, 19),
        r.riskType === 'high' ? chalk.red('高') : 
        r.riskType === 'medium' ? chalk.yellow('中') : chalk.green('低'),
        r.success ? chalk.green('是') : chalk.red('否')
      ]);
    });

    console.log(table.toString());

    const failedCount = records.filter(r => !r.success).length;
    if (failedCount > 0) {
      console.log(chalk.red(`\n❌ 其中 ${failedCount} 条操作失败，可查看失败项文件了解详情`));
    }
  }
}

module.exports = HistoryManager;
