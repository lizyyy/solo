#!/usr/bin/env node

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import chalk from 'chalk';
import dayjs from 'dayjs';
import express from 'express';

import { Parser } from './parser';
import { CacheEngine } from './cache-engine';
import { TimelineReplay } from './timeline-replay';
import { Exporter } from './exporter';
import { PreviewGenerator } from './preview-generator';
import { CacheReport } from './types';

const program = new Command();

program
  .name('graphql-cache-replay')
  .description('GraphQL BFF cache invalidation replay tool for offline analysis')
  .version('1.0.0');

program
  .command('replay')
  .description('Replay cache operations and generate analysis report')
  .option('-s, --schema <path>', 'Path to schema.graphql file', 'schema.graphql')
  .option('-o, --operations <path>', 'Path to operations.jsonl file', 'operations.jsonl')
  .option('-p, --policy <path>', 'Path to cache-policy.yaml file', 'cache-policy.yaml')
  .option('-m, --mutations <path>', 'Path to mutation-events.jsonl file', 'mutation-events.jsonl')
  .option('-d, --output-dir <path>', 'Output directory for generated files', '.')
  .option('--no-preview', 'Skip generating preview.html')
  .option('--no-csv', 'Skip generating issues.csv')
  .option('--no-md', 'Skip generating cache_report.md')
  .action(async (options) => {
    console.log(chalk.blue('🔄 Starting GraphQL Cache Replay Analysis...'));
    console.log('');

    const baseDir = process.cwd();
    const outputDir = path.resolve(options.outputDir);

    const parser = new Parser(baseDir);

    try {
      console.log(chalk.gray('  Parsing input files...'));

      const schemaDoc = await parser.parseSchema(options.schema);
      console.log(chalk.green('  ✓'), 'Schema parsed successfully');

      const cachePolicy = await parser.parseCachePolicy(options.policy);
      console.log(chalk.green('  ✓'), 'Cache policy loaded');

      const operations = await parser.parseOperations(options.operations);
      console.log(chalk.green('  ✓'), `Loaded ${operations.length} query operations`);

      const mutations = await parser.parseMutationEvents(options.mutations);
      console.log(chalk.green('  ✓'), `Loaded ${mutations.length} mutation events`);

      console.log('');
      console.log(chalk.gray('  Initializing cache engine...'));
      const cacheEngine = new CacheEngine(cachePolicy);
      console.log(chalk.green('  ✓'), 'Cache engine initialized');

      console.log('');
      console.log(chalk.gray('  Checking for circular dependencies...'));
      const cycleResult = cacheEngine.detectCircularDependencies();
      if (cycleResult.hasCycle) {
        console.log(chalk.yellow('  ⚠'), 'Circular dependencies detected:');
        for (const cycle of cycleResult.cycles) {
          console.log(chalk.yellow('     →'), cycle.join(' → '));
        }
      } else {
        console.log(chalk.green('  ✓'), 'No circular dependencies found');
      }

      console.log('');
      console.log(chalk.gray('  Starting timeline replay...'));
      const timelineReplay = new TimelineReplay(
        cacheEngine,
        parser,
        schemaDoc,
        operations,
        mutations
      );

      const report = timelineReplay.replay();
      console.log(chalk.green('  ✓'), 'Timeline replay completed');

      console.log('');
      console.log(chalk.blue('📊 Replay Summary'));
      console.log(chalk.gray('='.repeat(50)));
      console.log(`  Queries:    ${report.summary.totalQueries}`);
      console.log(`  Mutations:  ${report.summary.totalMutations}`);
      console.log(`  Cache Hits: ${report.summary.cacheHits}`);
      console.log(`  Cache Miss: ${report.summary.cacheMisses}`);
      console.log(`  Hit Rate:   ${(report.summary.cacheHitRate * 100).toFixed(1)}%`);
      console.log(`  Invalidations: ${report.summary.invalidations}`);
      console.log(`  Total Issues: ${report.summary.issues.total}`);

      if (report.summary.issues.total > 0) {
        console.log('');
        console.log(chalk.yellow('⚠ Issues Detected:'));
        for (const [type, count] of Object.entries(report.summary.issues.byType)) {
          console.log(`  ${type}: ${count}`);
        }
      }

      console.log('');
      console.log(chalk.gray('  Generating output files...'));

      const exporter = new Exporter(outputDir);

      if (options.csv) {
        const allIssues = report.timeline.flatMap(t => t.issues);
        const csvPath = await exporter.exportIssuesCSV(allIssues);
        console.log(chalk.green('  ✓'), `issues.csv written to ${csvPath}`);
      }

      if (options.md) {
        const mdPath = await exporter.exportCacheReportMD(report);
        console.log(chalk.green('  ✓'), `cache_report.md written to ${mdPath}`);
      }

      if (options.preview) {
        const previewGen = new PreviewGenerator(outputDir);
        const previewPath = await previewGen.generatePreview(report);
        console.log(chalk.green('  ✓'), `preview.html written to ${previewPath}`);
      }

      console.log('');
      console.log(chalk.green('✅ Analysis complete!'));
      console.log('');
      console.log(chalk.gray('  Quick commands:'));
      console.log(chalk.gray('  → Open preview.html in your browser'));
      console.log(chalk.gray('  → Run "graphql-cache-replay serve" to view results'));

    } catch (error) {
      console.error(chalk.red('❌ Error:'), (error as Error).message);
      console.error((error as Error).stack);
      process.exit(1);
    }
  });

program
  .command('serve')
  .description('Start a local server to view the generated preview.html')
  .option('-p, --port <number>', 'Port to listen on', '3000')
  .option('-d, --dir <path>', 'Directory containing preview.html', '.')
  .action(async (options) => {
    const app = express();
    const dir = path.resolve(options.dir);
    const port = parseInt(options.port, 10);

    const previewPath = path.join(dir, 'preview.html');
    if (!fs.existsSync(previewPath)) {
      console.error(chalk.red(`❌ preview.html not found in ${dir}`));
      console.error(chalk.gray('   Run "graphql-cache-replay replay" first to generate the preview file.'));
      process.exit(1);
    }

    app.use(express.static(dir));

    app.listen(port, () => {
      console.log(chalk.blue(`🌐 Server running at http://localhost:${port}`));
      console.log('');
      console.log(chalk.gray('  Press Ctrl+C to stop the server'));
    });
  });

program
  .command('demo')
  .description('Run the replay tool with sample data')
  .option('-d, --output-dir <path>', 'Output directory', './demo-output')
  .action(async (options) => {
    const samplesDir = path.join(__dirname, '..', 'samples');
    const outputDir = path.resolve(options.outputDir);

    if (!fs.existsSync(samplesDir)) {
      console.error(chalk.red(`❌ Samples directory not found at ${samplesDir}`));
      process.exit(1);
    }

    console.log(chalk.blue('🚀 Running demo with sample data...'));
    console.log('');

    const args = [
      'replay',
      '--schema', path.join(samplesDir, 'schema.graphql'),
      '--operations', path.join(samplesDir, 'operations.jsonl'),
      '--policy', path.join(samplesDir, 'cache-policy.yaml'),
      '--mutations', path.join(samplesDir, 'mutation-events.jsonl'),
      '--output-dir', outputDir
    ];

    program.parse(['node', 'graphql-cache-replay', ...args]);
  });

program
  .command('test-circular')
  .description('Test circular dependency detection with sample policy')
  .option('-d, --output-dir <path>', 'Output directory', './circular-test')
  .action(async (options) => {
    const samplesDir = path.join(__dirname, '..', 'samples');
    const outputDir = path.resolve(options.outputDir);

    console.log(chalk.blue('🔄 Testing circular dependency detection...'));
    console.log('');

    const parser = new Parser(samplesDir);
    const cachePolicy = await parser.parseCachePolicy('circular-deps-policy.yaml');
    const cacheEngine = new CacheEngine(cachePolicy);

    const cycleResult = cacheEngine.detectCircularDependencies();

    if (cycleResult.hasCycle) {
      console.log(chalk.yellow('⚠ Circular dependencies detected:'));
      console.log('');
      for (const cycle of cycleResult.cycles) {
        console.log(chalk.yellow('   →'), cycle.join(' → '));
      }
      console.log('');
      console.log(chalk.gray('Expected: User -> Post -> Comment -> User (cycle)'));
      console.log(chalk.green('✓ Circular dependency detection is working correctly!'));
    } else {
      console.log(chalk.red('✗ Expected circular dependencies but none were detected'));
      process.exit(1);
    }
  });

program.parse(process.argv);
