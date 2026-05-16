const chalk = require('chalk');
const path = require('path');
const { findAllFiles, analyzeLinks } = require('./linkChecker');
const { generateFixPreview, applyFixes, writeFixedFiles } = require('./fixer');
const { printTerminalSummary, exportReports } = require('./reporter');

async function runMigration(options) {
  console.log(chalk.blue('🔍 开始扫描 Markdown 文件...\n'));
  
  const files = await findAllFiles(options.input, options.pattern, options.exclude);
  
  if (files.length === 0) {
    console.log(chalk.yellow('⚠️  未找到任何 Markdown 文件\n'));
    return;
  }
  
  console.log(chalk.green(`✅ 找到 ${files.length} 个 Markdown 文件\n`));
  
  if (options.verbose) {
    files.forEach(file => {
      console.log(`   📄 ${path.relative(process.cwd(), file)}`);
    });
    console.log();
  }
  
  console.log(chalk.blue('🔗 分析链接和锚点...\n'));
  const analysis = await analyzeLinks(files);
  
  let fixPreview = null;
  let fixResults = null;
  let writtenFiles = null;
  
  if (options.fix) {
    console.log(chalk.blue('🔧 生成自动修复方案...\n'));
    fixPreview = generateFixPreview(analysis.brokenLinks);
    
    if (options.applyFix) {
      console.log(chalk.blue('✏️  应用自动修复...\n'));
      fixResults = applyFixes(fixPreview.filesToFix, analysis.parseResults);
    }
  }
  
  printTerminalSummary(analysis, fixPreview);
  
  console.log(chalk.blue('📤 导出报告...\n'));
  const reportOptions = {
    input: options.input,
    pattern: options.pattern,
    exclude: options.exclude,
    clean: options.clean !== false
  };
  const reports = exportReports(analysis, options.output, fixPreview, reportOptions);
  
  if (options.applyFix && fixResults) {
    writtenFiles = writeFixedFiles(fixResults, options.output);
    
    console.log(chalk.green(`✅ 已修复 ${writtenFiles.reduce((sum, f) => sum + f.successCount, 0)} 处链接`));
    if (writtenFiles.reduce((sum, f) => sum + f.failCount, 0) > 0) {
      console.log(chalk.yellow(`⚠️  ${writtenFiles.reduce((sum, f) => sum + f.failCount, 0)} 处修复失败`));
    }
    console.log();
  }
  
  if (writtenFiles && writtenFiles.length > 0) {
    console.log(chalk.bold('📁 修复后的文件:\n'));
    for (const file of writtenFiles) {
      const relativePath = path.relative(process.cwd(), file.fixed);
      console.log(`   📄 ${relativePath} (成功: ${file.successCount}, 失败: ${file.failCount})`);
    }
    console.log();
  }
  
  if (analysis.brokenLinks.length === 0 && analysis.unhandledLinks.length === 0) {
    console.log(chalk.green.bold('🎉 完美！未发现任何断链问题\n'));
  } else {
    console.log(chalk.yellow.bold(`⚠️  发现 ${analysis.brokenLinks.length} 个断链，${analysis.unhandledLinks.length} 个无法处理的链接\n`));
  }
  
  return {
    analysis,
    fixPreview,
    fixResults,
    writtenFiles,
    reports
  };
}

module.exports = {
  runMigration
};
