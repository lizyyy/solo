import * as fs from 'fs';
import * as path from 'path';
import { parseTerraformPlan, getNewResources, getModifiedResources } from '../parsers/terraform';
import { parseIamPolicy } from '../parsers/iam';
import { parseOwnerCsv, parseExceptions } from '../parsers/csv-parser';
import { detectWildcardPermissions, detectCrossAccountTrust, detectPublicBuckets, detectUnregisteredOwners } from '../auditors/security-auditor';
import { generateCsvReport, generateMarkdownReport, generateHtmlGraph } from '../reporters/report-generator';
import { Issue, RiskReport, TerraformResource } from '../types';

export interface AuditOptions {
  plan?: string;
  iam?: string;
  owners?: string;
  exceptions?: string;
  output: string;
  verbose?: boolean;
}

export async function auditCommand(options: AuditOptions): Promise<void> {
  const { plan, iam, owners, exceptions, output, verbose } = options;

  if (verbose) {
    console.log('开始审计...');
    console.log('选项:', JSON.stringify(options, null, 2));
  }

  if (!fs.existsSync(output)) {
    fs.mkdirSync(output, { recursive: true });
  }

  let resources: TerraformResource[] = [];
  let newResources: TerraformResource[] = [];
  let modifiedResources: TerraformResource[] = [];
  let iamPolicies: any[] = [];
  let ownerMap: Map<string, string> = new Map();
  let exceptionList: any[] = [];

  if (plan) {
    try {
      if (verbose) console.log('解析 Terraform plan:', plan);
      const planData = parseTerraformPlan(plan);
      
      if (!planData.planned_values?.root_module?.resources && !planData.resource_changes?.length) {
        console.warn('⚠️  警告: Terraform plan 为空，没有待变更的资源');
      }

      resources = [
        ...(planData.planned_values?.root_module?.resources || []),
        ...(planData.planned_values?.root_module?.child_modules?.flatMap(m => m.resources || []).filter(Boolean) || [])
      ];

      newResources = getNewResources(planData);
      modifiedResources = getModifiedResources(planData);

      if (verbose) {
        console.log(`发现 ${resources.length} 个资源`);
        console.log(`其中 ${newResources.length} 个是新增资源`);
        console.log(`其中 ${modifiedResources.length} 个是修改资源`);
      }
    } catch (error: any) {
      console.error(`❌ 解析 Terraform plan 失败: ${error.message}`);
      throw error;
    }
  } else {
    console.warn('⚠️  未提供 Terraform plan 文件，将仅分析 IAM 策略文件');
  }

  if (iam) {
    try {
      if (verbose) console.log('解析 IAM 策略:', iam);
      const policies = parseIamPolicy(iam);
      iamPolicies = policies;
      if (verbose) console.log(`发现 ${policies.length} 个 IAM 策略`);
    } catch (error: any) {
      console.error(`❌ 解析 IAM 策略失败: ${error.message}`);
      throw error;
    }
  }

  if (owners) {
    try {
      if (verbose) console.log('解析资源 owner CSV:', owners);
      const ownerList = parseOwnerCsv(owners);
      ownerMap = new Map(ownerList.map(o => [`${o.resource_type}:${o.resource_name}`, o.owner]));
      if (verbose) console.log(`发现 ${ownerList.length} 个资源 owner 记录`);
    } catch (error: any) {
      console.error(`❌ 解析 owner CSV 失败: ${error.message}`);
      throw error;
    }
  }

  if (exceptions) {
    try {
      if (verbose) console.log('解析例外清单:', exceptions);
      exceptionList = parseExceptions(exceptions);
      if (verbose) console.log(`发现 ${exceptionList.length} 个例外项`);
    } catch (error: any) {
      console.error(`❌ 解析例外清单失败: ${error.message}`);
      throw error;
    }
  }

  const allResources = [...resources, ...newResources, ...modifiedResources];
  const uniqueResources = Array.from(new Map(allResources.map(r => [r.address, r])).values());

  if (verbose) console.log('开始安全检测...');

  const issues: Issue[] = [
    ...detectWildcardPermissions(uniqueResources, iamPolicies),
    ...detectCrossAccountTrust(uniqueResources, iamPolicies),
    ...detectPublicBuckets(uniqueResources, iamPolicies),
    ...detectUnregisteredOwners(uniqueResources, ownerMap),
  ];

  const issuesWithExceptions = issues.map(issue => {
    const exception = exceptionList.find(e => 
      e.resource === issue.resource && 
      (e.issue_type === issue.issue_type || e.issue_type === '*')
    );
    return {
      ...issue,
      is_exception: !!exception,
      exception_reason: exception?.reason
    };
  });

  const nonExceptionIssues = issuesWithExceptions.filter(i => !i.is_exception);

  const statistics = {
    by_type: {} as Record<string, number>,
    by_severity: {} as Record<string, number>,
    by_owner: {} as Record<string, number>
  };

  nonExceptionIssues.forEach(issue => {
    statistics.by_type[issue.issue_type] = (statistics.by_type[issue.issue_type] || 0) + 1;
    statistics.by_severity[issue.severity] = (statistics.by_severity[issue.severity] || 0) + 1;
  });

  const report: RiskReport = {
    summary: {
      total_issues: nonExceptionIssues.length,
      critical_count: nonExceptionIssues.filter(i => i.severity === 'critical').length,
      high_count: nonExceptionIssues.filter(i => i.severity === 'high').length,
      medium_count: nonExceptionIssues.filter(i => i.severity === 'medium').length,
      low_count: nonExceptionIssues.filter(i => i.severity === 'low').length,
      exceptions_count: issuesWithExceptions.filter(i => i.is_exception).length
    },
    resources: {
      new_resources: newResources,
      modified_resources: modifiedResources
    },
    issues: issuesWithExceptions,
    statistics
  };

  if (verbose) {
    console.log('检测结果:');
    console.log(`  总问题数: ${nonExceptionIssues.length}`);
    console.log(`  Critical: ${report.summary.critical_count}`);
    console.log(`  High: ${report.summary.high_count}`);
    console.log(`  Medium: ${report.summary.medium_count}`);
    console.log(`  Low: ${report.summary.low_count}`);
    console.log(`  例外项: ${report.summary.exceptions_count}`);
  }

  const csvPath = path.join(output, 'issues.csv');
  const mdPath = path.join(output, 'risk_report.md');
  const graphPath = path.join(output, 'graph.html');

  if (verbose) console.log('生成报告...');

  await generateCsvReport(issuesWithExceptions, csvPath);
  await generateMarkdownReport(report, mdPath);
  await generateHtmlGraph(report, graphPath);

  console.log('\n✅ 报告已生成:');
  console.log(`   - issues.csv: ${csvPath}`);
  console.log(`   - risk_report.md: ${mdPath}`);
  console.log(`   - graph.html: ${graphPath}`);
}
