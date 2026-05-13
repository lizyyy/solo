const chalk = require('chalk');
const config = require('../config');

function execute(ruleId) {
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

  const severityColors = {
    critical: chalk.red.bold,
    high: chalk.red,
    medium: chalk.yellow,
    low: chalk.cyan,
    info: chalk.blue
  };

  const colorFn = severityColors[rule.severity] || severityColors.info;

  console.log(chalk.bold(`\n${'='.repeat(70)}`));
  console.log(chalk.bold(`规则详情: ${rule.name}`));
  console.log(chalk.bold(`${'='.repeat(70)}`));

  console.log(`\n${chalk.bold('规则 ID:')} ${rule.id}`);
  console.log(`${chalk.bold('规则名称:')} ${rule.name}`);
  console.log(`${chalk.bold('风险等级:')} ${colorFn(rule.severity.toUpperCase())}`);
  console.log(`${chalk.bold('分类:')} ${rule.category}`);
  console.log(`${chalk.bold('分值权重:')} ${config.getSeverityWeight(rule.severity)} 分`);

  console.log(`\n${chalk.bold('描述:')}`);
  console.log(`  ${rule.description}`);

  console.log(`\n${chalk.bold('修复建议:')}`);
  console.log(`  ${rule.fixSuggestion}`);

  console.log(`\n${chalk.bold('常见场景:')}`);
  const scenarios = getCommonScenarios(rule.id);
  for (const scenario of scenarios) {
    console.log(`  • ${scenario}`);
  }

  console.log(`\n${chalk.bold('允许漂移:')}`);
  console.log(`  此规则可以使用 "${chalk.yellow('allow-drift')}" 命令临时豁免`);
  console.log(`  示例: ${chalk.cyan(`scaffold-cli allow-drift <project-path> ${rule.id} --until 2027-06-30 --reason "技术债务，计划Q3修复"`)}`);

  console.log(`\n${chalk.bold('相关规则:')}`);
  const related = getRelatedRules(rule.id);
  for (const rel of related) {
    const relRule = config.getRuleDefinition(rel);
    if (relRule) {
      console.log(`  • ${chalk.yellow(rel)} - ${relRule.name}`);
    }
  }

  console.log('\n');
}

function getCommonScenarios(ruleId) {
  const scenariosMap = {
    'template-version': [
      '项目使用过时的模板版本',
      '项目未声明使用的模板版本',
      '模板已升级但项目未同步'
    ],
    'package-scripts': [
      '缺少 start、build、test 等标准脚本',
      '脚本命令与模板不一致',
      '自定义脚本替代了标准脚本'
    ],
    'dockerfile': [
      '使用了非标准基础镜像',
      '未使用非 root 用户运行',
      '工作目录与标准不一致'
    ],
    'healthcheck': [
      'Dockerfile 未配置 HEALTHCHECK',
      '健康检查路径不是 /health',
      '健康检查超时或间隔配置不合理'
    ],
    'logging': [
      '使用 console.log 而非结构化日志',
      '日志格式为文本而非 JSON',
      '日志输出到文件而非 stdout'
    ],
    'directory-structure': [
      '缺少 src/ 目录',
      '缺少 tests/ 目录',
      '使用了自定义目录结构'
    ],
    'required-files': [
      '缺少 Dockerfile',
      '缺少 package.json',
      '缺少配置文件'
    ],
    'dependency-version': [
      '依赖版本过旧存在安全风险',
      '缺少必需的标准依赖',
      '使用了已废弃的依赖包'
    ],
    'node-version': [
      'Node.js 版本要求过低',
      '未声明 Node.js 版本要求',
      '使用了已 EOL 的 Node.js 版本'
    ]
  };
  return scenariosMap[ruleId] || ['该规则检查配置与模板的一致性'];
}

function getRelatedRules(ruleId) {
  const relatedMap = {
    'template-version': ['package-scripts', 'node-version', 'dockerfile'],
    'package-scripts': ['template-version', 'node-version', 'dependency-version'],
    'dockerfile': ['healthcheck', 'template-version'],
    'healthcheck': ['dockerfile', 'logging'],
    'logging': ['dockerfile', 'dependency-version'],
    'directory-structure': ['required-files'],
    'required-files': ['directory-structure', 'dockerfile'],
    'dependency-version': ['package-scripts', 'node-version'],
    'node-version': ['template-version', 'dependency-version', 'dockerfile']
  };
  return relatedMap[ruleId] || [];
}

module.exports = { execute };
