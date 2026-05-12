const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const Table = require('cli-table3');
const config = require('../utils/config');
const rules = require('../utils/rules');
const sampleData = require('../data/sample-data');

const validTypes = ['send', 'bounce', 'retry', 'source'];

function importCommand(type, options) {
  try {
    config.ensureInitialized();
    
    if (!validTypes.includes(type)) {
      console.error(chalk.red(`✗ 无效的数据类型: ${type}`));
      console.log(chalk.yellow('  有效类型: send, bounce, retry, source'));
      process.exit(1);
    }
    
    console.log(chalk.blue(`\n=== 导入 ${type.toUpperCase()} 数据 ===\n`));
    
    let newData;
    let isSample = false;
    
    if (options.sample) {
      console.log(chalk.gray('使用内置样例数据...'));
      newData = getSampleData(type);
      isSample = true;
    } else if (options.file) {
      console.log(chalk.gray(`从文件导入: ${options.file}...`));
      newData = loadFromFile(options.file);
    } else {
      console.error(chalk.red('✗ 请指定 --file 或 --sample 参数'));
      process.exit(1);
    }
    
    if (!Array.isArray(newData)) {
      newData = [newData];
    }
    
    console.log(chalk.cyan(`准备导入 ${newData.length} 条记录...`));
    
    const existingData = config.getData(type);
    const existingIds = new Set(existingData.map(item => item.id));
    
    const toAdd = [];
    const toUpdate = [];
    const duplicates = [];
    
    newData.forEach(item => {
      if (!item.id) {
        item.id = rules.generateId();
      }
      
      if (existingIds.has(item.id)) {
        const existing = existingData.find(e => e.id === item.id);
        if (JSON.stringify(existing) !== JSON.stringify(item)) {
          toUpdate.push({ old: existing, new: item });
        } else {
          duplicates.push(item.id);
        }
      } else {
        toAdd.push(item);
      }
    });
    
    if (duplicates.length > 0) {
      console.log(chalk.gray(`  跳过 ${duplicates.length} 条相同记录（幂等处理）`));
    }
    
    let updatedData = [...existingData];
    
    if (toAdd.length > 0) {
      console.log(chalk.green(`  新增 ${toAdd.length} 条记录`));
      updatedData = [...updatedData, ...toAdd];
      toAdd.forEach(item => {
        config.addHistoryEntry(type, item.id, {
          action: 'created',
          source: isSample ? 'sample' : options.file,
          data: item
        });
      });
    }
    
    if (toUpdate.length > 0) {
      console.log(chalk.yellow(`  更新 ${toUpdate.length} 条记录`));
      toUpdate.forEach(({ old: oldItem, new: newItem }) => {
        const index = updatedData.findIndex(e => e.id === oldItem.id);
        updatedData[index] = newItem;
        config.addHistoryEntry(type, newItem.id, {
          action: 'updated',
          source: isSample ? 'sample' : options.file,
          before: oldItem,
          after: newItem
        });
      });
    }
    
    config.saveData(type, updatedData);
    
    updateStatistics();
    
    console.log(chalk.green(`\n✓ 导入完成！`));
    console.log(chalk.cyan(`  总计: ${updatedData.length} 条记录`));
    
    if (toAdd.length + toUpdate.length > 0) {
      console.log(chalk.cyan('\n  建议执行: bounce check 来更新状态'));
    }
    
    console.log();
    
  } catch (error) {
    console.error(chalk.red('\n✗ 导入失败：'), error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

function getSampleData(type) {
  const mapping = {
    send: sampleData.sendLogs,
    bounce: sampleData.bounces,
    retry: sampleData.retries,
    source: sampleData.sources
  };
  return mapping[type] || [];
}

function loadFromFile(filePath) {
  const absolutePath = path.resolve(filePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`文件不存在: ${absolutePath}`);
  }
  const content = fs.readFileSync(absolutePath, 'utf-8');
  return JSON.parse(content);
}

function updateStatistics() {
  const cfg = config.getConfig();
  const sendLogs = config.getData('send');
  const bounces = config.getData('bounce');
  const retries = config.getData('retry');
  const unsubscribed = config.getData('unsubscribed');
  
  const uniqueEmails = new Set(sendLogs.map(s => s.email));
  const permanentBounces = bounces.filter(b => {
    const info = rules.classifyBounce(b.bounceCode);
    return info.type === 'permanent';
  });
  const temporaryBounces = bounces.filter(b => {
    const info = rules.classifyBounce(b.bounceCode);
    return info.type === 'temporary';
  });
  
  cfg.statistics = {
    totalEmails: uniqueEmails.size,
    bounces: bounces.length,
    permanentFailures: permanentBounces.length,
    temporaryFailures: temporaryBounces.length,
    retriesAttempted: retries.length,
    retriesSuccessful: retries.filter(r => r.success).length,
    unsubscribed: unsubscribed.length
  };
  
  config.saveConfig(cfg);
}

module.exports = importCommand;
