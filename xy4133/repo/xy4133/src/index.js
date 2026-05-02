#!/usr/bin/env node

import { program } from 'commander';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

import { PodcastTimelineStitcher } from './core/index.js';
import { msToReadable, Severity } from './types.js';

program
  .name('stitcher')
  .description('口播时间轴缝合台 - 播客音频章节整理工具')
  .version('1.0.0');

program
  .command('create')
  .description('创建新项目')
  .argument('<name>', '项目名称')
  .option('-o, --output <dir>', '输出目录', process.cwd())
  .action(async (name, options) => {
    console.log(chalk.blue('🎙️ 口播时间轴缝合台'));
    console.log('');
    
    const stitcher = new PodcastTimelineStitcher({ outputDir: options.output });
    stitcher.createNewProject(name);
    
    const projectPath = path.join(options.output, `${name.replace(/\s+/g, '_')}.pts.json`);
    stitcher.saveProject(projectPath);
    
    console.log(chalk.green(`✅ 项目已创建: ${projectPath}`));
    console.log('');
    console.log('使用以下命令导入文件:');
    console.log(`  stitcher import --project ${projectPath} --wav <audio.wav> --clips <clips.csv> --subtitles <subs.srt> --ads <ads.txt>`);
  });

program
  .command('import')
  .description('导入源文件')
  .option('-p, --project <file>', '项目文件路径')
  .option('-n, --name <name>', '新项目名称 (如果不指定项目文件)')
  .option('--wav <file>', 'WAV音频文件')
  .option('--clips <file>', '片段CSV文件')
  .option('--subtitles <file>', '字幕SRT文件')
  .option('--ads <file>', '广告时间表')
  .option('-o, --output <dir>', '输出目录', process.cwd())
  .action(async (options) => {
    console.log(chalk.blue('🎙️ 口播时间轴缝合台 - 导入文件'));
    console.log('');
    
    let stitcher;
    
    if (options.project) {
      stitcher = new PodcastTimelineStitcher();
      stitcher.loadProject(options.project);
      console.log(chalk.gray(`已加载项目: ${options.project}`));
    } else if (options.name) {
      stitcher = new PodcastTimelineStitcher({ outputDir: options.output });
      stitcher.createNewProject(options.name);
      console.log(chalk.gray(`已创建新项目: ${options.name}`));
    } else {
      console.error(chalk.red('❌ 请提供 --project 或 --name 参数'));
      process.exit(1);
    }
    
    const files = {};
    const imported = [];
    
    if (options.wav) {
      if (!fs.existsSync(options.wav)) {
        console.error(chalk.red(`❌ WAV文件不存在: ${options.wav}`));
        process.exit(1);
      }
      files.wav = options.wav;
      imported.push('WAV音频');
    }
    
    if (options.clips) {
      if (!fs.existsSync(options.clips)) {
        console.error(chalk.red(`❌ 片段文件不存在: ${options.clips}`));
        process.exit(1);
      }
      files.clipsCsv = options.clips;
      imported.push('片段CSV');
    }
    
    if (options.subtitles) {
      if (!fs.existsSync(options.subtitles)) {
        console.error(chalk.red(`❌ 字幕文件不存在: ${options.subtitles}`));
        process.exit(1);
      }
      files.subtitlesSrt = options.subtitles;
      imported.push('字幕SRT');
    }
    
    if (options.ads) {
      if (!fs.existsSync(options.ads)) {
        console.error(chalk.red(`❌ 广告表不存在: ${options.ads}`));
        process.exit(1);
      }
      files.adSchedule = options.ads;
      imported.push('广告表');
    }
    
    if (imported.length === 0) {
      console.error(chalk.red('❌ 请至少指定一个要导入的文件 (--wav, --clips, --subtitles, --ads)'));
      process.exit(1);
    }
    
    console.log(chalk.gray(`正在导入: ${imported.join(', ')}`));
    
    const parsedData = await stitcher.importFiles(files);
    
    console.log(chalk.green('✅ 文件解析完成'));
    console.log('');
    
    if (parsedData.clips) {
      console.log(`📎 片段: ${parsedData.clips.length} 个`);
    }
    if (parsedData.subtitles) {
      console.log(`💬 字幕: ${parsedData.subtitles.length} 条`);
    }
    if (parsedData.ads) {
      console.log(`📢 广告: ${parsedData.ads.length} 个`);
    }
    if (parsedData.wavHeader) {
      console.log(`🎵 音频时长: ${msToReadable(parsedData.wavHeader.duration)}`);
    }
    
    console.log('');
    console.log(chalk.gray('生成时间轴...'));
    
    const timeline = stitcher.generateTimeline(parsedData);
    
    console.log(chalk.green('✅ 时间轴生成完成'));
    console.log(`📖 章节: ${timeline.chapters.length} 个`);
    console.log(`⏱️ 总时长: ${msToReadable(timeline.totalDuration)}`);
    console.log('');
    
    const projectPath = options.project || path.join(options.output, `${stitcher.project.name.replace(/\s+/g, '_')}.pts.json`);
    stitcher.saveProject(projectPath);
    
    console.log(chalk.green(`✅ 项目已保存: ${projectPath}`));
    console.log('');
    console.log('使用以下命令运行检测:');
    console.log(`  stitcher check --project ${projectPath}`);
  });

program
  .command('check')
  .description('运行所有检测')
  .option('-p, --project <file>', '项目文件路径')
  .option('--verbose', '显示详细信息')
  .action(async (options) => {
    console.log(chalk.blue('🎙️ 口播时间轴缝合台 - 运行检测'));
    console.log('');
    
    if (!options.project) {
      console.error(chalk.red('❌ 请提供项目文件路径: --project <file>'));
      process.exit(1);
    }
    
    const stitcher = new PodcastTimelineStitcher();
    stitcher.loadProject(options.project);
    
    console.log(chalk.gray(`已加载项目: ${stitcher.project.name}`));
    console.log('');
    
    console.log(chalk.gray('运行音频检测...'));
    const result = stitcher.runAllChecks();
    
    console.log(chalk.green('✅ 检测完成'));
    console.log('');
    
    console.log('--- 检测结果 ---');
    console.log(``);
    
    const issues = stitcher.getIssues();
    const allIssues = issues.all;
    
    if (allIssues.length === 0) {
      console.log(chalk.green('✅ 没有发现问题!'));
    } else {
      const critical = allIssues.filter(i => i.severity === Severity.CRITICAL).length;
      const high = allIssues.filter(i => i.severity === Severity.HIGH).length;
      const medium = allIssues.filter(i => i.severity === Severity.MEDIUM).length;
      const low = allIssues.filter(i => i.severity === Severity.LOW).length;
      
      console.log(`总计: ${allIssues.length} 个问题`);
      console.log(`🔴 致命: ${critical} | 🟠 高: ${high} | 🟡 中: ${medium} | 🟢 低: ${low}`);
      console.log('');
      
      if (options.verbose || allIssues.length <= 20) {
        for (const issue of allIssues) {
          const severityIcon = issue.severity === Severity.CRITICAL ? '🔴' :
                               issue.severity === Severity.HIGH ? '🟠' :
                               issue.severity === Severity.MEDIUM ? '🟡' : '🟢';
          
          const timeStr = `[${msToReadable(issue.startTime)}]`;
          console.log(`${severityIcon} ${chalk.gray(timeStr)} ${issue.message}`);
        }
      } else {
        console.log(chalk.gray('(使用 --verbose 查看所有问题详情)'));
      }
    }
    
    console.log('');
    
    stitcher.saveProject(options.project);
    console.log(chalk.green(`✅ 项目已更新: ${options.project}`));
    console.log('');
    console.log('使用以下命令导出:');
    console.log(`  stitcher export --project ${options.project} --output ./output/`);
  });

program
  .command('export')
  .description('导出交付文件')
  .option('-p, --project <file>', '项目文件路径')
  .option('-o, --output <dir>', '输出目录', process.cwd())
  .option('--all', '导出所有格式')
  .option('--markdown', '导出Markdown交付单')
  .option('--chapters', '导出章节JSON')
  .option('--issues', '导出问题CSV')
  .action(async (options) => {
    console.log(chalk.blue('🎙️ 口播时间轴缝合台 - 导出文件'));
    console.log('');
    
    if (!options.project) {
      console.error(chalk.red('❌ 请提供项目文件路径: --project <file>'));
      process.exit(1);
    }
    
    const stitcher = new PodcastTimelineStitcher();
    stitcher.loadProject(options.project);
    
    console.log(chalk.gray(`已加载项目: ${stitcher.project.name}`));
    console.log('');
    
    if (!fs.existsSync(options.output)) {
      fs.mkdirSync(options.output, { recursive: true });
    }
    
    const exportAll = options.all || (!options.markdown && !options.chapters && !options.issues);
    
    const baseName = stitcher.project.name.replace(/\s+/g, '_');
    const exported = [];
    
    if (exportAll || options.markdown) {
      const mdPath = path.join(options.output, `${baseName}_交付单.md`);
      fs.writeFileSync(mdPath, stitcher.exportDeliveryNote(), 'utf8');
      exported.push({ type: 'Markdown交付单', path: mdPath });
    }
    
    if (exportAll || options.chapters) {
      const chaptersPath = path.join(options.output, `${baseName}_章节.json`);
      fs.writeFileSync(chaptersPath, stitcher.exportChapters(), 'utf8');
      exported.push({ type: '章节JSON', path: chaptersPath });
    }
    
    if (exportAll || options.issues) {
      const issuesPath = path.join(options.output, `${baseName}_问题清单.csv`);
      fs.writeFileSync(issuesPath, stitcher.exportIssuesCSV(), 'utf8');
      exported.push({ type: '问题清单CSV', path: issuesPath });
    }
    
    console.log(chalk.green('✅ 导出完成'));
    console.log('');
    
    for (const item of exported) {
      console.log(`📄 ${item.type}: ${item.path}`);
    }
  });

program
  .command('report')
  .description('打印检测报告')
  .option('-p, --project <file>', '项目文件路径')
  .action(async (options) => {
    if (!options.project) {
      console.error(chalk.red('❌ 请提供项目文件路径: --project <file>'));
      process.exit(1);
    }
    
    const stitcher = new PodcastTimelineStitcher();
    stitcher.loadProject(options.project);
    
    console.log(stitcher.printReport());
  });

program
  .command('list')
  .description('列出项目')
  .option('-d, --dir <dir>', '搜索目录', process.cwd())
  .action(async (options) => {
    console.log(chalk.blue('🎙️ 口播时间轴缝合台 - 项目列表'));
    console.log('');
    
    const { listProjects } = await import('./persistence/index.js');
    const projects = listProjects(options.dir);
    
    if (projects.length === 0) {
      console.log(chalk.gray(`在 ${options.dir} 中没有找到项目文件 (*.pts.json)`));
    } else {
      for (const proj of projects) {
        const issues = proj.stats?.issues;
        const issueStr = issues ? 
          `(${issues.total || 0} 问题, ${issues.resolved || 0} 已解决)` : '';
        
        console.log(chalk.bold(proj.name));
        console.log(`  📁 ${proj.file}`);
        console.log(`  📅 更新: ${new Date(proj.updatedAt).toLocaleString('zh-CN')} ${issueStr}`);
        console.log('');
      }
    }
  });

program.parse();
