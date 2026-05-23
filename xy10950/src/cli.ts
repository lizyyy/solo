import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { CliOptions } from './types';

export function parseArgs(): CliOptions {
  const program = new Command();

  program
    .name('fuel-abnormal')
    .description('货车油耗异常检测CLI工具')
    .version('1.0.0')
    .requiredOption('--vehicles <path>', '车辆信息CSV文件路径')
    .requiredOption('--fuel <path>', '油卡流水CSV文件路径')
    .requiredOption('--mileage <path>', '里程记录CSV文件路径')
    .option('--drivers <path>', '司机信息CSV文件路径')
    .option('--routes <path>', '路线信息CSV文件路径')
    .option('-o, --output <directory>', '输出目录', './output')
    .option('--warning-threshold <number>', '警告阈值（油耗偏差%）', '15')
    .option('--severe-threshold <number>', '严重阈值（油耗偏差%）', '30')
    .option('--critical-threshold <number>', '危急阈值（油耗偏差%）', '50');

  program.parse();
  const options = program.opts();

  return {
    vehicles: options.vehicles,
    fuel: options.fuel,
    mileage: options.mileage,
    drivers: options.drivers || '',
    routes: options.routes || '',
    output: options.output,
    warningThreshold: parseFloat(options.warningThreshold),
    severeThreshold: parseFloat(options.severeThreshold),
    criticalThreshold: parseFloat(options.criticalThreshold)
  };
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function validateOptions(options: CliOptions): void {
  const errors: string[] = [];

  if (!fs.existsSync(options.vehicles)) {
    errors.push(`车辆文件不存在: ${options.vehicles}`);
  } else if (path.extname(options.vehicles).toLowerCase() !== '.csv') {
    errors.push(`车辆文件必须是CSV格式: ${options.vehicles}`);
  }

  if (!fs.existsSync(options.fuel)) {
    errors.push(`油卡流水文件不存在: ${options.fuel}`);
  } else if (path.extname(options.fuel).toLowerCase() !== '.csv') {
    errors.push(`油卡流水文件必须是CSV格式: ${options.fuel}`);
  }

  if (!fs.existsSync(options.mileage)) {
    errors.push(`里程记录文件不存在: ${options.mileage}`);
  } else if (path.extname(options.mileage).toLowerCase() !== '.csv') {
    errors.push(`里程记录文件必须是CSV格式: ${options.mileage}`);
  }

  if (options.drivers && !fs.existsSync(options.drivers)) {
    errors.push(`司机文件不存在: ${options.drivers}`);
  }
  if (options.drivers && path.extname(options.drivers).toLowerCase() !== '.csv') {
    errors.push(`司机文件必须是CSV格式: ${options.drivers}`);
  }

  if (options.routes && !fs.existsSync(options.routes)) {
    errors.push(`路线文件不存在: ${options.routes}`);
  }
  if (options.routes && path.extname(options.routes).toLowerCase() !== '.csv') {
    errors.push(`路线文件必须是CSV格式: ${options.routes}`);
  }

  if (isNaN(options.warningThreshold) || options.warningThreshold < 0) {
    errors.push('警告阈值必须是非负数字');
  }
  if (isNaN(options.severeThreshold) || options.severeThreshold < 0) {
    errors.push('严重阈值必须是非负数字');
  }
  if (isNaN(options.criticalThreshold) || options.criticalThreshold < 0) {
    errors.push('危急阈值必须是非负数字');
  }

  if (options.warningThreshold >= options.severeThreshold) {
    errors.push('警告阈值必须小于严重阈值');
  }
  if (options.severeThreshold >= options.criticalThreshold) {
    errors.push('严重阈值必须小于危急阈值');
  }

  try {
    if (!fs.existsSync(options.output)) {
      fs.mkdirSync(options.output, { recursive: true });
    }
  } catch (error) {
    errors.push(`无法创建输出目录: ${options.output}, 错误: ${(error as Error).message}`);
  }

  if (errors.length > 0) {
    throw new ValidationError(`\n输入校验失败:\n${errors.map(e => `  ❌ ${e}`).join('\n')}`);
  }
}
