const chalk = require('chalk');
const { ensureDirs, getWorkspaceStatus, writeJSON, CONFIG_FILE } = require('../utils/workspace');

const DEFAULT_CONFIG = {
  version: '1.0.0',
  initializedAt: new Date().toISOString(),
  rules: {
    overTemperatureThreshold: -10,
    underTemperatureThreshold: -25,
    shortDurationMinutes: 15,
    longDurationMinutes: 120,
    maintenanceBufferMinutes: 10
  },
  operators: ['system', 'admin']
};

module.exports = async (options) => {
  const status = getWorkspaceStatus();
  
  if (status.initialized && !options.force) {
    console.log(chalk.yellow('工作目录已初始化。使用 --force 强制重新初始化。'));
    console.log(chalk.gray(`  配置文件: ${status.configPath}`));
    console.log(chalk.gray(`  数据目录: ${status.dataPath}`));
    return;
  }
  
  if (options.force) {
    console.log(chalk.yellow('警告: --force 将覆盖现有配置和数据结构'));
  }
  
  ensureDirs();
  writeJSON(CONFIG_FILE, DEFAULT_CONFIG);
  
  console.log(chalk.green('✓ 工作目录初始化成功'));
  console.log('');
  console.log(chalk.bold('目录结构:'));
  console.log(chalk.cyan('  .cold-chain/'));
  console.log('    ├── config.json          ' + chalk.gray('# 配置文件'));
  console.log('    ├── data/');
  console.log('    │   ├── temperature/     ' + chalk.gray('# 温度曲线数据'));
  console.log('    │   ├── door/            ' + chalk.gray('# 开门记录'));
  console.log('    │   ├── maintenance/     ' + chalk.gray('# 维护计划'));
  console.log('    │   ├── batch/           ' + chalk.gray('# 库存批次'));
  console.log('    │   ├── alerts/          ' + chalk.gray('# 告警记录'));
  console.log('    │   └── assessments/     ' + chalk.gray('# 评估结果'));
  console.log('    └── history/             ' + chalk.gray('# 操作历史记录'));
  console.log('');
  console.log(chalk.bold('下一步:'));
  console.log('  1. ' + chalk.cyan('cold-chain import --sample') + '  ' + chalk.gray('# 导入样例数据'));
  console.log('  2. ' + chalk.cyan('cold-chain check --all') + '       ' + chalk.gray('# 检查所有告警'));
  console.log('  3. ' + chalk.cyan('cold-chain report --type summary') + '  ' + chalk.gray('# 查看汇总报告'));
};
