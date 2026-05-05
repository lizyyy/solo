import { Command } from 'commander';
import chalk from 'chalk';
import { table } from 'table';
import { AppContext, CheckResult } from '../types';
import { runAllChecks } from '../utils/checkers';
import { loadContextData, ensureEventsLoaded } from '../utils/context-loader';

export function checkCommand(program: Command, context: AppContext) {
  program
    .command('check')
    .description('Run validation checks on tracking data')
    .option('-s, --schema <path>', 'Path to tracking-schema.yaml')
    .option('-e, --events <path>', 'Path to events.jsonl')
    .option('--release <path>', 'Path to release-changes.md')
    .option('-d, --directory <path>', 'Directory containing data files')
    .option('-c, --category <categories>', 'Check only specific categories (comma-separated)')
    .option('--severity <level>', 'Filter by severity: error, warning, info')
    .option('--verbose', 'Show detailed output')
    .option('-o, --output <path>', 'Output file path (JSON format)')
    .action(async (options) => {
      // Load data
      await loadContextData(context, {
        schema: options.schema,
        events: options.events,
        release: options.release,
        directory: options.directory,
      });
      
      if (!ensureEventsLoaded(context)) {
        console.error(chalk.red('No events found. Please provide events file path or run from a directory with events.jsonl.'));
        console.log(chalk.yellow('Use -e <path> to specify events file, or -d <directory> to specify data directory.'));
        process.exit(1);
      }
      
      console.log(chalk.blue('Running validation checks...\n'));
      
      const allResults = runAllChecks(
        context.events,
        context.schema,
        context.releaseChanges
      );
      
      // Filter results
      let filteredResults = allResults;
      
      if (options.severity) {
        filteredResults = filteredResults.filter(r => r.type === options.severity);
      }
      
      if (options.category) {
        const categories = options.category.split(',').map((c: string) => c.trim());
        filteredResults = filteredResults.filter(r => categories.includes(r.category));
      }
      
      // Show summary
      const errorCount = filteredResults.filter(r => r.type === 'error').length;
      const warningCount = filteredResults.filter(r => r.type === 'warning').length;
      const infoCount = filteredResults.filter(r => r.type === 'info').length;
      
      console.log(chalk.green('Check Summary:'));
      console.log(chalk.red(`  - Errors: ${errorCount}`));
      console.log(chalk.yellow(`  - Warnings: ${warningCount}`));
      console.log(chalk.blue(`  - Info: ${infoCount}`));
      console.log();
      
      if (filteredResults.length > 0) {
        console.log(chalk.yellow('Issues Found:'));
        console.log();
        
        // Display table
        const tableData = [
          ['Severity', 'Category', 'Message', 'Event ID'],
          ...filteredResults.map((result) => [
            getSeverityColor(result.type, result.type.toUpperCase()),
            result.category,
            result.message,
            result.event_id || '-',
          ]),
        ];
        
        console.log(table(tableData));
        
        if (options.verbose) {
          console.log(chalk.blue('\nDetailed Information:'));
          filteredResults.forEach((result, index) => {
            console.log(chalk.gray(`\n--- Issue ${index + 1} ---`));
            console.log(`Severity: ${getSeverityColor(result.type, result.type)}`);
            console.log(`Category: ${result.category}`);
            console.log(`Message: ${result.message}`);
            if (result.event_id) console.log(`Event ID: ${result.event_id}`);
            if (result.event_name) console.log(`Event Name: ${result.event_name}`);
            if (result.timestamp) console.log(`Timestamp: ${result.timestamp}`);
            if (result.details) {
              console.log(`Details: ${JSON.stringify(result.details, null, 2)}`);
            }
          });
        }
      } else {
        console.log(chalk.green('✓ No issues found!'));
      }
      
      // Store results in context for export
      (context as any).lastCheckResults = filteredResults;
      
      // Output to file if requested
      if (options.output) {
        const fs = require('fs');
        fs.writeFileSync(options.output, JSON.stringify(filteredResults, null, 2));
        console.log(chalk.green(`\nResults written to: ${options.output}`));
      }
    });
}

function getSeverityColor(type: string, text: string): string {
  switch (type) {
    case 'error':
      return chalk.red(text);
    case 'warning':
      return chalk.yellow(text);
    case 'info':
      return chalk.blue(text);
    default:
      return text;
  }
}
