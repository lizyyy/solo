#!/usr/bin/env node

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import { ValidationResult } from './types';
import {
  runValidation,
  discoverConfigPaths,
  ValidationOptions
} from './validator';
import { generateReports, ReportOptions } from './report';

const program = new Command();

let lastValidationResult: ValidationResult | null = null;

program
  .name('case-validator')
  .description('法院电子卷宗刻录/移交前离线校验工具')
  .version('1.0.0');

program
  .command('validate')
  .description('执行卷宗校验')
  .argument('[directory]', '卷宗目录路径，默认为当前目录', '.')
  .option('--no-hash', '跳过哈希值校验')
  .option('--no-duplicate', '跳过重复文件检查')
  .option('--no-secret', '跳过敏级目录检查')
  .option('--no-path-case', '跳过路径大小写检查')
  .option('--no-batch', '跳过批次追加检查')
  .option('--no-verify-files', '不实际读取文件计算哈希（仅对比记录）')
  .option('--cases <path>', '指定 cases.csv 路径')
  .option('--manifest <path>', '指定 manifest.jsonl 路径')
  .option('--hashes <path>', '指定 hashes.txt 路径')
  .option('--rules <path>', '指定 rules.yaml 路径')
  .action(async (directory: string, options: any) => {
    try {
      const rootDir = path.resolve(directory);
      
      if (!fs.existsSync(rootDir)) {
        console.error(`错误: 目录不存在: ${rootDir}`);
        process.exit(1);
      }
      
      let configPaths = discoverConfigPaths(rootDir);
      
      if (options.cases) {
        configPaths.casesCsv = path.resolve(options.cases);
      }
      if (options.manifest) {
        configPaths.manifestJsonl = path.resolve(options.manifest);
      }
      if (options.hashes) {
        configPaths.hashesTxt = path.resolve(options.hashes);
      }
      if (options.rules) {
        configPaths.rulesYaml = path.resolve(options.rules);
      }
      
      const validationOptions: ValidationOptions = {
        skipHashCheck: !options.hash,
        skipDuplicateCheck: !options.duplicate,
        skipSecretLevelCheck: !options.secret,
        skipPathCaseCheck: !options.pathCase,
        skipBatchCheck: !options.batch,
        verifyActualFiles: options.verifyFiles !== false
      };
      
      console.log('='.repeat(60));
      console.log('法院电子卷宗校验工具');
      console.log('='.repeat(60));
      console.log(`\n卷宗目录: ${rootDir}`);
      console.log(`配置文件:`);
      console.log(`  - cases.csv: ${configPaths.casesCsv}`);
      console.log(`  - manifest.jsonl: ${configPaths.manifestJsonl}`);
      console.log(`  - hashes.txt: ${configPaths.hashesTxt}`);
      console.log(`  - rules.yaml: ${configPaths.rulesYaml}`);
      console.log('');
      
      lastValidationResult = await runValidation(configPaths, validationOptions);
      
      if (lastValidationResult.errors > 0) {
        console.log(`\n⚠️  校验完成，但存在 ${lastValidationResult.errors} 个错误需要修复`);
        process.exit(1);
      } else if (lastValidationResult.warnings > 0) {
        console.log(`\n⚠️  校验完成，存在 ${lastValidationResult.warnings} 个警告，请检查`);
      } else {
        console.log(`\n✅ 校验完成，未发现任何问题`);
      }
      
    } catch (error) {
      console.error(`\n❌ 校验失败: ${(error as Error).message}`);
      console.error((error as Error).stack);
      process.exit(1);
    }
  });

program
  .command('report')
  .description('生成校验报告')
  .argument('[directory]', '卷宗目录路径，默认为当前目录', '.')
  .option('-o, --output <path>', '报告输出目录', './output')
  .option('--issues-csv <name>', '问题列表文件名', 'issues.csv')
  .option('--report-md <name>', '移交报告文件名', 'handover_report.md')
  .option('--validate', '先执行校验再生成报告')
  .option('--no-hash', '跳过哈希值校验')
  .option('--no-duplicate', '跳过重复文件检查')
  .option('--no-secret', '跳过敏级目录检查')
  .option('--no-path-case', '跳过路径大小写检查')
  .option('--no-batch', '跳过批次追加检查')
  .option('--cases <path>', '指定 cases.csv 路径')
  .option('--manifest <path>', '指定 manifest.jsonl 路径')
  .option('--hashes <path>', '指定 hashes.txt 路径')
  .option('--rules <path>', '指定 rules.yaml 路径')
  .action(async (directory: string, options: any) => {
    try {
      const rootDir = path.resolve(directory);
      
      if (!fs.existsSync(rootDir)) {
        console.error(`错误: 目录不存在: ${rootDir}`);
        process.exit(1);
      }
      
      let result: ValidationResult;
      
      if (options.validate || !lastValidationResult) {
        console.log('='.repeat(60));
        console.log('法院电子卷宗校验报告生成');
        console.log('='.repeat(60));
        
        let configPaths = discoverConfigPaths(rootDir);
        
        if (options.cases) {
          configPaths.casesCsv = path.resolve(options.cases);
        }
        if (options.manifest) {
          configPaths.manifestJsonl = path.resolve(options.manifest);
        }
        if (options.hashes) {
          configPaths.hashesTxt = path.resolve(options.hashes);
        }
        if (options.rules) {
          configPaths.rulesYaml = path.resolve(options.rules);
        }
        
        const validationOptions: ValidationOptions = {
          skipHashCheck: !options.hash,
          skipDuplicateCheck: !options.duplicate,
          skipSecretLevelCheck: !options.secret,
          skipPathCaseCheck: !options.pathCase,
          skipBatchCheck: !options.batch
        };
        
        result = await runValidation(configPaths, validationOptions);
      } else {
        result = lastValidationResult;
      }
      
      const reportOptions: ReportOptions = {
        outputDir: path.resolve(options.output),
        issuesCsvName: options.issuesCsv,
        reportMdName: options.reportMd
      };
      
      await generateReports(result, reportOptions);
      
    } catch (error) {
      console.error(`\n❌ 报告生成失败: ${(error as Error).message}`);
      console.error((error as Error).stack);
      process.exit(1);
    }
  });

program
  .command('help [command]')
  .description('显示帮助信息')
  .action((cmd: string) => {
    if (cmd) {
      const command = program.commands.find(c => c.name() === cmd);
      if (command) {
        command.outputHelp();
      } else {
        console.log(`未知命令: ${cmd}`);
        program.outputHelp();
      }
    } else {
      program.outputHelp();
    }
  });

program.parse(process.argv);
