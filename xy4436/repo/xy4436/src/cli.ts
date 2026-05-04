#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';

import {
  projectModel,
  fixtureModel,
  cueModel,
  circuitModel,
  mediaFileModel,
  bannedDeviceModel,
  issueModel,
} from './db/models';

import {
  parseFixturesCsv,
  parseCuesCsv,
  parseCircuitsCsv,
  parseBannedDevicesCsv,
  scanMediaFolder,
} from './parsers/csvParser';

import { runAllValidations } from './validators';
import { exportMarkdown, exportJsonAudit } from './exporters';

const program = new Command();

program
  .name('light-checker')
  .description('灯光巡演预检工具 - 扫描并校验灯光控台导出的文件')
  .version('1.0.0');

program
  .command('projects')
  .description('列出所有项目')
  .action(() => {
    const projects = projectModel.getAll();
    if (projects.length === 0) {
      console.log(chalk.yellow('暂无项目。使用 "light-checker create" 创建新项目。'));
      return;
    }
    
    console.log(chalk.cyan.bold('\n项目列表:\n'));
    for (const p of projects) {
      const summary = projectModel.getSummary(p.id);
      console.log(chalk.cyan(`  ID: ${p.id}`));
      console.log(`  名称: ${p.name}`);
      console.log(`  场地: ${p.venue || '-'}`);
      console.log(`  创建时间: ${new Date(p.createdAt).toLocaleString('zh-CN')}`);
      if (summary) {
        const statusColor = summary.unresolvedIssueCount > 0 ? chalk.red : chalk.green;
        console.log(statusColor(`  问题: ${summary.issueCount} 个 (未解决: ${summary.unresolvedIssueCount})`));
      }
      console.log('');
    }
  });

program
  .command('create')
  .description('创建新项目')
  .option('-n, --name <name>', '项目名称')
  .option('-v, --venue <venue>', '场地名称')
  .action((options) => {
    const name = options.name || `巡演项目 ${new Date().toLocaleDateString('zh-CN')}`;
    const venue = options.venue || '';
    
    const project = projectModel.create(name, venue);
    
    console.log(chalk.green.bold('\n✅ 项目创建成功!'));
    console.log(chalk.cyan(`  项目 ID: ${project.id}`));
    console.log(`  名称: ${project.name}`);
    console.log(`  场地: ${project.venue || '-'}`);
    console.log('');
    console.log(chalk.gray('  使用以下命令导入数据:'));
    console.log(chalk.gray(`    light-checker import --project ${project.id} --dmx <dmx.csv> --cue <cue.csv> --circuit <circuit.csv>`));
    console.log('');
  });

program
  .command('import')
  .description('导入数据到项目')
  .option('-p, --project <projectId>', '项目 ID')
  .option('--dmx <file>', 'DMX 地址表 CSV 文件路径')
  .option('--cue <file>', 'Cue 表 CSV 文件路径')
  .option('--circuit <file>', '电源回路 CSV 文件路径')
  .option('--media <folder>', '素材文件夹路径')
  .option('--banned <file>', '场地禁用设备 CSV 文件路径')
  .option('--overwrite', '覆盖已有数据', false)
  .action(async (options) => {
    const projectId = options.project;
    
    if (!projectId) {
      console.error(chalk.red('错误: 请使用 -p 或 --project 指定项目 ID'));
      process.exit(1);
    }
    
    const project = projectModel.getById(projectId);
    if (!project) {
      console.error(chalk.red(`错误: 项目 ${projectId} 不存在`));
      process.exit(1);
    }
    
    console.log(chalk.cyan.bold(`\n📥 导入数据到项目: ${project.name}\n`));
    
    if (options.overwrite) {
      console.log(chalk.yellow('  覆盖模式: 将清除已有数据\n'));
    }
    
    let totalImported = 0;
    
    try {
      if (options.dmx) {
        const dmxPath = path.resolve(options.dmx);
        if (!await fs.pathExists(dmxPath)) {
          console.error(chalk.red(`  ❌ DMX 地址表文件不存在: ${dmxPath}`));
        } else {
          console.log(chalk.gray(`  解析 DMX 地址表: ${options.dmx}`));
          
          if (options.overwrite) {
            fixtureModel.deleteByProjectId(projectId);
          }
          
          const fixtures = await parseFixturesCsv(dmxPath, projectId);
          for (const f of fixtures) {
            fixtureModel.create(f);
          }
          console.log(chalk.green(`  ✅ 导入 ${fixtures.length} 个灯具`));
          totalImported += fixtures.length;
        }
      }
      
      if (options.cue) {
        const cuePath = path.resolve(options.cue);
        if (!await fs.pathExists(cuePath)) {
          console.error(chalk.red(`  ❌ Cue 表文件不存在: ${cuePath}`));
        } else {
          console.log(chalk.gray(`  解析 Cue 表: ${options.cue}`));
          
          if (options.overwrite) {
            cueModel.deleteByProjectId(projectId);
          }
          
          const cues = await parseCuesCsv(cuePath, projectId);
          for (const c of cues) {
            cueModel.create(c);
          }
          console.log(chalk.green(`  ✅ 导入 ${cues.length} 个 Cue`));
          totalImported += cues.length;
        }
      }
      
      if (options.circuit) {
        const circuitPath = path.resolve(options.circuit);
        if (!await fs.pathExists(circuitPath)) {
          console.error(chalk.red(`  ❌ 回路表文件不存在: ${circuitPath}`));
        } else {
          console.log(chalk.gray(`  解析电源回路表: ${options.circuit}`));
          
          if (options.overwrite) {
            circuitModel.deleteByProjectId(projectId);
          }
          
          const circuits = await parseCircuitsCsv(circuitPath, projectId);
          for (const c of circuits) {
            circuitModel.create(c);
          }
          console.log(chalk.green(`  ✅ 导入 ${circuits.length} 个回路`));
          totalImported += circuits.length;
        }
      }
      
      if (options.media) {
        const mediaPath = path.resolve(options.media);
        if (!await fs.pathExists(mediaPath)) {
          console.error(chalk.red(`  ❌ 素材文件夹不存在: ${mediaPath}`));
        } else {
          console.log(chalk.gray(`  扫描素材文件夹: ${options.media}`));
          
          if (options.overwrite) {
            mediaFileModel.deleteByProjectId(projectId);
          }
          
          const mediaFiles = await scanMediaFolder(mediaPath, projectId);
          for (const m of mediaFiles) {
            mediaFileModel.create({
              projectId,
              name: m.name,
              path: m.path,
              size: m.size,
              fileType: m.fileType,
            });
          }
          console.log(chalk.green(`  ✅ 扫描到 ${mediaFiles.length} 个素材文件`));
          totalImported += mediaFiles.length;
        }
      }
      
      if (options.banned) {
        const bannedPath = path.resolve(options.banned);
        if (!await fs.pathExists(bannedPath)) {
          console.error(chalk.red(`  ❌ 禁用设备文件不存在: ${bannedPath}`));
        } else {
          console.log(chalk.gray(`  解析禁用设备表: ${options.banned}`));
          
          if (options.overwrite) {
            bannedDeviceModel.deleteByProjectId(projectId);
          }
          
          const bannedDevices = await parseBannedDevicesCsv(bannedPath, projectId);
          for (const b of bannedDevices) {
            bannedDeviceModel.create(b);
          }
          console.log(chalk.green(`  ✅ 导入 ${bannedDevices.length} 个禁用设备`));
          totalImported += bannedDevices.length;
        }
      }
      
      console.log(chalk.green.bold(`\n✅ 导入完成! 共导入 ${totalImported} 条数据`));
      console.log('');
      console.log(chalk.gray('  使用以下命令运行校验:'));
      console.log(chalk.gray(`    light-checker validate --project ${projectId}`));
      console.log('');
      
    } catch (error: any) {
      console.error(chalk.red(`\n❌ 导入失败: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('validate')
  .description('运行校验检查')
  .option('-p, --project <projectId>', '项目 ID')
  .option('-r, --revalidate', '重新运行所有校验', false)
  .action(async (options) => {
    const projectId = options.project;
    
    if (!projectId) {
      console.error(chalk.red('错误: 请使用 -p 或 --project 指定项目 ID'));
      process.exit(1);
    }
    
    const project = projectModel.getById(projectId);
    if (!project) {
      console.error(chalk.red(`错误: 项目 ${projectId} 不存在`));
      process.exit(1);
    }
    
    console.log(chalk.cyan.bold(`\n🔍 运行校验: ${project.name}\n`));
    
    const fixtures = fixtureModel.getByProjectId(projectId);
    const cues = cueModel.getByProjectId(projectId);
    const circuits = circuitModel.getByProjectId(projectId);
    const mediaFiles = mediaFileModel.getByProjectId(projectId);
    const bannedDevices = bannedDeviceModel.getByProjectId(projectId);
    
    console.log(chalk.gray(`  灯具: ${fixtures.length} 台`));
    console.log(chalk.gray(`  Cue: ${cues.length} 个`));
    console.log(chalk.gray(`  回路: ${circuits.length} 个`));
    console.log(chalk.gray(`  素材: ${mediaFiles.length} 个`));
    console.log(chalk.gray(`  禁用设备: ${bannedDevices.length} 项`));
    console.log('');
    
    const result = runAllValidations(
      projectId,
      fixtures,
      cues,
      circuits,
      mediaFiles,
      bannedDevices
    );
    
    if (options.revalidate) {
      issueModel.deleteByProjectId(projectId);
    }
    
    for (const issueData of result.issues) {
      issueModel.create(issueData);
    }
    
    const summary = result.summary;
    
    console.log(chalk.bold('  校验结果:'));
    console.log(`    总计: ${summary.total} 个问题`);
    
    if (summary.critical > 0) {
      console.log(chalk.red(`    🔴 严重: ${summary.critical}`));
    }
    if (summary.warning > 0) {
      console.log(chalk.yellow(`    🟡 警告: ${summary.warning}`));
    }
    if (summary.info > 0) {
      console.log(chalk.blue(`    🔵 提示: ${summary.info}`));
    }
    console.log('');
    
    if (summary.total > 0) {
      const unresolved = issueModel.getByProjectId(projectId, false);
      
      if (unresolved.length > 0) {
        console.log(chalk.yellow.bold('  未解决的问题:'));
        console.log('');
        
        for (const issue of unresolved.slice(0, 10)) {
          const icon = issue.severity === 'critical' ? '🔴' : issue.severity === 'warning' ? '🟡' : '🔵';
          console.log(`    ${icon} [${issue.type}] ${issue.title}`);
        }
        
        if (unresolved.length > 10) {
          console.log(chalk.gray(`    ... 还有 ${unresolved.length - 10} 个问题`));
        }
        console.log('');
      }
      
      console.log(chalk.gray('  使用以下命令启动 Web 界面查看详情:'));
      console.log(chalk.gray(`    light-checker server`));
      console.log('');
    } else {
      console.log(chalk.green.bold('  ✅ 所有校验通过!'));
      console.log('');
    }
  });

program
  .command('export')
  .description('导出交接单和审计包')
  .option('-p, --project <projectId>', '项目 ID')
  .option('-m, --markdown <path>', '导出 Markdown 交接单到指定路径')
  .option('-j, --json <path>', '导出 JSON 审计包到指定路径')
  .action(async (options) => {
    const projectId = options.project;
    
    if (!projectId) {
      console.error(chalk.red('错误: 请使用 -p 或 --project 指定项目 ID'));
      process.exit(1);
    }
    
    const project = projectModel.getById(projectId);
    if (!project) {
      console.error(chalk.red(`错误: 项目 ${projectId} 不存在`));
      process.exit(1);
    }
    
    const fixtures = fixtureModel.getByProjectId(projectId);
    const cues = cueModel.getByProjectId(projectId);
    const circuits = circuitModel.getByProjectId(projectId);
    const mediaFiles = mediaFileModel.getByProjectId(projectId);
    const bannedDevices = bannedDeviceModel.getByProjectId(projectId);
    const issues = issueModel.getByProjectId(projectId);
    
    console.log(chalk.cyan.bold(`\n📤 导出数据: ${project.name}\n`));
    
    if (options.markdown) {
      try {
        const outputPath = await exportMarkdown(
          path.resolve(options.markdown),
          project,
          fixtures,
          cues,
          circuits,
          mediaFiles,
          issues,
          bannedDevices
        );
        console.log(chalk.green(`  ✅ Markdown 交接单已导出: ${outputPath}`));
      } catch (error: any) {
        console.error(chalk.red(`  ❌ 导出 Markdown 失败: ${error.message}`));
      }
    }
    
    if (options.json) {
      try {
        const outputPath = await exportJsonAudit(
          path.resolve(options.json),
          project,
          fixtures,
          cues,
          circuits,
          mediaFiles,
          bannedDevices,
          issues
        );
        console.log(chalk.green(`  ✅ JSON 审计包已导出: ${outputPath}`));
      } catch (error: any) {
        console.error(chalk.red(`  ❌ 导出 JSON 失败: ${error.message}`));
      }
    }
    
    if (!options.markdown && !options.json) {
      console.log(chalk.yellow('  未指定导出格式。使用 -m 导出 Markdown，使用 -j 导出 JSON。'));
    }
    
    console.log('');
  });

program
  .command('server')
  .description('启动本地 HTTP 服务')
  .option('-p, --port <port>', '端口号 (默认: 3000)', '3000')
  .action((options) => {
    const port = parseInt(options.port, 10) || 3000;
    
    console.log(chalk.cyan.bold(`\n🚀 启动本地 HTTP 服务...`));
    console.log(chalk.gray(`  端口: ${port}`));
    console.log(chalk.gray(`  访问: http://localhost:${port}`));
    console.log('');
    
    const serverPath = path.join(__dirname, 'server.js');
    process.env.PORT = String(port);
    
    require(serverPath);
  });

program.parse(process.argv);
