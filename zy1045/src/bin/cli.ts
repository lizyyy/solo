#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import * as path from 'path';
import * as fs from 'fs';

import { ConfigLoader } from '../config/loader';
import { ConfigValidator } from '../config/validator';
import { DataProcessor } from '../core/processor';
import { RiskChecker } from '../risk/risk-checker';
import { Reporter } from '../reporter/reporter';

const program = new Command();

program
  .name('data-masker')
  .description('数据脱敏CLI工具 - 批量处理CSV/JSON文件，保持跨文件一致性映射')
  .version('1.0.0');

program
  .command('validate')
  .description('校验配置文件，检查配置冲突、字段问题和风险')
  .argument('<config>', '配置文件路径 (YAML/JSON)')
  .option('--json', '输出JSON格式结果')
  .action(async (configPath: string, options: any) => {
    try {
      console.log(chalk.blue(`📋 正在校验配置: ${configPath}`));
      console.log('');

      const config = ConfigLoader.load(configPath);
      const validation = ConfigValidator.validate(config);

      if (options.json) {
        console.log(JSON.stringify(validation, null, 2));
        process.exit(validation.valid ? 0 : 1);
      }

      console.log(chalk.bold('=== 配置校验结果 ==='));
      console.log('');

      if (validation.errors.length > 0) {
        console.log(chalk.red('❌ 错误:'));
        for (const error of validation.errors) {
          console.log(chalk.red(`   • ${error}`));
        }
        console.log('');
      }

      if (validation.warnings.length > 0) {
        console.log(chalk.yellow('⚠️  警告:'));
        for (const warning of validation.warnings) {
          console.log(chalk.yellow(`   • ${warning}`));
        }
        console.log('');
      }

      const riskSummary = RiskChecker.summarizeRisks(validation.risks);
      
      console.log(chalk.bold('=== 风险检查 ==='));
      console.log('');
      console.log(`   🔴 高风险: ${riskSummary.high.length} 项`);
      console.log(`   🟡 中风险: ${riskSummary.medium.length} 项`);
      console.log(`   🟢 低风险: ${riskSummary.low.length} 项`);
      console.log('');

      if (riskSummary.high.length > 0) {
        console.log(chalk.red('🔴 高风险详情:'));
        for (const risk of riskSummary.high) {
          console.log(chalk.red(`   [${risk.category}] ${risk.message}`));
          if (risk.suggestion) {
            console.log(chalk.gray(`      > 建议: ${risk.suggestion}`));
          }
        }
        console.log('');
      }

      if (validation.valid && riskSummary.high.length === 0) {
        console.log(chalk.green('✅ 配置校验通过！'));
        process.exit(0);
      } else {
        console.log(chalk.red('❌ 配置校验存在问题，请修复后重试'));
        process.exit(1);
      }

    } catch (e) {
      console.error(chalk.red(`❌ 错误: ${(e as Error).message}`));
      process.exit(1);
    }
  });

program
  .command('mask')
  .description('执行脱敏处理，输出脱敏文件和报告')
  .argument('<config>', '配置文件路径 (YAML/JSON)')
  .option('--dry-run', '预览模式，不实际写入文件')
  .option('--output <dir>', '覆盖配置中的输出目录')
  .option('--no-report', '不生成报告')
  .option('--mapping-details', '报告中包含详细映射关系')
  .option('--json', '输出JSON格式结果')
  .action(async (configPath: string, options: any) => {
    try {
      console.log(chalk.blue(`🔒 开始数据脱敏处理`));
      console.log(chalk.gray(`   配置文件: ${configPath}`));
      console.log('');

      const config = ConfigLoader.load(configPath);
      
      if (options.dryRun) {
        config.dryRun = true;
        console.log(chalk.yellow('⚠️  预览模式 (Dry Run) - 不会实际写入文件'));
        console.log('');
      }

      if (options.output) {
        config.outputDir = path.resolve(options.output);
      }

      const processor = new DataProcessor(config, configPath);
      const result = processor.process();

      if (options.json) {
        console.log(JSON.stringify({
          summary: result.summary,
          risks: result.risks,
        }, null, 2));
      } else {
        console.log(chalk.bold('=== 处理概览 ==='));
        console.log('');
        console.log(`   📁 处理文件数: ${result.summary.totalFiles}`);
        console.log(`   📊 总记录数: ${result.summary.totalRecords}`);
        console.log(`   🔒 脱敏字段总数: ${result.summary.totalMaskedFields}`);
        console.log('');

        console.log(chalk.bold('=== 各类型统计 ==='));
        console.log('');
        for (const [type, count] of Object.entries(result.summary.mappingStats || {})) {
          const typeName = getTypeName(type);
          console.log(`   • ${typeName}: ${count} 个唯一值`);
        }
        console.log('');

        for (const fileResult of result.summary.files) {
          const fileName = path.basename(fileResult.filePath);
          console.log(chalk.bold(`📄 ${fileName}`));
          console.log(`   输出: ${fileResult.outputPath}`);
          console.log(`   记录数: ${fileResult.totalRecords}`);
          
          if (Object.keys(fileResult.maskedFields).length > 0) {
            console.log('   脱敏字段:');
            for (const [field, count] of Object.entries(fileResult.maskedFields)) {
              console.log(`      • ${field}: ${count} 条`);
            }
          }
          
          if (fileResult.warnings.length > 0) {
            console.log(chalk.yellow(`   警告: ${fileResult.warnings.length} 项`));
          }
          if (fileResult.errors.length > 0) {
            console.log(chalk.red(`   错误: ${fileResult.errors.length} 项`));
          }
          console.log('');
        }

        const riskSummary = RiskChecker.summarizeRisks(result.risks);
        if (result.risks.length > 0) {
          console.log(chalk.bold('=== 风险提示 ==='));
          console.log('');
          console.log(`   🔴 高风险: ${riskSummary.high.length}`);
          console.log(`   🟡 中风险: ${riskSummary.medium.length}`);
          console.log(`   🟢 低风险: ${riskSummary.low.length}`);
          console.log('');
        }
      }

      if (options.report !== false && !config.dryRun) {
        const reports = DataProcessor.generateReports(
          result,
          config.outputDir,
          options.mappingDetails
        );
        
        if (!options.json) {
          console.log(chalk.bold('📋 报告已生成:'));
          console.log(`   • Markdown: ${reports.markdownPath}`);
          console.log(`   • JSON: ${reports.jsonPath}`);
          if (reports.mappingPath) {
            console.log(`   • 映射详情: ${reports.mappingPath}`);
          }
          console.log('');
        }
      }

      if (config.dryRun) {
        console.log(chalk.yellow('⚠️  预览模式完成，移除 --dry-run 参数以实际执行'));
      } else {
        console.log(chalk.green('✅ 脱敏处理完成！'));
      }

    } catch (e) {
      console.error(chalk.red(`❌ 错误: ${(e as Error).message}`));
      process.exit(1);
    }
  });

program
  .command('report')
  .description('基于已有结果重新生成报告')
  .argument('<summary>', '之前生成的 summary.json 或 report.json')
  .option('--format <format>', '输出格式: markdown|json', 'markdown')
  .option('--output <path>', '输出文件路径')
  .option('--mapping-details', '包含详细映射关系')
  .action(async (summaryPath: string, options: any) => {
    try {
      console.log(chalk.blue(`📋 正在生成报告`));
      console.log('');

      const summaryContent = fs.readFileSync(summaryPath, 'utf-8');
      const summary = JSON.parse(summaryContent);

      const format = options.format === 'json' ? 'json' : 'markdown';
      
      const report = Reporter.generateReport(
        summary.summary || summary,
        { format, includeMappingDetails: options.mappingDetails },
        summary.risks
      );

      if (options.output) {
        fs.writeFileSync(options.output, report, 'utf-8');
        console.log(chalk.green(`✅ 报告已写入: ${options.output}`));
      } else {
        console.log(report);
      }

    } catch (e) {
      console.error(chalk.red(`❌ 错误: ${(e as Error).message}`));
      process.exit(1);
    }
  });

function getTypeName(type: string): string {
  const typeNames: { [key: string]: string } = {
    phone: '手机号',
    email: '邮箱',
    name: '姓名',
    address: '地址',
    order_number: '订单号',
    ticket_number: '工单号',
    free_text: '自由文本',
  };
  return typeNames[type] || type;
}

program.parse(process.argv);
