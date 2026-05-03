#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { join, resolve } from 'path';
import { existsSync } from 'fs';
import { runMemoryPrecheck, PrecheckOptions } from './core';

const program = new Command();

program
  .name('memory-precheck')
  .description('Embedded device firmware memory layout pre-check CLI')
  .version('1.0.0');

program
  .command('check')
  .description('Run memory layout pre-check')
  .requiredOption('-m, --linker-map <path>', 'Path to linker.map file')
  .option('-r, --memory-regions <path>', 'Path to memory_regions.yaml file')
  .option('-f, --features <path>', 'Path to features.csv file')
  .option('-b, --bootloader-constraints <path>', 'Path to bootloader_constraints.json file')
  .option('-o, --output <dir>', 'Output directory for reports', './output')
  .option('-v, --verbose', 'Enable verbose output')
  .action((options) => {
    const opts: PrecheckOptions = {
      linkerMap: resolve(options.linkerMap),
      memoryRegions: options.memoryRegions ? resolve(options.memoryRegions) : undefined,
      features: options.features ? resolve(options.features) : undefined,
      bootloaderConstraints: options.bootloaderConstraints ? resolve(options.bootloaderConstraints) : undefined,
      outputDir: resolve(options.output),
      verbose: options.verbose
    };
    
    console.log(chalk.blue('========================================'));
    console.log(chalk.blue('  Firmware Memory Layout Pre-Check'));
    console.log(chalk.blue('========================================'));
    console.log('');
    
    if (!existsSync(opts.linkerMap)) {
      console.error(chalk.red(`Error: Linker map file not found: ${opts.linkerMap}`));
      process.exit(1);
    }
    
    console.log(chalk.cyan('Input files:'));
    console.log(`  - Linker Map: ${opts.linkerMap}`);
    if (opts.memoryRegions) console.log(`  - Memory Regions: ${opts.memoryRegions}`);
    if (opts.features) console.log(`  - Features: ${opts.features}`);
    if (opts.bootloaderConstraints) console.log(`  - Bootloader Constraints: ${opts.bootloaderConstraints}`);
    console.log(`  - Output Directory: ${opts.outputDir}`);
    console.log('');
    
    try {
      console.log(chalk.cyan('Running pre-check...'));
      console.log('');
      
      const result = runMemoryPrecheck(opts);
      
      console.log(chalk.cyan('Results:'));
      console.log(`  - Total Issues: ${result.issuesCount}`);
      console.log(`  - Critical: ${result.criticalCount}`);
      console.log(`  - High: ${result.highCount}`);
      console.log('');
      
      if (result.criticalCount > 0) {
        console.log(chalk.red('❌ CRITICAL issues found! Release blocked.'));
      } else if (result.highCount > 0) {
        console.log(chalk.yellow('⚠️ HIGH issues found. Review recommended.'));
      } else if (result.issuesCount > 0) {
        console.log(chalk.yellow('⚠️ Issues found. Please review.'));
      } else {
        console.log(chalk.green('✅ All checks passed!'));
      }
      console.log('');
      
      console.log(chalk.cyan('Generated Reports:'));
      console.log(`  - Issues CSV: ${result.reports.issuesCsv}`);
      console.log(`  - Memory Report: ${result.reports.memoryReport}`);
      console.log(`  - Layout HTML: ${result.reports.layoutHtml}`);
      console.log('');
      
      if (result.issuesCount > 0) {
        console.log(chalk.cyan('Issues Summary:'));
        for (const issue of result.report.issues) {
          const severityColor = issue.severity === 'CRITICAL' ? chalk.red :
                               issue.severity === 'HIGH' ? chalk.yellow :
                               issue.severity === 'MEDIUM' ? chalk.blue :
                               chalk.gray;
          console.log(`  ${severityColor(`[${issue.severity}]`)} ${issue.id}: ${issue.title}`);
          if (opts.verbose) {
            console.log(`        ${issue.description}`);
          }
        }
        console.log('');
      }
      
      console.log(chalk.cyan('Memory Summary:'));
      console.log(`  Flash: ${formatPercent(result.report.summary.flash.utilization)}% used (${formatSize(result.report.summary.flash.used)} of ${formatSize(result.report.summary.flash.total)})`);
      console.log(`  RAM:   ${formatPercent(result.report.summary.ram.utilization)}% used (${formatSize(result.report.summary.ram.used)} of ${formatSize(result.report.summary.ram.total)})`);
      console.log('');
      
      if (result.criticalCount > 0) {
        process.exit(1);
      } else if (result.highCount > 0) {
        process.exit(2);
      } else {
        process.exit(0);
      }
      
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
      if (opts.verbose) {
        console.error((error as Error).stack);
      }
      process.exit(1);
    }
  });

program
  .command('demo')
  .description('Run pre-check with sample data')
  .option('-o, --output <dir>', 'Output directory for reports', './demo-output')
  .action((options) => {
    const sampleDir = join(__dirname, '..', 'samples');
    
    console.log(chalk.blue('========================================'));
    console.log(chalk.blue('  Demo Mode - Using Sample Data'));
    console.log(chalk.blue('========================================'));
    console.log('');
    
    const result = runMemoryPrecheck({
      linkerMap: join(sampleDir, 'linker.map'),
      memoryRegions: join(sampleDir, 'memory_regions.yaml'),
      features: join(sampleDir, 'features.csv'),
      bootloaderConstraints: join(sampleDir, 'bootloader_constraints.json'),
      outputDir: resolve(options.output)
    });
    
    console.log(chalk.cyan('Demo complete!'));
    console.log('');
    console.log(chalk.cyan('Generated Reports:'));
    console.log(`  - Issues CSV: ${result.reports.issuesCsv}`);
    console.log(`  - Memory Report: ${result.reports.memoryReport}`);
    console.log(`  - Layout HTML: ${result.reports.layoutHtml}`);
    console.log('');
    console.log(chalk.cyan('Try opening layout.html in your browser to see the visualization!'));
  });

program.parse(process.argv);

function formatSize(value: bigint): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = Number(value);
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

function formatPercent(value: number): string {
  return value.toFixed(1);
}
