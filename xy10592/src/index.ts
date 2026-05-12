#! /usr/bin/env node

import * as path from 'path';
import {
  createContext,
  executeInit,
  executeImport,
  executeCheck,
  executeDetail,
  executeReport,
  printHelp
} from './cli/commands';

interface ParsedArgs {
  command: string | null;
  options: Record<string, string | number | boolean>;
  positional: string[];
}

function parseArgs(args: string[]): ParsedArgs {
  const result: ParsedArgs = {
    command: null,
    options: {},
    positional: []
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg.startsWith('--')) {
      const eqIndex = arg.indexOf('=');
      let key: string;
      let value: string | boolean;

      if (eqIndex > 0) {
        key = arg.substring(2, eqIndex);
        value = arg.substring(eqIndex + 1);
      } else {
        key = arg.substring(2);
        const nextArg = args[i + 1];
        if (nextArg && !nextArg.startsWith('--')) {
          value = nextArg;
          i++;
        } else {
          value = true;
        }
      }

      if (key === 'help') {
        result.options['help'] = true;
      } else {
        const numValue = Number(value);
        if (!isNaN(numValue) && typeof value === 'string') {
          result.options[key] = numValue;
        } else {
          result.options[key] = value;
        }
      }
    } else if (arg.startsWith('-')) {
      const shortOpt = arg.substring(1);
      if (shortOpt === 'h') {
        result.options['help'] = true;
      } else {
        result.options[shortOpt] = true;
      }
    } else if (!result.command) {
      result.command = arg;
    } else {
      result.positional.push(arg);
    }

    i++;
  }

  return result;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const parsed = parseArgs(args);

  if (parsed.options['help'] || !parsed.command) {
    printHelp();
    process.exit(0);
  }

  const dataDir = (parsed.options['data-dir'] as string) || './data';
  const ctx = createContext(path.resolve(dataDir));

  try {
    switch (parsed.command) {
      case 'init':
        await executeInit(ctx);
        break;

      case 'import':
        await executeImport(ctx, {
          sample: !!parsed.options['sample'],
          invalid: !!parsed.options['invalid'],
          file: parsed.options['file'] as string
        });
        break;

      case 'check':
        await executeCheck(ctx);
        break;

      case 'detail':
        if (parsed.positional.length === 0) {
          console.error('✗ 请指定资产 ID 或编号');
          process.exit(1);
        }
        await executeDetail(ctx, parsed.positional[0]);
        break;

      case 'report':
        await executeReport(ctx, {
          year: parsed.options['year'] as number,
          month: parsed.options['month'] as number,
          store: parsed.options['store'] as string
        });
        break;

      default:
        console.error(`✗ 未知命令: ${parsed.command}`);
        printHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error('\n✗ 执行出错:');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
