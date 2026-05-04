#!/usr/bin/env node

const { program } = require('commander');
const path = require('path');
const { runReconciliation, exportReports, printSummary } = require('./index');

// 从package.json读取版本
const pkg = require('../package.json');

program
  .name('qcrecon')
  .description('售前报价与合同交付差异核对工具')
  .version(pkg.version, '-v, --version', '显示版本号');

// scan 命令
program
  .command('scan <directory>')
  .description('扫描目录并执行差异核对（仅在控制台显示结果）')
  .option('-v, --verbose', '显示详细信息')
  .action(async (directory, options) => {
    console.log('═'.repeat(60));
    console.log('📋 售前报价与合同交付差异核对工具');
    console.log('═'.repeat(60));
    console.log(`\n版本: ${pkg.version}`);
    console.log(`时间: ${new Date().toLocaleString('zh-CN')}`);
    console.log('');
    
    try {
      const dirPath = path.resolve(directory);
      
      const result = await runReconciliation(dirPath, {
        verbose: options.verbose
      });
      
      printSummary(result);
      
      if (!result.success) {
        process.exit(1);
      }
      
    } catch (error) {
      console.error('\n❌ 执行出错:');
      console.error(`   ${error.message}`);
      if (options.verbose && error.stack) {
        console.error('\n堆栈跟踪:');
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

// report 命令
program
  .command('report <directory>')
  .description('扫描目录并生成报告文件')
  .option('-o, --output <dir>', '输出目录 (默认: ./reports)', './reports')
  .option('-n, --name <name>', '报告文件名前缀 (默认: reconciliation-report)', 'reconciliation-report')
  .option('-f, --format <formats...>', '输出格式: json, md, html (默认: 全部)', ['json', 'md', 'html'])
  .option('-v, --verbose', '显示详细信息')
  .action(async (directory, options) => {
    console.log('═'.repeat(60));
    console.log('📋 售前报价与合同交付差异核对工具 - 报告生成');
    console.log('═'.repeat(60));
    console.log(`\n版本: ${pkg.version}`);
    console.log(`时间: ${new Date().toLocaleString('zh-CN')}`);
    console.log(`输出目录: ${options.output}`);
    console.log(`输出格式: ${options.format.join(', ')}`);
    console.log('');
    
    try {
      const dirPath = path.resolve(directory);
      const outputPath = path.resolve(options.output);
      
      const result = await runReconciliation(dirPath, {
        verbose: options.verbose
      });
      
      printSummary(result);
      
      if (result.success && result.reports) {
        console.log('\n📁 导出报告...');
        
        // 根据选择的格式过滤报告
        const reportsToExport = {};
        if (options.format.includes('json') && result.reports.json) {
          reportsToExport.json = result.reports.json;
        }
        if (options.format.includes('md') && result.reports.markdown) {
          reportsToExport.markdown = result.reports.markdown;
        }
        if (options.format.includes('html') && result.reports.html) {
          reportsToExport.html = result.reports.html;
        }
        
        if (Object.keys(reportsToExport).length > 0) {
          const exported = await exportReports(reportsToExport, outputPath, options.name);
          console.log(`\n✅ 报告导出完成，共 ${exported.length} 个文件:`);
          exported.forEach(e => {
            console.log(`   - [${e.type.toUpperCase()}] ${e.path}`);
          });
        } else {
          console.log('\n⚠️  没有报告被导出（可能是格式选择问题）');
        }
      }
      
      if (!result.success) {
        process.exit(1);
      }
      
    } catch (error) {
      console.error('\n❌ 执行出错:');
      console.error(`   ${error.message}`);
      if (options.verbose && error.stack) {
        console.error('\n堆栈跟踪:');
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

// help 命令增强
program.addHelpText('after', `

示例:
  # 扫描样例目录（仅在控制台显示结果）
  $ qcrecon scan samples/normal
  
  # 扫描异常样例目录
  $ qcrecon scan samples/abnormal
  
  # 生成报告文件（默认输出到 ./reports）
  $ qcrecon report samples/normal
  
  # 指定输出目录和格式
  $ qcrecon report samples/abnormal -o ./my-reports -f json md

  # 完整选项
  $ qcrecon report ./project -o ./output -n my-project -f json md html -v

文件命名规范:
  工具会自动识别以下文件名（不区分大小写）:
  - 报价单: quote.csv, quote.xlsx, [name]_quote.csv
  - 合同: contract.md, [name]_contract.md
  - 产品目录: catalog.json, [name]_catalog.json
  - 审批备注: approval-notes.json, approval.json, [name]_approval.json

严重程度说明:
  🔴 critical (需要客户确认) - 最严重，需要立即与客户确认
  🟠 high (需要内部确认)     - 高优先级，需要内部确认
  🟡 medium (建议修订)        - 中优先级，建议修订
  🔵 low (建议检查)           - 低优先级，建议检查
`);

// 解析命令行参数
program.parse(process.argv);

// 如果没有指定命令，显示帮助
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
