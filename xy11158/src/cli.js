#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Command } = require('commander');
const chalk = require('chalk');
const { InsuranceListProcessor } = require('./processor');
const { INSURANCE_STATUS, STATUS_TYPES, validateIdCard } = require('./models');

const program = new Command();

program
  .name('户外研学机构研学保险名单')
  .description('户外研学机构研学保险名单处理工具 - 支持改队、退团、身份证校验、审计追踪')
  .version('1.0.0');

program
  .option('-i, --input <file>', '输入JSON文件路径')
  .option('-o, --output <file>', '输出JSON文件路径')
  .option('-a, --audit <file>', '审计日志输出路径')
  .option('-s, --summary', '显示人类可读汇总')
  .option('-v, --verbose', '详细模式，展开每条记录')
  .option('--idempotency-key <key>', '幂等键，用于可复跑操作')
  .option('--operator <name>', '操作人姓名')
  .option('--validate-id', '验证所有身份证号')
  .option('--change-team <recordId:newTeamId:newTeamName>', '改队操作，格式: recordId:newTeamId:newTeamName')
  .option('--withdraw <recordId>', '退团操作')
  .option('--correct-idcard <recordId:newIdCard>', '修正身份证号')
  .option('--update-insurance <recordId:status>', '更新保险状态');

program.parse();

const options = program.opts();

function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

function logVerbose(message) {
  if (options.verbose) {
    console.log(chalk.gray(`  ${message}`));
  }
}

async function main() {
  const processor = new InsuranceListProcessor({
    operator: options.operator || 'cli-user',
    idempotencyKey: options.idempotencyKey
  });

  if (options.input) {
    if (!fs.existsSync(options.input)) {
      console.error(chalk.red(`错误: 输入文件不存在: ${options.input}`));
      process.exit(1);
    }
    const inputData = JSON.parse(fs.readFileSync(options.input, 'utf8'));
    processor.loadRecords(inputData);
    log(`已加载 ${inputData.length} 条记录`);
  }

  if (options.changeTeam) {
    const parts = options.changeTeam.split(':');
    if (parts.length >= 3) {
      const [recordId, newTeamId, ...teamNameParts] = parts;
      const newTeamName = teamNameParts.join(':');
      const result = processor.changeTeam(recordId, newTeamId, newTeamName);
      log(result.message);
      logVerbose(`变更记录: ${recordId}, 新队伍: ${newTeamName}`);
    }
  }

  if (options.withdraw) {
    const result = processor.withdraw(options.withdraw, '用户申请退团');
    log(result.message);
    logVerbose(`退团记录: ${options.withdraw}`);
  }

  if (options.correctIdcard) {
    const [recordId, newIdCard] = options.correctIdcard.split(':');
    const result = processor.correctIdCard(recordId, newIdCard, '身份证号修正');
    log(result.message);
    if (result.validation) {
      logVerbose(`身份证类型: ${result.validation.type}`);
    }
  }

  if (options.updateInsurance) {
    const [recordId, status] = options.updateInsurance.split(':');
    const result = processor.updateInsurance(recordId, status);
    log(result.message);
  }

  if (options.validateId) {
    const validationResults = processor.validateAllIdCards();
    const invalid = validationResults.filter(r => !r.valid);
    if (invalid.length > 0) {
      log(chalk.yellow(`发现 ${invalid.length} 条身份证验证失败:`));
      invalid.forEach(r => {
        console.log(`  ${r.participantName} (${r.recordId}): ${r.error}`);
      });
    } else {
      log(chalk.green('所有身份证号验证通过'));
    }
    if (options.verbose) {
      validationResults.forEach(r => {
        console.log(`  ${r.participantName}: ${r.idCardNumber} - ${r.valid ? '✓' : '✗'} ${r.type || ''}`);
      });
    }
  }

  if (options.output) {
    const outputDir = path.dirname(options.output);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const outputData = processor.getRecordsForOutput();
    fs.writeFileSync(options.output, JSON.stringify(outputData, null, 2), 'utf8');
    log(`结果已写入: ${options.output}`);
  }

  if (options.audit) {
    const auditDir = path.dirname(options.audit);
    if (!fs.existsSync(auditDir)) {
      fs.mkdirSync(auditDir, { recursive: true });
    }
    const auditLog = processor.getAuditLog();
    fs.writeFileSync(options.audit, JSON.stringify(auditLog, null, 2), 'utf8');
    log(`审计日志已写入: ${options.audit}`);
  }

  if (options.summary) {
    printSummary(processor);
  }

  if (!options.output && !options.audit && !options.summary && !options.validateId) {
    const records = processor.getRecordsForOutput();
    console.log(JSON.stringify(records, null, 2));
  }
}

function printSummary(processor) {
  const summary = processor.getSummary();
  const auditLog = processor.getAuditLog();

  console.log('\n' + chalk.bold('═══════════════════════════════════════════'));
  console.log(chalk.bold('      户外研学机构研学保险名单 - 汇总报告'));
  console.log(chalk.bold('═══════════════════════════════════════════\n'));

  console.log(chalk.blue.bold('📊 基本统计'));
  console.log(`   总记录数: ${chalk.green(summary.total)}`);
  console.log('');

  console.log(chalk.blue.bold('📋 状态分布'));
  Object.entries(summary.byStatus).forEach(([status, count]) => {
    console.log(`   ${status}: ${chalk.yellow(count)}`);
  });
  console.log('');

  console.log(chalk.blue.bold('🛡️  保险状态分布'));
  Object.entries(summary.byInsuranceStatus).forEach(([status, count]) => {
    console.log(`   ${status}: ${chalk.yellow(count)}`);
  });
  console.log('');

  if (Object.keys(summary.byTeam).length > 0) {
    console.log(chalk.blue.bold('👥 队伍分布'));
    Object.entries(summary.byTeam).forEach(([team, count]) => {
      console.log(`   ${team}: ${chalk.yellow(count)}人`);
    });
    console.log('');
  }

  console.log(chalk.blue.bold('🔄 本次操作统计'));
  console.log(`   改队: ${chalk.magenta(summary.operations.teamChanges)} 次`);
  console.log(`   退团: ${chalk.magenta(summary.operations.withdrawals)} 次`);
  console.log(`   身份证修正: ${chalk.magenta(summary.operations.idCardCorrections)} 次`);
  console.log(`   保险状态更新: ${chalk.magenta(summary.operations.insuranceUpdates)} 次`);
  console.log('');

  if (options.verbose && auditLog.length > 0) {
    console.log(chalk.blue.bold('📝 详细操作日志'));
    auditLog.forEach((entry, index) => {
      console.log(`   ${index + 1}. [${entry.timestamp}] ${entry.operation}`);
      if (entry.participantName) {
        console.log(`      参与人: ${entry.participantName}`);
      }
      if (entry.oldValue && entry.newValue) {
        console.log(`      变更前:`, entry.oldValue);
        console.log(`      变更后:`, entry.newValue);
      }
      if (entry.reason) {
        console.log(`      原因: ${entry.reason}`);
      }
      console.log('');
    });
  } else if (auditLog.length > 0) {
    console.log(chalk.blue(`📝 操作日志共 ${auditLog.length} 条 (使用 -v 查看详情)`));
  }

  console.log(chalk.bold('═══════════════════════════════════════════\n'));
}

main().catch(error => {
  console.error(chalk.red('错误:'), error.message);
  if (options.verbose) {
    console.error(error.stack);
  }
  process.exit(1);
});
