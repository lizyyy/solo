import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs';
import { AppContext } from '../types';
import { importAllFiles } from '../utils/importers';

export function importCommand(program: Command, context: AppContext) {
  program
    .command('import')
    .description('Import tracking data files')
    .option('-s, --schema <path>', 'Path to tracking-schema.yaml')
    .option('-e, --events <path>', 'Path to events.jsonl')
    .option('-r, --routes <path>', 'Path to routes.csv')
    .option('--release <path>', 'Path to release-changes.md')
    .option('-w, --warehouse <path>', 'Path to warehouse-sample.csv')
    .option('-d, --directory <path>', 'Directory containing all files (default: current directory)')
    .option('--verbose', 'Show verbose output')
    .action(async (options) => {
      const cwd = options.directory || process.cwd();
      
      console.log(chalk.blue(`Importing data from: ${cwd}`));
      
      const schemaPath = options.schema || path.join(cwd, 'tracking-schema.yaml');
      const eventsPath = options.events || path.join(cwd, 'events.jsonl');
      const routesPath = options.routes || path.join(cwd, 'routes.csv');
      const releasePath = options.release || path.join(cwd, 'release-changes.md');
      const warehousePath = options.warehouse || path.join(cwd, 'warehouse-sample.csv');
      
      try {
        const imported = await importAllFiles(
          schemaPath,
          eventsPath,
          routesPath,
          releasePath,
          warehousePath
        );
        
        context.schema = imported.schema;
        context.events = imported.events;
        context.routes = imported.routes;
        context.releaseChanges = imported.releaseChanges;
        context.warehouseSamples = imported.warehouseSamples;
        
        // Show summary
        console.log(chalk.green('\nImport Summary:'));
        console.log(chalk.green(`  - Schema: ${context.schema ? 'Loaded (v' + context.schema.version + ')' : 'Not found'}`));
        console.log(chalk.green(`  - Events: ${context.events.length} events`));
        console.log(chalk.green(`  - Routes: ${context.routes.length} routes`));
        console.log(chalk.green(`  - Releases: ${context.releaseChanges.length} releases`));
        console.log(chalk.green(`  - Warehouse samples: ${context.warehouseSamples.length} samples`));
        
        if (options.verbose) {
          if (context.schema) {
            console.log(chalk.yellow('\nSchema Details:'));
            console.log(chalk.yellow(`  - Version: ${context.schema.version}`));
            console.log(chalk.yellow(`  - Events defined: ${context.schema.events.length}`));
            context.schema.events.forEach((event: any) => {
              console.log(chalk.yellow(`    - ${event.name}: ${event.description}`));
            });
          }
          
          if (context.events.length > 0) {
            console.log(chalk.yellow('\nSample Events (first 3):'));
            context.events.slice(0, 3).forEach((event, index) => {
              console.log(chalk.yellow(`  ${index + 1}. ${event.event_name} (${event.event_id})`));
            });
          }
        }
        
      } catch (error) {
        console.error(chalk.red(`Import failed: ${error}`));
        process.exit(1);
      }
    });
}
