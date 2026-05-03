#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { program } = require('commander');
const chalk = require('chalk');

const { ValidationError, formatError } = require('./utils');
const PhotoScanner = require('./scanner');
const { ManifestReader, SelectionsReader, DEFAULT_MANIFEST } = require('./reader');
const { PhotoValidator, ISSUE_SEVERITY } = require('./validator');
const Reporter = require('./reporter');
const PhotoPackager = require('./packager');

const packageJson = require('../package.json');

const SEVERITY_COLORS = {
  critical: chalk.red,
  high: chalk.yellow,
  medium: chalk.blue,
  low: chalk.gray
};

const SEVERITY_ICONS = {
  critical: '🔴',
  high: '🟠',
  medium: '🟡',
  low: '🟢'
};

function printHeader() {
  console.log(chalk.bold.cyan(`\n📷 照片交付包校验工具 v${packageJson.version}`));
  console.log(chalk.gray('----------------------------------------\n'));
}

function printError(error) {
  const formatted = formatError(error);
  console.error(chalk.red.bold('\n❌ 错误:'));
  console.error(chalk.red(formatted.error.message));
  
  if (formatted.error.code) {
    console.error(chalk.gray(`   错误码: ${formatted.error.code}`));
  }
  
  if (formatted.error.details && Object.keys(formatted.error.details).length > 0) {
    console.error(chalk.gray('\n   详细信息:'));
    for (const [key, value] of Object.entries(formatted.error.details)) {
      if (Array.isArray(value)) {
        console.error(chalk.gray(`      ${key}: ${value.join(', ')}`));
      } else if (typeof value === 'object') {
        console.error(chalk.gray(`      ${key}: ${JSON.stringify(value)}`));
      } else {
        console.error(chalk.gray(`      ${key}: ${value}`));
      }
    }
  }
  
  console.error('');
  process.exit(1);
}

function printSummary(summary) {
  console.log(chalk.bold('📊 校验摘要'));
  console.log(chalk.gray('----------------------------------------'));
  
  const statusColor = summary.success ? chalk.green : chalk.yellow;
  const statusIcon = summary.success ? '✅' : '⚠️';
  
  console.log(`\n   📸 扫描到的照片: ${chalk.cyan(summary.totalPhotos)}`);
  console.log(`   📋 选片表中的照片: ${chalk.cyan(summary.totalSelections)}`);
  console.log(`   ❌ 发现的问题: ${chalk.cyan(summary.totalIssues)}`);
  console.log(`\n   ${SEVERITY_ICONS.critical} 严重问题: ${SEVERITY_COLORS.critical(summary.severityCounts.critical)}`);
  console.log(`   ${SEVERITY_ICONS.high} 高优先级问题: ${SEVERITY_COLORS.high(summary.severityCounts.high)}`);
  console.log(`   ${SEVERITY_ICONS.medium} 中优先级问题: ${SEVERITY_COLORS.medium(summary.severityCounts.medium)}`);
  console.log(`   ${SEVERITY_ICONS.low} 低优先级问题: ${SEVERITY_COLORS.low(summary.severityCounts.low)}`);
  
  console.log(`\n   总体状态: ${statusColor(statusIcon + (summary.success ? ' 校验通过' : ' 存在问题'))}`);
  console.log('');
}

function printIssues(issues, options = {}) {
  const { maxIssues = 20 } = options;
  
  if (issues.length === 0) {
    console.log(chalk.green('\n🎉 太棒了！没有发现任何问题！'));
    console.log(chalk.gray('   所有照片都符合交付要求。\n'));
    return;
  }
  
  const groupedBySeverity = {};
  for (const issue of issues) {
    if (!groupedBySeverity[issue.severity]) {
      groupedBySeverity[issue.severity] = [];
    }
    groupedBySeverity[issue.severity].push(issue);
  }
  
  const severityOrder = ['critical', 'high', 'medium', 'low'];
  
  for (const severity of severityOrder) {
    const severityIssues = groupedBySeverity[severity];
    if (!severityIssues || severityIssues.length === 0) continue;
    
    const color = SEVERITY_COLORS[severity];
    const icon = SEVERITY_ICONS[severity];
    const severityName = {
      critical: '严重',
      high: '高优先级',
      medium: '中优先级',
      low: '低优先级'
    }[severity];
    
    console.log(color(`\n${icon} ${severityName}问题 (${severityIssues.length}个)`));
    console.log(color('----------------------------------------'));
    
    const issuesToShow = severityIssues.slice(0, maxIssues);
    const hiddenCount = severityIssues.length - issuesToShow.length;
    
    for (const issue of issuesToShow) {
      console.log(`\n   ${chalk.bold(issue.message)}`);
      
      if (issue.photoNumber) {
        console.log(`   ${chalk.gray('照片编号:')} ${issue.photoNumber}`);
      }
      if (issue.photoTypeName) {
        console.log(`   ${chalk.gray('照片类型:')} ${issue.photoTypeName}`);
      }
      
      console.log(`   ${chalk.gray('规则:')} ${issue.rule}`);
      console.log(`   ${chalk.gray('建议:')} ${chalk.green(issue.suggestion)}`);
      
      if (issue.files && issue.files.length > 0) {
        console.log(`   ${chalk.gray('涉及文件:')}`);
        for (const file of issue.files.slice(0, 5)) {
          const versionInfo = file.version ? ` (v${file.version})` : '';
          console.log(`      ${chalk.gray('-')} ${file.relativePath || file.fileName}${versionInfo}`);
        }
        if (issue.files.length > 5) {
          console.log(`      ${chalk.gray(`... 还有 ${issue.files.length - 5} 个文件`)}`);
        }
      }
    }
    
    if (hiddenCount > 0) {
      console.log(chalk.gray(`\n   ... 还有 ${hiddenCount} 个问题未显示，请查看详细报告`));
    }
  }
  
  console.log('');
}

function printPreview(previewResult) {
  console.log(chalk.bold('\n📦 打包预演'));
  console.log(chalk.gray('----------------------------------------'));
  
  console.log(`\n   总计将处理: ${chalk.cyan(previewResult.totalPlans)} 个文件`);
  console.log(`   涉及照片编号: ${chalk.cyan(previewResult.summary.uniqueNumbers)} 个`);
  console.log(`   预计大小: ${chalk.cyan(previewResult.summary.estimatedSizeFormatted)}`);
  
  if (Object.keys(previewResult.summary.byType).length > 0) {
    console.log('\n   按类型分类:');
    for (const [type, info] of Object.entries(previewResult.summary.byType)) {
      console.log(`      - ${info.name}: ${info.count} 个文件`);
    }
  }
  
  if (previewResult.warnings && previewResult.warnings.length > 0) {
    console.log(chalk.yellow('\n⚠️ 警告:'));
    for (const warning of previewResult.warnings) {
      const color = warning.severity === ISSUE_SEVERITY.CRITICAL ? chalk.red : chalk.yellow;
      console.log(color(`   - ${warning.message}`));
    }
  }
  
  if (previewResult.plans.length > 0) {
    console.log(chalk.gray('\n   前10个文件预览:'));
    const previewPlans = previewResult.plans.slice(0, 10);
    
    for (const plan of previewPlans) {
      const sourceFile = plan.source.relativePath || plan.source.fileName;
      const targetDir = plan.target.relativeDir || '.';
      const targetFile = plan.target.fileName;
      
      console.log(`\n      ${chalk.gray('源:')} ${sourceFile}`);
      console.log(`      ${chalk.gray('目标:')} ${targetDir}/${targetFile}`);
      console.log(`      ${chalk.gray('类型:')} ${plan.photoTypeName}`);
      if (plan.version) {
        console.log(`      ${chalk.gray('版本:')} v${plan.version}${plan.isLatest ? ' (最新)' : ''}`);
      }
    }
    
    if (previewResult.plans.length > 10) {
      console.log(chalk.gray(`\n   ... 还有 ${previewResult.plans.length - 10} 个文件`));
    }
  }
  
  console.log('');
}

function printExecuteResult(result) {
  console.log(chalk.bold('\n✅ 打包执行结果'));
  console.log(chalk.gray('----------------------------------------'));
  
  if (result.success) {
    console.log(chalk.green('\n   打包成功完成！'));
  } else {
    console.log(chalk.red('\n   打包过程中有部分失败'));
  }
  
  console.log(`\n   成功复制: ${chalk.green(result.totalProcessed)} 个文件`);
  console.log(`   跳过(已存在): ${chalk.yellow(result.totalSkipped)} 个文件`);
  console.log(`   失败: ${chalk.red(result.totalFailed)} 个文件`);
  
  if (result.manifestPath) {
    console.log(`\n   清单文件: ${chalk.cyan(result.manifestPath)}`);
  }
  
  if (result.failedFiles && result.failedFiles.length > 0) {
    console.log(chalk.red('\n   失败的文件:'));
    for (const failed of result.failedFiles.slice(0, 10)) {
      console.log(`      - ${failed.source.fileName}: ${failed.error}`);
    }
    if (result.failedFiles.length > 10) {
      console.log(`      ${chalk.red(`... 还有 ${result.failedFiles.length - 10} 个失败文件`)}`);
    }
  }
  
  console.log('');
}

async function runCheck(options) {
  printHeader();
  
  const { manifest, selections, directory, report, format = ['json'], output } = options;
  
  let manifestConfig = DEFAULT_MANIFEST;
  
  if (manifest) {
    console.log(chalk.gray(`📋 读取配置文件: ${manifest}`));
    const manifestReader = new ManifestReader();
    try {
      manifestConfig = manifestReader.read(manifest);
    } catch (error) {
      printError(error);
    }
  }
  
  let selectionsData = [];
  if (selections) {
    console.log(chalk.gray(`📋 读取选片表: ${selections}`));
    const selectionsReader = new SelectionsReader();
    try {
      selectionsData = selectionsReader.readSync(selections);
      console.log(chalk.gray(`   共 ${selectionsData.length} 张选片`));
    } catch (error) {
      printError(error);
    }
  }
  
  console.log(chalk.gray(`\n📂 扫描目录: ${directory}`));
  const scanner = new PhotoScanner();
  let photos = [];
  
  try {
    photos = scanner.scan(directory);
    console.log(chalk.gray(`   共扫描到 ${photos.length} 张照片`));
  } catch (error) {
    printError(error);
  }
  
  console.log(chalk.gray('\n🔍 进行校验...'));
  const validator = new PhotoValidator(manifestConfig);
  
  const validationResult = validator.validate(photos, selectionsData);
  
  printSummary(validationResult.summary);
  
  if (validationResult.allIssues.length > 0) {
    printIssues(validationResult.allIssues);
  }
  
  if (report) {
    const reporter = new Reporter();
    const outputPath = output || path.join(process.cwd(), 'validation_report');
    
    for (const fmt of format) {
      try {
        const exportedPath = reporter.exportReport(validationResult, outputPath, fmt);
        console.log(chalk.green(`📄 报告已导出: ${exportedPath}`));
      } catch (error) {
        console.error(chalk.red(`❌ 导出报告失败 (${fmt}): ${error.message}`));
      }
    }
  }
  
  if (!validationResult.success) {
    process.exit(1);
  }
}

async function runPreview(options) {
  printHeader();
  
  const { manifest, selections, directory, output } = options;
  
  let manifestConfig = DEFAULT_MANIFEST;
  
  if (manifest) {
    console.log(chalk.gray(`📋 读取配置文件: ${manifest}`));
    const manifestReader = new ManifestReader();
    try {
      manifestConfig = manifestReader.read(manifest);
    } catch (error) {
      printError(error);
    }
  }
  
  let selectionsData = [];
  if (selections) {
    console.log(chalk.gray(`📋 读取选片表: ${selections}`));
    const selectionsReader = new SelectionsReader();
    try {
      selectionsData = selectionsReader.readSync(selections);
    } catch (error) {
      printError(error);
    }
  }
  
  console.log(chalk.gray(`📂 扫描目录: ${directory}`));
  const scanner = new PhotoScanner();
  let photos = [];
  
  try {
    photos = scanner.scan(directory);
  } catch (error) {
    printError(error);
  }
  
  console.log(chalk.gray('🔍 进行校验...'));
  const validator = new PhotoValidator(manifestConfig);
  const validationResult = validator.validate(photos, selectionsData);
  
  console.log(chalk.gray('📦 生成打包计划...'));
  const packager = new PhotoPackager(manifestConfig);
  
  try {
    const previewResult = packager.preview(photos, selectionsData, validationResult);
    printPreview(previewResult);
    
    if (output) {
      const outputPath = output.endsWith('.json') ? output : path.join(output, 'preview_plan.json');
      const outputDir = path.dirname(outputPath);
      
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      fs.writeFileSync(outputPath, JSON.stringify(previewResult, null, 2), 'utf-8');
      console.log(chalk.green(`📄 预演计划已保存: ${outputPath}`));
    }
    
    if (!previewResult.success) {
      console.log(chalk.yellow('⚠️  注意: 存在警告，执行打包时需要使用 --confirm 选项确认'));
    }
  } catch (error) {
    printError(error);
  }
}

async function runPackage(options) {
  printHeader();
  
  const { manifest, selections, directory, output, confirm, overwrite } = options;
  
  let manifestConfig = DEFAULT_MANIFEST;
  
  if (manifest) {
    console.log(chalk.gray(`📋 读取配置文件: ${manifest}`));
    const manifestReader = new ManifestReader();
    try {
      manifestConfig = manifestReader.read(manifest);
    } catch (error) {
      printError(error);
    }
  }
  
  let selectionsData = [];
  if (selections) {
    console.log(chalk.gray(`📋 读取选片表: ${selections}`));
    const selectionsReader = new SelectionsReader();
    try {
      selectionsData = selectionsReader.readSync(selections);
    } catch (error) {
      printError(error);
    }
  }
  
  console.log(chalk.gray(`📂 扫描目录: ${directory}`));
  const scanner = new PhotoScanner();
  let photos = [];
  
  try {
    photos = scanner.scan(directory);
  } catch (error) {
    printError(error);
  }
  
  console.log(chalk.gray('🔍 进行校验...'));
  const validator = new PhotoValidator(manifestConfig);
  const validationResult = validator.validate(photos, selectionsData);
  
  console.log(chalk.gray('📦 生成打包计划...'));
  const packager = new PhotoPackager(manifestConfig);
  
  try {
    const previewResult = packager.preview(photos, selectionsData, validationResult);
    printPreview(previewResult);
    
    const outputDir = output || path.join(process.cwd(), 'delivery_package');
    
    console.log(chalk.yellow(`\n⚠️  即将执行打包操作...`));
    console.log(chalk.gray(`   输出目录: ${outputDir}`));
    
    console.log(chalk.gray('\n⏳ 执行打包...'));
    const result = packager.execute(previewResult, outputDir, {
      confirm,
      overwrite
    });
    
    printExecuteResult(result);
    
    if (!result.success) {
      process.exit(1);
    }
  } catch (error) {
    printError(error);
  }
}

async function runGenerate(options) {
  printHeader();
  
  const { type, output } = options;
  const outputDir = output || process.cwd();
  
  if (type === 'manifest' || type === 'all') {
    const manifestPath = path.join(outputDir, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(DEFAULT_MANIFEST, null, 2), 'utf-8');
    console.log(chalk.green(`✅ 已生成示例配置文件: ${manifestPath}`));
  }
  
  if (type === 'selections' || type === 'all') {
    const selectionsPath = path.join(outputDir, 'selections.csv');
    const csvContent = `照片编号,类型,备注
1234,精修,客户指定
1235,精修,需要调整色调
1236,原片,
1237,精修,九宫格
1238,精修,`;
    fs.writeFileSync(selectionsPath, csvContent, 'utf-8');
    console.log(chalk.green(`✅ 已生成示例选片表: ${selectionsPath}`));
  }
  
  console.log(chalk.gray('\n💡 提示:'));
  console.log(chalk.gray('   你可以根据实际情况修改这些示例文件。'));
  console.log(chalk.gray('   使用 photo-check check 命令开始校验你的照片。\n'));
}

program
  .name('photo-check')
  .description('旅拍照片交付包校验和整理工具')
  .version(packageJson.version);

program
  .command('check')
  .description('校验照片交付包')
  .requiredOption('-d, --directory <path>', '要扫描的照片目录')
  .option('-m, --manifest <path>', 'manifest.json 配置文件路径')
  .option('-s, --selections <path>', 'selections.csv 选片表路径')
  .option('-r, --report', '生成报告')
  .option('-f, --format <formats...>', '报告格式: json, markdown, html (默认: json)', ['json'])
  .option('-o, --output <path>', '报告输出路径')
  .action(runCheck);

program
  .command('preview')
  .description('预览打包计划')
  .requiredOption('-d, --directory <path>', '要扫描的照片目录')
  .option('-m, --manifest <path>', 'manifest.json 配置文件路径')
  .option('-s, --selections <path>', 'selections.csv 选片表路径')
  .option('-o, --output <path>', '保存预演计划的路径')
  .action(runPreview);

program
  .command('package')
  .description('执行打包操作')
  .requiredOption('-d, --directory <path>', '要扫描的照片目录')
  .option('-m, --manifest <path>', 'manifest.json 配置文件路径')
  .option('-s, --selections <path>', 'selections.csv 选片表路径')
  .option('-o, --output <path>', '输出目录 (默认: delivery_package)')
  .option('--confirm', '确认执行，即使存在警告')
  .option('--overwrite', '覆盖已存在的文件')
  .action(runPackage);

program
  .command('generate')
  .description('生成示例配置文件')
  .option('-t, --type <type>', '生成类型: manifest, selections, all (默认: all)', 'all')
  .option('-o, --output <path>', '输出目录')
  .action(runGenerate);

program.on('command:*', function() {
  console.error(chalk.red(`\n❌ 无效的命令: ${program.args.join(' ')}`));
  console.error(chalk.gray('请使用 --help 查看可用命令。\n'));
  process.exit(1);
});

program.parseAsync(process.argv)
  .catch(error => {
    printError(error);
  });
