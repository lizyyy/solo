import * as fs from 'fs-extra';
import * as path from 'path';
import { DiffResult, RuleConfig, PermissionDiff } from './types';

export async function generateOutput(
  result: DiffResult,
  outputDir: string,
  rules: RuleConfig
): Promise<void> {
  await fs.ensureDir(outputDir);

  const filesGenerated: { filename: string; description: string; recordCount: number }[] = [];

  if (rules.rules.output.splitByCategory) {
    if (result.standardDiffs.length > 0) {
      const filename = '01-standard-permission-diffs.json';
      await fs.writeJson(
        path.join(outputDir, filename),
        {
          fileType: '组织变更-标准权限差异',
          generatedAt: new Date().toISOString(),
          ruleVersion: rules.version,
          recordCount: result.standardDiffs.length,
          data: result.standardDiffs
        },
        { spaces: 2 }
      );
      filesGenerated.push({
        filename,
        description: '标准权限差异文件：包含调岗导致的常规权限增减变更',
        recordCount: result.standardDiffs.length
      });
    }

    if (result.partTimeDiffs.length > 0) {
      const filename = '02-parttime-permission-diffs.json';
      await fs.writeJson(
        path.join(outputDir, filename),
        {
          fileType: '组织变更-兼职部门权限差异',
          generatedAt: new Date().toISOString(),
          ruleVersion: rules.version,
          recordCount: result.partTimeDiffs.length,
          handlingRules: rules.rules.partTimeHandling,
          data: result.partTimeDiffs
        },
        { spaces: 2 }
      );
      filesGenerated.push({
        filename,
        description: '兼职部门权限差异文件：员工在兼职部门拥有的权限变更，需特殊处理',
        recordCount: result.partTimeDiffs.length
      });
    }

    if (result.temporaryDiffs.length > 0) {
      const filename = '03-temporary-permission-diffs.json';
      await fs.writeJson(
        path.join(outputDir, filename),
        {
          fileType: '组织变更-临时授权差异',
          generatedAt: new Date().toISOString(),
          ruleVersion: rules.version,
          recordCount: result.temporaryDiffs.length,
          handlingRules: rules.rules.temporaryAuthorization,
          data: result.temporaryDiffs
        },
        { spaces: 2 }
      );
      filesGenerated.push({
        filename,
        description: '临时授权差异文件：有过期时间的临时权限，标注是否需要重新审批',
        recordCount: result.temporaryDiffs.length
      });
    }

    if (result.inheritedDiffs.length > 0) {
      const filename = '04-inherited-permission-diffs.json';
      await fs.writeJson(
        path.join(outputDir, filename),
        {
          fileType: '组织变更-继承规则差异',
          generatedAt: new Date().toISOString(),
          ruleVersion: rules.version,
          recordCount: result.inheritedDiffs.length,
          handlingRules: rules.rules.inheritance,
          data: result.inheritedDiffs
        },
        { spaces: 2 }
      );
      filesGenerated.push({
        filename,
        description: '继承规则差异文件：从角色/组/部门继承的权限，调岗后重新计算的结果',
        recordCount: result.inheritedDiffs.length
      });
    }

    if (rules.rules.output.includeUnchanged && result.unchangedPermissions.length > 0) {
      const filename = '05-unchanged-permissions.json';
      await fs.writeJson(
        path.join(outputDir, filename),
        {
          fileType: '组织变更-未变更权限',
          generatedAt: new Date().toISOString(),
          ruleVersion: rules.version,
          recordCount: result.unchangedPermissions.length,
          data: result.unchangedPermissions
        },
        { spaces: 2 }
      );
      filesGenerated.push({
        filename,
        description: '未变更权限文件：调岗前后保持不变的权限清单',
        recordCount: result.unchangedPermissions.length
      });
    }
  } else {
    const filename = 'all-permission-diffs.json';
    await fs.writeJson(
      path.join(outputDir, filename),
      {
        fileType: '组织变更-全部权限差异',
        generatedAt: new Date().toISOString(),
        ruleVersion: rules.version,
        summary: result.summary,
        data: {
          standardDiffs: result.standardDiffs,
          partTimeDiffs: result.partTimeDiffs,
          temporaryDiffs: result.temporaryDiffs,
          inheritedDiffs: result.inheritedDiffs,
          unchangedPermissions: result.unchangedPermissions
        }
      },
      { spaces: 2 }
    );
    filesGenerated.push({
      filename,
      description: '全部权限差异汇总文件',
      recordCount: result.standardDiffs.length + result.partTimeDiffs.length +
                   result.temporaryDiffs.length + result.inheritedDiffs.length
    });
  }

  if (result.errors.length > 0) {
    const filename = 'processing-errors.json';
    await fs.writeJson(
      path.join(outputDir, filename),
      {
        fileType: '组织变更-处理错误',
        generatedAt: new Date().toISOString(),
        ruleVersion: rules.version,
        errorCount: result.errors.length,
        errors: result.errors
      },
      { spaces: 2 }
    );
    filesGenerated.push({
      filename,
      description: '处理过程中发现的错误和警告信息',
      recordCount: result.errors.length
    });
  }

  if (rules.rules.output.generateSummary) {
    const summaryFile = await generateSummaryReport(result, rules, outputDir, filesGenerated);
    filesGenerated.push(summaryFile);
  }
}

async function generateSummaryReport(
  result: DiffResult,
  rules: RuleConfig,
  outputDir: string,
  filesGenerated: { filename: string; description: string; recordCount: number }[]
): Promise<{ filename: string; description: string; recordCount: number }> {
  const summaryContent = `
═══════════════════════════════════════════════════════════════
           组织变更文件权限重算差异 - 汇总报告
═══════════════════════════════════════════════════════════════

生成时间: ${new Date().toLocaleString('zh-CN')}
规则版本: ${rules.version}
生效日期: ${rules.effectiveDate}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                         统计摘要
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  员工总数:                     ${result.summary.totalEmployees} 人
  权限变更总数:                 ${result.summary.totalPermissionsChanged} 项
    ├─ 新增权限:                ${result.summary.addedPermissions} 项
    └─ 移除权限:                ${result.summary.removedPermissions} 项

  特殊类别差异统计:
    ├─ 兼职部门权限差异:        ${result.summary.partTimeDiffs} 项
    ├─ 临时授权差异:            ${result.summary.temporaryDiffs} 项
    └─ 继承规则差异:            ${result.summary.inheritedDiffs} 项

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                        处理规则配置
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  兼职部门处理:
    ├─ 启用:                    ${rules.rules.partTimeHandling.enabled ? '是' : '否'}
    ├─ 调岗后保留:              ${rules.rules.partTimeHandling.retainOnTransfer ? '是' : '否'}
    └─ 自动过期天数:            ${rules.rules.partTimeHandling.autoExpireDays} 天

  临时授权处理:
    ├─ 启用:                    ${rules.rules.temporaryAuthorization.enabled ? '是' : '否'}
    ├─ 调岗后延续:              ${rules.rules.temporaryAuthorization.carryOverOnTransfer ? '是' : '否'}
    └─ 需重新审批:              ${rules.rules.temporaryAuthorization.requireReapproval ? '是' : '否'}

  继承规则处理:
    ├─ 启用:                    ${rules.rules.inheritance.enabled ? '是' : '否'}
    ├─ 部门变更时重算:          ${rules.rules.inheritance.recalculateOnDepartmentChange ? '是' : '否'}
    ├─ 角色继承:                ${rules.rules.inheritance.roleInheritance ? '是' : '否'}
    ├─ 用户组继承:              ${rules.rules.inheritance.groupInheritance ? '是' : '否'}
    └─ 部门继承:                ${rules.rules.inheritance.departmentInheritance ? '是' : '否'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                         输出文件清单
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

本次共生成 ${filesGenerated.length} 个文件:

${filesGenerated.map((file, idx) => `  ${String(idx + 1).padStart(2)}. ${file.filename}
      说明: ${file.description}
      记录数: ${file.recordCount} 项
`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                         处理说明
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  1. 标准权限差异: 调岗直接导致的权限变更
  2. 兼职部门差异: 需要特别关注的跨部门权限
  3. 临时授权差异: 有时效限制的权限，可能需要重新审批
  4. 继承规则差异: 从组织架构继承的权限，调岗后需重新评估

  请根据业务实际情况复核上述差异，确保权限变更准确无误。

═══════════════════════════════════════════════════════════════
`;

  const filename = 'SUMMARY-REPORT.txt';
  await fs.writeFile(path.join(outputDir, filename), summaryContent, 'utf8');

  return {
    filename,
    description: '汇总报告文件：包含完整的统计信息、规则配置说明和输出文件清单',
    recordCount: 1
  };
}
