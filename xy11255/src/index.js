const { initDatabase } = require('./database');
const chalk = require('chalk');

initDatabase();

console.log(chalk.cyan.bold('\n=== 团长运营对账系统 ===\n'));
console.log(chalk.green('数据库初始化完成'));
console.log(chalk.blue('\n使用以下命令操作系统:'));
console.log(chalk.white('  npm run import -- --orders data/samples/orders.csv      导入订单数据'));
console.log(chalk.white('  npm run import -- --out-of-stock data/samples/out_of_stock.xlsx  导入缺货清单'));
console.log(chalk.white('  npm run import -- --rules data/samples/compensation_rules.json    导入补偿规则'));
console.log(chalk.white('  npm run process                                            处理缺货补偿'));
console.log(chalk.white('  npm run review                                             复核数据概览'));
console.log(chalk.white('  npm run review -- --errors                                 查看错误记录'));
console.log(chalk.white('  npm run export -- --report exports/report.csv              导出补偿报告'));
console.log(chalk.white('  npm run export -- --errors exports/errors.csv              导出错误记录'));
console.log(chalk.white('  npm test                                                   运行完整测试流程\n'));
