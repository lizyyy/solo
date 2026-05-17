#!/usr/bin/env node

import { Command } from 'commander';
import ora from 'ora';
import path from 'path';
import { scanPackages } from './scanner/package-scanner.js';
import { scanLockfile } from './scanner/lockfile-scanner.js';
import { scanCIConfigs } from './scanner/ci-scanner.js';
import { buildVersionMatrix } from './matrix/conflict-detector.js';
import { buildReport, generateReports } from './report/report-generator.js';
import { CLIOptions, ScanResult } from './types.js';

const program = new Command();

program
  .name('node-matrix')
  .description('Detect Node.js version conflicts and generate compatibility matrix')
  .version('1.0.0');

program
  .option('-p, --path <path>', 'Project path to scan', process.cwd())
  .option('-o, --output <path>', 'Output directory for reports')
  .option('-f, --format <format>', 'Output format: terminal|json|markdown|all', 'all')
  .option('-c, --ci <path>', 'CI config path (auto-detected if not specified)')
  .option('-s, --strict', 'Enable strict mode (treat warnings as errors)', false)
  .option('--no-dev', 'Exclude dev dependencies')
  .option('-d, --depth <number>', 'Scan depth for directories', '2')
  .action(async (options) => {
    const cliOptions: CLIOptions = {
      path: path.resolve(options.path),
      output: options.output ? path.resolve(options.output) : undefined,
      format: options.format,
      ci: options.ci ? path.resolve(options.ci) : undefined,
      strict: options.strict,
      includeDev: options.dev,
      depth: parseInt(options.depth, 10)
    };

    await runScan(cliOptions);
  });

async function runScan(options: CLIOptions): Promise<void> {
  console.log('\n');
  
  const spinner = ora('Starting Node.js version matrix scan...').start();
  const scanTime = new Date().toISOString();
  
  try {
    spinner.text = 'Scanning packages for version requirements...';
    const { packages, anomalies: pkgAnomalies } = await scanPackages(options.path, {
      depth: options.depth,
      includeDev: options.includeDev
    });
    
    spinner.text = 'Scanning lockfile...';
    const { entries: lockfileEntries, anomalies: lockAnomalies } = await scanLockfile(options.path);
    
    spinner.text = 'Scanning CI configurations...';
    const { configs: ciConfigs, anomalies: ciAnomalies } = await scanCIConfigs(options.path);
    
    spinner.text = 'Building version matrix...';
    const scanResult: ScanResult = {
      packages,
      lockfileEntries,
      ciConfigs,
      requirements: [],
      anomalies: [...pkgAnomalies, ...lockAnomalies, ...ciAnomalies]
    };
    
    const matrix = buildVersionMatrix(scanResult);
    
    spinner.text = 'Generating reports...';
    const report = buildReport(matrix, options.path, scanTime);
    
    await generateReports(report, options);
    
    spinner.succeed('Scan completed successfully!');
    
    if (options.strict && report.summary.errorCount > 0) {
      process.exit(1);
    }
    
  } catch (error) {
    spinner.fail('Scan failed!');
    console.error('\nError:', (error as Error).message);
    console.error((error as Error).stack);
    process.exit(1);
  }
}

program.parseAsync(process.argv)
  .catch(err => {
    console.error('Fatal error:', err.message);
    process.exit(1);
  });
