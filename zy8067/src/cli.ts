#!/usr/bin/env node

import { Command } from 'commander';
import { TestOrchestrator } from './test-orchestrator.js';
import { ReportExporter } from './report-exporter.js';

const program = new Command();

program
  .name('plugin-validator')
  .description('Offline CLI for validating low-code platform plugins')
  .version('1.0.0');

program
  .argument('<plugin-dir>', 'Path to the plugin directory')
  .option('-v, --platform-version <version>', 'Supported platform version', '2.0.0')
  .action(async (pluginDir: string, options: { platformVersion: string }) => {
    try {
      console.log(`Validating plugin in: ${pluginDir}`);
      console.log(`Supported platform version: ${options.platformVersion}`);
      console.log('');

      const orchestrator = new TestOrchestrator(options.platformVersion);
      const report = await orchestrator.run(pluginDir);

      const exporter = new ReportExporter();
      await exporter.export(pluginDir, report);

      console.log('Validation complete!');
      console.log('');
      console.log('Summary:');
      console.log(`  Total: ${report.summary.total}`);
      console.log(`  Passed: ${report.summary.passed}`);
      console.log(`  Failed: ${report.summary.failed}`);
      console.log(`  Warnings: ${report.summary.warnings}`);
      console.log('');
      console.log('Reports generated:');
      console.log('  - compatibility_report.md');
      console.log('  - traces.jsonl');

      process.exit(report.summary.failed > 0 ? 1 : 0);
    } catch (error: any) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

program.parse(process.argv);