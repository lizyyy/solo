#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { Parser } from './parser.js';
import { Validator } from './validator.js';
import { Summarizer } from './summarizer.js';
import { Reporter } from './reporter.js';

const argv = yargs(hideBin(process.argv))
  .option('old', {
    alias: 'o',
    type: 'string',
    description: '旧版本模板数据目录路径',
    demandOption: true
  })
  .option('new', {
    alias: 'n',
    type: 'string',
    description: '新版本模板数据目录路径',
    demandOption: true
  })
  .option('output', {
    alias: 'd',
    type: 'string',
    description: '报告输出目录',
    default: './output'
  })
  .option('expected-variables', {
    type: 'array',
    description: '期望的模板变量列表',
    default: []
  })
  .help()
  .argv;

async function main() {
  try {
    const parser = new Parser();
    const validator = new Validator({
      expectedVariables: argv.expectedVariables
    });
    const summarizer = new Summarizer();
    const reporter = new Reporter(argv.output);

    const [oldParseResult, newParseResult] = await Promise.all([
      parser.parseDirectory(argv.old),
      parser.parseDirectory(argv.new)
    ]);

    const oldValidated = validator.validate(oldParseResult.records, 'old');
    const newValidated = validator.validate(newParseResult.records, 'new');

    const validationDiffs = validator.compareValidation(
      oldValidated,
      newValidated
    );

    const result = summarizer.compare(
      {
        records: oldValidated.records,
        errors: [...oldParseResult.errors],
        warnings: [...oldParseResult.warnings]
      },
      {
        records: newValidated.records,
        errors: [...newParseResult.errors],
        warnings: [...newParseResult.warnings]
      }
    );

    result.validationDifferences = validationDiffs;

    await reporter.generate(result);

    process.exit(0);
  } catch (error) {
    console.error('❌ 执行失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
