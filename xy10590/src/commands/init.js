const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const config = require('../utils/config');
const sampleData = require('../data/sample-data');

const defaultConfig = {
  version: '1.0.0',
  initializedAt: null,
  settings: {
    maxRetries: 3,
    temporaryFailureWaitDays: 1,
    mailboxFullWaitDays: 7,
    autoExportReports: true,
    historyRetentionDays: 90
  },
  statistics: {
    totalEmails: 0,
    bounces: 0,
    permanentFailures: 0,
    temporaryFailures: 0,
    retriesAttempted: 0,
    retriesSuccessful: 0,
    unsubscribed: 0
  }
};

function init(options) {
  console.log(chalk.blue('\n=== 邮件退信归因 CLI 初始化 ===\n'));
  
  if (config.isInitialized()) {
    if (!options.force) {
      console.log(chalk.yellow('⚠ 工作目录已初始化。使用 -f/--force 参数强制覆盖。'));
      return;
    }
    console.log(chalk.yellow('⚠ 强制覆盖现有配置...'));
  }
  
  try {
    if (!fs.existsSync(config.BOUNCE_DIR)) {
      fs.mkdirSync(config.BOUNCE_DIR, { recursive: true });
      console.log(chalk.green('✓ 创建 .bounce 目录'));
    }
    
    if (!fs.existsSync(config.DATA_DIR)) {
      fs.mkdirSync(config.DATA_DIR, { recursive: true });
      console.log(chalk.green('✓ 创建数据目录'));
    }
    
    if (!fs.existsSync(config.HISTORY_DIR)) {
      fs.mkdirSync(config.HISTORY_DIR, { recursive: true });
      console.log(chalk.green('✓ 创建历史记录目录'));
    }
    
    const initConfig = {
      ...defaultConfig,
      initializedAt: new Date().toISOString()
    };
    config.saveConfig(initConfig);
    console.log(chalk.green('✓ 保存配置文件'));
    
    config.saveData('send', sampleData.sendLogs);
    config.saveData('bounce', sampleData.bounces);
    config.saveData('retry', sampleData.retries);
    config.saveData('source', sampleData.sources);
    config.saveData('unsubscribed', sampleData.unsubscribed);
    config.saveData('status', []);
    config.saveData('attribution', []);
    console.log(chalk.green('✓ 加载内置样例数据'));
    
    console.log(chalk.green('\n✓ 初始化完成！\n'));
    console.log(chalk.cyan('下一步操作：'));
    console.log('  1. ' + chalk.white('bounce list') + ' - 查看数据概览');
    console.log('  2. ' + chalk.white('bounce check') + ' - 执行规则检查');
    console.log('  3. ' + chalk.white('bounce report') + ' - 生成归因报告');
    console.log('  4. ' + chalk.white('bounce detail <email>') + ' - 查看特定邮箱详情');
    console.log();
    
  } catch (error) {
    console.error(chalk.red('\n✗ 初始化失败：'), error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

module.exports = init;
