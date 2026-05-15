import * as Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import { MeetingMinutes, ExportSummary } from '../types';

export class ReportGenerator {
  private templatesDir: string;

  constructor(templatesDir?: string) {
    this.templatesDir =
      templatesDir || path.join(__dirname, '..', 'templates');
    this.registerHelpers();
  }

  private registerHelpers(): void {
    Handlebars.registerHelper('formatDate', (dateStr: string) => {
      return new Date(dateStr).toLocaleString('zh-CN');
    });

    Handlebars.registerHelper('statusColor', (status: string) => {
      const colors: Record<string, string> = {
        complete: '✓ 完整',
        broken: '✗ 断开',
        under_review: '⚡ 审核中',
        draft: '📝 草稿',
        submitted: '📤 已提交',
        reviewed: '✅ 已审核',
        archived: '📦 已归档',
      };
      return colors[status] || status;
    });

    Handlebars.registerHelper('json', (obj: any) => {
      return JSON.stringify(obj, null, 2);
    });

    Handlebars.registerHelper('join', function (arr: any[], separator: string) {
      if (!Array.isArray(arr)) return '';
      return arr.join(separator || ', ');
    });

    Handlebars.registerHelper('ifEquals', function (this: any, arg1: any, arg2: any, options: any) {
      return arg1 == arg2 ? options.fn(this) : options.inverse(this);
    });
  }

  generateMeetingReport(
    meeting: MeetingMinutes,
    exportSummary: ExportSummary
  ): string {
    const templatePath = path.join(this.templatesDir, 'meeting-report.hbs');
    const templateContent = fs.readFileSync(templatePath, 'utf-8');
    const template = Handlebars.compile(templateContent);

    return template({
      meeting,
      exportSummary,
      generatedAt: new Date().toISOString(),
    });
  }

  generateSummaryReport(
    meetings: MeetingMinutes[],
    filterDescription: string
  ): string {
    const templatePath = path.join(this.templatesDir, 'summary-report.hbs');
    const templateContent = fs.readFileSync(templatePath, 'utf-8');
    const template = Handlebars.compile(templateContent);

    const stats = {
      total: meetings.length,
      completeChain: meetings.filter(
        (m) => m.evidenceChain.status === 'complete'
      ).length,
      brokenChain: meetings.filter(
        (m) => m.evidenceChain.status === 'broken'
      ).length,
      hasCorrections: meetings.filter((m) => m.corrections.length > 0)
        .length,
    };

    return template({
      meetings,
      stats,
      filterDescription,
      generatedAt: new Date().toISOString(),
    });
  }

  saveReport(content: string, outputPath: string): void {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outputPath, content, 'utf-8');
  }

  generateAuditTrail(meeting: MeetingMinutes): string {
    const lines: string[] = [];
    lines.push('=== 审计追踪 ===');
    lines.push(`会议ID: ${meeting.id}`);
    lines.push(`创建时间: ${new Date(meeting.createdAt).toLocaleString('zh-CN')}`);
    lines.push(`最后更新: ${new Date(meeting.updatedAt).toLocaleString('zh-CN')}`);
    lines.push('');

    lines.push('--- 证据链 ---');
    meeting.evidenceChain.items.forEach((item, index) => {
      lines.push(
        `${index + 1}. [${item.type}] ${item.description} (${
          item.verified ? '已验证' : '未验证'
        })`
      );
      lines.push(`   来源: ${item.source}`);
      lines.push(`   时间: ${new Date(item.timestamp).toLocaleString('zh-CN')}`);
    });
    lines.push(`状态: ${meeting.evidenceChain.status}`);
    if (meeting.evidenceChain.status === 'broken') {
      lines.push(`断开位置: 第 ${meeting.evidenceChain.brokenAt} 项`);
      lines.push(`原因: ${meeting.evidenceChain.brokenReason}`);
    }
    lines.push('');

    if (meeting.corrections.length > 0) {
      lines.push('--- 人工修正记录 ---');
      meeting.corrections.forEach((corr, index) => {
        lines.push(`${index + 1}. 字段: ${corr.fieldName}`);
        lines.push(`   系统判断: ${JSON.stringify(corr.systemJudgment)}`);
        lines.push(`   修正值: ${JSON.stringify(corr.correctedValue)}`);
        lines.push(`   原因: ${corr.reason}`);
        lines.push(`   修正人: ${corr.corrector}`);
        lines.push(`   时间: ${new Date(corr.timestamp).toLocaleString('zh-CN')}`);
      });
    }

    return lines.join('\n');
  }
}
