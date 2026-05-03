#!/usr/bin/env node

import { Command } from 'commander';
import * as path from 'path';
import { CLIConfig } from './types';
import { ReplayAnalyzer } from './analyzer/replayAnalyzer';
import { logger } from './utils/logger';

const program = new Command();

program
  .name('canary-replay')
  .description('TypeScript CLI for offline replay of gateway canary policies')
  .version('1.0.0');

program
  .command('replay')
  .description('Run canary policy replay analysis')
  .option('-r, --routes <path>', 'Path to routes.yaml file', './data/routes.yaml')
  .option('-t, --traffic <path>', 'Path to traffic_samples.jsonl file', './data/traffic_samples.jsonl')
  .option('-c, --canary <path>', 'Path to canary_policy.yaml file', './data/canary_policy.yaml')
  .option('-H, --health <path>', 'Path to service_health.csv file', './data/service_health.csv')
  .option('-o, --output <path>', 'Output directory for reports', './output')
  .option('-v, --verbose', 'Enable verbose output', false)
  .action(async (options) => {
    try {
      const config: CLIConfig = {
        routesPath: path.resolve(options.routes),
        trafficSamplesPath: path.resolve(options.traffic),
        canaryPolicyPath: path.resolve(options.canary),
        serviceHealthPath: path.resolve(options.health),
        outputDir: path.resolve(options.output),
        verbose: options.verbose
      };

      const analyzer = new ReplayAnalyzer(config);
      await analyzer.run();
    } catch (error) {
      logger.error('Analysis failed', error);
      process.exit(1);
    }
  });

program
  .command('init')
  .description('Initialize sample data files')
  .option('-d, --data-dir <path>', 'Directory to create sample files in', './data')
  .action((options) => {
    console.log(`Sample files should be created in: ${options.dataDir}`);
    console.log('Please refer to the README for sample data structure.');
  });

program.parse(process.argv);
