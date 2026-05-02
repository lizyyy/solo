#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const path = require('path');
const SnapshotParser = require('./snapshot-parser');
const MigrationExecutor = require('./migration-executor');
const RuleValidator = require('./rule-validator');
const ReportExporter = require('./report-exporter');

const program = new Command();

program
  .name('migrator')
  .description('CLI tool for IndexedDB/localStorage data migration rehearsal')
  .version('1.0.0')
  .requiredOption('-s, --snapshots <path>', 'Directory containing snapshot JSON files')
  .requiredOption('-m, --migrations <path>', 'Directory containing migration scripts')
  .requiredOption('-r, --rules <path>', 'YAML file with validation rules')
  .requiredOption('-o, --output <path>', 'Output directory for reports')
  .option('-f, --from <version>', 'Starting version (default: lowest snapshot version)')
  .option('-t, --to <version>', 'Target version (default: highest snapshot version)')
  .option('-v, --verbose', 'Verbose output')
  .option('--skip-validation', 'Skip rule validation');

async function run() {
  program.parse(process.argv);
  const options = program.opts();

  const resolvedSnapshots = path.resolve(options.snapshots);
  const resolvedMigrations = path.resolve(options.migrations);
  const resolvedRules = path.resolve(options.rules);
  const resolvedOutput = path.resolve(options.output);

  console.log(chalk.bold.blue('\nLocal Storage Migrator\n'));

  try {
    console.log(chalk.cyan('\nLoading snapshots...'));
    const snapshotParser = new SnapshotParser(resolvedSnapshots);
    const snapshots = snapshotParser.loadAllSnapshots();
    const versionInfo = snapshotParser.detectVersionChain(snapshots);

    console.log(chalk.green('   Found ' + Object.keys(snapshots).length + ' snapshots'));
    console.log(chalk.gray('   Version chain: ' + versionInfo.chain.join(' -> ')));
    if (versionInfo.missing.length > 0) {
      console.log(chalk.yellow('   Missing versions: ' + versionInfo.missing.join(', ')));
    }

    console.log(chalk.cyan('\nLoading migrations...'));
    const executor = new MigrationExecutor(resolvedMigrations);
    const migrationVersions = executor.getMigrationVersions();
    console.log(chalk.green('   Found ' + migrationVersions.length + ' migrations (versions: ' + migrationVersions.join(', ') + ')'));

    console.log(chalk.cyan('\nLoading validation rules...'));
    const validator = new RuleValidator(resolvedRules);
    console.log(chalk.green('   Rules loaded successfully'));

    const fromVersion = options.from ? parseInt(options.from, 10) : versionInfo.chain[0];
    const toVersion = options.to ? parseInt(options.to, 10) : versionInfo.chain[versionInfo.chain.length - 1];

    console.log(chalk.cyan('\nStarting migration chain: v' + fromVersion + ' -> v' + toVersion));

    const context = { snapshots, options };
    const result = await executor.executeChain(snapshots, fromVersion, toVersion, context);

    const report = {
      generatedAt: new Date().toISOString(),
      fromVersion,
      toVersion,
      success: result.completed,
      totalSnapshots: Object.keys(snapshots).length,
      successful: result.completed ? Object.keys(snapshots).length : 0,
      failed: result.completed ? 0 : 1,
      skippedVersions: result.skippedVersions || [],
      totalSteps: result.results?.length || 0,
      rollbacksTriggered: result.results?.filter(r => r.rollbackTriggered).length || 0,
      versionChain: versionInfo.chain,
      steps: [],
      rollbackSeeds: [],
      errors: []
    };

    if (result.results) {
      for (const stepResult of result.results) {
        const step = {
          version: stepResult.version,
          success: stepResult.success,
          before: stepResult.before,
          after: stepResult.after,
          diff: null,
          error: stepResult.error,
          rollbackTriggered: stepResult.rollbackTriggered
        };

        if (!options.skipValidation) {
          const validation = validator.validateMigrationStep(
            stepResult.before,
            stepResult.after,
            stepResult.version,
            null
          );
          step.diff = validation.diff;
          step.validationErrors = validation.errors;
          step.validationValid = validation.valid;
        } else {
          step.diff = validator.computeDiff(stepResult.before, stepResult.after);
        }

        if (stepResult.rollbackTriggered) {
          report.rollbackSeeds.push({
            version: stepResult.version,
            data: stepResult.after,
            reason: stepResult.error
          });
        }

        if (stepResult.error) {
          report.errors.push({
            version: stepResult.version,
            error: stepResult.error
          });
        }

        report.steps.push(step);
      }
    }

    const fieldChanges = {};
    for (const step of report.steps) {
      for (const d of step.diff || []) {
        const field = d.path.split('.')[0];
        if (!fieldChanges[field]) {
          fieldChanges[field] = { added: 0, removed: 0, modified: 0 };
        }
        if (d.type === 'added') fieldChanges[field].added++;
        else if (d.type === 'removed') fieldChanges[field].removed++;
        else if (d.type === 'modified') fieldChanges[field].modified++;
      }
    }
    report.fieldChanges = fieldChanges;

    console.log(chalk.cyan('\nGenerating reports...'));
    const exporter = new ReportExporter(resolvedOutput);
    const paths = exporter.export(report);

    console.log(chalk.green('\nMigration ' + (result.completed ? 'completed' : 'failed') + '\n'));
    console.log(chalk.bold('Reports:'));
    console.log('   Markdown: ' + paths.reportPath);
    console.log('   Summary: ' + paths.summaryPath);
    if (paths.rollbackPath) {
      console.log('   Rollback: ' + paths.rollbackPath);
    }

    if (options.verbose) {
      console.log(chalk.bold('\nSummary:'));
      console.log(JSON.stringify(exporter.generateSummary(report), null, 2));
    }

    if (!result.completed) {
      console.log(chalk.red('\nMigration failed at version ' + result.failedAtVersion));
      console.log(chalk.red('   Error: ' + result.error));
      process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    console.error(chalk.red('\nError: ' + error.message));
    if (options.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

run();

module.exports = { run };
