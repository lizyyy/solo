const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const MealChecker = require('./meal-checker');

async function runCheck(filePath, options = {}) {
  logger.configure(options);

  logger.header('月子餐配送组 - 月子餐配送核对');

  if (!fs.existsSync(filePath)) {
    throw new Error(`文件不存在: ${filePath}`);
  }

  const checker = new MealChecker(filePath, options);
  const result = await checker.run();

  displayResult(result, options);

  if (options.output) {
    await writeOutput(result, options.output, options);
  }

  if (result.errors.length > 0) {
    process.exitCode = 1;
  }

  return result;
}

function displayResult(result, options) {
  const { summary, errors, warnings } = result;

  console.log('');

  logger.info(`总记录数: ${summary.totalRecords}`);
  logger.success(`有效记录: ${summary.validRecords}`);
  
  if (summary.invalidRecords > 0) {
    logger.error(`无效记录: ${summary.invalidRecords}`);
  }

  if (warnings.length > 0) {
    logger.warning(`警告数量: ${warnings.length}`);
  }

  displayTwinOrders(summary.twinOrders);
  displayTemporaryRestrictions(summary.temporaryRestrictions);
  displayErrors(errors);
  displayWarnings(warnings);

  console.log('');
  logger.success('核对完成!');
}

function displayTwinOrders(twinOrders) {
  console.log('');
  
  if (twinOrders.length === 0) {
    logger.info('双胞胎订单: 0');
    return;
  }

  logger.info(`双胞胎订单: ${twinOrders.length}`);
  
  for (const order of twinOrders) {
    console.log(`   ↳ ${order.orderId} - ${order.customerName} (行${order.lineNumber})`);
  }
}

function displayTemporaryRestrictions(restrictions) {
  console.log('');
  
  if (restrictions.length === 0) {
    logger.info('临时忌口订单: 0');
    return;
  }

  logger.info(`临时忌口订单: ${restrictions.length}`);
  
  for (const restriction of restrictions) {
    const types = restriction.restrictions.map(r => r.type).join(', ');
    console.log(`   ↳ ${restriction.orderId} - ${restriction.customerName} [${types}] (行${restriction.lineNumber})`);
  }
}

function displayErrors(errors) {
  if (errors.length === 0) {
    return;
  }

  console.log('');
  logger.error(`数据问题 (${errors.length}):`);
  
  for (const error of errors) {
    if (error.toDisplayString) {
      console.log(`   ${error.toDisplayString()}`);
    } else {
      console.log(`   ${error.message}`);
    }
  }
}

function displayWarnings(warnings) {
  if (warnings.length === 0) {
    return;
  }

  console.log('');
  logger.warning(`警告提醒 (${warnings.length}):`);
  
  for (const warning of warnings) {
    if (warning.toDisplayString) {
      console.log(`   ${warning.toDisplayString()}`);
    } else {
      console.log(`   ${warning.message}`);
    }
  }
}

async function writeOutput(result, outputPath, options) {
  const { summary, errors, warnings } = result;
  
  let output = '';
  output += '═'.repeat(60) + '\n';
  output += '           月子餐配送组 - 月子餐配送核对报告\n';
  output += '═'.repeat(60) + '\n\n';
  
  output += `生成时间: ${new Date().toLocaleString('zh-CN')}\n`;
  output += `数据文件: ${path.basename(result.records[0]?._sourceFile || 'unknown')}\n\n`;
  
  output += '【统计摘要】\n';
  output += `  总记录数: ${summary.totalRecords}\n`;
  output += `  有效记录: ${summary.validRecords}\n`;
  output += `  无效记录: ${summary.invalidRecords}\n`;
  output += `  警告数量: ${warnings.length}\n\n`;
  
  output += '【双胞胎订单】\n';
  if (summary.twinOrders.length === 0) {
    output += '  无\n';
  } else {
    for (const order of summary.twinOrders) {
      output += `  • ${order.orderId} - ${order.customerName} (行${order.lineNumber})\n`;
    }
  }
  output += '\n';
  
  output += '【临时忌口订单】\n';
  if (summary.temporaryRestrictions.length === 0) {
    output += '  无\n';
  } else {
    for (const restriction of summary.temporaryRestrictions) {
      const types = restriction.restrictions.map(r => r.type).join(', ');
      output += `  • ${restriction.orderId} - ${restriction.customerName} [${types}] (行${restriction.lineNumber})\n`;
    }
  }
  output += '\n';
  
  if (errors.length > 0) {
    output += '【数据错误】\n';
    for (const error of errors) {
      if (error.toDisplayString) {
        output += `  ${error.toDisplayString()}\n`;
      } else {
        output += `  ${error.message}\n`;
      }
    }
    output += '\n';
  }
  
  if (warnings.length > 0) {
    output += '【警告提醒】\n';
    for (const warning of warnings) {
      if (warning.toDisplayString) {
        output += `  ${warning.toDisplayString()}\n`;
      } else {
        output += `  ${warning.message}\n`;
      }
    }
    output += '\n';
  }
  
  output += '═'.repeat(60) + '\n';
  output += '                     报告结束\n';
  output += '═'.repeat(60) + '\n';

  fs.writeFileSync(outputPath, output, 'utf8');
  logger.success(`结果已保存到: ${outputPath}`);
}

module.exports = {
  runCheck,
  MealChecker
};
