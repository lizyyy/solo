#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';

import { CLIOptions, ServiceRetention, SeverityThresholds } from './types';
import { readConfigFile } from './readers/configReader';
import { readTerraformFile } from './readers/terraformReader';
import { readPlatformFile } from './readers/platformReader';
import { readAliasMap, normalizeServices, filterServices, getSourceTypes } from './normalizer/serviceNormalizer';
import { calculateDifferences, generateReport, determineExitCode } from './diff/diffCalculator';
import { printConsoleSummary, printServiceDetails, printExitCodeInfo } from './reporters/consoleReporter';
import { writeJsonReport } from './reporters/jsonReporter';
import { writeMarkdownReport } from './reporters/markdownReporter';
import { ensureDir } from './readers/fileReader';

const program = new Command();

program
  .name('log-retention-diff')
  .description('比对各服务日志留存策略差异 - 支持配置中心、Terraform、实际平台多源对比')
  .version('1.0.0');

program
  .option('-c, --config <path>', '配置中心导出文件 (JSON/YAML)')
  .option('-t, --terraform <path>', 'Terraform 输出文件 (JSON/YAML)')
  .option('-p, --platform <path>', '实际平台导出文件 (JSON/YAML)')
  .option('-o, --output-dir <path>', '输出目录', './reports')
  .option('-n, --name <name>', '报告名称', 'retention-diff')
  .option('-f, --format <formats...>', '输出格式: console,json,markdown', ['console', 'json', 'markdown'])
  .option('--critical-threshold <days>', '严重差异阈值（天）', '30')
  .option('--warning-threshold <days>', '警告差异阈值（天）', '7')
  .option('-s, --service <name>', '仅检查指定服务')
  .option('-a, --alias-map <path>', '服务别名映射文件 (JSON/YAML)')
  .option('-q, --quiet', '安静模式，不输出终端摘要')
  .option('-v, --verbose', '详细模式，输出所有服务详情');

program.parse(process.argv);

const options = program.opts() as CLIOptions;

async function main(): Promise<number> {
  try {
    validateOptions(options);

    const thresholds: SeverityThresholds = {
      critical: options.thresholds?.critical || parseInt(options.criticalThreshold || '30', 10),
      warning: options.thresholds?.warning || parseInt(options.warningThreshold || '7', 10),
    };

    if (thresholds.warning >= thresholds.critical) {
      throw new Error('警告阈值必须小于严重阈值');
    }

    const allServices: ServiceRetention[] = [];
    const sourceFiles: string[] = [];

    if (options.config) {
      const services = readConfigFile(options.config);
      allServices.push(...services);
      sourceFiles.push(`config: ${options.config} (${services.length} 服务)`);
    }

    if (options.terraform) {
      const services = readTerraformFile(options.terraform);
      allServices.push(...services);
      sourceFiles.push(`terraform: ${options.terraform} (${services.length} 服务)`);
    }

    if (options.platform) {
      const services = readPlatformFile(options.platform);
      allServices.push(...services);
      sourceFiles.push(`platform: ${options.platform} (${services.length} 服务)`);
    }

    if (allServices.length === 0) {
      console.log(chalk.yellow('⚠️  未读取到任何服务配置'));
      return 0;
    }

    const aliasMap = readAliasMap(options.aliasMap);

    let normalizedServices = normalizeServices(allServices, aliasMap);

    if (options.service) {
      normalizedServices = filterServices(normalizedServices, options.service);
      if (normalizedServices.length === 0) {
        console.log(chalk.yellow(`⚠️  未找到匹配的服务: ${options.service}`));
        return 0;
      }
    }

    const sourceTypes = getSourceTypes(normalizedServices);

    const serviceDiffs = calculateDifferences(normalizedServices, thresholds);

    const report = generateReport(
      serviceDiffs,
      sourceTypes,
      options.outputDir,
      sourceFiles,
      thresholds
    );

    ensureDir(options.outputDir);

    const formats = options.format || [];

    if (formats.includes('json')) {
      const jsonPath = writeJsonReport(report, options.outputDir, options.name);
      if (!options.quiet) {
        console.log(chalk.green(`✅ JSON 报告已生成: ${jsonPath}`));
      }
    }

    if (formats.includes('markdown')) {
      const mdPath = writeMarkdownReport(report, options.outputDir, options.name);
      if (!options.quiet) {
        console.log(chalk.green(`✅ Markdown 报告已生成: ${mdPath}`));
      }
    }

    if (formats.includes('console') && !options.quiet) {
      printConsoleSummary(report);
      if (options.verbose) {
        printServiceDetails(serviceDiffs, true);
      } else {
        const inconsistentServices = serviceDiffs.filter(s => s.maxDiffDays > 0);
        printServiceDetails(inconsistentServices, false);
      }
    }

    const exitCode = determineExitCode(report);

    if (!options.quiet && formats.includes('console')) {
      printExitCodeInfo(exitCode);
    }

    return exitCode;

  } catch (error) {
    console.error(chalk.red(`❌ 错误: ${(error as Error).message}`));
    if (options.verbose) {
      console.error((error as Error).stack);
    }
    return 3;
  }
}

function validateOptions(options: CLIOptions): void {
  if (!options.config && !options.terraform && !options.platform) {
    throw new Error('至少需要指定一个数据源: --config, --terraform, 或 --platform');
  }

  const validFormats = ['console', 'json', 'markdown'];
  const formats = options.format || [];
  for (const format of formats) {
    if (!validFormats.includes(format)) {
      throw new Error(`无效的输出格式: ${format}。支持的格式: ${validFormats.join(', ')}`);
    }
  }

  const criticalThreshold = parseInt(options.criticalThreshold || '30', 10);
  const warningThreshold = parseInt(options.warningThreshold || '7', 10);

  if (isNaN(criticalThreshold) || criticalThreshold <= 0) {
    throw new Error('严重阈值必须是正整数');
  }

  if (isNaN(warningThreshold) || warningThreshold <= 0) {
    throw new Error('警告阈值必须是正整数');
  }
}

main().then(code => {
  process.exit(code);
}).catch(() => {
  process.exit(3);
});
