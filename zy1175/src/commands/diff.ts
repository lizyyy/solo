import { Command } from 'commander';
import chalk from 'chalk';
import { table } from 'table';
import { AppContext } from '../types';
import {
  compareEventsWithWarehouse,
  compareEventCounts,
  compareEventTypes,
} from '../utils/diff';
import { loadContextData, ensureEventsLoaded, ensureWarehouseLoaded } from '../utils/context-loader';

export function diffCommand(program: Command, context: AppContext) {
  program
    .command('diff')
    .description('Compare client events with warehouse samples (reconciliation)')
    .option('-e, --events <path>', 'Path to events.jsonl (client events)')
    .option('-w, --warehouse <path>', 'Path to warehouse-sample.csv')
    .option('-d, --directory <path>', 'Directory containing data files')
    .option('--by-event-id', 'Compare by event_id (default: true)', true)
    .option('--by-event-type', 'Compare by event type counts')
    .option('--verbose', 'Show detailed mismatches')
    .option('-o, --output <path>', 'Output file path (JSON format)')
    .action(async (options) => {
      // Load data
      await loadContextData(context, {
        events: options.events,
        warehouse: options.warehouse,
        directory: options.directory,
      });
      
      if (!ensureEventsLoaded(context)) {
        console.error(chalk.red('No client events found. Please provide events file path or run from a directory with events.jsonl.'));
        console.log(chalk.yellow('Use -e <path> to specify events file, or -d <directory> to specify data directory.'));
        process.exit(1);
      }
      
      if (!ensureWarehouseLoaded(context)) {
        console.error(chalk.red('No warehouse samples found. Please provide warehouse file path or run from a directory with warehouse-sample.csv.'));
        console.log(chalk.yellow('Use -w <path> to specify warehouse file, or -d <directory> to specify data directory.'));
        process.exit(1);
      }
      
      console.log(chalk.blue('Comparing client events with warehouse samples...\n'));
      
      // Count comparison
      const countComparison = compareEventCounts(context.events, context.warehouseSamples);
      
      console.log(chalk.green('Count Comparison:'));
      console.log(chalk.blue(`  - Client events: ${countComparison.clientCount}`));
      console.log(chalk.blue(`  - Warehouse samples: ${countComparison.warehouseCount}`));
      console.log(chalk[countComparison.difference > 0 ? 'yellow' : 'green'](
        `  - Difference: ${countComparison.difference > 0 ? '+' : ''}${countComparison.difference} (${countComparison.differencePercent.toFixed(1)}%)`
      ));
      console.log();
      
      // Event-level comparison
      const eventComparison = compareEventsWithWarehouse(context.events, context.warehouseSamples);
      
      console.log(chalk.green('Event-level Comparison:'));
      console.log(chalk.blue(`  - Events in both: ${eventComparison.both.length}`));
      console.log(chalk.yellow(`  - Events in client only: ${eventComparison.in_client_only.length}`));
      console.log(chalk.yellow(`  - Events in warehouse only: ${eventComparison.in_warehouse_only.length}`));
      console.log(chalk[eventComparison.mismatched.length > 0 ? 'red' : 'green'](
        `  - Mismatched events: ${eventComparison.mismatched.length}`
      ));
      console.log();
      
      // Show mismatches if any
      if (eventComparison.mismatched.length > 0) {
        console.log(chalk.red('Mismatched Events:'));
        console.log();
        
        const mismatchTableData = [
          ['Event ID', 'Differences'],
          ...eventComparison.mismatched.map((mismatch) => [
            mismatch.event_id,
            mismatch.differences.join('\n'),
          ]),
        ];
        
        console.log(table(mismatchTableData));
        
        if (options.verbose) {
          console.log(chalk.blue('\nDetailed Mismatch Information:'));
          eventComparison.mismatched.forEach((mismatch, index) => {
            console.log(chalk.gray(`\n--- Mismatch ${index + 1} ---`));
            console.log(`Event ID: ${mismatch.event_id}`);
            console.log('Differences:');
            mismatch.differences.forEach((diff, i) => {
              console.log(`  ${i + 1}. ${diff}`);
            });
          });
        }
      }
      
      // Event type comparison
      const typeComparison = compareEventTypes(context.events, context.warehouseSamples);
      
      if (typeComparison.differences.length > 0) {
        console.log(chalk.yellow('\nEvent Type Count Differences:'));
        console.log();
        
        const typeTableData = [
          ['Event Name', 'Client Count', 'Warehouse Count', 'Difference', 'Difference %'],
          ...typeComparison.differences.map((diff) => [
            diff.event_name,
            diff.client_count.toString(),
            diff.warehouse_count.toString(),
            diff.difference > 0 ? `+${diff.difference}` : diff.difference.toString(),
            `${diff.difference_percent.toFixed(1)}%`,
          ]),
        ];
        
        console.log(table(typeTableData));
      } else {
        console.log(chalk.green('\n✓ All event type counts match!'));
      }
      
      // Show events only in client
      if (eventComparison.in_client_only.length > 0 && eventComparison.in_client_only.length <= 20) {
        console.log(chalk.yellow(`\nEvents in Client Only (${eventComparison.in_client_only.length}):`));
        console.log(chalk.gray(eventComparison.in_client_only.join(', ')));
      }
      
      // Show events only in warehouse
      if (eventComparison.in_warehouse_only.length > 0 && eventComparison.in_warehouse_only.length <= 20) {
        console.log(chalk.yellow(`\nEvents in Warehouse Only (${eventComparison.in_warehouse_only.length}):`));
        console.log(chalk.gray(eventComparison.in_warehouse_only.join(', ')));
      }
      
      // Store results in context for export
      (context as any).lastDiffResults = {
        countComparison,
        eventComparison,
        typeComparison,
      };
      
      // Output to file if requested
      if (options.output) {
        const fs = require('fs');
        fs.writeFileSync(options.output, JSON.stringify({
          countComparison,
          eventComparison,
          typeComparison,
        }, null, 2));
        console.log(chalk.green(`\nResults written to: ${options.output}`));
      }
    });
}
