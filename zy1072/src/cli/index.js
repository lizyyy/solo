#!/usr/bin/env node

import * as path from 'path';
import { fileURLToPath } from 'url';
import { parseData } from '../parser/index.js';
import { validateGuestsAndTables } from '../rules/index.js';
import { generateSuggestions } from '../suggester/index.js';
import { exportAll } from '../exporter/index.js';
import { configManager } from './config.js';
import { printer } from './printer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseArgs(args) {
  const result = {
    command: null,
    guests: null,
    tables: null,
    output: null,
    config: null,
    verbose: false,
    colors: true,
    help: false
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      
      switch (key) {
        case 'guests':
        case 'g':
          result.guests = value || args[++i];
          break;
        case 'tables':
        case 't':
          result.tables = value || args[++i];
          break;
        case 'output':
        case 'o':
          result.output = value || args[++i];
          break;
        case 'config':
        case 'c':
          result.config = value || args[++i];
          break;
        case 'verbose':
        case 'v':
          result.verbose = true;
          break;
        case 'no-colors':
          result.colors = false;
          break;
        case 'help':
        case 'h':
          result.help = true;
          break;
        default:
          break;
      }
    } else if (arg.startsWith('-')) {
      const flags = arg.slice(1);
      for (const flag of flags) {
        switch (flag) {
          case 'g':
            result.guests = args[++i];
            break;
          case 't':
            result.tables = args[++i];
            break;
          case 'o':
            result.output = args[++i];
            break;
          case 'c':
            result.config = args[++i];
            break;
          case 'v':
            result.verbose = true;
            break;
          case 'h':
            result.help = true;
            break;
          default:
            break;
        }
      }
    } else if (!result.command) {
      result.command = arg.toLowerCase();
    }

    i++;
  }

  return result;
}

async function loadData(options) {
  const guestsPath = configManager.getGuestsPath(options.guests);
  const tablesPath = configManager.getTablesPath(options.tables);

  const guestsAbsPath = path.resolve(guestsPath);
  const tablesAbsPath = path.resolve(tablesPath);

  if (options.verbose) {
    printer.printInfo(`宾客名单: ${guestsAbsPath}`);
    printer.printInfo(`桌位配置: ${tablesAbsPath}`);
  }

  return parseData(guestsAbsPath, tablesAbsPath);
}

async function runValidate(options) {
  try {
    const data = await loadData(options);
    const result = await validateGuestsAndTables(data.guests, data.tables, data.errors);
    printer.printValidationResult(result);

    if (result.hasCritical || result.hasHigh) {
      process.exitCode = 1;
    }
  } catch (error) {
    printer.printError('执行 validate 命令失败', error);
    process.exitCode = 2;
  }
}

async function runSuggest(options) {
  try {
    const data = await loadData(options);
    const validationResult = await validateGuestsAndTables(data.guests, data.tables, data.errors);
    const result = await generateSuggestions(data.guests, data.tables, validationResult);
    printer.printSuggestions(result);

    if (result.criticalCount > 0 || result.highCount > 0) {
      process.exitCode = 1;
    }
  } catch (error) {
    printer.printError('执行 suggest 命令失败', error);
    process.exitCode = 2;
  }
}

async function runExport(options) {
  try {
    const data = await loadData(options);
    const outputDir = configManager.getOutputPath(options.output);
    const outputAbsPath = path.resolve(outputDir);

    if (options.verbose) {
      printer.printInfo(`输出目录: ${outputAbsPath}`);
    }

    const validationResult = await validateGuestsAndTables(data.guests, data.tables, data.errors);
    
    if (validationResult.hasCritical) {
      printer.printInfo('检测到严重冲突，建议先运行 validate 命令检查并修复问题');
    }

    const result = await exportAll(data.guests, data.tables, outputAbsPath);
    printer.printExportResult(result);
  } catch (error) {
    printer.printError('执行 export 命令失败', error);
    process.exitCode = 2;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  printer.colorsEnabled = options.colors;
  printer.verbose = options.verbose;

  if (options.help || !options.command) {
    printer.printHelp();
    return;
  }

  try {
    await configManager.load(options.config);
  } catch (error) {
    printer.printError('加载配置文件失败', error);
    process.exitCode = 2;
    return;
  }

  switch (options.command) {
    case 'validate':
    case 'check':
      await runValidate(options);
      break;
    case 'suggest':
    case 'advice':
      await runSuggest(options);
      break;
    case 'export':
    case 'output':
      await runExport(options);
      break;
    default:
      printer.printError(`未知命令: ${options.command}`);
      printer.printHelp();
      process.exitCode = 1;
  }
}

main().catch(error => {
  printer.printError('程序执行失败', error);
  process.exitCode = 3;
});
