import * as fs from 'fs';
import * as path from 'path';
import { 
  ExportReport, 
  ReportSummary, 
  DeviceReport, 
  Statistics,
  ProjectState,
  ValidationIssue,
  ScannedFile,
  TimelineEntry,
  CleanIndex,
  CleanFileEntry,
  Severity
} from '../types';
import { formatDate, parseTimestamp, sortBy, groupBy, formatDuration } from '../utils';

export interface ExporterOptions {
  projectState: ProjectState;
}

export class DataExporter {
  private options: ExporterOptions;

  constructor(options: ExporterOptions) {
    this.options = options;
  }

  generateReport(): ExportReport {
    const state = this.options.projectState;
    
    const summary = this.buildSummary(state);
    const deviceReports = this.buildDeviceReports(state);
    const statistics = this.buildStatistics(state);

    return {
      summary,
      issues: state.issues,
      devices: deviceReports,
      statistics
    };
  }

  private buildSummary(state: ProjectState): ReportSummary {
    const bySeverity: Record<Severity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };

    for (const issue of state.issues) {
      bySeverity[issue.severity]++;
    }

    return {
      totalFiles: state.scannedFiles.length,
      validFiles: state.scannedFiles.filter(f => f.isValid).length,
      invalidFiles: state.scannedFiles.filter(f => !f.isValid).length,
      issuesBySeverity: bySeverity,
      scanDate: state.lastScanned || formatDate(new Date())
    };
  }

  private buildDeviceReports(state: ProjectState): DeviceReport[] {
    const devices: DeviceReport[] = [];
    const filesByDevice = groupBy(state.scannedFiles, f => f.deviceId || 'unknown');
    const timelineByDevice = groupBy(state.timelineEntries, t => t.deviceId);
    const issuesByDevice = groupBy(state.issues, i => i.deviceId);

    for (const device of state.config.devices) {
      const files = filesByDevice[device.id] || [];
      const timeline = timelineByDevice[device.id] || [];
      const issues = issuesByDevice[device.id] || [];

      const sortedTimeline = sortBy(timeline, t => parseTimestamp(t.startTime)?.getTime() || 0);
      
      let startTime = '';
      let endTime = '';
      let timeDrift = 0;
      const missingIntervals: number[] = [];

      if (sortedTimeline.length > 0) {
        startTime = sortedTimeline[0].startTime;
        endTime = sortedTimeline[sortedTimeline.length - 1].endTime;
        
        const drifts = sortedTimeline.map(t => t.timeDriftMinutes);
        timeDrift = drifts.reduce((a, b) => a + b, 0) / drifts.length;

        for (let i = 1; i < sortedTimeline.length; i++) {
          const prev = sortedTimeline[i - 1];
          const curr = sortedTimeline[i];
          
          const prevEnd = parseTimestamp(prev.endTime);
          const currStart = parseTimestamp(curr.startTime);
          
          if (prevEnd && currStart) {
            const gap = (currStart.getTime() - prevEnd.getTime()) / (1000 * 60);
            const missing = Math.floor(gap / device.expectedInterval);
            if (missing > 0) {
              missingIntervals.push(missing);
            }
          }
        }
      }

      const totalRecords = sortedTimeline.reduce((sum, t) => sum + t.recordCount, 0);

      devices.push({
        deviceId: device.id,
        deviceName: device.name,
        files: files.length,
        records: totalRecords,
        startTime,
        endTime,
        timeDrift: Math.round(timeDrift * 100) / 100,
        issues: issues.length,
        missingIntervals
      });
    }

    return devices;
  }

  private buildStatistics(state: ProjectState): Statistics {
    const allTimeline = state.timelineEntries;
    
    if (allTimeline.length === 0) {
      return {
        totalRecords: 0,
        dataRangeHours: 0,
        expectedRecords: 0,
        actualRecords: 0,
        completenessPercentage: 100
      };
    }

    const sorted = sortBy(allTimeline, t => parseTimestamp(t.startTime)?.getTime() || 0);
    const firstTime = parseTimestamp(sorted[0].startTime);
    const lastTime = parseTimestamp(sorted[sorted.length - 1].endTime);
    
    const totalRecords = allTimeline.reduce((sum, t) => sum + t.recordCount, 0);
    
    let dataRangeHours = 0;
    let expectedRecords = 0;
    
    if (firstTime && lastTime) {
      dataRangeHours = (lastTime.getTime() - firstTime.getTime()) / (1000 * 60 * 60);
      
      const minInterval = Math.min(...state.config.devices.map(d => d.expectedInterval));
      expectedRecords = Math.floor(dataRangeHours * 60 / minInterval);
    }

    const actualRecords = totalRecords;
    const completenessPercentage = expectedRecords > 0 
      ? Math.round((actualRecords / expectedRecords) * 100 * 10) / 10 
      : 100;

    return {
      totalRecords,
      dataRangeHours: Math.round(dataRangeHours * 10) / 10,
      expectedRecords,
      actualRecords,
      completenessPercentage
    };
  }

  exportMarkdownReport(outputPath: string): string {
    const report = this.generateReport();
    const state = this.options.projectState;

    const lines: string[] = [];

    lines.push(`# 离线采集包验收报告`);
    lines.push('');
    lines.push(`**项目名称**: ${state.config.name}`);
    lines.push(`**生成时间**: ${formatDate(new Date())}`);
    if (state.config.description) {
      lines.push(`**描述**: ${state.config.description}`);
    }
    lines.push('');
    lines.push('---');
    lines.push('');

    lines.push('## 摘要');
    lines.push('');
    lines.push('| 指标 | 数值 |');
    lines.push('|------|------|');
    lines.push(`| 总文件数 | ${report.summary.totalFiles} |`);
    lines.push(`| 有效文件 | ${report.summary.validFiles} |`);
    lines.push(`| 无效文件 | ${report.summary.invalidFiles} |`);
    lines.push(`| 严重问题 (Critical) | ${report.summary.issuesBySeverity.critical} |`);
    lines.push(`| 高优先级问题 (High) | ${report.summary.issuesBySeverity.high} |`);
    lines.push(`| 中优先级问题 (Medium) | ${report.summary.issuesBySeverity.medium} |`);
    lines.push(`| 低优先级问题 (Low) | ${report.summary.issuesBySeverity.low} |`);
    lines.push('');

    lines.push('## 统计数据');
    lines.push('');
    lines.push('| 指标 | 数值 |');
    lines.push('|------|------|');
    lines.push(`| 总记录数 | ${report.statistics.totalRecords} |`);
    lines.push(`| 数据范围 | ${report.statistics.dataRangeHours} 小时 |`);
    lines.push(`| 预期记录数 | ${report.statistics.expectedRecords} |`);
    lines.push(`| 实际记录数 | ${report.statistics.actualRecords} |`);
    lines.push(`| 完整度 | ${report.statistics.completenessPercentage}% |`);
    lines.push('');

    lines.push('## 设备状态');
    lines.push('');
    lines.push('| 设备ID | 设备名称 | 文件数 | 记录数 | 时间偏移 | 问题数 |');
    lines.push('|--------|----------|--------|--------|----------|--------|');
    
    for (const device of report.devices) {
      const driftSign = device.timeDrift >= 0 ? '+' : '';
      lines.push(`| ${device.deviceId} | ${device.deviceName} | ${device.files} | ${device.records} | ${driftSign}${device.timeDrift.toFixed(2)}m | ${device.issues} |`);
    }
    lines.push('');

    lines.push('## 问题详情');
    lines.push('');

    const issuesBySeverity = groupBy(report.issues, i => i.severity);
    const severityOrder: Severity[] = ['critical', 'high', 'medium', 'low'];
    const severityLabels: Record<Severity, string> = {
      critical: '严重问题',
      high: '高优先级问题',
      medium: '中优先级问题',
      low: '低优先级问题'
    };

    for (const severity of severityOrder) {
      const issues = issuesBySeverity[severity] || [];
      if (issues.length === 0) continue;

      lines.push(`### ${severityLabels[severity]} (${issues.length})`);
      lines.push('');

      for (const issue of issues) {
        lines.push(`#### ${issue.description}`);
        lines.push('');
        lines.push(`- **设备ID**: ${issue.deviceId}`);
        if (issue.fileName) {
          lines.push(`- **文件**: ${issue.fileName}`);
        }
        lines.push(`- **类型**: ${issue.type}`);
        lines.push(`- **建议操作**: ${issue.suggestedAction}`);
        lines.push('');
        lines.push('**详细信息**:');
        lines.push('```json');
        lines.push(JSON.stringify(issue.details, null, 2));
        lines.push('```');
        lines.push('');
      }
    }

    const content = lines.join('\n');
    fs.writeFileSync(outputPath, content, 'utf-8');
    
    return outputPath;
  }

  exportCsvIssues(outputPath: string): string {
    const issues = this.options.projectState.issues;
    
    const headers = [
      'ID',
      '严重程度',
      '类型',
      '设备ID',
      '文件名',
      '描述',
      '建议操作',
      '详细信息'
    ];

    const lines: string[] = [headers.join(',')];

    for (const issue of issues) {
      const row = [
        issue.id,
        issue.severity,
        issue.type,
        issue.deviceId,
        issue.fileName || '',
        `"${issue.description.replace(/"/g, '""')}"`,
        `"${issue.suggestedAction.replace(/"/g, '""')}"`,
        `"${JSON.stringify(issue.details).replace(/"/g, '""')}"`
      ];
      lines.push(row.join(','));
    }

    const content = lines.join('\n');
    fs.writeFileSync(outputPath, content, 'utf-8');
    
    return outputPath;
  }

  exportCleanIndex(outputPath: string): string {
    const state = this.options.projectState;
    const indices: CleanIndex[] = [];

    const filesByDevice = groupBy(state.scannedFiles, f => f.deviceId || 'unknown');
    const timelineByDevice = groupBy(state.timelineEntries, t => t.deviceId);
    const issuesByFile = new Map<string, ValidationIssue[]>();

    for (const issue of state.issues) {
      if (issue.fileId) {
        if (!issuesByFile.has(issue.fileId)) {
          issuesByFile.set(issue.fileId, []);
        }
        issuesByFile.get(issue.fileId)!.push(issue);
      }
    }

    for (const device of state.config.devices) {
      const files = filesByDevice[device.id] || [];
      const timeline = timelineByDevice[device.id] || [];
      
      const cleanFiles: CleanFileEntry[] = [];
      const timeOffsets: Record<string, number> = {};
      const mergedTimeline: string[] = [];

      for (const file of files) {
        const fileIssues = issuesByFile.get(file.id) || [];
        const hasCriticalIssues = fileIssues.some(i => 
          i.severity === 'critical' || 
          i.severity === 'high'
        );

        if (!hasCriticalIssues && file.isValid) {
          const entry = timeline.find(t => t.fileId === file.id);
          
          cleanFiles.push({
            fileId: file.id,
            originalPath: file.path,
            cleanPath: file.path,
            timeAdjustmentMinutes: entry?.timeDriftMinutes || 0,
            validFrom: entry?.startTime || file.lastModified,
            validTo: entry?.endTime || file.lastModified
          });

          if (entry) {
            timeOffsets[file.id] = entry.timeDriftMinutes;
            mergedTimeline.push(entry.normalizedTime);
          }
        }
      }

      indices.push({
        deviceId: device.id,
        cleanFiles,
        timeOffsets,
        mergedTimeline: mergedTimeline.sort()
      });
    }

    const output = {
      generatedAt: formatDate(new Date()),
      projectName: state.config.name,
      indices
    };

    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
    
    return outputPath;
  }
}
