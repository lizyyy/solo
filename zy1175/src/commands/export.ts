import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import { AppContext } from '../types';
import {
  generateReport,
  exportToJSON,
  exportToCSV,
  exportToMarkdown,
} from '../utils/exporters';
import { runAllChecks } from '../utils/checkers';
import { analyzeAllFunnels } from '../utils/funnel';
import { compareEventsWithWarehouse, compareEventCounts, compareEventTypes } from '../utils/diff';
import { loadContextData, ensureEventsLoaded } from '../utils/context-loader';

export function exportCommand(program: Command, context: AppContext) {
  program
    .command('export')
    .description('Export analysis reports in multiple formats')
    .option('-s, --schema <path>', 'Path to tracking-schema.yaml')
    .option('-e, --events <path>', 'Path to events.jsonl')
    .option('--release <path>', 'Path to release-changes.md')
    .option('-w, --warehouse <path>', 'Path to warehouse-sample.csv')
    .option('-d, --directory <path>', 'Directory containing data files')
    .option('-f, --format <format>', 'Output format: json, csv, markdown (default: all)', 'all')
    .option('-o, --output <path>', 'Output file path (without extension)')
    .option('--re-run', 'Re-run all analyses before exporting')
    .option('--verbose', 'Show detailed output')
    .action(async (options) => {
      // Load data
      await loadContextData(context, {
        schema: options.schema,
        events: options.events,
        release: options.release,
        warehouse: options.warehouse,
        directory: options.directory,
      });
      
      if (!ensureEventsLoaded(context)) {
        console.error(chalk.red('No events found. Please provide events file path or run from a directory with events.jsonl.'));
        console.log(chalk.yellow('Use -e <path> to specify events file, or -d <directory> to specify data directory.'));
        process.exit(1);
      }
      
      console.log(chalk.blue('Preparing to export reports...\n'));
      
      // Re-run analyses if requested or if no cached results
      let checkResults = (context as any).lastCheckResults;
      let funnelAnalyses = (context as any).lastFunnelAnalyses;
      let diffResults = (context as any).lastDiffResults;
      
      if (options.reRun || !checkResults || checkResults.length === 0) {
        console.log(chalk.yellow('Re-running all analyses...'));
        
        // Run checks
        checkResults = runAllChecks(
          context.events,
          context.schema,
          context.releaseChanges
        );
        (context as any).lastCheckResults = checkResults;
        
        // Run funnel analysis
        funnelAnalyses = analyzeAllFunnels(context.events);
        (context as any).lastFunnelAnalyses = funnelAnalyses;
        
        // Run diff if warehouse data is available
        if (context.warehouseSamples.length > 0) {
          const eventComparison = compareEventsWithWarehouse(context.events, context.warehouseSamples);
          const countComparison = compareEventCounts(context.events, context.warehouseSamples);
          const typeComparison = compareEventTypes(context.events, context.warehouseSamples);
          
          diffResults = {
            eventComparison,
            countComparison,
            typeComparison,
          };
          (context as any).lastDiffResults = diffResults;
        }
      }
      
      // Use empty arrays if no results
      checkResults = checkResults || [];
      funnelAnalyses = funnelAnalyses || [];
      
      // Generate report
      const report = generateReport(checkResults, funnelAnalyses, diffResults, context);
      
      // Determine output path
      let baseOutputPath = options.output;
      if (!baseOutputPath) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        baseOutputPath = path.join(process.cwd(), `tracking-report-${timestamp}`);
      }
      
      console.log(chalk.green(`Exporting reports to: ${baseOutputPath}`));
      console.log();
      
      // Export in requested formats
      const formats = options.format === 'all' 
        ? ['json', 'csv', 'markdown']
        : options.format.split(',').map((f: string) => f.trim().toLowerCase());
      
      formats.forEach((format: string) => {
        switch (format) {
          case 'json':
            const jsonPath = `${baseOutputPath}.json`;
            exportToJSON(report, jsonPath);
            console.log(chalk.green(`  - JSON: ${jsonPath}`));
            break;
            
          case 'csv':
            exportToCSV(report, baseOutputPath);
            break;
            
          case 'markdown':
          case 'md':
            const mdPath = `${baseOutputPath}.md`;
            exportToMarkdown(report, mdPath);
            console.log(chalk.green(`  - Markdown: ${mdPath}`));
            break;
            
          default:
            console.warn(chalk.yellow(`  - Skipping unknown format: ${format}`));
        }
      });
      
      // Show summary
      console.log();
      console.log(chalk.green('Export Summary:'));
      console.log(chalk.blue(`  - Total Events: ${report.summary.total_events}`));
      console.log(chalk.red(`  - Errors: ${report.summary.total_errors}`));
      console.log(chalk.yellow(`  - Warnings: ${report.summary.total_warnings}`));
      
      if (report.summary.critical_issues.length > 0) {
        console.log();
        console.log(chalk.red('Critical Issues:'));
        report.summary.critical_issues.forEach((issue: string) => {
          console.log(chalk.red(`  ⚠️ ${issue}`));
        });
      }
      
      console.log();
      console.log(chalk.green('✓ Export complete!'));
    });
}
