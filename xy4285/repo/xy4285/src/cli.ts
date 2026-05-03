#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { DeliveryRule, ExportOptions } from './types';
import { Scanner } from './scanner';
import { Exporter } from './exporter';

const program = new Command();

function loadRules(rulesPath: string): DeliveryRule {
  if (!fs.existsSync(rulesPath)) {
    throw new Error(`规则文件不存在: ${rulesPath}`);
  }
  
  const content = fs.readFileSync(rulesPath, 'utf-8');
  return JSON.parse(content);
}

function getDefaultRules(): DeliveryRule {
  return {
    platforms: [
      { name: 'TikTok', code: 'tiktok', requiredLanguages: ['zh', 'en', 'es'] },
      { name: 'YouTube', code: 'youtube', requiredLanguages: ['zh', 'en', 'es', 'pt'] }
    ],
    languages: [
      { code: 'zh', name: 'Chinese', readingSpeed: 8, maxLinesPerCue: 2 },
      { code: 'en', name: 'English', readingSpeed: 15, maxLinesPerCue: 2 },
      { code: 'es', name: 'Spanish', readingSpeed: 13, maxLinesPerCue: 2 },
      { code: 'pt', name: 'Portuguese', readingSpeed: 13, maxLinesPerCue: 2 },
      { code: 'ar', name: 'Arabic', readingSpeed: 12, maxLinesPerCue: 2 },
      { code: 'id', name: 'Indonesian', readingSpeed: 14, maxLinesPerCue: 2 }
    ],
    timing: {
      minGapBetweenCues: 40,
      minCueDuration: 300,
      maxCueDuration: 7000,
      allowOverlap: false
    },
    text: {
      allowEmptyLines: false,
      maxLineLength: 40,
      checkPunctuation: true
    },
    forbiddenWords: {
      enabled: true,
      words: ['敏感词', '禁止', '违规', 'forbidden', 'violate'],
      caseSensitive: false
    },
    naming: {
      pattern: '{platform}_{episode}_{language}.{ext}',
      requiredParts: ['platform', 'episode', 'language'],
      separator: '_'
    }
  };
}

program
  .name('subtitle-deliver')
  .description('短剧出海字幕交付自动化工具')
  .version('1.0.0');

program
  .command('scan')
  .description('扫描目录并校验字幕文件')
  .argument('<directory>', '要扫描的目录路径')
  .option('-r, --rules <path>', '规则配置文件路径 (JSON)')
  .option('-o, --output <path>', '输出目录', './output')
  .option('--no-markdown', '不生成Markdown报告')
  .option('--no-csv', '不生成CSV明细')
  .option('--no-package', '不打包通过的文件')
  .action(async (directory: string, options: any) => {
    try {
      const scanDir = path.resolve(directory);
      
      if (!fs.existsSync(scanDir)) {
        console.error(`❌ 目录不存在: ${scanDir}`);
        process.exit(1);
      }
      
      let rules: DeliveryRule;
      if (options.rules) {
        const rulesPath = path.resolve(options.rules);
        console.log(`📋 加载规则配置: ${rulesPath}`);
        rules = loadRules(rulesPath);
      } else {
        console.log('📋 使用默认规则配置');
        rules = getDefaultRules();
      }
      
      const scanner = new Scanner(rules);
      const exporter = new Exporter();
      
      console.log(`🔍 开始扫描目录: ${scanDir}`);
      console.log('─'.repeat(50));
      
      const result = scanner.scanDirectory(scanDir);
      
      exporter.printTerminalSummary(result);
      
      const exportOptions: ExportOptions = {
        outputDir: path.resolve(options.output),
        generateMarkdown: options.markdown !== false,
        generateCsv: options.csv !== false,
        packageByPlatform: options.package !== false
      };
      
      exporter.exportAll(result, exportOptions);
      
      const errors = result.issues.filter(i => i.severity === 'error');
      if (errors.length > 0) {
        console.log(`\n⚠️  检测到 ${errors.length} 个错误，请修复后重试`);
        process.exit(1);
      } else {
        console.log('\n✅ 所有检查通过！');
        process.exit(0);
      }
      
    } catch (error) {
      console.error(`❌ 执行失败: ${(error as Error).message}`);
      console.error((error as Error).stack);
      process.exit(1);
    }
  });

program
  .command('init')
  .description('生成示例规则配置文件')
  .argument('[outputPath]', '输出文件路径', './delivery-rules.json')
  .action((outputPath: string) => {
    try {
      const fullPath = path.resolve(outputPath);
      const rules = getDefaultRules();
      
      fs.writeFileSync(fullPath, JSON.stringify(rules, null, 2), 'utf-8');
      console.log(`✅ 规则配置文件已生成: ${fullPath}`);
      console.log('\n请根据实际需求修改配置文件中的参数。');
    } catch (error) {
      console.error(`❌ 生成配置文件失败: ${(error as Error).message}`);
      process.exit(1);
    }
  });

program
  .command('validate-rule')
  .description('验证规则配置文件格式')
  .argument('<rulesPath>', '规则配置文件路径')
  .action((rulesPath: string) => {
    try {
      const fullPath = path.resolve(rulesPath);
      loadRules(fullPath);
      console.log(`✅ 规则配置文件格式正确: ${fullPath}`);
    } catch (error) {
      console.error(`❌ 规则配置文件无效: ${(error as Error).message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
