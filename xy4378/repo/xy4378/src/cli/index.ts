#!/usr/bin/env node

import { Command } from 'commander';
import * as path from 'path';
import * as chalk from 'chalk';
import { I18nCheckerEngine } from '../engine';
import { DataStore } from '../store';
import { Exporter } from '../exporter';
import { IssueStatus, IssueType, Severity } from '../types';
import { getIssueTypeLabel, getSeverityLabel } from '../utils';
import { startServer } from '../server';

const program = new Command();

program
  .name('i18n-checker')
  .description('Local i18n content health checker for frontend teams')
  .version('1.0.0');

program
  .command('scan')
  .description('Scan project and detect i18n issues')
  .option('-p, --project <path>', 'Project path to scan', process.cwd())
  .option('--locales <locales>', 'Comma-separated list of locales to check', 'zh,en,ja')
  .option('--locale-patterns <patterns>', 'Glob patterns for locale files (comma-separated)')
  .option('--source-patterns <patterns>', 'Glob patterns for source files (comma-separated)')
  .option('--no-save', 'Do not save results to database')
  .option('--open', 'Open web interface after scanning', false)
  .action(async (options) => {
    try {
      const projectPath = path.resolve(options.project);
      const locales = options.locales.split(',').map((l: string) => l.trim());
      
      const config: any = {
        projectPath,
        locales,
      };
      
      if (options.localePatterns) {
        config.localePatterns = options.localePatterns.split(',').map((p: string) => p.trim());
      }
      
      if (options.sourcePatterns) {
        config.sourcePatterns = options.sourcePatterns.split(',').map((p: string) => p.trim());
      }

      console.log(chalk.blue(`\n🔍 Scanning project: ${projectPath}`));
      console.log(chalk.blue(`🌐 Locales: ${locales.join(', ')}\n`));

      const engine = new I18nCheckerEngine(config);
      const result = await engine.scan();

      console.log(chalk.green(`\n✅ Scan completed!`));
      console.log(chalk.gray(`📁 Scanned ${result.sourceFiles.length} source files`));
      console.log(chalk.gray(`📊 Found ${result.totalKeys} translation keys`));
      console.log(chalk.gray(`🐛 Detected ${result.issues.length} issues\n`));

      printIssuesSummary(result.issues);

      let scanId: string | undefined;
      if (options.save !== false) {
        const dbPath = path.join(projectPath, '.i18n-checker.db');
        const store = new DataStore(dbPath);
        scanId = store.saveScanResult(result, projectPath);
        store.close();
        console.log(chalk.green(`💾 Results saved to database: ${dbPath}`));
        console.log(chalk.gray(`   Scan ID: ${scanId}\n`));
      }

      if (options.open) {
        console.log(chalk.blue('🌐 Starting web server...\n'));
        await startServer(projectPath, scanId);
      }

    } catch (error) {
      console.error(chalk.red('❌ Scan failed:'), error);
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List issues from database')
  .option('-p, --project <path>', 'Project path', process.cwd())
  .option('--scan-id <id>', 'Scan ID to filter issues')
  .option('--status <statuses>', 'Filter by status (comma-separated: open,acknowledged,resolved,ignored)')
  .option('--type <types>', 'Filter by issue type (comma-separated)')
  .option('--severity <severities>', 'Filter by severity (comma-separated: critical,high,medium,low)')
  .option('--false-positives', 'Show only false positives')
  .option('--no-false-positives', 'Exclude false positives')
  .action(async (options) => {
    try {
      const projectPath = path.resolve(options.project);
      const dbPath = path.join(projectPath, '.i18n-checker.db');
      const store = new DataStore(dbPath);

      const filters: any = {};
      
      if (options.scanId) {
        filters.scanId = options.scanId;
      }
      
      if (options.status) {
        filters.status = options.status.split(',').map((s: string) => s.trim() as IssueStatus);
      }
      
      if (options.type) {
        filters.type = options.type.split(',').map((t: string) => t.trim() as IssueType);
      }
      
      if (options.severity) {
        filters.severity = options.severity.split(',').map((s: string) => s.trim() as Severity);
      }
      
      if (options.falsePositives === true) {
        filters.falsePositive = true;
      } else if (options.falsePositives === false) {
        filters.falsePositive = false;
      }

      const issues = store.getIssues(filters);
      const stats = store.getStatistics(options.scanId);

      console.log(chalk.blue(`\n📋 Issues List`));
      console.log(chalk.gray(`   Total: ${issues.length} issues\n`));

      console.log(chalk.underline('Statistics:'));
      console.log(`  Critical: ${stats.bySeverity.critical}`);
      console.log(`  High: ${stats.bySeverity.high}`);
      console.log(`  Medium: ${stats.bySeverity.medium}`);
      console.log(`  Low: ${stats.bySeverity.low}`);
      console.log(`  False Positives: ${stats.falsePositives}\n`);

      if (issues.length > 0) {
        console.log(chalk.underline('Issues:'));
        for (const issue of issues.slice(0, 50)) {
          const severityColor = getSeverityColor(issue.severity);
          const statusIcon = getStatusIcon(issue.status);
          
          console.log(
            `  ${statusIcon} [${severityColor(getSeverityLabel(issue.severity))}] ` +
            `${chalk.cyan(getIssueTypeLabel(issue.type))}: ` +
            `${issue.key ? `${chalk.yellow(issue.key)} - ` : ''}` +
            `${issue.message}`
          );
          
          if (issue.sourceFile) {
            console.log(`      ${chalk.gray(`at ${issue.sourceFile}${issue.line ? `:${issue.line}` : ''}`)}`);
          }
        }
        
        if (issues.length > 50) {
          console.log(chalk.gray(`  ... and ${issues.length - 50} more issues\n`));
        }
      }

      store.close();

    } catch (error) {
      console.error(chalk.red('❌ Failed to list issues:'), error);
      process.exit(1);
    }
  });

program
  .command('update')
  .description('Update issue status, notes, or mark as false positive')
  .argument('<issue-id>', 'Issue ID to update')
  .option('-p, --project <path>', 'Project path', process.cwd())
  .option('--status <status>', 'Set status: open, acknowledged, resolved, ignored')
  .option('--false-positive', 'Mark as false positive')
  .option('--no-false-positive', 'Unmark as false positive')
  .option('--notes <text>', 'Add notes to the issue')
  .option('--fix-suggestion <text>', 'Add fix suggestion')
  .action(async (issueId, options) => {
    try {
      const projectPath = path.resolve(options.project);
      const dbPath = path.join(projectPath, '.i18n-checker.db');
      const store = new DataStore(dbPath);

      const updates: any = {};
      
      if (options.status) {
        updates.status = options.status as IssueStatus;
      }
      
      if (options.falsePositive === true) {
        updates.falsePositive = true;
      } else if (options.falsePositive === false) {
        updates.falsePositive = false;
      }
      
      if (options.notes !== undefined) {
        updates.notes = options.notes;
      }
      
      if (options.fixSuggestion !== undefined) {
        updates.fixSuggestion = options.fixSuggestion;
      }

      if (Object.keys(updates).length === 0) {
        console.log(chalk.yellow('⚠️  No updates specified'));
        store.close();
        return;
      }

      const success = store.updateIssue(issueId, updates);
      store.close();

      if (success) {
        console.log(chalk.green(`✅ Issue ${issueId} updated successfully`));
      } else {
        console.log(chalk.yellow(`⚠️  Issue ${issueId} not found`));
      }

    } catch (error) {
      console.error(chalk.red('❌ Failed to update issue:'), error);
      process.exit(1);
    }
  });

program
  .command('export')
  .description('Export issues to various formats')
  .option('-p, --project <path>', 'Project path', process.cwd())
  .option('--scan-id <id>', 'Scan ID to export')
  .option('-f, --format <format>', 'Export format: markdown, json, patch (default: all)', 'all')
  .option('-o, --output <path>', 'Output directory or file')
  .option('--include-resolved', 'Include resolved issues')
  .option('--include-ignored', 'Include ignored issues')
  .option('--include-false-positives', 'Include false positives')
  .action(async (options) => {
    try {
      const projectPath = path.resolve(options.project);
      const dbPath = path.join(projectPath, '.i18n-checker.db');
      const store = new DataStore(dbPath);
      const exporter = new Exporter();

      const filters: any = {};
      if (options.scanId) {
        filters.scanId = options.scanId;
      }

      const issues = store.getIssues(filters);
      const scan = options.scanId ? store.getScanById(options.scanId) : store.getLatestScan();
      
      const exportOptions = {
        includeResolved: options.includeResolved || false,
        includeIgnored: options.includeIgnored || false,
        includeFalsePositives: options.includeFalsePositives || false,
      };

      const outputDir = options.output || path.join(projectPath, 'i18n-report');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

      const projectInfo = scan ? {
        projectName: path.basename(projectPath),
        scanDate: new Date(scan.timestamp).toLocaleString(),
        locales: JSON.parse(scan.locales),
        totalKeys: scan.total_keys,
      } : undefined;

      if (options.format === 'markdown' || options.format === 'all') {
        const outputPath = path.join(outputDir, `i18n-report-${timestamp}.md`);
        exporter.exportToMarkdown(issues, outputPath, exportOptions, projectInfo);
      }

      if (options.format === 'json' || options.format === 'all') {
        const outputPath = path.join(outputDir, `i18n-issues-${timestamp}.json`);
        exporter.exportToJson(issues, outputPath, exportOptions);
      }

      if (options.format === 'patch' || options.format === 'all') {
        const outputPath = path.join(outputDir, `i18n-patch-${timestamp}.md`);
        exporter.exportPatchDraft(issues, outputPath, exportOptions);
      }

      store.close();
      console.log(chalk.green(`\n✅ Export completed! Files saved to: ${outputDir}`));

    } catch (error) {
      console.error(chalk.red('❌ Export failed:'), error);
      process.exit(1);
    }
  });

program
  .command('server')
  .description('Start web interface for reviewing issues')
  .option('-p, --project <path>', 'Project path', process.cwd())
  .option('--port <port>', 'Server port', '3000')
  .option('--scan-id <id>', 'Scan ID to view')
  .option('--no-open', 'Do not open browser automatically')
  .action(async (options) => {
    try {
      const projectPath = path.resolve(options.project);
      const port = parseInt(options.port, 10);
      
      console.log(chalk.blue(`\n🌐 Starting web server on port ${port}...`));
      console.log(chalk.blue(`   Project: ${projectPath}\n`));

      await startServer(projectPath, options.scanId, port, options.open !== false);

    } catch (error) {
      console.error(chalk.red('❌ Failed to start server:'), error);
      process.exit(1);
    }
  });

program
  .command('scans')
  .description('List all scan history')
  .option('-p, --project <path>', 'Project path', process.cwd())
  .action(async (options) => {
    try {
      const projectPath = path.resolve(options.project);
      const dbPath = path.join(projectPath, '.i18n-checker.db');
      const store = new DataStore(dbPath);

      const scans = store.getAllScans();
      
      console.log(chalk.blue(`\n📋 Scan History (${scans.length} scans)\n`));

      for (const scan of scans) {
        const date = new Date(scan.timestamp).toLocaleString();
        const locales = JSON.parse(scan.locales).join(', ');
        
        console.log(chalk.cyan(`  ID: ${scan.id}`));
        console.log(`     Date: ${date}`);
        console.log(`     Locales: ${locales}`);
        console.log(`     Total Keys: ${scan.total_keys}`);
        console.log(`     Source Files: ${JSON.parse(scan.source_files).length}`);
        console.log();
      }

      if (scans.length === 0) {
        console.log(chalk.gray('  No scans found. Run "i18n-checker scan" first.\n'));
      }

      store.close();

    } catch (error) {
      console.error(chalk.red('❌ Failed to list scans:'), error);
      process.exit(1);
    }
  });

function printIssuesSummary(issues: any[]) {
  const bySeverity: Record<string, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  
  const byType: Record<string, number> = {};

  for (const issue of issues) {
    bySeverity[issue.severity] = (bySeverity[issue.severity] || 0) + 1;
    byType[issue.type] = (byType[issue.type] || 0) + 1;
  }

  console.log(chalk.underline('By Severity:'));
  console.log(`  ${chalk.red('Critical:')} ${bySeverity.critical}`);
  console.log(`  ${chalk.yellow('High:')} ${bySeverity.high}`);
  console.log(`  ${chalk.blue('Medium:')} ${bySeverity.medium}`);
  console.log(`  ${chalk.gray('Low:')} ${bySeverity.low}\n`);

  console.log(chalk.underline('By Type:'));
  for (const [type, count] of Object.entries(byType)) {
    console.log(`  ${getIssueTypeLabel(type)}: ${count}`);
  }
  console.log();
}

function getSeverityColor(severity: string): (text: string) => string {
  switch (severity) {
    case 'critical':
      return chalk.red;
    case 'high':
      return chalk.yellow;
    case 'medium':
      return chalk.blue;
    case 'low':
      return chalk.gray;
    default:
      return chalk.white;
  }
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'open':
      return '🔴';
    case 'acknowledged':
      return '🟡';
    case 'resolved':
      return '🟢';
    case 'ignored':
      return '⚪';
    default:
      return '⚪';
  }
}

program.parse(process.argv);
