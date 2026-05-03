#!/usr/bin/env node

import { program } from 'commander';
import * as path from 'path';
import { HlsValidator } from './validator';

program
  .name('hls-preflight')
  .description('HLS delivery package preflight validation tool')
  .version('1.0.0');

program
  .command('validate')
  .description('Validate an HLS delivery package')
  .argument('<input-dir>', 'Directory containing the HLS package files')
  .option('-o, --output <output-dir>', 'Output directory for reports (default: input-dir/output)')
  .option('-r, --rules <rules-file>', 'Custom rules YAML file')
  .option('-v, --verbose', 'Enable verbose output')
  .option('--skip-output', 'Skip generating output files, only show summary')
  .action(async (inputDir: string, options: {
    output?: string;
    rules?: string;
    verbose?: boolean;
    skipOutput?: boolean;
  }) => {
    try {
      const validator = new HlsValidator();

      const resolvedInputDir = path.resolve(inputDir);
      let outputDir: string | undefined;

      if (!options.skipOutput) {
        outputDir = options.output 
          ? path.resolve(options.output) 
          : path.join(resolvedInputDir, 'output');
      }

      console.log(`\n📦 Validating HLS package: ${resolvedInputDir}`);
      console.log(`   Generating reports to: ${outputDir || '(none)'}`);
      console.log('');

      const result = await validator.validate({
        inputDir: resolvedInputDir,
        outputDir,
        rulesFile: options.rules ? path.resolve(options.rules) : undefined,
        verbose: options.verbose,
      });

      console.log('✅ Validation complete!\n');
      console.log('📊 Summary:');
      console.log(`   Errors:   ${result.summary.errors}`);
      console.log(`   Warnings: ${result.summary.warnings}`);
      console.log(`   Infos:    ${result.summary.infos}`);
      console.log(`   Total:    ${result.summary.total}`);
      console.log('');
      console.log(`⏱️  Processing time: ${result.metadata.duration.toFixed(2)}ms`);
      console.log('');

      if (result.issues.length > 0) {
        console.log('📋 Issues found:');
        console.log('');
        
        if (result.summary.errors > 0) {
          console.log('  ❌ Errors:');
          result.issues
            .filter((i) => i.severity === 'error')
            .slice(0, 10)
            .forEach((issue, idx) => {
              console.log(`     ${idx + 1}. [${issue.ruleId}] ${issue.message}`);
              if (issue.location) {
                console.log(`        Location: ${issue.location}`);
              }
            });
          if (result.summary.errors > 10) {
            console.log(`     ... and ${result.summary.errors - 10} more`);
          }
          console.log('');
        }

        if (result.summary.warnings > 0) {
          console.log('  ⚠️  Warnings:');
          result.issues
            .filter((i) => i.severity === 'warning')
            .slice(0, 5)
            .forEach((issue, idx) => {
              console.log(`     ${idx + 1}. [${issue.ruleId}] ${issue.message}`);
            });
          if (result.summary.warnings > 5) {
            console.log(`     ... and ${result.summary.warnings - 5} more`);
          }
          console.log('');
        }
      }

      if (outputDir) {
        console.log('📄 Generated reports:');
        console.log(`   - ${path.join(outputDir, 'issues.csv')}`);
        console.log(`   - ${path.join(outputDir, 'review_report.md')}`);
        console.log(`   - ${path.join(outputDir, 'timeline.html')}`);
        console.log('');
      }

      if (result.summary.errors > 0) {
        process.exit(1);
      } else {
        process.exit(0);
      }

    } catch (error) {
      console.error('\n❌ Error:', error instanceof Error ? error.message : String(error));
      if (error instanceof Error && error.stack) {
        console.error('\nStack trace:', error.stack);
      }
      process.exit(1);
    }
  });

program
  .command('list-rules')
  .description('List all available validation rules')
  .option('-r, --rules <rules-file>', 'Custom rules YAML file')
  .action(async (options: { rules?: string }) => {
    try {
      const { YamlParser } = await import('./parsers');
      const yamlParser = new YamlParser();
      
      let rulesConfig;
      if (options.rules) {
        rulesConfig = await yamlParser.parseRulesConfigFile(path.resolve(options.rules));
      } else {
        rulesConfig = yamlParser.parseRulesConfig('');
      }

      console.log('\n📋 Available validation rules:\n');
      
      rulesConfig.rules.forEach((rule, idx) => {
        const status = rule.enabled ? '✅' : '⏸️';
        console.log(`${idx + 1}. ${status} [${rule.id}] ${rule.name}`);
        console.log(`   Severity: ${rule.severity.toUpperCase()}`);
        console.log(`   ${rule.description}`);
        console.log('');
      });

      if (rulesConfig.thresholds) {
        console.log('📊 Default thresholds:');
        console.log(`   - Max segment duration variance: ${rulesConfig.thresholds.maxSegmentDurationVariance}s`);
        console.log(`   - Min bitrate: ${rulesConfig.thresholds.minBitrateBps / 1000} kbps`);
        console.log(`   - Max bitrate: ${rulesConfig.thresholds.maxBitrateBps / 1000000} Mbps`);
        console.log(`   - Max CDN response time: ${rulesConfig.thresholds.maxResponseTimeMs}ms`);
        console.log('');
      }

    } catch (error) {
      console.error('\n❌ Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program.parse(process.argv);
