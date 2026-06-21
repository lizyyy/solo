#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectFormat, parseLog, readLogFile, validateRows } from './parser';
import { detectLatLonSwap, applyDeduplication } from './dedupe';
import { computeRemarkImpacts, rowToRecord } from './judge';
import { buildRecordMap, getDedupeKey, loadState, resetState, saveState } from './storage';
import { generateMarkdownReport } from './report';
import type { BuoyCliRecord, CliRunResult, ProcessStats } from './types';

const CLI_VERSION = '1.0.0';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

interface CliArgs {
  command: 'import' | 'reset' | 'help';
  inputFile?: string;
  reportFile?: string;
  projectRoot?: string;
}

function printHelp(): void {
  const help = `
浮标海况日志 CLI v${CLI_VERSION}

用法:
  buoy import <日志文件> [--report 报告路径] [--root 项目根目录]
  buoy reset [--root 项目根目录]
  buoy help

示例:
  # 正常导入 CSV 日志，生成 Markdown 报告
  buoy import examples/logs/scene1-normal.csv

  # 指定报告输出路径
  buoy import examples/logs/scene2-duplicate.csv --report reports/scene2.md

  # 清空已处理数据（用于重复测试）
  buoy reset
`;
  process.stdout.write(help + '\n');
}

function parseArgs(argv: string[]): CliArgs {
  const args = argv.slice(2);
  if (args.length === 0 || args[0] === 'help' || args[0] === '--help' || args[0] === '-h') {
    return { command: 'help' };
  }

  const command = args[0];
  if (command === 'reset') {
    const rootIdx = args.indexOf('--root');
    return {
      command: 'reset',
      projectRoot: rootIdx !== -1 ? args[rootIdx + 1] : undefined,
    };
  }

  if (command === 'import') {
    const inputFile = args[1];
    const reportIdx = args.indexOf('--report');
    const rootIdx = args.indexOf('--root');
    return {
      command: 'import',
      inputFile,
      reportFile: reportIdx !== -1 ? args[reportIdx + 1] : undefined,
      projectRoot: rootIdx !== -1 ? args[rootIdx + 1] : undefined,
    };
  }

  return { command: 'help' };
}

function defaultReportPath(inputFile: string): string {
  const dir = path.dirname(inputFile);
  const base = path.basename(inputFile, path.extname(inputFile));
  return path.join(dir, `${base}-report.md`);
}

function runImport(args: CliArgs): number {
  if (!args.inputFile) {
    process.stderr.write('错误: 请指定要导入的日志文件路径\n');
    printHelp();
    return 1;
  }

  const projectRoot = args.projectRoot ?? PROJECT_ROOT;
  const inputAbs = path.resolve(projectRoot, args.inputFile);

  if (!fs.existsSync(inputAbs)) {
    process.stderr.write(`错误: 找不到日志文件 ${inputAbs}\n`);
    return 1;
  }

  const format = detectFormat(inputAbs);
  const content = readLogFile(inputAbs);
  const rawRows = parseLog(content, format);
  const { valid, bad } = validateRows(rawRows);

  const swapCandidates = detectLatLonSwap(valid);
  const swapLineNumbers = new Set(swapCandidates.map(s => s.lineNumber));

  const validForDedupe = valid.filter(r => !swapLineNumbers.has(r.lineNumber));
  const incomingRecords: BuoyCliRecord[] = validForDedupe.map(r => rowToRecord(r, args.inputFile!));

  const state = loadState(projectRoot);
  const existingMap = buildRecordMap(state.records);
  const outcome = applyDeduplication(existingMap, incomingRecords, getDedupeKey);

  const remarkImpacts = computeRemarkImpacts(outcome.updatedRecords, existingMap, getDedupeKey);

  const newMap = new Map(existingMap);
  for (const rec of outcome.newRecords) newMap.set(getDedupeKey(rec), rec);
  for (const rec of outcome.updatedRecords) newMap.set(getDedupeKey(rec), rec);

  const updatedRecords = Array.from(newMap.values());
  const newState = {
    records: updatedRecords,
    lastRunAt: new Date().toISOString(),
    lastInputFile: args.inputFile,
    schemaVersion: 1,
  };
  saveState(projectRoot, newState);

  const blockingReasons: string[] = [];
  if (swapCandidates.length > 0) {
    blockingReasons.push(`存在 ${swapCandidates.length} 条经纬度疑似反写记录，位置未确认`);
  }
  if (bad.length > 0) {
    blockingReasons.push(`存在 ${bad.length} 条坏行未处理`);
  }

  const stats: ProcessStats = {
    inputFile: args.inputFile,
    totalRows: rawRows.length,
    processed: outcome.newRecords.length + outcome.updatedRecords.length,
    skippedDuplicate: outcome.skippedDuplicate.length,
    skippedRemarkProtected: outcome.skippedRemarkProtected.length,
    bad: bad.length,
  };

  const result: CliRunResult = {
    stats,
    badRows: bad,
    swapCandidates,
    remarkImpacts,
    newRecords: outcome.newRecords,
    updatedRecords: outcome.updatedRecords,
    skippedRemarkProtectedRecords: outcome.skippedRemarkProtected,
    canRelease: blockingReasons.length === 0,
    blockingReasons,
    runAt: new Date().toISOString(),
    cliVersion: CLI_VERSION,
  };

  const md = generateMarkdownReport(result);
  const reportPath = path.resolve(projectRoot, args.reportFile ?? defaultReportPath(args.inputFile));
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, md, 'utf-8');

  process.stdout.write(`\n✅ 处理完成\n`);
  process.stdout.write(`  总行数:       ${stats.totalRows}\n`);
  process.stdout.write(`  正常入库:     ${stats.processed} (新增 ${outcome.newRecords.length} / 更新 ${outcome.updatedRecords.length})\n`);
  process.stdout.write(`  重复跳过:     ${stats.skippedDuplicate}\n`);
  process.stdout.write(`  备注保护跳过: ${stats.skippedRemarkProtected}\n`);
  process.stdout.write(`  坏行:         ${stats.bad}\n`);
  process.stdout.write(`  反写疑点:     ${swapCandidates.length}\n`);
  process.stdout.write(`  备注影响:     ${remarkImpacts.length} 条记录\n`);
  process.stdout.write(`  可放行:       ${result.canRelease ? '是' : '否（见报告）'}\n`);
  process.stdout.write(`\n📄 报告已生成: ${reportPath}\n`);

  return result.canRelease ? 0 : 2;
}

function main(): number {
  const args = parseArgs(process.argv);
  const projectRoot = args.projectRoot ?? PROJECT_ROOT;

  switch (args.command) {
    case 'help':
      printHelp();
      return 0;
    case 'reset':
      resetState(projectRoot);
      process.stdout.write('🧹 已清空浮标日志处理数据\n');
      return 0;
    case 'import':
      return runImport(args);
    default:
      printHelp();
      return 1;
  }
}

process.exit(main());
