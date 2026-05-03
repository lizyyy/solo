import * as fs from 'fs';
import * as path from 'path';
import * as csv from 'fast-csv';
import { v4 as uuidv4 } from 'uuid';
import {
  AuditReport,
  Violation,
  ReviewDecision,
  DeviceConfig,
  ExportOptions,
  ExportFormat
} from '../types';

export class Exporter {
  private options: Required<ExportOptions>;

  constructor(options?: Partial<ExportOptions>) {
    this.options = {
      format: options?.format ?? 'markdown',
      includeDetails: options?.includeDetails ?? true,
      includeViolations: options?.includeViolations ?? true,
      includeReviews: options?.includeReviews ?? true,
      includeDeviceStatus: options?.includeDeviceStatus ?? true
    };
  }

  export(report: AuditReport, options?: Partial<ExportOptions>): string {
    const exportOptions = { ...this.options, ...options };
    
    switch (exportOptions.format) {
      case 'markdown':
        return this.exportMarkdown(report, exportOptions);
      case 'csv':
        return this.exportCSV(report, exportOptions);
      case 'json':
        return this.exportJSON(report, exportOptions);
      default:
        return this.exportJSON(report, exportOptions);
    }
  }

  exportToFile(
    report: AuditReport,
    outputPath: string,
    options?: Partial<ExportOptions>
  ): string {
    const exportOptions = { ...this.options, ...options };
    const content = this.export(report, exportOptions);
    
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(outputPath, content, 'utf-8');
    return outputPath;
  }

  private exportMarkdown(report: AuditReport, options: Required<ExportOptions>): string {
    let markdown = `# 离线重连影子审计报告\n\n`;
    
    markdown += `**报告ID**: ${report.reportId}\n`;
    markdown += `**生成时间**: ${new Date(report.generatedAt).toISOString()}\n`;
    markdown += `**审计周期**: ${new Date(report.period.start).toISOString()} - ${new Date(report.period.end).toISOString()}\n\n`;
    
    markdown += `## 汇总统计\n\n`;
    markdown += `| 指标 | 数值 |\n`;
    markdown += `|------|------|\n`;
    markdown += `| 总消息数 | ${report.summary.totalMessages} |\n`;
    markdown += `| 设备数 | ${report.summary.totalDevices} |\n`;
    markdown += `| 违规总数 | ${report.summary.totalViolations} |\n`;
    markdown += `| 严重违规 | ${report.summary.violationsBySeverity.critical || 0} |\n`;
    markdown += `| 警告 | ${report.summary.violationsBySeverity.warning || 0} |\n`;
    markdown += `| 信息 | ${report.summary.violationsBySeverity.info || 0} |\n\n`;
    
    markdown += `### 违规类型分布\n\n`;
    const violationTypes = Object.entries(report.summary.violationsByType);
    if (violationTypes.length > 0) {
      markdown += `| 类型 | 数量 |\n`;
      markdown += `|------|------|\n`;
      for (const [type, count] of violationTypes) {
        markdown += `| ${this.formatViolationType(type)} | ${count} |\n`;
      }
    } else {
      markdown += `无违规记录\n`;
    }
    markdown += `\n`;
    
    if (options.includeViolations && report.violations.length > 0) {
      markdown += `## 违规详情\n\n`;
      
      const criticalViolations = report.violations.filter(v => v.severity === 'critical');
      const warningViolations = report.violations.filter(v => v.severity === 'warning');
      const infoViolations = report.violations.filter(v => v.severity === 'info');
      
      const writeViolationSection = (title: string, violations: Violation[]) => {
        if (violations.length === 0) return '';
        
        let section = `### ${title}\n\n`;
        
        for (const violation of violations) {
          section += `#### ${violation.message}\n\n`;
          section += `- **时间**: ${new Date(violation.timestamp).toISOString()}\n`;
          section += `- **设备**: ${violation.deviceId || 'N/A'}\n`;
          section += `- **类型**: ${this.formatViolationType(violation.type)}\n`;
          section += `- **状态**: ${this.formatViolationStatus(violation.status)}\n`;
          
          if (options.includeDetails) {
            section += `- **详情**:\n`;
            section += `\`\`\`json\n`;
            section += JSON.stringify(violation.details, null, 2) + '\n';
            section += `\`\`\`\n`;
          }
          
          section += `\n`;
        }
        
        return section;
      };
      
      markdown += writeViolationSection('严重违规', criticalViolations);
      markdown += writeViolationSection('警告', warningViolations);
      markdown += writeViolationSection('信息', infoViolations);
    }
    
    if (options.includeReviews && report.reviews.length > 0) {
      markdown += `## 人工裁决记录\n\n`;
      markdown += `| 时间 | 违规ID | 裁决 | 原因 | 裁决人 |\n`;
      markdown += `|------|--------|------|------|--------|\n`;
      
      for (const review of report.reviews) {
        markdown += `| ${new Date(review.timestamp).toISOString()} | ${review.violationId.substring(0, 8)}... | ${this.formatDecision(review.decision)} | ${review.reason.substring(0, 50)}${review.reason.length > 50 ? '...' : ''} | ${review.reviewer} |\n`;
      }
      markdown += `\n`;
    }
    
    if (options.includeDeviceStatus && report.deviceStatuses.size > 0) {
      markdown += `## 设备状态\n\n`;
      markdown += `| 设备ID | 名称 | 类型 | 影子版本 | 最后见 | 状态 |\n`;
      markdown += `|--------|------|------|----------|--------|------|\n`;
      
      for (const [deviceId, config] of report.deviceStatuses) {
        markdown += `| ${deviceId} | ${config.name} | ${config.type} | ${config.shadowVersion} | ${new Date(config.lastSeen).toISOString()} | ${this.formatDeviceStatus(config.status)} |\n`;
      }
      markdown += `\n`;
    }
    
    if (report.retainedMessages.size > 0) {
      markdown += `## Retained 消息\n\n`;
      markdown += `| 主题 | 版本 | 最后更新 | 内容摘要 |\n`;
      markdown += `|------|------|----------|----------|\n`;
      
      for (const [topic, retained] of report.retainedMessages) {
        const payloadSummary = retained.payload.length > 50 
          ? retained.payload.substring(0, 50) + '...' 
          : retained.payload;
        markdown += `| ${topic} | ${retained.version} | ${new Date(retained.lastUpdated).toISOString()} | ${payloadSummary.replace(/\n/g, ' ')} |\n`;
      }
      markdown += `\n`;
    }
    
    return markdown;
  }

  private exportCSV(report: AuditReport, options: Required<ExportOptions>): string {
    const rows: Array<Record<string, unknown>> = [];
    
    if (options.includeViolations) {
      for (const violation of report.violations) {
        const row: Record<string, unknown> = {
          'report_id': report.reportId,
          'record_type': 'violation',
          'timestamp': new Date(violation.timestamp).toISOString(),
          'violation_type': violation.type,
          'severity': violation.severity,
          'device_id': violation.deviceId || '',
          'message': violation.message,
          'status': violation.status,
          'details': JSON.stringify(violation.details)
        };
        rows.push(row);
      }
    }
    
    if (options.includeReviews) {
      for (const review of report.reviews) {
        const row: Record<string, unknown> = {
          'report_id': report.reportId,
          'record_type': 'review',
          'timestamp': new Date(review.timestamp).toISOString(),
          'violation_id': review.violationId,
          'decision': review.decision,
          'reason': review.reason,
          'reviewer': review.reviewer
        };
        rows.push(row);
      }
    }
    
    if (options.includeDeviceStatus) {
      for (const [deviceId, config] of report.deviceStatuses) {
        const row: Record<string, unknown> = {
          'report_id': report.reportId,
          'record_type': 'device',
          'device_id': deviceId,
          'device_name': config.name,
          'device_type': config.type,
          'shadow_version': config.shadowVersion,
          'last_seen': new Date(config.lastSeen).toISOString(),
          'status': config.status
        };
        rows.push(row);
      }
    }
    
    if (rows.length === 0) {
      return 'report_id,record_type,timestamp\n';
    }
    
    let csvContent = '';
    const headers = Object.keys(rows[0]);
    csvContent += headers.join(',') + '\n';
    
    for (const row of rows) {
      const values = headers.map(header => {
        const value = row[header];
        if (typeof value === 'string') {
          if (value.includes(',') || value.includes('"') || value.includes('\n')) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }
        return String(value ?? '');
      });
      csvContent += values.join(',') + '\n';
    }
    
    return csvContent;
  }

  private exportJSON(report: AuditReport, _options: Required<ExportOptions>): string {
    const serializableReport = {
      reportId: report.reportId,
      generatedAt: report.generatedAt,
      generatedAtISO: new Date(report.generatedAt).toISOString(),
      period: {
        start: report.period.start,
        end: report.period.end,
        startISO: new Date(report.period.start).toISOString(),
        endISO: new Date(report.period.end).toISOString()
      },
      summary: report.summary,
      violations: report.violations.map(v => ({
        ...v,
        timestampISO: new Date(v.timestamp).toISOString()
      })),
      reviews: report.reviews.map(r => ({
        ...r,
        timestampISO: new Date(r.timestamp).toISOString()
      })),
      deviceStatuses: Array.from(report.deviceStatuses.entries()).map(([deviceId, config]) => ({
        deviceId,
        ...config,
        lastSeenISO: new Date(config.lastSeen).toISOString()
      })),
      retainedMessages: Array.from(report.retainedMessages.entries()).map(([topic, retained]) => ({
        topic,
        ...retained,
        lastUpdatedISO: new Date(retained.lastUpdated).toISOString()
      }))
    };
    
    return JSON.stringify(serializableReport, null, 2);
  }

  private formatViolationType(type: string): string {
    const typeNames: Record<string, string> = {
      'version_regression': '版本倒退',
      'duplicate_command': '重复命令',
      'expired_shadow': '过期影子',
      'missed_alert': '告警漏发',
      'retain_override': 'Retain覆盖'
    };
    return typeNames[type] || type;
  }

  private formatViolationStatus(status: string): string {
    const statusNames: Record<string, string> = {
      'open': '待处理',
      'investigating': '调查中',
      'resolved': '已解决',
      'false_positive': '误报'
    };
    return statusNames[status] || status;
  }

  private formatDecision(decision: string): string {
    const decisionNames: Record<string, string> = {
      'accept': '接受',
      'reject': '拒绝',
      'need_more_info': '需要更多信息'
    };
    return decisionNames[decision] || decision;
  }

  private formatDeviceStatus(status: string): string {
    const statusNames: Record<string, string> = {
      'online': '在线',
      'offline': '离线',
      'unknown': '未知'
    };
    return statusNames[status] || status;
  }
}
