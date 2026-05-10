import ExcelJS from 'exceljs';
import { 
  ReportData, 
  MessageType, 
  MessageStatus, 
  LiveMessage, 
  Operation 
} from '@live-push/shared';
import { average, calculatePercentile } from '@live-push/shared';
import LiveMessageModel from '../models/LiveMessage';
import operationLogService from './OperationLogService';
import logger from '../utils/logger';
import { format } from 'date-fns';

interface ReportOptions {
  roomId: string;
  startDate: Date;
  endDate: Date;
  formats: Array<'excel' | 'markdown' | 'pdf'>;
}

let puppeteerModule: any = null;

async function loadPuppeteer(): Promise<any> {
  if (puppeteerModule === null) {
    try {
      puppeteerModule = await import('puppeteer');
    } catch {
      puppeteerModule = undefined;
    }
  }
  return puppeteerModule;
}

class ReportService {
  async generateReport(options: ReportOptions): Promise<ReportData> {
    const { roomId, startDate, endDate } = options;

    logger.info('Generating report', { roomId, startDate, endDate });

    const query = {
      roomId,
      createdAt: {
        $gte: startDate,
        $lte: endDate,
      },
    };

    const messages = await LiveMessageModel.find(query).sort({ sequence: 1 });
    const operations = await operationLogService.getOperationsByTimeRange(
      startDate,
      endDate,
      undefined,
      10000
    );

    const messagesByType = this.countByType(messages);
    const messagesByStatus = this.countByStatus(messages);
    const delays = this.calculateDelays(messages);
    const retryCount = messages.reduce((sum, m) => sum + (m.retryCount || 0), 0);
    const topSenders = this.getTopSenders(messages, 10);
    const conflicts = operations.filter((op) => 
      op.beforeState && op.afterState && this.hasConflict(op)
    ).length;

    const reportData: ReportData = {
      roomId,
      period: {
        start: startDate,
        end: endDate,
      },
      totalMessages: messages.length,
      messagesByType,
      messagesByStatus,
      averageDelay: average(delays),
      p95Delay: calculatePercentile(delays, 95),
      p99Delay: calculatePercentile(delays, 99),
      failedMessages: messagesByStatus[MessageStatus.FAILED] || 0,
      retryCount,
      conflicts,
      topSenders,
      operations,
    };

    logger.info('Report generated', { 
      roomId, 
      totalMessages: reportData.totalMessages,
      failedMessages: reportData.failedMessages 
    });

    return reportData;
  }

  async exportToExcel(report: ReportData): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Live Push System';
    workbook.created = new Date();

    const summarySheet = workbook.addWorksheet('Summary');
    const messagesSheet = workbook.addWorksheet('Messages');
    const operationsSheet = workbook.addWorksheet('Operations');

    this.addSummarySheet(summarySheet, report);
    this.addMessagesSheet(messagesSheet, report);
    this.addOperationsSheet(operationsSheet, report);

    summarySheet.columns.forEach((column) => {
      column.width = column.header && column.header.length > 20 ? 30 : 20;
    });

    const buffer = (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
    
    logger.info('Excel report exported', { roomId: report.roomId });
    
    return buffer;
  }

  async exportToMarkdown(report: ReportData): Promise<string> {
    const lines: string[] = [];

    lines.push(`# 直播推送报告 - ${report.roomId}`);
    lines.push('');
    lines.push(`**报告周期:** ${format(report.period.start, 'yyyy-MM-dd HH:mm:ss')} - ${format(report.period.end, 'yyyy-MM-dd HH:mm:ss')}`);
    lines.push('');
    lines.push('## 摘要');
    lines.push('');
    lines.push(`| 指标 | 值 |`);
    lines.push(`|------|-----|`);
    lines.push(`| 消息总数 | ${report.totalMessages} |`);
    lines.push(`| 失败消息数 | ${report.failedMessages} |`);
    lines.push(`| 重试次数 | ${report.retryCount} |`);
    lines.push(`| 冲突次数 | ${report.conflicts} |`);
    lines.push(`| 平均延迟 | ${report.averageDelay.toFixed(2)}ms |`);
    lines.push(`| P95 延迟 | ${report.p95Delay.toFixed(2)}ms |`);
    lines.push(`| P99 延迟 | ${report.p99Delay.toFixed(2)}ms |`);
    lines.push('');

    lines.push('## 消息类型分布');
    lines.push('');
    Object.entries(report.messagesByType).forEach(([type, count]) => {
      lines.push(`- **${type}**: ${count}`);
    });
    lines.push('');

    lines.push('## 消息状态分布');
    lines.push('');
    Object.entries(report.messagesByStatus).forEach(([status, count]) => {
      lines.push(`- **${status}**: ${count}`);
    });
    lines.push('');

    lines.push('## 热门发送者');
    lines.push('');
    lines.push(`| 排名 | 用户ID | 用户名 | 消息数 |`);
    lines.push(`|------|--------|--------|--------|`);
    report.topSenders.forEach((sender, index) => {
      lines.push(`| ${index + 1} | ${sender.senderId} | ${sender.senderName} | ${sender.count} |`);
    });
    lines.push('');

    lines.push('## 操作记录');
    lines.push('');
    lines.push(`| 时间 | 操作类型 | 操作员 | 消息ID | 原因 |`);
    lines.push(`|------|----------|--------|--------|------|`);
    report.operations.slice(0, 100).forEach((op) => {
      lines.push(`| ${format(op.timestamp, 'yyyy-MM-dd HH:mm:ss')} | ${op.type} | ${op.operatorName} | ${op.messageId} | ${op.reason || '-'} |`);
    });

    logger.info('Markdown report exported', { roomId: report.roomId });

    return lines.join('\n');
  }

  async exportToPdf(report: ReportData): Promise<Buffer> {
    const puppeteer = await loadPuppeteer();
    if (!puppeteer) {
      throw new Error('PDF export requires puppeteer. Install with: npm install puppeteer');
    }

    const markdown = await this.exportToMarkdown(report);
    const html = this.markdownToHtml(markdown);

    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20px',
          right: '20px',
          bottom: '20px',
          left: '20px',
        },
      });

      logger.info('PDF report exported', { roomId: report.roomId });

      return pdfBuffer;
    } finally {
      await browser.close();
    }
  }

  private addSummarySheet(sheet: ExcelJS.Worksheet, report: ReportData): void {
    sheet.addRow(['直播推送报告摘要']);
    sheet.addRow(['']);
    sheet.addRow(['报告周期', `${format(report.period.start, 'yyyy-MM-dd HH:mm:ss')} - ${format(report.period.end, 'yyyy-MM-dd HH:mm:ss')}`]);
    sheet.addRow(['房间ID', report.roomId]);
    sheet.addRow(['']);
    
    sheet.addRow(['核心指标']);
    sheet.addRow(['消息总数', report.totalMessages]);
    sheet.addRow(['失败消息数', report.failedMessages]);
    sheet.addRow(['重试次数', report.retryCount]);
    sheet.addRow(['冲突次数', report.conflicts]);
    sheet.addRow(['平均延迟 (ms)', report.averageDelay.toFixed(2)]);
    sheet.addRow(['P95 延迟 (ms)', report.p95Delay.toFixed(2)]);
    sheet.addRow(['P99 延迟 (ms)', report.p99Delay.toFixed(2)]);
  }

  private addMessagesSheet(sheet: ExcelJS.Worksheet, report: ReportData): void {
    sheet.columns = [
      { header: '类型', key: 'type' },
      { header: '计数', key: 'count' },
    ];

    Object.entries(report.messagesByType).forEach(([type, count]) => {
      sheet.addRow({ type, count });
    });

    sheet.addRow(['']);
    sheet.addRow(['状态分布']);
    sheet.columns = [
      { header: '状态', key: 'status' },
      { header: '计数', key: 'count' },
    ];

    Object.entries(report.messagesByStatus).forEach(([status, count]) => {
      sheet.addRow({ status, count });
    });
  }

  private addOperationsSheet(sheet: ExcelJS.Worksheet, report: ReportData): void {
    sheet.columns = [
      { header: '时间', key: 'timestamp' },
      { header: '操作类型', key: 'type' },
      { header: '操作员', key: 'operatorName' },
      { header: '消息ID', key: 'messageId' },
      { header: '原因', key: 'reason' },
    ];

    report.operations.slice(0, 1000).forEach((op) => {
      sheet.addRow({
        timestamp: format(op.timestamp, 'yyyy-MM-dd HH:mm:ss'),
        type: op.type,
        operatorName: op.operatorName,
        messageId: op.messageId,
        reason: op.reason || '-',
      });
    });
  }

  private countByType(messages: any[]): Record<MessageType, number> {
    const counts: Record<string, number> = {};
    Object.values(MessageType).forEach((type) => {
      counts[type] = 0;
    });

    messages.forEach((m) => {
      if (counts[m.type] !== undefined) {
        counts[m.type]++;
      }
    });

    return counts as Record<MessageType, number>;
  }

  private countByStatus(messages: any[]): Record<MessageStatus, number> {
    const counts: Record<string, number> = {};
    Object.values(MessageStatus).forEach((status) => {
      counts[status] = 0;
    });

    messages.forEach((m) => {
      if (counts[m.status] !== undefined) {
        counts[m.status]++;
      }
    });

    return counts as Record<MessageStatus, number>;
  }

  private calculateDelays(messages: any[]): number[] {
    return messages
      .filter((m) => m.deliveredAt && m.createdAt)
      .map((m) => new Date(m.deliveredAt).getTime() - new Date(m.createdAt).getTime());
  }

  private getTopSenders(
    messages: any[],
    limit: number
  ): Array<{ senderId: string; senderName: string; count: number }> {
    const senderMap = new Map<string, { senderId: string; senderName: string; count: number }>();

    messages.forEach((m) => {
      const existing = senderMap.get(m.senderId);
      if (existing) {
        existing.count++;
      } else {
        senderMap.set(m.senderId, {
          senderId: m.senderId,
          senderName: m.senderName,
          count: 1,
        });
      }
    });

    return Array.from(senderMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  private hasConflict(operation: Operation): boolean {
    if (!operation.beforeState || !operation.afterState) {
      return false;
    }

    const before = operation.beforeState as any;
    const after = operation.afterState as any;

    return (
      before.version !== undefined &&
      after.version !== undefined &&
      after.version > before.version + 1
    );
  }

  private markdownToHtml(markdown: string): string {
    const html = markdown
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^\|(.+)\|$/gm, (match) => {
        const cells = match.split('|').slice(1, -1);
        if (cells.every((c) => c.trim().startsWith('-'))) {
          return '';
        }
        const tag = cells.some((c) => c.trim() === '指标' || c.trim() === '排名') ? 'th' : 'td';
        return `<tr>${cells.map((c) => `<${tag}>${c.trim()}</${tag}>`).join('')}</tr>`;
      })
      .replace(/^- (.*$)/gm, '<li>$1</li>')
      .replace(/(<tr>.*<\/tr>)\n(<tr>.*<\/tr>)/g, '<table>$1$2</table>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
          h2 { color: #555; margin-top: 30px; }
          h3 { color: #666; }
          table { border-collapse: collapse; width: 100%; margin: 10px 0; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f4f4f4; }
          tr:nth-child(even) { background-color: #f9f9f9; }
          li { margin: 5px 0; }
          strong { color: #333; }
        </style>
      </head>
      <body>
        ${html}
      </body>
      </html>
    `;
  }
}

export default new ReportService();
