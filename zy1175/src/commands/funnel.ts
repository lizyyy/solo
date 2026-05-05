import { Command } from 'commander';
import chalk from 'chalk';
import { table } from 'table';
import { AppContext, FunnelAnalysis } from '../types';
import { analyzeAllFunnels, getStepDropOffDetails, FunnelDefinition } from '../utils/funnel';
import { loadContextData, ensureEventsLoaded } from '../utils/context-loader';

export function funnelCommand(program: Command, context: AppContext) {
  program
    .command('funnel')
    .description('Analyze funnel conversion and identify breakpoints')
    .option('-e, --events <path>', 'Path to events.jsonl')
    .option('-d, --directory <path>', 'Directory containing data files')
    .option('-s, --steps <steps>', 'Custom funnel steps (comma-separated, e.g., page_view,product_view,purchase_complete)')
    .option('-n, --name <name>', 'Name for custom funnel')
    .option('--session-based', 'Analyze by session (default: true)', true)
    .option('--no-session-based', 'Analyze by event count only')
    .option('--verbose', 'Show detailed drop-off analysis')
    .option('-o, --output <path>', 'Output file path (JSON format)')
    .action(async (options) => {
      // Load data
      await loadContextData(context, {
        events: options.events,
        directory: options.directory,
      });
      
      if (!ensureEventsLoaded(context)) {
        console.error(chalk.red('No events found. Please provide events file path or run from a directory with events.jsonl.'));
        console.log(chalk.yellow('Use -e <path> to specify events file, or -d <directory> to specify data directory.'));
        process.exit(1);
      }
      
      console.log(chalk.blue('Analyzing funnel conversion...\n'));
      
      let funnels: FunnelDefinition[] | undefined;
      
      // Use custom funnel if provided
      if (options.steps) {
        const steps = options.steps.split(',').map((s: string) => s.trim());
        funnels = [
          {
            name: options.name || 'Custom Funnel',
            steps,
          },
        ];
      }
      
      const analyses = analyzeAllFunnels(context.events, funnels);
      
      // Store results in context for export
      (context as any).lastFunnelAnalyses = analyses;
      
      // Display results
      analyses.forEach((analysis) => {
        console.log(chalk.green(`Funnel: ${analysis.funnel_name}`));
        console.log(chalk.yellow(`Total Conversion Rate: ${analysis.total_conversion_rate.toFixed(1)}%`));
        console.log();
        
        // Display steps table
        const stepTableData = [
          ['Step', 'Count', 'Conversion Rate', 'Drop-off Rate'],
          ...analysis.steps.map((step, index) => [
            `${index + 1}. ${step.event_name}`,
            step.count.toString(),
            `${step.conversion_rate?.toFixed(1) || 'N/A'}%`,
            `${step.drop_off_rate?.toFixed(1) || 'N/A'}%`,
          ]),
        ];
        
        console.log(table(stepTableData));
        
        // Display breakpoints
        if (analysis.breakpoints.length > 0) {
          console.log(chalk.red('\nBreakpoints Detected (High Drop-off):'));
          console.log();
          
          const breakpointTableData = [
            ['From Step', 'To Step', 'Drop-off Count', 'Drop-off Rate'],
            ...analysis.breakpoints.map((bp) => [
              bp.step_name,
              bp.next_step_name,
              bp.drop_off_count.toString(),
              `${bp.drop_off_rate.toFixed(1)}%`,
            ]),
          ];
          
          console.log(table(breakpointTableData));
          
          // Show detailed drop-off analysis if verbose
          if (options.verbose) {
            console.log(chalk.blue('\nDetailed Drop-off Analysis:'));
            analysis.breakpoints.forEach((bp, index) => {
              console.log(chalk.gray(`\n--- Breakpoint ${index + 1}: ${bp.step_name} → ${bp.next_step_name} ---`));
              
              const details = getStepDropOffDetails(
                context.events,
                bp.step_name,
                bp.next_step_name
              );
              
              console.log(`  Sessions that continued: ${details.continuedSessions.length}`);
              console.log(`  Sessions that dropped off: ${details.droppedSessions.length}`);
              
              if (details.droppedSessions.length > 0 && details.droppedSessions.length <= 10) {
                console.log(`  Dropped session IDs: ${details.droppedSessions.join(', ')}`);
              }
            });
          }
        } else {
          console.log(chalk.green('\nNo critical breakpoints detected.'));
        }
        
        console.log(chalk.gray('─'.repeat(60)));
      });
      
      // Output to file if requested
      if (options.output) {
        const fs = require('fs');
        fs.writeFileSync(options.output, JSON.stringify(analyses, null, 2));
        console.log(chalk.green(`\nResults written to: ${options.output}`));
      }
    });
}
