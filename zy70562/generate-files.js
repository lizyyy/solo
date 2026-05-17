const fs = require('fs');

const files = {
  'src/parsers/file-reader.ts': `import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { RulesFile } from '../types';

export class FileReader {
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  read(): { content: string; lines: string[] } {
    const content = fs.readFileSync(this.filePath, 'utf-8');
    const lines = content.split('\\n');
    return { content, lines };
  }

  parseYaml(): RulesFile {
    const { content } = this.read();
    const parsed = yaml.load(content) as RulesFile;
    
    if (!parsed.groups) {
      throw new Error('Invalid Prometheus rules file: missing groups field');
    }
    
    return parsed;
  }

  findRuleLineNumber(ruleName: string, groupName: string): number | undefined {
    const { lines } = this.read();
    let inGroup = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.includes(name: groupName)) {
        inGroup = true;
      }
      
      if (inGroup && line.includes(alert: ruleName)) {
        return i + 1;
      }
      
      if (inGroup && line.match(/^\\s*- name:/) && !line.includes(groupName)) {
        break;
      }
    }
    
    return undefined;
  }
}

export function resolveInputPath(inputPath: string): string[] {
  const resolved = path.resolve(inputPath);
  
  if (fs.statSync(resolved).isDirectory()) {
    return fs.readdirSync(resolved)
      .filter(f => f.endsWith('.yml') || f.endsWith('.yaml'))
      .map(f => path.join(resolved, f));
  }
  
  return [resolved];
}
`,

  'src/validators/rule-validator.ts': `import { PrometheusRule, ValidationIssue, RuleValidationResult } from '../types';
import { PromQLParser } from '../parsers/promql-parser';
import { AnnotationParser } from '../parsers/annotation-parser';

export class RuleValidator {
  private filePath: string;
  private groupName: string;

  constructor(filePath: string, groupName: string) {
    this.filePath = filePath;
    this.groupName = groupName;
  }

  validate(rule: PrometheusRule): RuleValidationResult {
    const issues: ValidationIssue[] = [];
    const result: RuleValidationResult = {
      ruleName: rule.alert,
      groupName: this.groupName,
      filePath: this.filePath,
      expr: rule.expr,
      issues: []
    };

    const promqlParser = new PromQLParser(rule.expr);
    const syntaxCheck = promqlParser.validateSyntax();
    if (!syntaxCheck.valid) {
      issues.push({
        type: 'error',
        category: 'syntax',
        message: PromQL syntax error: syntaxCheck.error,
        ruleName: rule.alert,
        groupName: this.groupName,
        filePath: this.filePath,
        rawContent: rule.expr
      });
    }

    const parsedLabels = promqlParser.parse();
    result.parsedLabels = parsedLabels;
    const availableLabels = promqlParser.getAvailableLabels();

    if (rule.annotations) {
      for (const [key, value] of Object.entries(rule.annotations)) {
        const annotationParser = new AnnotationParser(value);
        const placeholders = annotationParser.getAllPlaceholders();

        for (const placeholder of placeholders) {
          const labelPath = placeholder.split('.');
          const labelName = labelPath[0];
          
          if (!availableLabels.includes(labelName) && 
              !['value', 'labels', 'externalLabels'].includes(labelName)) {
            issues.push({
              type: 'warning',
              category: 'annotation_placeholder',
              message: Annotation placeholder not found in expression: placeholder,
              ruleName: rule.alert,
              groupName: this.groupName,
              filePath: this.filePath
            });
          }
        }
      }

      result.annotationPlaceholders = [...new Set(
        Object.values(rule.annotations).flatMap(v => 
          new AnnotationParser(v).extractPlaceholders()
        )
      )];
    }

    if (!rule.annotations?.summary && !rule.annotations?.description) {
      issues.push({
        type: 'info',
        category: 'annotation_missing',
        message: 'Missing summary or description annotation',
        ruleName: rule.alert,
        groupName: this.groupName,
        filePath: this.filePath
      });
    }

    result.issues = issues;
    return result;
  }
}
`,

  'src/reporters/report-generator.ts': `import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { LintResult, RuleValidationResult } from '../types';

const VERSION = '1.0.0';

export class ReportGenerator {
  private result: LintResult;
  private outputDir?: string;

  constructor(result: LintResult, outputDir?: string) {
    this.result = result;
    this.outputDir = outputDir;
  }

  generateConsoleSummary(): string {
    const lines: string[] = [];
    
    lines.push(chalk.bold('\\n=== Prometheus Rule Linter Report ===\\n'));
    lines.push(Scan time: this.result.timestamp);
    lines.push(Files scanned: this.result.files.length);
    lines.push(Groups scanned: this.result.summary.totalGroups);
    lines.push(Rules scanned: this.result.summary.totalRules + '\\n');

    if (this.result.summary.totalIssues === 0) {
      lines.push(chalk.green('✓ All rules passed validation!\\n'));
    } else {
      lines.push(Issues found: this.result.summary.totalIssues);
      lines.push(  - chalk.red(Errors: this.result.summary.errors));
      lines.push(  - chalk.yellow(Warnings: this.result.summary.warnings));
      lines.push(  - chalk.blue(Info: this.result.summary.infos));
      lines.push(  - chalk.magenta(Rules with issues: this.result.summary.rulesWithIssues) + '\\n');

      const rulesWithIssues = this.result.results.filter(r => r.issues.length > 0);
      for (const rule of rulesWithIssues) {
        lines.push(chalk.bold(Rule: rule.ruleName));
        lines.push(  File: rule.filePath);
        lines.push(  Expression: rule.expr);
        const labels = rule.parsedLabels?.byLabels.join(', ') || rule.parsedLabels?.labels.join(', ') || 'None';
        lines.push(  Available labels: labels);
        
        for (const issue of rule.issues) {
          const icon = issue.type === 'error' ? '✗' : issue.type === 'warning' ? '⚠' : 'ℹ';
          const colorFn = issue.type === 'error' ? chalk.red : issue.type === 'warning' ? chalk.yellow : chalk.blue;
          
          let lineInfo = '';
          if (issue.line) {
            lineInfo = (line issue.line);
          }
          
          lines.push(colorFn(  icon [issue.category] issue.message lineInfo));
        }
        lines.push('');
      }
    }

    if (this.outputDir) {
      lines.push(chalk.gray(Reports saved to: this.outputDir));
    }

    return lines.join('\\n');
  }

  generateJson(): string {
    return JSON.stringify(this.result, null, 2);
  }

  generateMarkdown(): string {
    const lines: string[] = [];
    
    lines.push('# Prometheus Rule Linter Report\\n');
    lines.push(> Generated at: this.result.timestamp);
    lines.push(> Tool version: VERSION + '\\n');
    
    lines.push('## Summary\\n');
    lines.push('| Metric | Value |');
    lines.push('|--------|-------|');
    lines.push(| Files scanned | this.result.files.length |);
    lines.push(| Groups scanned | this.result.summary.totalGroups |);
    lines.push(| Rules scanned | this.result.summary.totalRules |);
    lines.push(| Rules with issues | this.result.summary.rulesWithIssues |);
    lines.push(| **Total issues** | **this.result.summary.totalIssues** |\\n);

    if (this.result.summary.totalIssues > 0) {
      lines.push('## Issue Breakdown\\n');
      lines.push('| Type | Count |');
      lines.push('|------|-------|');
      lines.push(| 🔴 Errors | this.result.summary.errors |);
      lines.push(| 🟡 Warnings | this.result.summary.warnings |);
      lines.push(| 🔵 Info | this.result.summary.infos |\\n);
    }

    const rulesWithIssues = this.result.results.filter(r => r.issues.length > 0);
    
    if (rulesWithIssues.length > 0) {
      lines.push('## Detailed Issues\\n');
      
      for (const rule of rulesWithIssues) {
        lines.push(### rule.ruleName);
        lines.push(- **File**: rule.filePath);
        lines.push(- **Expression**: rule.expr);
        const labels = rule.parsedLabels?.byLabels.join(', ') || rule.parsedLabels?.labels.join(', ') || 'None';
        lines.push(- **Labels**: labels + '\\n');
        
        lines.push('| Level | Category | Message | Line |');
        lines.push('|-------|----------|---------|------|');
        
        for (const issue of rule.issues) {
          const level = issue.type === 'error' ? '🔴 Error' : issue.type === 'warning' ? '🟡 Warning' : '🔵 Info';
          const lineNum = issue.line || '-';
          lines.push(| level | issue.category | issue.message | lineNum |);
        }
        lines.push('\\n');
      }
    }

    const goodRules = this.result.results.filter(r => r.issues.length === 0);
    if (goodRules.length > 0) {
      lines.push('## Valid Rules\\n');
      for (const rule of goodRules.slice(0, 20)) {
        lines.push(- ✓ rule.ruleName (rule.filePath));
      }
      if (goodRules.length > 20) {
        lines.push(- ... and goodRules.length - 20 more rules\\n);
      }
      lines.push('');
    }

    lines.push('## Scanned Files\\n');
    for (const file of this.result.files) {
      lines.push(- file);
    }

    return lines.join('\\n');
  }

  saveReports(): void {
    if (!this.outputDir) {
      return;
    }

    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    const jsonPath = path.join(this.outputDir, report-timestamp.json);
    fs.writeFileSync(jsonPath, this.generateJson(), 'utf-8');
    
    const mdPath = path.join(this.outputDir, report-timestamp.md);
    fs.writeFileSync(mdPath, this.generateMarkdown(), 'utf-8');

    const latestJsonPath = path.join(this.outputDir, 'latest.json');
    const latestMdPath = path.join(this.outputDir, 'latest.md');
    
    if (fs.existsSync(latestJsonPath)) {
      fs.unlinkSync(latestJsonPath);
    }
    if (fs.existsSync(latestMdPath)) {
      fs.unlinkSync(latestMdPath);
    }
    
    fs.writeFileSync(latestJsonPath, this.generateJson(), 'utf-8');
    fs.writeFileSync(latestMdPath, this.generateMarkdown(), 'utf-8');
  }
}
`,

  'src/cli.ts': `#!/usr/bin/env node

import { Command } from 'commander';
import { CliOptions, LintResult, RuleValidationResult } from './types';
import { FileReader, resolveInputPath } from './parsers/file-reader';
import { RuleValidator } from './validators/rule-validator';
import { ReportGenerator } from './reporters/report-generator';

const VERSION = '1.0.0';

const program = new Command();

program
  .name('prom-rule-linter')
  .description('Prometheus Rule Linter - Validate alerting rules expressions, labels, and annotations')
  .version(VERSION)
  .option('-i, --input <path>', 'Input file or directory path', './rules')
  .option('-o, --output <directory>', 'Report output directory')
  .option('-v, --verbose', 'Show verbose output')
  .option('--fail-on-error', 'Exit with non-zero code on errors')
  .parse(process.argv);

const options = program.opts() as CliOptions;

async function main() {
  try {
    const files = resolveInputPath(options.input);
    
    if (files.length === 0) {
      console.error('No rule files found');
      process.exit(1);
    }

    if (options.verbose) {
      console.log(Found files.length + ' rule files);
    }

    const allResults: RuleValidationResult[] = [];
    let totalGroups = 0;

    for (const file of files) {
      if (options.verbose) {
        console.log(Processing: file);
      }

      const reader = new FileReader(file);
      const rulesFile = reader.parseYaml();
      
      totalGroups += rulesFile.groups.length;

      for (const group of rulesFile.groups) {
        const validator = new RuleValidator(file, group.name);
        
        for (const rule of group.rules) {
          const result = validator.validate(rule);
          
          const lineNum = reader.findRuleLineNumber(rule.alert, group.name);
          if (lineNum) {
            result.issues = result.issues.map(issue => ({
              ...issue,
              line: lineNum
            }));
          }
          
          allResults.push(result);
        }
      }
    }

    const totalRules = allResults.length;
    const allIssues = allResults.flatMap(r => r.issues);
    const rulesWithIssues = allResults.filter(r => r.issues.length > 0).length;

    const lintResult: LintResult = {
      summary: {
        totalRules,
        totalGroups,
        totalIssues: allIssues.length,
        errors: allIssues.filter(i => i.type === 'error').length,
        warnings: allIssues.filter(i => i.type === 'warning').length,
        infos: allIssues.filter(i => i.type === 'info').length,
        rulesWithIssues
      },
      results: allResults,
      files,
      timestamp: new Date().toISOString(),
      version: VERSION
    };

    const reportGenerator = new ReportGenerator(lintResult, options.output);
    console.log(reportGenerator.generateConsoleSummary());

    if (options.output) {
      reportGenerator.saveReports();
    }

    if (options.failOnError && lintResult.summary.errors > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
`
};

for (const [path, content] of Object.entries(files)) {
  fs.writeFileSync(path, content, 'utf-8');
  console.log(Created: path);
}

console.log('All files created successfully!');
