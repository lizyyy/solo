#!/usr/bin/env node

const { Command } = require('commander');
const XLSX = require('xlsx');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs');
const ReferenceValidator = require('./reference-validator');
const ReportGenerator = require('./report-generator');

const program = new Command();

program
  .name('excel-formula-linter')
  .description('Excel 公式引用检查工具 - 检测跨工作表引用错误')
  .version('1.0.0');

program
  .command('check', { isDefault: true })
  .description('检查 Excel 文件中的公式引用')
  .argument('<files...>', '要检查的 Excel 文件路径，支持 glob 模式')
  .option('-o, --output <dir>', '报告输出目录', './reports')
  .option('-n, --name <name>', '报告文件名前缀', 'formula-check')
  .option('--no-console', '不输出终端摘要')
  .option('--no-json', '不生成 JSON 报告')
  .option('--no-html', '不生成 HTML 报告')
  .option('--no-csv', '不生成 CSV 报告')
  .option('--strict', '严格模式，将警告视为错误')
  .action(async (files, options) => {
    console.log(chalk.bold.blue('🚀 Excel 公式引用检查工具启动'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    let totalErrors = 0;
    const processedFiles = [];

    for (const filePattern of files) {
      const matchedFiles = resolveFilePattern(filePattern);
      
      if (matchedFiles.length === 0) {
        console.log(chalk.yellow(`⚠️  未找到匹配的文件: ${filePattern}`));
        continue;
      }

      for (const filePath of matchedFiles) {
        if (!isExcelFile(filePath)) {
          console.log(chalk.yellow(`⚠️  跳过非 Excel 文件: ${filePath}`));
          continue;
        }

        console.log(chalk.cyan(`📂 处理文件: ${path.basename(filePath)}`));
        
        try {
          const result = processFile(filePath, options, timestamp);
          processedFiles.push(result);
          totalErrors += result.errors.length;
          console.log(chalk.gray(`   ✓ 完成，发现 ${result.errors.length} 个错误`));
        } catch (error) {
          console.log(chalk.red(`   ✗ 处理失败: ${error.message}`));
        }
        console.log();
      }
    }

    if (processedFiles.length > 0) {
      console.log(chalk.bold('📋 处理汇总'));
      console.log(chalk.gray('─'.repeat(30)));
      console.log(`  处理文件数: ${processedFiles.length}`);
      console.log(`  总错误数:   ${totalErrors}`);
      console.log();

      if (options.strict && totalErrors > 0) {
        process.exit(1);
      }
    } else {
      console.log(chalk.yellow('⚠️  未处理任何文件'));
    }
  });

function resolveFilePattern(pattern) {
  if (pattern.includes('*') || pattern.includes('?')) {
    const glob = require('glob');
    return glob.sync(pattern, { absolute: true });
  }
  
  const absolutePath = path.resolve(pattern);
  if (fs.existsSync(absolutePath)) {
    if (fs.statSync(absolutePath).isDirectory()) {
      return fs.readdirSync(absolutePath)
        .filter(f => isExcelFile(f))
        .map(f => path.join(absolutePath, f));
    }
    return [absolutePath];
  }
  
  return [];
}

function isExcelFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ['.xlsx', '.xls', '.xlsm', '.xlsb'].includes(ext);
}

function processFile(filePath, options, timestamp) {
  const workbook = XLSX.readFile(filePath, {
    cellFormula: true,
    cellNF: false
  });

  const validator = new ReferenceValidator(workbook);
  const results = validator.validateWorkbook();

  results.file = {
    path: filePath,
    name: path.basename(filePath),
    size: fs.statSync(filePath).size,
    checkedAt: new Date().toISOString()
  };

  const reportGen = new ReportGenerator(results, {
    outputDir: options.output,
    timestamp: `${timestamp}-${path.basename(filePath, path.extname(filePath))}`,
    filename: options.name
  });

  if (options.console !== false) {
    reportGen.generateConsoleSummary();
  }

  if (options.json !== false) {
    reportGen.generateJsonReport();
  }
  if (options.html !== false) {
    reportGen.generateHtmlReport();
  }
  if (options.csv !== false) {
    reportGen.generateCsvReport();
  }

  return {
    filePath,
    errors: results.errors,
    summary: results.summary
  };
}

program
  .command('list')
  .description('列出 Excel 文件中的所有公式和引用')
  .argument('<file>', 'Excel 文件路径')
  .action((file) => {
    const filePath = path.resolve(file);
    if (!fs.existsSync(filePath)) {
      console.log(chalk.red(`❌ 文件不存在: ${filePath}`));
      process.exit(1);
    }

    const workbook = XLSX.readFile(filePath, { cellFormula: true });
    const sheetNames = workbook.SheetNames;

    console.log(chalk.bold.blue(`📊 Excel 文件公式列表: ${path.basename(filePath)}`));
    console.log();

    for (const sheetName of sheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const formulas = [];

      for (const cellAddr of Object.keys(sheet)) {
        if (cellAddr.startsWith('!')) continue;
        const cell = sheet[cellAddr];
        if (cell.f) {
          formulas.push({ addr: cellAddr, formula: cell.f });
        }
      }

      if (formulas.length > 0) {
        console.log(chalk.bold(`📑 ${sheetName} (${formulas.length} 个公式)`));
        console.log(chalk.gray('─'.repeat(60)));
        formulas.slice(0, 15).forEach(f => {
          console.log(`  ${f.addr.padEnd(8)}: ${f.formula}`);
        });
        if (formulas.length > 15) {
          console.log(chalk.gray(`  ... 还有 ${formulas.length - 15} 个公式`));
        }
        console.log();
      }
    }
  });

program
  .command('error-types')
  .description('列出所有支持的错误类型')
  .action(() => {
    console.log(chalk.bold.blue('📋 支持的错误类型'));
    console.log();
    for (const [key, value] of Object.entries(ReferenceValidator.ERROR_TYPES)) {
      console.log(`  ${chalk.cyan(key)}`);
    }
    console.log();
  });

program.parse();
