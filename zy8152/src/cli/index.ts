#!/usr/bin/env node

import { program } from 'commander';
import * as path from 'path';
import { parseAllData } from '../parsers';
import { runAllRules } from '../rules';
import { generateAllReports } from '../reporters';
import { FontReport } from '../types';

interface CliOptions {
  dataDir: string;
  outputDir: string;
  verbose: boolean;
  quiet: boolean;
}

program
  .name('font-check')
  .description('国际化字体回退链路预检 CLI 工具')
  .version('1.0.0')
  .option('-d, --data-dir <path>', '数据目录路径', 'data')
  .option('-o, --output-dir <path>', '输出目录路径', 'output')
  .option('-v, --verbose', '显示详细输出')
  .option('-q, --quiet', '静默模式，只显示错误')
  .action(async (options: CliOptions) => {
    try {
      await runFontCheck(options);
    } catch (error) {
      console.error('\n❌ 执行过程中发生错误:');
      if (error instanceof Error) {
        console.error(`   ${error.message}`);
        if (options.verbose && error.stack) {
          console.error('\n堆栈追踪:');
          console.error(error.stack);
        }
      } else {
        console.error(`   ${String(error)}`);
      }
      process.exit(1);
    }
  });

program.parse(process.argv);

async function runFontCheck(options: CliOptions): Promise<void> {
  const dataDir = path.resolve(options.dataDir);
  const outputDir = path.resolve(options.outputDir);

  if (!options.quiet) {
    console.log('📋 字体回退链路预检工具');
    console.log('========================\n');
    console.log(`📁 数据目录: ${dataDir}`);
    console.log(`📤 输出目录: ${outputDir}`);
    console.log('');
  }

  if (options.verbose) {
    console.log('🔍 步骤 1: 解析配置文件...');
  }

  const parseResult = parseAllData(dataDir);

  if (parseResult.errors.length > 0 && !options.quiet) {
    console.log(`⚠️  发现 ${parseResult.errors.length} 个验证警告/错误`);
    if (options.verbose) {
      for (const err of parseResult.errors) {
        console.log(`   [${err.type.toUpperCase()}] ${err.source}: ${err.message}`);
        if (err.detail) {
          console.log(`      详情: ${err.detail}`);
        }
      }
    }
    console.log('');
  }

  const data = parseResult.data;

  if (!options.quiet) {
    console.log('✅ 解析完成');
    console.log(`   - 字体数量: ${data.fonts.size}`);
    console.log(`   - 样本数量: ${data.samples.length}`);
    console.log(`   - 回退链数量: ${data.fallbackConfig.chains.length}`);
    console.log(`   - 子集数量: ${data.subsets.size}`);
    console.log('');
  }

  if (options.verbose) {
    console.log('🔍 步骤 2: 执行规则检查...');
  }

  const report: FontReport = runAllRules(data, parseResult.errors);

  if (!options.quiet) {
    console.log('✅ 规则检查完成');
    console.log('');
    console.log('📊 检查结果摘要:');
    console.log(`   - 通过规则: ${report.summary.passedRules} / 5`);
    console.log(`   - 缺字数量: ${report.summary.missingGlyphsCount}`);
    console.log(`   - Emoji 风险: ${report.summary.emojiRisksCount}`);
    console.log(`   - 方向性风险: ${report.summary.arabicRisksCount}`);
    console.log(`   - 字体轴问题: ${report.summary.variableAxisIssuesCount}`);
    console.log(`   - 无用子集: ${report.summary.unusedSubsetsCount}`);
    console.log('');
  }

  if (options.verbose) {
    console.log('🔍 步骤 3: 生成报告...');
  }

  const generatedFiles = generateAllReports(report, outputDir);

  if (!options.quiet) {
    console.log('✅ 报告生成完成');
    console.log('');
    console.log('📄 生成的文件:');
    if (generatedFiles.missingGlyphsCsv) {
      console.log(`   - missing_glyphs.csv: ${generatedFiles.missingGlyphsCsv}`);
    } else {
      console.log('   - missing_glyphs.csv: (无缺字，未生成)');
    }
    console.log(`   - font_report.md: ${generatedFiles.fontReportMd}`);
    console.log(`   - preview.html: ${generatedFiles.previewHtml}`);
    console.log('');
  }

  if (!options.quiet) {
    if (report.summary.failedRules > 0) {
      console.log('⚠️  部分规则检查失败，请查看报告详情');
      console.log(`   失败规则数: ${report.summary.failedRules}`);
      console.log('');
    }

    console.log('🎉 预检完成!');
    console.log(`   详细报告请查看: ${outputDir}`);
  }

  if (report.summary.failedRules > 0) {
    process.exit(1);
  }
}
