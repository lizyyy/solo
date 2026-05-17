#!/usr/bin/env node

import { Command } from 'commander';
import { expandYaml } from './expander';
import { OutputGenerator } from './output';
import * as path from 'path';

const program = new Command();

program
  .name('yaml-expand')
  .description('YAML锚点展开工具 - 解析并展开YAML中的锚点和合并键')
  .version('1.0.0');

program
  .requiredOption('-i, --input <file>', '输入YAML文件路径')
  .option('-o, --output-dir <dir>', '输出目录 (默认: 当前目录)')
  .option('-b, --base-name <name>', '输出文件基础名称 (默认: 自动生成带时间戳)')
  .option('--no-json', '不生成JSON输出')
  .option('--no-markdown', '不生成Markdown报告')
  .option('--no-terminal', '不输出终端摘要')
  .option('--no-yaml', '不生成展开后的YAML')
  .action(async (options) => {
    try {
      const expandOptions = {
        inputFile: path.resolve(options.input),
        outputDir: options.outputDir ? path.resolve(options.outputDir) : undefined,
        outputBase: options.baseName,
      };

      const result = expandYaml(expandOptions);

      const output = new OutputGenerator(
        result,
        expandOptions.outputDir || process.cwd()
      );

      const outputs: string[] = [];

      if (options.yaml) {
        outputs.push(output.writeExpandedYaml());
      }

      if (options.json) {
        outputs.push(output.writeJson());
      }

      if (options.markdown) {
        outputs.push(output.writeMarkdown());
      }

      if (options.terminal) {
        output.printTerminalSummary();
      }

      process.exit(result.exitCode);
    } catch (error) {
      console.error('执行失败:', (error as Error).message);
      console.error((error as Error).stack);
      process.exit(1);
    }
  });

program.parseAsync(process.argv).catch((error) => {
  console.error('解析命令行参数失败:', error);
  process.exit(1);
});
