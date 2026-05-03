#!/usr/bin/env node

import { Command } from 'commander';
import * as path from 'path';
import { WorkflowParser } from '../parser/workflow';
import { ConfigParser } from '../parser/config';
import { RuleEngine, RuleEngineConfig } from '../engine/rules';
import { CsvReporter } from '../reporter/csv';
import { MarkdownReporter } from '../reporter/markdown';
import {
  GitHubWorkflow,
  EnvironmentManifest,
  SecretWhitelist,
  ApprovalRule,
  Report,
  Issue,
  WorkflowSummary,
  CliOptions
} from '../types';

const pkg = require('../../package.json');

const program = new Command();

program
  .name('gh-actions-guard')
  .description('GitHub Actions 工作流离线预检 CLI 工具')
  .version(pkg.version, '-v, --version', '显示版本号')
  .option('-w, --workflows-dir <dir>', '工作流目录路径', '.github/workflows')
  .option('-e, --environments <file>', '环境清单 CSV 文件路径')
  .option('-s, --secrets <file>', 'Secret 白名单 JSON 文件路径')
  .option('-a, --approval <file>', '审批规则 YAML 文件路径')
  .option('-o, --output <dir>', '输出目录', 'reports')
  .option('--verbose', '显示详细日志', false)
  .option('--fail-on-critical', '发现 Critical 问题时退出码为 1', false)
  .action(async (options: CliOptions) => {
    await runGuard(options);
  });

async function runGuard(options: CliOptions): Promise<void> {
  const verbose = options.verbose;
  const baseDir = process.cwd();

  if (verbose) {
    console.log('🔍 开始 GitHub Actions 发布预检...');
    console.log('');
    console.log('📋 配置:');
    console.log(`   工作流目录: ${options.workflowsDir}`);
    console.log(`   环境清单: ${options.environments || '(未提供)'}`);
    console.log(`   Secret 白名单: ${options.secrets || '(未提供)'}`);
    console.log(`   审批规则: ${options.approval || '(未提供)'}`);
    console.log(`   输出目录: ${options.output}`);
    console.log('');
  }

  try {
    const workflowsDir = path.resolve(baseDir, options.workflowsDir);
    
    const workflowParser = new WorkflowParser(workflowsDir);
    const configParser = new ConfigParser(baseDir);

    if (verbose) {
      console.log('📂 解析工作流文件...');
    }
    const workflows = await workflowParser.parseAll();
    
    if (workflows.length === 0) {
      console.error('❌ 错误: 未找到任何工作流文件');
      process.exit(1);
    }

    if (verbose) {
      console.log(`   ✓ 找到 ${workflows.length} 个工作流文件`);
    }

    let environments: EnvironmentManifest = { environments: [] };
    if (options.environments) {
      if (verbose) {
        console.log('📋 解析环境清单...');
      }
      environments = await configParser.parseEnvironmentsCsv(options.environments);
      if (verbose) {
        console.log(`   ✓ 找到 ${environments.environments.length} 个环境`);
      }
    } else {
      if (verbose) {
        console.log('⚠️  未提供环境清单，将使用空配置');
      }
    }

    let secretWhitelist: SecretWhitelist = {
      prodSecrets: [],
      nonProdSecrets: [],
      environmentSecrets: {}
    };
    if (options.secrets) {
      if (verbose) {
        console.log('🔐 解析 Secret 白名单...');
      }
      secretWhitelist = await configParser.parseSecretWhitelist(options.secrets);
      if (verbose) {
        const totalSecrets = secretWhitelist.prodSecrets.length + 
                            secretWhitelist.nonProdSecrets.length;
        console.log(`   ✓ 找到 ${totalSecrets} 个白名单 secret`);
      }
    }

    let approvalRules: ApprovalRule = { rules: [] };
    if (options.approval) {
      if (verbose) {
        console.log('✅ 解析审批规则...');
      }
      approvalRules = await configParser.parseApprovalRules(options.approval);
      if (verbose) {
        console.log(`   ✓ 找到 ${approvalRules.rules.length} 条审批规则`);
      }
    }

    if (verbose) {
      console.log('');
      console.log('🔍 运行检查规则...');
    }

    const ruleConfig: RuleEngineConfig = {
      workflows,
      environments,
      secretWhitelist,
      approvalRules
    };

    const ruleEngine = new RuleEngine(ruleConfig, workflowsDir);
    const { issues, workflowSummaries } = await ruleEngine.runAllRules();

    if (verbose) {
      const critical = issues.filter(i => i.severity === 'critical').length;
      const high = issues.filter(i => i.severity === 'high').length;
      const medium = issues.filter(i => i.severity === 'medium').length;
      const low = issues.filter(i => i.severity === 'low').length;
      
      console.log('');
      console.log('📊 检查结果:');
      console.log(`   🔴 Critical: ${critical}`);
      console.log(`   🟠 High: ${high}`);
      console.log(`   🟡 Medium: ${medium}`);
      console.log(`   🟢 Low: ${low}`);
    }

    const report = createReport(
      issues,
      workflowSummaries,
      options,
      workflows,
      baseDir
    );

    const outputDir = path.resolve(baseDir, options.output);
    
    if (verbose) {
      console.log('');
      console.log('📄 生成报告...');
    }

    const csvReporter = new CsvReporter(outputDir);
    const csvPath = await csvReporter.exportIssues(issues);
    
    if (verbose) {
      console.log(`   ✓ CSV 报告: ${csvPath}`);
    }

    const mdReporter = new MarkdownReporter(outputDir);
    const mdPath = await mdReporter.exportReport(report);
    
    if (verbose) {
      console.log(`   ✓ Markdown 报告: ${mdPath}`);
    }

    console.log('');
    console.log('✅ 预检完成!');
    console.log('');
    console.log('📄 输出文件:');
    console.log(`   - issues.csv`);
    console.log(`   - release_guard_report.md`);
    console.log('');

    const criticalCount = issues.filter(i => i.severity === 'critical').length;
    const highCount = issues.filter(i => i.severity === 'high').length;

    if (criticalCount > 0 || highCount > 0) {
      console.log('⚠️  发现问题:');
      if (criticalCount > 0) {
        console.log(`   🔴 ${criticalCount} 个 Critical 问题 - 建议立即修复`);
      }
      if (highCount > 0) {
        console.log(`   🟠 ${highCount} 个 High 问题 - 建议尽快修复`);
      }
      console.log('');
      console.log(`查看完整报告: ${options.output}/release_guard_report.md`);
    } else {
      console.log('🎉 没有发现严重问题!');
    }

    if (options.failOnCritical && criticalCount > 0) {
      process.exit(1);
    }

  } catch (error) {
    console.error('');
    console.error('❌ 执行失败:');
    console.error(`   ${(error as Error).message}`);
    
    if (options.verbose) {
      console.error('');
      console.error('堆栈信息:');
      console.error((error as Error).stack);
    }
    
    process.exit(1);
  }
}

function createReport(
  issues: Issue[],
  workflowSummaries: WorkflowSummary[],
  options: CliOptions,
  workflows: GitHubWorkflow[],
  scanDirectory: string
): Report {
  let totalJobs = 0;
  for (const workflow of workflows) {
    totalJobs += Object.keys(workflow.jobs).length;
  }

  const criticalIssues = issues.filter(i => i.severity === 'critical').length;
  const highIssues = issues.filter(i => i.severity === 'high').length;
  const mediumIssues = issues.filter(i => i.severity === 'medium').length;
  const lowIssues = issues.filter(i => i.severity === 'low').length;

  return {
    generatedAt: new Date(),
    summary: {
      totalWorkflows: workflows.length,
      totalJobs,
      criticalIssues,
      highIssues,
      mediumIssues,
      lowIssues
    },
    issues,
    workflows: workflowSummaries,
    metadata: {
      toolVersion: pkg.version,
      scanDirectory,
      configFiles: {
        environments: options.environments,
        secretWhitelist: options.secrets,
        approvalRules: options.approval
      }
    }
  };
}

program.parseAsync(process.argv)
  .catch((error) => {
    console.error('');
    console.error('❌ 执行失败:');
    console.error(`   ${error.message}`);
    process.exit(1);
  });
