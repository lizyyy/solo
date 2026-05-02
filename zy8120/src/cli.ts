#!/usr/bin/env node

import { program } from 'commander';
import * as path from 'path';
import { PrecheckEngine } from './precheckEngine';
import { PrecheckOptions } from './types';

interface CliOptions {
  input: string;
  output: string;
  timezone?: string;
  coordTolerance?: number;
  timeTolerance?: number;
  strict?: boolean;
}

program
  .name('inspect-precheck')
  .description('无人机电力巡检影像交付包离线预检工具')
  .version('1.0.0');

program
  .command('check')
  .description('执行预检')
  .requiredOption('-i, --input <path>', '输入目录路径（包含 route.yaml, manifest.csv, defects.jsonl, images/）')
  .requiredOption('-o, --output <path>', '输出目录路径')
  .option('-t, --timezone <zone>', '时区，如 Asia/Shanghai 或 UTC', 'Asia/Shanghai')
  .option('--coord-tolerance <value>', '坐标容差（度），默认 0.001', parseFloat)
  .option('--time-tolerance <minutes>', '时间容差（分钟），默认 30', parseFloat)
  .option('--strict', '严格模式，将警告视为错误')
  .action(async (options: CliOptions) => {
    try {
      const precheckOptions: PrecheckOptions = {
        inputDir: path.resolve(options.input),
        outputDir: path.resolve(options.output),
        timezone: options.timezone,
        coordinateTolerance: options.coordTolerance || 0.001,
        timeToleranceMinutes: options.timeTolerance || 30,
        strict: options.strict || false,
      };

      const engine = new PrecheckEngine(precheckOptions);
      const result = await engine.run();

      if (options.strict && !result.success) {
        process.exit(1);
      }
    } catch (error) {
      console.error('');
      console.error('❌ 预检失败:');
      console.error((error as Error).message);
      console.error('');
      console.error('使用帮助:');
      console.error('  inspect-precheck check -i <input-dir> -o <output-dir>');
      console.error('');
      process.exit(1);
    }
  });

program
  .command('sample')
  .description('生成示例数据（用于测试）')
  .option('-o, --output <path>', '输出目录路径', './sample')
  .action((options: { output: string }) => {
    console.log('使用以下命令生成示例数据后运行预检:');
    console.log('');
    console.log('  npm run dev -- check -i ./sample -o ./sample/output');
    console.log('');
    console.log('或编译后运行:');
    console.log('');
    console.log('  npm run build');
    console.log('  npm start -- check -i ./sample -o ./sample/output');
    console.log('');
  });

program.parse(process.argv);
