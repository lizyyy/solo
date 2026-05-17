#!/usr/bin/env node

import * as yargs from 'yargs';
import chalk from 'chalk';
import { parseLogFile } from './parser';
import { analyzeCacheData } from './analyzer';
import { printTerminalSummary, writeJsonOutput, writeMarkdownOutput } from './output';
import { EXIT_CODES } from './constants';
import { CLIOptions } from './types';

interface ParsedArgs {
  _: string[];
  json: boolean;
  markdown: boolean;
  'output-json'?: string;
  'output-markdown'?: string;
  'output-dir'?: string;
  format: 'github-actions' | 'gitlab-ci' | 'circleci' | 'auto';
  quiet: boolean;
  verbose: boolean;
}

async function main(): Promise<number> {
  const argv = await yargs
    .scriptName('ci-cache-analyzer')
    .usage('$0 <input> [options]')
    .example('$0 build.log', '分析构建日志并在终端显示结果')
    .example('$0 build.log --json --markdown', '生成JSON和Markdown报告')
    .example('$0 build.log --output-dir ./reports', '指定输出目录')
    .positional('input', {
      describe: 'CI 构建日志文件路径',
      type: 'string',
      demandOption: true,
    })
    .option('json', {
      alias: 'j',
      describe: '生成 JSON 格式报告',
      type: 'boolean',
      default: false,
    })
    .option('markdown', {
      alias: 'm',
      describe: '生成 Markdown 格式报告',
      type: 'boolean',
      default: false,
    })
    .option('output-json', {
      describe: '指定 JSON 输出文件路径',
      type: 'string',
    })
    .option('output-markdown', {
      describe: '指定 Markdown 输出文件路径',
      type: 'string',
    })
    .option('output-dir', {
      alias: 'o',
      describe: '指定输出目录',
      type: 'string',
    })
    .option('format', {
      alias: 'f',
      describe: '日志格式 (github-actions, gitlab-ci, circleci, auto)',
      type: 'string',
      choices: ['github-actions', 'gitlab-ci', 'circleci', 'auto'],
      default: 'auto',
    })
    .option('quiet', {
      alias: 'q',
      describe: '静默模式，不输出终端摘要',
      type: 'boolean',
      default: false,
    })
    .option('verbose', {
      alias: 'v',
      describe: '详细输出模式',
      type: 'boolean',
      default: false,
    })
    .help('help')
    .alias('help', 'h')
    .version()
    .alias('version', 'V')
    .argv as unknown as ParsedArgs;

  const options: CLIOptions = {
    input: argv._[0],
    outputJson: argv['output-json'],
    outputMarkdown: argv['output-markdown'],
    outputDir: argv['output-dir'],
    logFormat: argv.format,
    verbose: argv.verbose,
    quiet: argv.quiet,
  };

  try {
    if (options.verbose) {
      console.log(chalk.blue(`开始分析: ${options.input}`));
    }

    const parseResult = await parseLogFile(options);
    
    if (options.verbose) {
      console.log(chalk.blue(`解析完成: ${parseResult.entries.length} 条有效记录`));
    }

    const analysisResult = analyzeCacheData({
      entries: parseResult.entries,
      badLines: parseResult.badLines,
      totalLines: parseResult.totalLines,
      options,
    });

    if (!options.quiet) {
      printTerminalSummary(analysisResult);
    }

    const outputFiles: string[] = [];

    if (argv.json || options.outputJson) {
      const jsonPath = writeJsonOutput(analysisResult, options);
      outputFiles.push(jsonPath);
      if (!options.quiet) {
        console.log(chalk.green(`✓ JSON 报告已保存: ${jsonPath}`));
      }
    }

    if (argv.markdown || options.outputMarkdown) {
      const mdPath = writeMarkdownOutput(analysisResult, options);
      outputFiles.push(mdPath);
      if (!options.quiet) {
        console.log(chalk.green(`✓ Markdown 报告已保存: ${mdPath}`));
      }
    }

    if (options.verbose && outputFiles.length > 0) {
      console.log(chalk.blue(`共生成 ${outputFiles.length} 个输出文件`));
    }

    const hasBadLines = analysisResult.badLines.length > 0;
    const hasCacheMiss = analysisResult.summary.totalCacheMisses > 0;
    const hitRateLow = analysisResult.summary.hitRate < 0.5;

    if (hasBadLines) {
      return EXIT_CODES.PARSE_ERROR;
    }
    if (hitRateLow) {
      return 2;
    }

    return EXIT_CODES.SUCCESS;

  } catch (error) {
    console.error(chalk.red(`错误: ${(error as Error).message}`));
    if (options.verbose) {
      console.error((error as Error).stack);
    }
    return EXIT_CODES.ANALYSIS_ERROR;
  }
}

main().then(exitCode => {
  process.exit(exitCode);
}).catch(error => {
  console.error(chalk.red(`致命错误: ${error.message}`));
  process.exit(EXIT_CODES.ANALYSIS_ERROR);
});
