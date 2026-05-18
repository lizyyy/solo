#!/usr/bin/env node

import { processRefundFile } from './index.js';
import path from 'path';
import fs from 'fs';
import chalk from 'chalk';

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printHelp();
    return;
  }

  const filePath = args[0];
  
  if (!fs.existsSync(filePath)) {
    console.error(chalk.red(`错误: 文件不存在 - ${filePath}`));
    process.exit(1);
  }

  try {
    await processRefundFile(filePath);
  } catch (error) {
    console.error(chalk.red(`处理失败: ${error.message}`));
    console.error(error.stack);
    process.exit(1);
  }
}

function printHelp() {
  console.log(`
${chalk.bold.magenta('退款风控记录异常退款复核包 CLI')}
${chalk.gray('═══════════════════════════════════════')}

${chalk.bold('用法:')}
  refund-review <csv文件路径>

${chalk.bold('功能模块:')}
  ${chalk.cyan('◆ 解析模块')}   - 解析CSV格式的退款记录，验证字段格式
  ${chalk.cyan('◆ 校验模块')}   - 业务规则校验（拆单退款、标签过期、黑名单解除）
  ${chalk.cyan('◆ 汇总模块')}   - 统计需要人工复核的退款
  ${chalk.cyan('◆ 报告模块')}   - 生成运营友好的复核报告

${chalk.bold('业务规则:')}
  • 遇到拆单退款时继续处理剩余文件，报告中注明
  • 遇到标签过期时继续处理剩余文件，报告中注明
  • 遇到黑名单解除时继续处理剩余文件，报告中注明
  • 汇总所有需要人工复核的退款记录

${chalk.bold('示例:')}
  refund-review ./samples/normal.csv
  refund-review ./samples/bad-rows.csv
  npm run test:normal
  npm run test:bad

${chalk.gray('═══════════════════════════════════════')}
  `);
}

main().catch(console.error);
