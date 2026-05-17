#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { PreviewEngine } from './preview-engine';
import { ReportGenerator } from './report-generator';

const program = new Command();
const previewEngine = new PreviewEngine();
const reportGenerator = new ReportGenerator();

program
  .name('jsonpatch-preview')
  .description('JSON Patch 预演 CLI 工具 - 批量修改 JSON 配置前的安全预演')
  .version('1.0.0');

program
  .argument('<json-file>', '目标 JSON 文件路径')
  .argument('<patch-file>', 'JSON Patch 文件路径')
  .option('-o, --output <dir>', '报告输出目录', './reports')
  .option('--no-terminal', '不在终端输出摘要')
  .option('--json-report', '输出机器可读的 JSON 报告')
  .option('--human-report', '输出可读的 Markdown 报告')
  .action((jsonFile: string, patchFile: string, options) => {
    try {
      const originalJson = JSON.parse(fs.readFileSync(jsonFile, 'utf-8'));
      const patches = JSON.parse(fs.readFileSync(patchFile, 'utf-8'));

      const result = previewEngine.previewFile(jsonFile, originalJson, patches);
      const report = reportGenerator.generateReport([result]);

      if (options.terminal) {
        console.log(reportGenerator.generateTerminalSummary(report));
      }

      if (!fs.existsSync(options.output)) {
        fs.mkdirSync(options.output, { recursive: true });
      }

      if (options.jsonReport) {
        const jsonReportPath = path.join(options.output, 'preview-report.json');
        fs.writeFileSync(jsonReportPath, reportGenerator.generateMachineReadable(report));
        console.log(`JSON 报告已保存到: ${jsonReportPath}`);
      }

      if (options.humanReport) {
        const mdReportPath = path.join(options.output, 'preview-report.md');
        fs.writeFileSync(mdReportPath, reportGenerator.generateHumanReadable(report));
        console.log(`Markdown 报告已保存到: ${mdReportPath}`);
      }

      process.exit(reportGenerator.getExitCode(report));
    } catch (error: any) {
      console.error(`❌ 错误: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('batch')
  .description('批量处理多个 JSON 文件')
  .requiredOption('-d, --dir <directory>', '包含 JSON 文件的目录')
  .requiredOption('-p, --patch <file>', 'Patch 文件路径')
  .option('-o, --output <dir>', '报告输出目录', './reports')
  .action((options) => {
    try {
      const patches = JSON.parse(fs.readFileSync(options.patch, 'utf-8'));
      const files = fs.readdirSync(options.dir)
        .filter((f: string) => f.endsWith('.json'))
        .map((f: string) => path.join(options.dir, f));

      const results = files.map((file: string) => {
        const originalJson = JSON.parse(fs.readFileSync(file, 'utf-8'));
        return previewEngine.previewFile(file, originalJson, patches);
      });

      const report = reportGenerator.generateReport(results);

      console.log(reportGenerator.generateTerminalSummary(report));

      if (!fs.existsSync(options.output)) {
        fs.mkdirSync(options.output, { recursive: true });
      }

      const jsonReportPath = path.join(options.output, 'preview-report.json');
      fs.writeFileSync(jsonReportPath, reportGenerator.generateMachineReadable(report));
      console.log(`JSON 报告已保存到: ${jsonReportPath}`);

      const mdReportPath = path.join(options.output, 'preview-report.md');
      fs.writeFileSync(mdReportPath, reportGenerator.generateHumanReadable(report));
      console.log(`Markdown 报告已保存到: ${mdReportPath}`);

      process.exit(reportGenerator.getExitCode(report));
    } catch (error: any) {
      console.error(`❌ 错误: ${error.message}`);
      process.exit(1);
    }
  });

program.parse();
