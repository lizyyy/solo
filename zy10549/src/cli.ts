#!/usr/bin/env node

import { Command } from 'commander';
import * as path from 'path';
import { FileScanner } from './scanner';
import { RouteParser } from './route-parser';
import { PageParser } from './page-parser';
import { OrphanDetector } from './orphan-detector';
import { ReportGenerator } from './report-generator';
import { DEFAULT_OPTIONS } from './config';
import { CliOptions, RouteConfig, PageFile, ScanResult } from './types';

const program = new Command();

program
  .name('route-orphan')
  .description('前端路由孤儿排查工具 - 检测SPA项目中路由与页面文件不匹配的问题')
  .version('1.0.0')
  .option('-s, --source <dir>', '源码目录路径', process.cwd())
  .option('-o, --output <dir>', '报告输出目录', path.join(process.cwd(), 'route-orphan-report'))
  .option('--route-patterns <patterns>', '路由文件匹配模式（逗号分隔）')
  .option('--page-patterns <patterns>', '页面文件匹配模式（逗号分隔）')
  .option('--exclude <patterns>', '排除文件模式（逗号分隔）')
  .option('--framework <type>', '框架类型: vue|react|auto', 'auto')
  .option('--format <formats>', '输出格式: terminal,json,html（逗号分隔）')
  .option('--strict', '严格模式，更多警告转为错误', false)
  .option('--quiet', '静默模式，减少终端输出', false)
  .action(async (options) => {
    await runScan(options);
  });

async function runScan(cmdOptions: any): Promise<void> {
  const startTime = Date.now();

  const options: CliOptions = {
    source: path.resolve(cmdOptions.source),
    output: path.resolve(cmdOptions.output),
    routePatterns: cmdOptions.routePatterns 
      ? cmdOptions.routePatterns.split(',') 
      : DEFAULT_OPTIONS.routePatterns as string[],
    pagePatterns: cmdOptions.pagePatterns 
      ? cmdOptions.pagePatterns.split(',') 
      : DEFAULT_OPTIONS.pagePatterns as string[],
    excludePatterns: cmdOptions.exclude 
      ? cmdOptions.exclude.split(',') 
      : DEFAULT_OPTIONS.excludePatterns as string[],
    framework: cmdOptions.framework,
    format: cmdOptions.format 
      ? cmdOptions.format.split(',') 
      : DEFAULT_OPTIONS.format as string[],
    strict: cmdOptions.strict,
    quiet: cmdOptions.quiet
  };

  if (!options.quiet) {
    console.log('\n🔍 开始扫描...');
    console.log(`   源码目录: ${options.source}`);
    console.log(`   输出目录: ${options.output}\n`);
  }

  try {
    const scanner = new FileScanner(options);
    const routeParser = new RouteParser(options);
    const pageParser = new PageParser(options.source);
    const detector = new OrphanDetector(options);
    const reporter = new ReportGenerator(options.output);

    const routeFiles = await scanner.findRouteFiles();
    const pageFiles = await scanner.findPageFiles();

    if (!options.quiet) {
      console.log(`📁 发现 ${routeFiles.length} 个路由文件`);
      console.log(`📁 发现 ${pageFiles.length} 个页面文件\n`);
    }

    const allRoutes: RouteConfig[] = [];
    for (const routeFile of routeFiles) {
      const routes = await routeParser.parseRouteFile(routeFile);
      routes.forEach(r => {
        r.rawSource = scanner.getRelativePath(routeFile);
      });
      allRoutes.push(...routes);
    }

    const allPages: PageFile[] = [];
    for (const pageFile of pageFiles) {
      const page = await pageParser.parsePageFile(pageFile);
      allPages.push(page);
    }

    const result: ScanResult = detector.detect(allRoutes, allPages);

    reporter.generate(result, options.format);

    if (result.summary.orphanCount > 0) {
      process.exitCode = options.strict ? 1 : 0;
    }
  } catch (error) {
    console.error('\n❌ 扫描过程出错:', (error as Error).message);
    console.error((error as Error).stack);
    process.exit(1);
  }
}

program.parse();