#!/usr/bin/env node

import { program } from 'commander';
import * as path from 'path';
import { Parser } from './parser';
import { SchemaDiffer } from './diff';
import { MigrationSimulator } from './migration';
import { ReportExporter } from './reporter';
import { InputConfig, ReportData } from './types';

interface CliOptions {
  oldSchema: string;
  newSchema: string;
  drafts: string;
  enumMapping?: string;
  migrationRules?: string;
  output: string;
  verbose: boolean;
  sample: boolean;
}

function getSampleDir(): string {
  if (process.env.SAMPLE_DIR) {
    return process.env.SAMPLE_DIR;
  }
  
  const possiblePaths = [
    path.join(process.cwd(), 'samples'),
    path.join(__dirname, '..', 'samples'),
    path.join(__dirname, '..', '..', 'samples')
  ];

  for (const p of possiblePaths) {
    try {
      if (require('fs').existsSync(p)) {
        return p;
      }
    } catch {
      continue;
    }
  }
  
  return path.join(__dirname, '..', 'samples');
}

async function runCheck(options: CliOptions): Promise<void> {
  let config: InputConfig;
  
  if (options.sample) {
    const sampleDir = getSampleDir();
    console.log(`📁 Using sample data from: ${sampleDir}`);
    console.log('');
    
    config = {
      oldSchemaPath: path.join(sampleDir, 'old_schema.yaml'),
      newSchemaPath: path.join(sampleDir, 'new_schema.yaml'),
      draftsPath: path.join(sampleDir, 'drafts.jsonl'),
      enumMappingPath: path.join(sampleDir, 'enum_mapping.csv'),
      migrationRulesPath: path.join(sampleDir, 'migration_rules.yaml')
    };
  } else {
    config = {
      oldSchemaPath: options.oldSchema,
      newSchemaPath: options.newSchema,
      draftsPath: options.drafts,
      enumMappingPath: options.enumMapping,
      migrationRulesPath: options.migrationRules
    };
  }

  console.log('========================================');
  console.log('  Schema Migration Pre-Check Tool');
  console.log('========================================\n');

  console.log('📄 Parsing input files...');
  const { oldSchema, newSchema, drafts, enumMappings, migrationRules } = await Parser.parseAll(config);
  
  console.log(`   ✅ Old schema (v${oldSchema.schemaVersion}): ${oldSchema.groups.length} groups, ${countFields(oldSchema)} fields`);
  console.log(`   ✅ New schema (v${newSchema.schemaVersion}): ${newSchema.groups.length} groups, ${countFields(newSchema)} fields`);
  console.log(`   ✅ Drafts: ${drafts.length} records`);
  console.log(`   ✅ Enum mappings: ${enumMappings.length} rules`);
  console.log(`   ✅ Migration rules: ${migrationRules.length} rules\n`);

  console.log('🔍 Analyzing schema differences...\n');
  const schemaDiff = SchemaDiffer.diff(oldSchema, newSchema);
  
  if (options.verbose) {
    SchemaDiffer.printDiff(schemaDiff);
  }

  console.log('🔄 Running migration simulation...\n');
  const simulator = new MigrationSimulator();
  const migrationResult = simulator.simulate(
    oldSchema,
    newSchema,
    drafts,
    enumMappings,
    migrationRules,
    schemaDiff
  );

  MigrationSimulator.printResult(migrationResult);

  console.log('📊 Generating reports...\n');
  
  const outputDir = path.isAbsolute(options.output) 
    ? options.output 
    : path.join(process.cwd(), options.output);

  const reporter = new ReportExporter(outputDir);
  const reportData: ReportData = {
    migrationPlan: migrationResult.plan,
    issues: migrationResult.issues,
    statistics: migrationResult.statistics,
    schemaDiff,
    inputConfig: config
  };

  const { planPath, issuesPath, reportPath } = await reporter.exportAll(reportData);

  console.log('✅ Reports generated successfully!\n');
  console.log(`   📋 Migration Plan: ${planPath}`);
  console.log(`   📊 Issues CSV: ${issuesPath}`);
  console.log(`   📝 Markdown Report: ${reportPath}\n`);

  const criticalCount = migrationResult.statistics.issuesBySeverity['critical'] || 0;
  const highCount = migrationResult.statistics.issuesBySeverity['high'] || 0;

  if (criticalCount > 0) {
    console.log('🔴 CRITICAL: Migration should NOT proceed until critical issues are resolved!');
  } else if (highCount > 0) {
    console.log('🟠 WARNING: Review high-priority issues before migration.');
  } else {
    console.log('🟢 OK: No blocking issues found.');
  }

  console.log('\n========================================\n');
}

function countFields(schema: { groups: { fields: unknown[] }[] }): number {
  return schema.groups.reduce((sum, g) => sum + g.fields.length, 0);
}

program
  .name('schema-check')
  .description('Schema migration pre-check tool for offline forms')
  .version('1.0.0');

program
  .command('check')
  .description('Run schema migration pre-check')
  .option('--old-schema <path>', 'Path to old schema YAML file')
  .option('--new-schema <path>', 'Path to new schema YAML file')
  .option('--drafts <path>', 'Path to drafts JSONL file')
  .option('--enum-mapping <path>', 'Path to enum mapping CSV file (optional)')
  .option('--migration-rules <path>', 'Path to migration rules YAML file (optional)')
  .option('-o, --output <dir>', 'Output directory for reports', './output')
  .option('-v, --verbose', 'Show verbose output')
  .option('--sample', 'Use sample data for demonstration')
  .action(async (options: Partial<CliOptions>) => {
    if (options.sample) {
      await runCheck({
        ...options,
        oldSchema: '',
        newSchema: '',
        drafts: '',
        output: options.output || './output',
        verbose: options.verbose || false,
        sample: true
      } as CliOptions);
      return;
    }

    if (!options.oldSchema || !options.newSchema || !options.drafts) {
      console.error('Error: --old-schema, --new-schema, and --drafts are required unless using --sample');
      program.help();
      process.exit(1);
    }

    await runCheck(options as CliOptions);
  });

program
  .command('sample')
  .description('Run with sample data (shortcut for check --sample)')
  .option('-o, --output <dir>', 'Output directory for reports', './output')
  .option('-v, --verbose', 'Show verbose output')
  .action((options: { output: string; verbose: boolean }) => {
    runCheck({
      oldSchema: '',
      newSchema: '',
      drafts: '',
      output: options.output,
      verbose: options.verbose,
      sample: true
    } as CliOptions);
  });

program
  .command('help')
  .description('Show detailed help and examples')
  .action(() => {
    console.log(`
========================================
  Schema Migration Pre-Check Tool
========================================

A CLI tool for mobile teams to validate schema migrations before upgrading offline forms.

Features:
  - Compare old and new form schemas
  - Simulate migration on offline drafts
  - Detect missing fields, enum mismatches, required defaults, attachment issues
  - Generate migration plan and reports

Commands:
  check           Run a migration pre-check
  sample          Run with sample data (demo)
  help            Show this help message

Examples:

  # Run with sample data
  schema-check sample
  schema-check check --sample

  # Run with your own files
  schema-check check \\
    --old-schema ./schemas/v1.0.0/form.yaml \\
    --new-schema ./schemas/v1.1.0/form.yaml \\
    --drafts ./data/drafts.jsonl \\
    --enum-mapping ./rules/enum_mapping.csv \\
    --migration-rules ./rules/migration_rules.yaml \\
    --output ./reports

  # Verbose mode with schema diff details
  schema-check check --sample --verbose

Output Files:
  - migration_plan.json  - Detailed migration steps
  - issues.csv           - All issues in CSV format
  - report.md            - Human-readable report

Checks Performed:
  1. Schema version lag detection
  2. Removed fields with data
  3. Enum value mapping gaps
  4. New required fields without defaults
  5. Attachment reference validity
  6. Field type incompatibilities

For more information, see the README or visit the project repository.
`);
  });

program.parse(process.argv);
