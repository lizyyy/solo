'use strict';

const { program } = require('commander');
const chalk = require('chalk');
const { loadConfig, validateConfig } = require('./config');
const { scanLocaleDirectory } = require('./parsers');
const { runAllChecks } = require('./checkers');
const { writeReports } = require('./reporters');

const EXIT_CODES = {
  SUCCESS: 0,
  ERRORS_FOUND: 1,
  CONFIG_ERROR: 2,
  FILE_PARSE_ERROR: 3,
  RUNTIME_ERROR: 4
};

program
  .name('i18n-lint')
  .description('多语言文案质量检查 CLI 工具')
  .version('1.0.0', '-v, --version', '显示版本号')
  .option('-c, --config <path>', '配置文件路径')
  .option('-l, --locale-dir <path>', 'locale 目录路径')
  .option('-b, --base-lang <lang>', '基准语言 (默认: zh-CN)')
  .option('-o, --output-dir <path>', '输出报告目录')
  .option('-f, --formats <formats...>', '输出格式: console, json, markdown, html')
  .option('--no-console', '不输出到终端')
  .option('--strict', '严格模式：所有警告视为错误')
  .helpOption('-h, --help', '显示帮助信息');

program.addHelpText('after', `
示例:
  # 使用默认配置运行
  i18n-lint

  # 指定 locale 目录和基准语言
  i18n-lint -l ./locales -b en-US

  # 指定输出格式
  i18n-lint -f console json html

  # 使用配置文件
  i18n-lint -c ./i18n-lint.config.js

退出码:
  0 - 成功（无错误）
  1 - 发现错误
  2 - 配置错误
  3 - 文件解析错误
  4 - 运行时错误
`);

function mergeCliOptionsWithConfig(config, options) {
  const merged = { ...config };
  
  if (options.localeDir) {
    merged.localeDir = options.localeDir;
  }
  
  if (options.baseLang) {
    merged.baseLang = options.baseLang;
  }
  
  if (options.outputDir) {
    merged.outputDir = options.outputDir;
  }
  
  if (options.formats && options.formats.length > 0) {
    merged.formats = options.formats;
  } else if (options.console === false) {
    merged.formats = merged.formats.filter(f => f !== 'console');
  }
  
  if (options.strict) {
    merged.strict = true;
  }
  
  return merged;
}

async function main() {
  try {
    program.parse(process.argv);
    const options = program.opts();
    
    let config;
    try {
      config = loadConfig(options.config);
      config = mergeCliOptionsWithConfig(config, options);
      validateConfig(config);
    } catch (error) {
      console.error(chalk.red('配置错误:'));
      console.error(chalk.red(`  ${error.message}`));
      process.exit(EXIT_CODES.CONFIG_ERROR);
    }
    
    console.log(chalk.cyan('📂 正在扫描 locale 目录...'));
    console.log(chalk.gray(`   目录: ${config.localeDir}`));
    console.log(chalk.gray(`   基准语言: ${config.baseLang}`));
    console.log('');
    
    let languages;
    try {
      languages = scanLocaleDirectory(config.localeDir, config.fileTypes);
    } catch (error) {
      console.error(chalk.red('文件扫描错误:'));
      console.error(chalk.red(`  ${error.message}`));
      process.exit(EXIT_CODES.FILE_PARSE_ERROR);
    }
    
    const langList = Object.keys(languages);
    if (langList.length === 0) {
      console.error(chalk.yellow('⚠️  未找到任何翻译文件'));
      console.error(chalk.gray(`   支持的格式: ${config.fileTypes.join(', ')}`));
      process.exit(EXIT_CODES.SUCCESS);
    }
    
    console.log(chalk.green(`✓ 找到 ${langList.length} 种语言:`));
    for (const lang of langList) {
      const fileCount = languages[lang].files?.length || 0;
      const hasErrors = languages[lang].errors?.length > 0;
      const status = hasErrors ? chalk.red('(有解析错误)') : '';
      console.log(chalk.gray(`   - ${lang}: ${fileCount} 个文件 ${status}`));
    }
    console.log('');
    
    console.log(chalk.cyan('🔍 正在执行检查...'));
    console.log('');
    
    const result = runAllChecks(languages, config);
    
    if (config.strict && result.statistics.bySeverity.warning > 0) {
      result.statistics.bySeverity.error += result.statistics.bySeverity.warning;
      result.statistics.bySeverity.warning = 0;
      
      for (const issue of result.issues) {
        if (issue.severity === 'warning') {
          issue.severity = 'error';
          issue.message = '[严格模式] ' + issue.message;
        }
      }
    }
    
    console.log(chalk.cyan('📊 生成报告...'));
    console.log('');
    
    const exitCode = writeReports(result, config);
    
    if (exitCode === EXIT_CODES.SUCCESS) {
      console.log('');
      console.log(chalk.green('✅ 检查完成，未发现错误！'));
    } else {
      console.log('');
      const errorCount = result.statistics.bySeverity.error;
      const warningCount = result.statistics.bySeverity.warning;
      console.log(chalk.red(`❌ 检查完成，发现 ${errorCount} 个错误`));
      if (warningCount > 0) {
        console.log(chalk.yellow(`⚠️  另有 ${warningCount} 个警告`));
      }
    }
    
    process.exit(exitCode);
    
  } catch (error) {
    console.error('');
    console.error(chalk.red('❌ 运行时错误:'));
    console.error(chalk.red(`   ${error.message}`));
    
    if (process.env.DEBUG) {
      console.error('');
      console.error(chalk.gray('堆栈跟踪:'));
      console.error(chalk.gray(error.stack));
    }
    
    process.exit(EXIT_CODES.RUNTIME_ERROR);
  }
}

main();
