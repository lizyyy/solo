const path = require('path');
const chalk = require('chalk');
const TemplateLoader = require('../template-loader');
const config = require('../config');

function execute(templateA, templateB, options) {
  const templateLoader = new TemplateLoader(options.templateDir);

  console.log(chalk.bold(`\n${'='.repeat(70)}`));
  console.log(chalk.bold(`模板版本比较`));
  console.log(chalk.bold(`${'='.repeat(70)}`));

  let template1, template2;

  try {
    template1 = templateLoader.loadTemplate(templateA);
    console.log(`\n${chalk.bold('模板 A:')} ${templateA}`);
    console.log(`  名称: ${template1.name} v${template1.version}`);
  } catch (e) {
    console.log(chalk.red(`\n错误: 无法加载模板 ${templateA}`));
    console.log(`  ${e.message}`);
    process.exit(1);
  }

  try {
    template2 = templateLoader.loadTemplate(templateB);
    console.log(`${chalk.bold('模板 B:')} ${templateB}`);
    console.log(`  名称: ${template2.name} v${template2.version}`);
  } catch (e) {
    console.log(chalk.red(`\n错误: 无法加载模板 ${templateB}`));
    console.log(`  ${e.message}`);
    process.exit(1);
  }

  const comparison = compareTemplates(template1, template2, templateA, templateB);

  console.log(`\n${chalk.bold(`\n${'-'.repeat(70)}`)}`);
  console.log(chalk.bold('差异汇总'));
  console.log(chalk.bold(`${'-'.repeat(70)}`));

  const allDiffs = comparison.differences;
  if (allDiffs.length === 0) {
    console.log(chalk.green(`\n✓ 两个模板完全一致`));
    return;
  }

  const categoryStats = {};
  for (const diff of allDiffs) {
    categoryStats[diff.category] = (categoryStats[diff.category] || 0);
    categoryStats[diff.category]++;
  }

  console.log(`\n${chalk.bold('差异统计:')}`);
  for (const [category, count] of Object.entries(categoryStats)) {
    console.log(`  ${category}: ${count} 处差异`);
  }

  const criticalChanges = allDiffs.filter(d => d.impact === 'critical');
  const highChanges = allDiffs.filter(d => d.impact === 'high');
  const mediumChanges = allDiffs.filter(d => d.impact === 'medium');
  const lowChanges = allDiffs.filter(d => d.impact === 'low');

  if (criticalChanges.length > 0) {
    console.log(`\n${chalk.red.bold('重大变更 (CRITICAL):')}`);
    for (const diff of criticalChanges) {
      printDiff(diff);
    }
  }

  if (highChanges.length > 0) {
    console.log(`\n${chalk.red.bold('重要变更 (HIGH):')}`);
    for (const diff of highChanges) {
      printDiff(diff);
    }
  }

  if (mediumChanges.length > 0) {
    console.log(`\n${chalk.yellow.bold('中等变更 (MEDIUM):')}`);
    for (const diff of mediumChanges) {
      printDiff(diff);
    }
  }

  if (lowChanges.length > 0) {
    console.log(`\n${chalk.cyan.bold('轻微变更 (LOW):')}`);
    for (const diff of lowChanges) {
      printDiff(diff);
    }
  }

  console.log(`\n${chalk.bold(`\n${'-'.repeat(70)}`)}`);
  console.log(chalk.bold('升级影响评估'));
  console.log(chalk.bold(`${'-'.repeat(70)}`));

  const riskScore = (criticalChanges.length * 100) + (highChanges.length * 50) + (mediumChanges.length * 20) + (lowChanges.length * 5);
  const totalChanges = allDiffs.length;
  const breakingChanges = criticalChanges.length + highChanges.length;

  console.log(`\n${chalk.bold('总变更数:')} ${totalChanges}`);
  console.log(`${chalk.bold('破坏性变更:')} ${breakingChanges}`);
  console.log(`${chalk.bold('风险评分:')} ${riskScore}`);

  if (riskScore >= 200) {
    console.log(`${chalk.bold('升级风险:')} ${chalk.red('高风险 - 需要详细评估，建议逐步迁移')}`);
  } else if (riskScore >= 100) {
    console.log(`${chalk.bold('升级风险:')} ${chalk.yellow('中风险 - 需要测试验证')}`);
  } else {
    console.log(`${chalk.bold('升级风险:')} ${chalk.green('低风险 - 可以直接升级')}`);
  }

  console.log(`\n${chalk.bold('建议:')}`);
  if (breakingChanges > 0) {
    console.log(`  • 先在测试环境验证迁移`);
    console.log(`  • 准备回滚方案`);
    console.log(`  • 安排充分的测试时间`);
  }
  console.log(`  • 参考详细差异列表制定迁移计划`);
  console.log('\n');
}

function compareTemplates(t1, t2, path1, path2) {
  const differences = [];

  if (t1.version !== t2.version) {
    differences.push({
      category: '版本',
      field: 'version',
      path1: t1.version,
      path2: t2.version,
      impact: 'medium',
      description: '模板版本不同'
    });
  }

  if (t1.name !== t2.name) {
    differences.push({
      category: '基本信息',
      field: 'name',
      path1: t1.name,
      path2: t2.name,
      impact: 'low',
      description: '模板名称不同'
    });
  }

  if (t1.type !== t2.type) {
    differences.push({
      category: '基本信息',
      field: 'type',
      path1: t1.type,
      path2: t2.type,
      impact: 'medium',
      description: '服务类型不同'
    });
  }

  const pkg1 = t1.packageJson || {};
  const pkg2 = t2.packageJson || {};

  const scripts1 = pkg1.scripts || {};
  const scripts2 = pkg2.scripts || {};
  const allScriptKeys = new Set([...Object.keys(scripts1), ...Object.keys(scripts2)]);

  for (const key of allScriptKeys) {
    if (!(key in scripts1)) {
      differences.push({
        category: 'package.scripts',
        field: `scripts.${key}`,
        path1: null,
        path2: scripts2[key],
        impact: 'high',
        description: `新增脚本 ${key}`
      });
    } else if (!(key in scripts2)) {
      differences.push({
        category: 'package.scripts',
        field: `scripts.${key}`,
        path1: scripts1[key],
        path2: null,
        impact: 'high',
        description: `移除脚本 ${key}`
      });
    } else if (scripts1[key] !== scripts2[key]) {
      differences.push({
        category: 'package.scripts',
        field: `scripts.${key}`,
        path1: scripts1[key],
        path2: scripts2[key],
        impact: 'medium',
        description: `脚本 ${key} 变更`
      });
    }
  }

  const engines1 = pkg1.engines || {};
  const engines2 = pkg2.engines || {};
  if (engines1.node !== engines2.node) {
    differences.push({
      category: 'package.engines',
      field: 'engines.node',
      path1: engines1.node,
      path2: engines2.node,
      impact: 'critical',
      description: 'Node.js 版本要求变更'
    });
  }

  const deps1 = { ...(pkg1.dependencies || {}), ...(pkg1.devDependencies || {}) };
  const deps2 = { ...(pkg2.dependencies || {}), ...(pkg2.devDependencies || {}) };
  const allDeps = new Set([...Object.keys(deps1), ...Object.keys(deps2)]);

  for (const dep of allDeps) {
    if (!(dep in deps1)) {
      differences.push({
        category: '依赖',
        field: `dependency.${dep}`,
        path1: null,
        path2: deps2[dep],
        impact: 'medium',
        description: `新增依赖 ${dep}`
      });
    } else if (!(dep in deps2)) {
      differences.push({
        category: '依赖',
        field: `dependency.${dep}`,
        path1: deps1[dep],
        path2: null,
        impact: 'high',
        description: `移除依赖 ${dep}`
      });
    } else if (deps1[dep] !== deps2[dep]) {
      differences.push({
        category: '依赖',
        field: `dependency.${dep}`,
        path1: deps1[dep],
        path2: deps2[dep],
        impact: 'low',
        description: `依赖版本变更 ${dep}`
      });
    }
  }

  const docker1 = t1.dockerfile || {};
  const docker2 = t2.dockerfile || {};

  if (docker1.baseImage !== docker2.baseImage) {
    differences.push({
      category: 'Dockerfile',
      field: 'dockerfile.baseImage',
      path1: docker1.baseImage,
      path2: docker2.baseImage,
      impact: 'critical',
      description: '基础镜像变更'
    });
  }

  if (docker1.user !== docker2.user) {
    differences.push({
      category: 'Dockerfile',
      field: 'dockerfile.user',
      path1: docker1.user,
      path2: docker2.user,
      impact: 'high',
      description: '运行用户变更'
    });
  }

  if (docker1.workdir !== docker2.workdir) {
    differences.push({
      category: 'Dockerfile',
      field: 'dockerfile.workdir',
      path1: docker1.workdir,
      path2: docker2.workdir,
      impact: 'medium',
      description: '工作目录变更'
    });
  }

  if (docker1.exposePort !== docker2.exposePort) {
    differences.push({
      category: 'Dockerfile',
      field: 'dockerfile.exposePort',
      path1: docker1.exposePort,
      path2: docker2.exposePort,
      impact: 'high',
      description: '暴露端口变更'
    });
  }

  const hc1 = t1.healthcheck?.http || {};
  const hc2 = t2.healthcheck?.http || {};

  if (hc1.path !== hc2.path) {
    differences.push({
      category: '健康检查',
      field: 'healthcheck.path',
      path1: hc1.path,
      path2: hc2.path,
      impact: 'critical',
      description: '健康检查路径变更'
    });
  }

  if (hc1.method !== hc2.method) {
    differences.push({
      category: '健康检查',
      field: 'healthcheck.method',
      path1: hc1.method,
      path2: hc2.method,
      impact: 'medium',
      description: '健康检查方法变更'
    });
  }

  const log1 = t1.logging || {};
  const log2 = t2.logging || {};

  if (log1.format !== log2.format) {
    differences.push({
      category: '日志',
      field: 'logging.format',
      path1: log1.format,
      path2: log2.format,
      impact: 'medium',
      description: '日志格式变更'
    });
  }

  if (log1.level !== log2.level) {
    differences.push({
      category: '日志',
      field: 'logging.level',
      path1: log1.level,
      path2: log2.level,
      impact: 'low',
      description: '日志级别变更'
    });
  }

  if (log1.destination !== log2.destination) {
    differences.push({
      category: '日志',
      field: 'logging.destination',
      path1: log1.destination,
      path2: log2.destination,
      impact: 'medium',
      description: '日志输出目标变更'
    });
  }

  const dirs1 = new Set(t1.directoryStructure || []);
  const dirs2 = new Set(t2.directoryStructure || []);
  const allDirs = new Set([...dirs1, ...dirs2]);

  for (const dir of allDirs) {
    if (!dirs1.has(dir)) {
      differences.push({
        category: '目录结构',
        field: `directory.${dir}`,
        path1: null,
        path2: dir,
        impact: 'low',
        description: `新增目录 ${dir}`
      });
    } else if (!dirs2.has(dir)) {
      differences.push({
        category: '目录结构',
        field: `directory.${dir}`,
        path1: dir,
        path2: null,
        impact: 'low',
        description: `移除目录 ${dir}`
      });
    }
  }

  const files1 = new Set(t1.requiredFiles || []);
  const files2 = new Set(t2.requiredFiles || []);
  const allFiles = new Set([...files1, ...files2]);

  for (const file of allFiles) {
    if (!files1.has(file)) {
      differences.push({
        category: '必需文件',
        field: `file.${file}`,
        path1: null,
        path2: file,
        impact: 'medium',
        description: `新增必需文件 ${file}`
      });
    } else if (!files2.has(file)) {
      differences.push({
        category: '必需文件',
        field: `file.${file}`,
        path1: file,
        path2: null,
        impact: 'medium',
        description: `移除必需文件 ${file}`
      });
    }
  }

  return {
    templateA: { path: path1, version: t1.version },
    templateB: { path: path2, version: t2.version },
    differences
  };
}

function printDiff(diff) {
  const impactColors = {
    critical: chalk.red,
    high: chalk.red,
    medium: chalk.yellow,
    low: chalk.cyan
  };

  const color = impactColors[diff.impact] || chalk.white;

  console.log(`\n  ${color(`[${diff.impact.toUpperCase()}] ${diff.description}`)}`);
  console.log(`    ${chalk.bold('字段:')} ${diff.field}`);

  if (diff.path1 === null) {
    console.log(`    ${chalk.green('新增:')} ${diff.path2}`);
  } else if (diff.path2 === null) {
    console.log(`    ${chalk.red('移除:')} ${diff.path1}`);
  } else {
    console.log(`    ${chalk.cyan('模板A:')} ${diff.path1}`);
    console.log(`    ${chalk.green('模板B:')} ${diff.path2}`);
  }
}

module.exports = { execute };
