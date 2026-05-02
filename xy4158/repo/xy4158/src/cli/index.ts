#!/usr/bin/env node

import * as yargs from 'yargs';
import * as path from 'path';
import * as chalk from 'chalk';
import { ProjectStorage } from '../storage';
import { FileScanner } from '../scanner';
import { TimelineCalibrator } from '../timeline';
import { RuleValidator } from '../validator';
import { DataExporter } from '../exporter';
import { DeviceConfig } from '../types';

const console = {
  info: (msg: string) => process.stdout.write(`${chalk.blue('info')}  ${msg}\n`),
  success: (msg: string) => process.stdout.write(`${chalk.green('success')} ${msg}\n`),
  error: (msg: string) => process.stderr.write(`${chalk.red('error')}  ${msg}\n`),
  warn: (msg: string) => process.stdout.write(`${chalk.yellow('warn')}  ${msg}\n`),
  log: (msg: string) => process.stdout.write(`${msg}\n`)
};

function getProjectDir(customDir?: string): string {
  return customDir || process.cwd();
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

yargs
  .scriptName('ocv')
  .usage('$0 <command> [options]')
  .demandCommand(1, '请指定一个命令')

  .command(
    'init [name]',
    '初始化新项目',
    (yargs) => {
      return yargs
        .positional('name', {
          describe: '项目名称',
          type: 'string',
          default: 'offline-collection'
        })
        .option('description', {
          alias: 'd',
          describe: '项目描述',
          type: 'string'
        })
        .option('dir', {
          alias: 'D',
          describe: '项目目录',
          type: 'string'
        });
    },
    async (argv) => {
      const projectDir = getProjectDir(argv.dir as string);
      const storage = new ProjectStorage({ projectDir });

      if (storage.projectExists()) {
        console.error(`项目已存在于: ${projectDir}`);
        process.exit(1);
      }

      const state = storage.initProject(
        argv.name as string,
        argv.description as string
      );

      console.success(`项目已初始化: ${state.config.name}`);
      console.log(`项目目录: ${projectDir}`);
      console.log('');
      console.log('下一步:');
      console.log('  1. 添加设备: ocv add-device');
      console.log('  2. 导入采集包: ocv import <path>');
    }
  )

  .command(
    'add-device',
    '添加或更新设备配置',
    (yargs) => {
      return yargs
        .option('id', {
          alias: 'i',
          describe: '设备ID',
          type: 'string',
          demandOption: true
        })
        .option('name', {
          alias: 'n',
          describe: '设备名称',
          type: 'string',
          demandOption: true
        })
        .option('type', {
          alias: 't',
          describe: '设备类型 (logger, camera, sensor)',
          type: 'string',
          default: 'logger',
          choices: ['logger', 'camera', 'sensor']
        })
        .option('interval', {
          alias: 'I',
          describe: '预期采集间隔（分钟）',
          type: 'number',
          default: 5
        })
        .option('offset', {
          alias: 'O',
          describe: '时间偏移（分钟，正数表示设备时间比实际慢）',
          type: 'number'
        })
        .option('dir', {
          alias: 'D',
          describe: '项目目录',
          type: 'string'
        });
    },
    async (argv) => {
      const projectDir = getProjectDir(argv.dir as string);
      const storage = new ProjectStorage({ projectDir });

      if (!storage.projectExists()) {
        console.error(`项目不存在于: ${projectDir}`);
        console.log('请先运行: ocv init');
        process.exit(1);
      }

      storage.loadProject();

      const device: DeviceConfig = {
        id: argv.id as string,
        name: argv.name as string,
        type: argv.type as DeviceConfig['type'],
        expectedInterval: argv.interval as number
      };

      if (argv.offset !== undefined) {
        device.timeOffset = argv.offset as number;
      }

      storage.addDevice(device);
      console.success(`设备已添加: ${device.id} - ${device.name}`);
    }
  )

  .command(
    'list-devices',
    '列出所有设备',
    (yargs) => {
      return yargs
        .option('dir', {
          alias: 'D',
          describe: '项目目录',
          type: 'string'
        });
    },
    async (argv) => {
      const projectDir = getProjectDir(argv.dir as string);
      const storage = new ProjectStorage({ projectDir });

      if (!storage.projectExists()) {
        console.error(`项目不存在于: ${projectDir}`);
        process.exit(1);
      }

      const state = storage.loadProject();

      if (state.config.devices.length === 0) {
        console.warn('暂无设备配置');
        return;
      }

      console.log('设备列表:');
      console.log('');
      for (const device of state.config.devices) {
        console.log(`  ${chalk.bold(device.id)} - ${device.name}`);
        console.log(`    类型: ${device.type}`);
        console.log(`    采集间隔: ${device.expectedInterval} 分钟`);
        if (device.timeOffset !== undefined) {
          console.log(`    时间偏移: ${device.timeOffset} 分钟`);
        }
        console.log('');
      }
    }
  )

  .command(
    'import <path>',
    '导入采集包目录',
    (yargs) => {
      return yargs
        .positional('path', {
          describe: '采集包目录路径',
          type: 'string',
          demandOption: true
        })
        .option('dir', {
          alias: 'D',
          describe: '项目目录',
          type: 'string'
        })
        .option('force', {
          alias: 'f',
          describe: '强制重新扫描',
          type: 'boolean',
          default: false
        });
    },
    async (argv) => {
      const projectDir = getProjectDir(argv.dir as string);
      const storage = new ProjectStorage({ projectDir });

      if (!storage.projectExists()) {
        console.error(`项目不存在于: ${projectDir}`);
        process.exit(1);
      }

      const state = storage.loadProject();
      const importPath = path.resolve(argv.path as string);

      console.info(`扫描目录: ${importPath}`);

      const scanner = new FileScanner({
        basePath: importPath,
        rules: state.config.rules,
        devices: state.config.devices
      });

      const files = await scanner.scan();
      
      console.success(`扫描完成，共发现 ${files.length} 个文件`);
      
      const validCount = files.filter(f => f.isValid).length;
      const invalidCount = files.filter(f => !f.isValid).length;
      
      console.log(`  有效文件: ${validCount}`);
      console.log(`  无效文件: ${invalidCount}`);

      const duplicates = scanner.getDuplicateFiles();
      if (duplicates.length > 0) {
        const dupCount = duplicates.reduce((sum, g) => sum + g.length - 1, 0);
        console.warn(`发现 ${dupCount} 个重复文件`);
      }

      storage.updateScannedFiles(files);
      console.success(`文件列表已保存到项目`);

      console.info('开始构建时间线...');
      const calibrator = new TimelineCalibrator({
        devices: state.config.devices
      });

      const timeline = await calibrator.buildTimeline(files);
      storage.updateTimeline(timeline);

      console.success(`时间线构建完成，共 ${timeline.length} 个时间点`);
      console.log('');
      console.log('下一步:');
      console.log('  运行验证: ocv validate');
    }
  )

  .command(
    'validate',
    '运行规则校验',
    (yargs) => {
      return yargs
        .option('dir', {
          alias: 'D',
          describe: '项目目录',
          type: 'string'
        });
    },
    async (argv) => {
      const projectDir = getProjectDir(argv.dir as string);
      const storage = new ProjectStorage({ projectDir });

      if (!storage.projectExists()) {
        console.error(`项目不存在于: ${projectDir}`);
        process.exit(1);
      }

      const state = storage.loadProject();

      if (state.scannedFiles.length === 0) {
        console.error('没有已扫描的文件，请先运行: ocv import <path>');
        process.exit(1);
      }

      console.info('开始规则校验...');

      const validator = new RuleValidator({
        rules: state.config.rules,
        devices: state.config.devices
      });

      const issues = await validator.validateAll(
        state.scannedFiles,
        state.timelineEntries
      );

      storage.updateIssues(issues);

      const stats = validator.getStatistics();
      console.success(`校验完成，共发现 ${stats.total} 个问题`);
      console.log('');
      console.log('问题分布:');
      console.log(`  严重 (Critical): ${stats.bySeverity.critical}`);
      console.log(`  高优先级 (High): ${stats.bySeverity.high}`);
      console.log(`  中优先级 (Medium): ${stats.bySeverity.medium}`);
      console.log(`  低优先级 (Low): ${stats.bySeverity.low}`);
      console.log('');

      if (stats.total > 0) {
        console.log('问题类型:');
        for (const [type, count] of Object.entries(stats.byType)) {
          console.log(`  ${type}: ${count}`);
        }
      }

      console.log('');
      console.log('quarantine.json 已生成');
      console.log('');
      console.log('下一步:');
      console.log('  导出报告: ocv export report');
      console.log('  导出问题清单: ocv export csv');
      console.log('  导出清洗索引: ocv export json');
    }
  )

  .command(
    'export <type>',
    '导出验收报告',
    (yargs) => {
      return yargs
        .positional('type', {
          describe: '导出类型 (report, csv, json)',
          type: 'string',
          demandOption: true,
          choices: ['report', 'csv', 'json']
        })
        .option('output', {
          alias: 'o',
          describe: '输出文件路径',
          type: 'string'
        })
        .option('dir', {
          alias: 'D',
          describe: '项目目录',
          type: 'string'
        });
    },
    async (argv) => {
      const projectDir = getProjectDir(argv.dir as string);
      const storage = new ProjectStorage({ projectDir });

      if (!storage.projectExists()) {
        console.error(`项目不存在于: ${projectDir}`);
        process.exit(1);
      }

      const state = storage.loadProject();
      const exporter = new DataExporter({ projectState: state });

      const type = argv.type as string;
      let outputPath = argv.output as string;

      if (!outputPath) {
        switch (type) {
          case 'report':
            outputPath = storage.getReportPath('validation-report.md');
            break;
          case 'csv':
            outputPath = storage.getExportPath('issues.csv');
            break;
          case 'json':
            outputPath = storage.getExportPath('clean-index.json');
            break;
        }
      }

      switch (type) {
        case 'report':
          exporter.exportMarkdownReport(outputPath);
          console.success(`Markdown 报告已导出: ${outputPath}`);
          break;
        case 'csv':
          exporter.exportCsvIssues(outputPath);
          console.success(`CSV 问题清单已导出: ${outputPath}`);
          break;
        case 'json':
          exporter.exportCleanIndex(outputPath);
          console.success(`JSON 清洗索引已导出: ${outputPath}`);
          break;
      }
    }
  )

  .command(
    'status',
    '显示项目状态',
    (yargs) => {
      return yargs
        .option('dir', {
          alias: 'D',
          describe: '项目目录',
          type: 'string'
        });
    },
    async (argv) => {
      const projectDir = getProjectDir(argv.dir as string);
      const storage = new ProjectStorage({ projectDir });

      if (!storage.projectExists()) {
        console.error(`项目不存在于: ${projectDir}`);
        process.exit(1);
      }

      const state = storage.loadProject();
      const stats = storage.getStatistics();

      console.log('');
      console.log(chalk.bold(`项目: ${state.config.name}`));
      if (state.config.description) {
        console.log(state.config.description);
      }
      console.log('');
      console.log('统计概览:');
      console.log(`  设备数: ${stats.devices}`);
      console.log(`  总文件数: ${stats.totalFiles}`);
      console.log(`  有效文件: ${stats.validFiles}`);
      console.log(`  无效文件: ${stats.invalidFiles}`);
      console.log(`  总问题数: ${stats.totalIssues}`);
      console.log(`  严重问题: ${stats.criticalIssues}`);
      console.log(`  已隔离文件: ${stats.quarantinedFiles}`);
      console.log('');

      if (state.lastScanned) {
        console.log(`上次扫描: ${state.lastScanned}`);
      }
      if (state.lastValidated) {
        console.log(`上次验证: ${state.lastValidated}`);
      }
    }
  )

  .command(
    'quarantine <fileId> <issueId>',
    '隔离问题文件',
    (yargs) => {
      return yargs
        .positional('fileId', {
          describe: '文件ID',
          type: 'string',
          demandOption: true
        })
        .positional('issueId', {
          describe: '问题ID',
          type: 'string',
          demandOption: true
        })
        .option('dir', {
          alias: 'D',
          describe: '项目目录',
          type: 'string'
        });
    },
    async (argv) => {
      const projectDir = getProjectDir(argv.dir as string);
      const storage = new ProjectStorage({ projectDir });

      if (!storage.projectExists()) {
        console.error(`项目不存在于: ${projectDir}`);
        process.exit(1);
      }

      const state = storage.loadProject();
      const file = state.scannedFiles.find(f => f.id === argv.fileId);

      if (!file) {
        console.error(`文件不存在: ${argv.fileId}`);
        process.exit(1);
      }

      const quarantinePath = await storage.quarantineFile(
        file.path,
        argv.issueId as string,
        argv.fileId as string
      );

      console.success(`文件已隔离: ${quarantinePath}`);
    }
  )

  .help('help')
  .alias('help', 'h')
  .version()
  .alias('version', 'v')
  .epilog('离线采集包验收器 - Offline Collection Validator')
  .argv;
