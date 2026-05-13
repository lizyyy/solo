const path = require('path');
const chalk = require('chalk');
const DriftManager = require('../drift-manager');
const config = require('../config');

function execute(projectPath, ruleId, options) {
  const rule = config.getRuleDefinition(ruleId);

  if (!rule) {
    console.log(chalk.red(`规则未找到: ${ruleId}`));
    console.log(`\n可用规则:`);
    const rules = config.getRuleDefinitions();
    for (const [id, def] of Object.entries(rules)) {
      console.log(chalk.yellow(`  ${id}`) + ` - ${def.name}`);
    }
    process.exit(1);
  }

  const untilDate = validateUntilDate(options.until);
  if (!untilDate) {
    console.log(chalk.red(`日期格式无效: ${options.until}，请使用 YYYY-MM-DD 格式`));
    process.exit(1);
  }

  const driftManager = new DriftManager(projectPath);
  const absolutePath = path.resolve(projectPath);

  console.log(chalk.bold(`\n${'='.repeat(70)}`));
  console.log(chalk.bold(`添加允许漂移配置`));
  console.log(chalk.bold(`${'='.repeat(70)}`));

  console.log(`\n${chalk.bold('项目路径:')} ${absolutePath}`);
  console.log(`${chalk.bold('规则:')} ${chalk.yellow(ruleId)} - ${rule.name}`);
  console.log(`${chalk.bold('风险等级:')} ${getSeverityLabel(rule.severity)}`);
  console.log(`${chalk.bold('允许至:')} ${options.until}`);
  console.log(`${chalk.bold('理由:')} ${options.reason}`);

  if (options.approvedBy) {
    console.log(`${chalk.bold('批准人:')} ${options.approvedBy}`);
  }

  if (options.reviewRequired) {
    console.log(`${chalk.bold('需要复审:')} 是`);
  }

  const drift = {
    ruleId,
    reason: options.reason,
    allowedUntil: options.until,
    approvedBy: options.approvedBy || 'unknown',
    reviewRequired: options.reviewRequired || false
  };

  if (options.mismatchedScript) {
    drift.mismatchedScript = options.mismatchedScript;
  }

  if (options.missingFile) {
    drift.missingFile = options.missingFile;
  }

  if (options.dependency) {
    drift.dependency = options.dependency;
  }

  const existingDrifts = driftManager.getAllDrifts();
  const duplicate = existingDrifts.find(d => {
    if (d.ruleId !== drift.ruleId) return false;
    if (d.mismatchedScript && drift.mismatchedScript && d.mismatchedScript !== drift.mismatchedScript) return false;
    if (d.missingFile && drift.missingFile && d.missingFile !== drift.missingFile) return false;
    if (d.dependency && drift.dependency && d.dependency !== drift.dependency) return false;
    return true;
  });

  if (duplicate) {
    console.log(`\n${chalk.yellow('警告:')} 已存在相同的漂移配置:`);
    console.log(`  ID: ${duplicate.id}`);
    console.log(`  到期: ${duplicate.allowedUntil}`);
    console.log(`  理由: ${duplicate.reason}`);
    console.log(`\n将更新现有配置...`);
    driftManager.removeAllowedDrift(duplicate.id);
  }

  const driftId = driftManager.addAllowedDrift(drift);

  console.log(`\n${chalk.green.bold('✓ 已添加允许漂移配置')}`);
  console.log(`  ID: ${driftId}`);
  console.log(`  配置文件: ${path.join(absolutePath, '.scaffold-drift.json')}`);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const until = new Date(untilDate);
  until.setHours(0, 0, 0, 0);
  const daysRemaining = Math.ceil((until - today) / (1000 * 60 * 60 * 24));

  console.log(`\n${chalk.bold('有效期提醒:')}`);
  if (daysRemaining < 0) {
    console.log(chalk.red(`  ⚠ 此漂移已过期 ${Math.abs(daysRemaining)} 天`));
  } else if (daysRemaining < 30) {
    console.log(chalk.yellow(`  ⚠ 此漂移将在 ${daysRemaining} 天后到期，请及时安排修复`));
  } else {
    console.log(chalk.cyan(`  ✓ 此漂移有效期 ${daysRemaining} 天`));
  }

  console.log(`\n${chalk.bold('建议:')}`);
  console.log(`  • 在到期前完成修复工作`);
  console.log(`  • 将此配置纳入版本控制`);
  console.log(`  • 定期扫描检查，确保所有漂移都有记录`);

  if (options.reviewRequired) {
    console.log(`  • 记得在到期前进行复审`);
  }

  console.log('\n');
}

function validateUntilDate(dateStr) {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return null;

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;

  return dateStr;
}

function getSeverityLabel(severity) {
  const labels = {
    critical: chalk.red.bold('CRITICAL'),
    high: chalk.red('HIGH'),
    medium: chalk.yellow('MEDIUM'),
    low: chalk.cyan('LOW'),
    info: chalk.blue('INFO')
  };
  return labels[severity] || severity;
}

module.exports = { execute };
