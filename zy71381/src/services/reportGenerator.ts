import dayjs from 'dayjs';
import type {
  ComplianceReport,
  Dependency,
  ReportFormat,
  ExportRecord,
  Project,
  ReportEntry,
  ReportStats,
  ComplianceResult,
  ReportDependency,
} from '../types';
import { generateId, getCurrentUser } from '../types';
import { db, calculateObjectHash } from '../db';

interface ReportDiff {
  changed: boolean;
  changes: { field: string; old: number; new: number }[];
}

export class ReportGenerator {
  async generate(projectId: string): Promise<ComplianceReport> {
    const project = await db.projects.get(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    const stats = await this.calculateStats(projectId);
    const hash = await calculateObjectHash(stats);

    const lastReport = await this.getLastReport(projectId);
    if (lastReport) {
      const diff = this.compareStats(stats, lastReport);
      if (diff.changed) {
        this.logReportDiff(lastReport, stats, diff);
      }
    }

    const entries = await this.generateEntries(projectId);
    const dependencies = await this.generateReportDependencies(projectId);
    const complianceResult = this.generateComplianceResult(stats);

    const report: ComplianceReport = {
      id: generateId(),
      projectId,
      title: `${project.name} - 开源依赖合规报告`,
      notes: '',
      reportVersion: this.incrementVersion(lastReport?.reportVersion),
      version: (lastReport?.version || 0) + 1,
      generatedAt: Date.now(),
      generatedBy: getCurrentUser(),
      status: 'draft',
      totalDependencies: stats.totalDependencies,
      safeCount: stats.safeCount,
      warningCount: stats.warningCount,
      criticalCount: stats.criticalCount,
      unknownCount: stats.unknownCount,
      waiverCount: stats.waiverCount,
      dirtyCount: stats.dirtyCount,
      contentHash: hash,
      exportHash: hash,
      verificationStatus: 'pending',
      stats: await this.generateDetailedStats(projectId),
      complianceResult,
      dependencies,
      entries,
    };

    await db.reports.add(report);
    await db.reportEntries.bulkAdd(entries);

    return report;
  }

  async calculateStats(projectId: string): Promise<{
    totalDependencies: number;
    safeCount: number;
    warningCount: number;
    criticalCount: number;
    unknownCount: number;
    waiverCount: number;
    dirtyCount: number;
  }> {
    const dependencies = await db.dependencies.where('projectId').equals(projectId).toArray();

    const stats = {
      totalDependencies: dependencies.length,
      safeCount: 0,
      warningCount: 0,
      criticalCount: 0,
      unknownCount: 0,
      waiverCount: 0,
      dirtyCount: 0,
    };

    for (const dep of dependencies) {
      switch (dep.riskLevel) {
        case 'safe':
          stats.safeCount++;
          break;
        case 'warning':
          stats.warningCount++;
          break;
        case 'critical':
          stats.criticalCount++;
          break;
        case 'unknown':
          stats.unknownCount++;
          break;
      }

      if (dep.waiverId) {
        stats.waiverCount++;
      }

      if (dep.dirtyData && !dep.dirtyData.fixed) {
        stats.dirtyCount++;
      }
    }

    return stats;
  }

  async generateDetailedStats(projectId: string): Promise<ReportStats> {
    const dependencies = await db.dependencies.where('projectId').equals(projectId).toArray();

    const stats: ReportStats = {
      total: dependencies.length,
      directCount: dependencies.filter((d) => d.isDirect).length,
      transitiveCount: dependencies.filter((d) => !d.isDirect).length,
      waiverCount: dependencies.filter((d) => d.waiverId).length,
      riskBreakdown: {
        critical: 0,
        warning: 0,
        safe: 0,
        unknown: 0,
      },
      licenseBreakdown: {},
    };

    for (const dep of dependencies) {
      stats.riskBreakdown[dep.riskLevel]++;
      const licenseKey = Array.isArray(dep.license) ? dep.license.join(' OR ') : dep.license || 'Unknown';
      stats.licenseBreakdown[licenseKey] = (stats.licenseBreakdown[licenseKey] || 0) + 1;
    }

    return stats;
  }

  generateComplianceResult(stats: {
    criticalCount: number;
    warningCount: number;
    unknownCount: number;
    dirtyCount: number;
  }): ComplianceResult {
    const passed = stats.criticalCount === 0 && stats.dirtyCount === 0;
    const details: string[] = [];

    if (stats.criticalCount > 0) {
      details.push(`存在 ${stats.criticalCount} 个高危依赖需要处理`);
    }
    if (stats.warningCount > 0) {
      details.push(`存在 ${stats.warningCount} 个中危依赖需要关注`);
    }
    if (stats.unknownCount > 0) {
      details.push(`存在 ${stats.unknownCount} 个未知风险依赖需要确认`);
    }
    if (stats.dirtyCount > 0) {
      details.push(`存在 ${stats.dirtyCount} 条脏数据需要修复`);
    }

    return {
      passed,
      summary: passed ? '所有依赖合规检查通过' : '存在合规问题需要处理',
      details: details.length > 0 ? details : undefined,
    };
  }

  async generateReportDependencies(projectId: string): Promise<ReportDependency[]> {
    const dependencies = await db.dependencies.where('projectId').equals(projectId).toArray();

    return dependencies.map((dep) => ({
      packageName: dep.packageName,
      packageVersion: dep.packageVersion,
      license: dep.license,
      riskLevel: dep.riskLevel,
      status: dep.status,
      waiverId: dep.waiverId,
    }));
  }

  async getLastReport(projectId: string): Promise<ComplianceReport | undefined> {
    return db.reports
      .where('projectId')
      .equals(projectId)
      .reverse()
      .sortBy('generatedAt')
      .then((reports) => reports[0]);
  }

  compareStats(
    actual: {
      totalDependencies: number;
      safeCount: number;
      warningCount: number;
      criticalCount: number;
      unknownCount: number;
      waiverCount: number;
      dirtyCount: number;
    },
    reported: {
      totalDependencies: number;
      safeCount: number;
      warningCount: number;
      criticalCount: number;
      unknownCount: number;
      waiverCount: number;
      dirtyCount: number;
    }
  ): ReportDiff {
    const changes: ReportDiff['changes'] = [];
    const fields = [
      'totalDependencies',
      'safeCount',
      'warningCount',
      'criticalCount',
      'unknownCount',
      'waiverCount',
      'dirtyCount',
    ] as const;

    for (const field of fields) {
      const oldValue = reported[field];
      const newValue = actual[field];
      if (oldValue !== newValue) {
        changes.push({ field, old: oldValue, new: newValue });
      }
    }

    return {
      changed: changes.length > 0,
      changes,
    };
  }

  private logReportDiff(
    oldReport: ComplianceReport,
    newStats: {
      totalDependencies: number;
      safeCount: number;
      warningCount: number;
      criticalCount: number;
      unknownCount: number;
      waiverCount: number;
      dirtyCount: number;
    },
    diff: ReportDiff
  ): void {
    console.warn(`[Report] 报告数据变化检测: ${oldReport.reportVersion} -> new`);
    diff.changes.forEach((c) => {
      console.warn(`  ${c.field}: ${c.old} -> ${c.new}`);
    });
  }

  private async generateEntries(projectId: string): Promise<ReportEntry[]> {
    const dependencies = await db.dependencies
      .where('projectId')
      .equals(projectId)
      .toArray();

    const reportId = generateId();

    return dependencies.map((dep) => ({
      id: generateId(),
      reportId,
      dependencyId: dep.id,
      packageName: dep.packageName,
      packageVersion: dep.packageVersion,
      license: Array.isArray(dep.license)
        ? dep.license.join(' OR ')
        : dep.license || 'Unknown',
      riskLevel: dep.riskLevel,
      status: dep.status,
      waiverId: dep.waiverId,
      notes: dep.blockReason || dep.reviewNotes,
    }));
  }

  private incrementVersion(lastVersion?: string): string {
    if (!lastVersion) {
      return 'v1.0.0';
    }

    const match = lastVersion.match(/^v(\d+)\.(\d+)\.(\d+)$/);
    if (!match) {
      return 'v1.0.0';
    }

    const [, major, minor, patch] = match.map(Number);
    return `v${major}.${minor}.${patch + 1}`;
  }

  async verifyReport(reportId: string): Promise<boolean> {
    const report = await db.reports.get(reportId);
    if (!report) return false;

    const actual = await this.calculateStats(report.projectId);
    const currentHash = await calculateObjectHash(actual);

    const numbersMatch =
      report.totalDependencies === actual.totalDependencies &&
      report.safeCount === actual.safeCount &&
      report.warningCount === actual.warningCount &&
      report.criticalCount === actual.criticalCount &&
      report.unknownCount === actual.unknownCount &&
      report.waiverCount === actual.waiverCount &&
      report.dirtyCount === actual.dirtyCount;

    const hashMatch = report.exportHash === currentHash;

    if (numbersMatch && hashMatch) {
      await db.reports.update(reportId, {
        verificationStatus: 'verified',
        verificationHash: currentHash,
        verificationTime: Date.now(),
      });
    } else {
      await db.reports.update(reportId, {
        verificationStatus: 'failed',
        verificationTime: Date.now(),
      });
    }

    return numbersMatch && hashMatch;
  }

  async exportReport(
    reportId: string,
    format: ReportFormat
  ): Promise<ExportRecord> {
    const report = await db.reports.get(reportId);
    if (!report) {
      throw new Error('Report not found');
    }

    const project = await db.projects.get(report.projectId);
    const entries = await db.reportEntries.where('reportId').equals(reportId).toArray();

    const isValid = await this.verifyReport(reportId);
    if (!isValid) {
      console.warn('[Export] 报告数据已变更，建议重新生成报告');
    }

    const content = this.formatExport(report, entries, format, project);
    const exportHash = await calculateObjectHash({ report, entries, format });

    this.downloadExport(content, format, project?.name || 'report');

    const exportRecord: ExportRecord = {
      id: generateId(),
      reportId,
      format,
      exportedAt: Date.now(),
      exportedBy: getCurrentUser(),
      exportHash,
      recordCount: entries.length,
    };

    await db.exports.add(exportRecord);

    if (project) {
      await db.projects.update(project.id, {
        lastExportHash: exportHash,
        updatedAt: Date.now(),
      });
    }

    return exportRecord;
  }

  private formatExport(
    report: ComplianceReport,
    entries: ReportEntry[],
    format: ReportFormat,
    project?: Project
  ): string {
    const header = this.generateReportHeader(report, project);

    switch (format) {
      case 'json':
        return JSON.stringify({ report, entries }, null, 2);

      case 'csv':
        return this.formatAsCSV(report, entries, header);

      case 'markdown':
        return this.formatAsMarkdown(report, entries, header);

      case 'pdf':
        return this.formatAsMarkdown(report, entries, header);

      default:
        return JSON.stringify({ report, entries }, null, 2);
    }
  }

  private generateReportHeader(report: ComplianceReport, project?: Project): string {
    return `
# 开源依赖合规报告

## 项目信息
- 项目名称: ${project?.name || '未知项目'}
- 报告版本: ${report.reportVersion}
- 生成时间: ${dayjs(report.generatedAt).format('YYYY-MM-DD HH:mm:ss')}
- 生成人: ${report.generatedBy}
- 数据校验: ${report.exportHash}

## 统计概览
- 总依赖数: ${report.totalDependencies}
- 低危: ${report.safeCount}
- 中危: ${report.warningCount}
- 高危: ${report.criticalCount}
- 未知: ${report.unknownCount}
- 豁免: ${report.waiverCount}
- 脏数据: ${report.dirtyCount}
`.trim();
  }

  private formatAsCSV(
    report: ComplianceReport,
    entries: ReportEntry[],
    header: string
  ): string {
    const csvHeader = [
      '包名',
      '版本',
      '许可证',
      '风险等级',
      '状态',
      '豁免ID',
      '备注',
    ].join(',');

    const csvRows = entries.map((entry) => {
      const riskLabels: Record<string, string> = {
        critical: '高危',
        warning: '中危',
        safe: '低危',
        unknown: '未知',
      };
      return [
        `"${entry.packageName}"`,
        `"${entry.packageVersion}"`,
        `"${entry.license}"`,
        `"${riskLabels[entry.riskLevel] || entry.riskLevel}"`,
        `"${entry.status}"`,
        `"${entry.waiverId || ''}"`,
        `"${(entry.notes || '').replace(/"/g, '""')}"`,
      ].join(',');
    });

    return `# ${header.replace(/\n/g, '\n# ')}\n\n${csvHeader}\n${csvRows.join('\n')}`;
  }

  private formatAsMarkdown(
    report: ComplianceReport,
    entries: ReportEntry[],
    header: string
  ): string {
    const riskBadge: Record<string, string> = {
      critical: '🔴 高危',
      warning: '🟡 中危',
      safe: '🟢 低危',
      unknown: '⚪ 未知',
    };

    const entriesTable = `
## 依赖明细

| 包名 | 版本 | 许可证 | 风险等级 | 状态 | 备注 |
|------|------|--------|----------|------|------|
${entries
  .map(
    (e) =>
      `| ${e.packageName} | ${e.packageVersion} | ${e.license} | ${riskBadge[e.riskLevel] || e.riskLevel} | ${e.status} | ${e.notes || ''} |`
  )
  .join('\n')}
`.trim();

    const criticalEntries = entries.filter((e) => e.riskLevel === 'critical');
    const warningEntries = entries.filter((e) => e.riskLevel === 'warning');
    const waiverEntries = entries.filter((e) => e.waiverId);

    let criticalSection = '';
    if (criticalEntries.length > 0) {
      criticalSection = `
## ⚠️  高危依赖清单

${criticalEntries
  .map(
    (e) => `- **${e.packageName}@${e.packageVersion}** - ${e.license}\n  - ${e.notes || '存在高风险合规问题'}`
  )
  .join('\n\n')}
`.trim();
    }

    let waiverSection = '';
    if (waiverEntries.length > 0) {
      waiverSection = `
## 📜 豁免记录

${waiverEntries
  .map((e) => `- **${e.packageName}@${e.packageVersion}** - 豁免ID: ${e.waiverId}`)
  .join('\n')}
`.trim();
    }

    return [header, criticalSection, entriesTable, waiverSection]
      .filter(Boolean)
      .join('\n\n---\n\n');
  }

  private downloadExport(
    content: string,
    format: ReportFormat,
    projectName: string
  ): void {
    const mimeTypes: Record<ReportFormat, string> = {
      json: 'application/json',
      csv: 'text/csv',
      pdf: 'text/markdown',
      markdown: 'text/markdown',
    };

    const extensions: Record<ReportFormat, string> = {
      json: 'json',
      csv: 'csv',
      pdf: 'md',
      markdown: 'md',
    };

    const blob = new Blob([content], { type: mimeTypes[format] });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName}-合规报告-${dayjs().format('YYYYMMDD')}.${extensions[format]}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async getExportHistory(projectId: string): Promise<ExportRecord[]> {
    const reports = await db.reports.where('projectId').equals(projectId).toArray();
    const reportIds = reports.map((r) => r.id);
    return db.exports
      .where('reportId')
      .anyOf(reportIds)
      .reverse()
      .sortBy('exportedAt');
  }
}

export const reportGenerator = new ReportGenerator();
