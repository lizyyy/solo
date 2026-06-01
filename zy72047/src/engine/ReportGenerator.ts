import type { GameRound, Operation, ScoreNote, Conflict } from '@/types/game';
import type { HandoverReport } from '@/types/audit';
import { generateHandoverReport, formatReportAsMarkdown } from '@/utils/audit';
import { formatTimestamp } from '@/utils/storage';

export type ReportFormat = 'markdown' | 'json' | 'text';

export class ReportGenerator {
  private round: GameRound;
  private operations: Operation[];
  private notes: ScoreNote[];
  private conflicts: Conflict[];

  constructor(
    round: GameRound,
    operations: Operation[],
    notes: ScoreNote[] = [],
    conflicts: Conflict[] = []
  ) {
    this.round = round;
    this.operations = operations;
    this.notes = notes;
    this.conflicts = conflicts;
  }

  generate(): HandoverReport {
    return generateHandoverReport(this.round, this.operations, this.notes, this.conflicts);
  }

  exportAs(format: ReportFormat): string {
    const report = this.generate();

    switch (format) {
      case 'markdown':
        return formatReportAsMarkdown(report);
      case 'json':
        return JSON.stringify(report, null, 2);
      case 'text':
        return this.exportAsText(report);
      default:
        return formatReportAsMarkdown(report);
    }
  }

  private exportAsText(report: HandoverReport): string {
    const lines: string[] = [];

    lines.push('========================================');
    lines.push('  黑胶节拍修复赛 - 交接报告');
    lines.push('========================================');
    lines.push('');
    lines.push(`生成时间：${formatTimestamp(report.generatedAt)}`);
    lines.push(`生成人：${report.generatedBy}`);
    lines.push('');
    lines.push('----------------------------------------');
    lines.push('  比赛概况');
    lines.push('----------------------------------------');
    lines.push('');
    lines.push(`玩家：${report.playerName}`);
    lines.push(`关卡：${report.levelName}`);
    lines.push(`开始时间：${formatTimestamp(report.startTime)}`);
    lines.push(`结束时间：${report.endTime ? formatTimestamp(report.endTime) : '进行中'}`);
    lines.push(`最终分数：${report.finalScore}`);
    lines.push(`最终资源：${report.finalResources}`);
    lines.push(`最终风险：${report.finalRisk}`);
    lines.push('');
    lines.push('----------------------------------------');
    lines.push('  本局总结');
    lines.push('----------------------------------------');
    lines.push('');
    lines.push(report.summary);
    lines.push('');
    lines.push('----------------------------------------');
    lines.push('  操作时间线');
    lines.push('----------------------------------------');
    lines.push('');

    report.timeline.forEach((event, index) => {
      const icon = {
        operation: '🔘',
        note: '📝',
        conflict: '⚠️',
        status_change: '🔄',
        judgement: '⚖️',
      }[event.type];

      lines.push(`${String(index + 1).padStart(3, '0')}. ${icon} ${formatTimestamp(event.timestamp)}`);
      lines.push(`     ${event.title}`);
      lines.push(`     操作人：${event.operator} | 来源：${event.source}`);
      lines.push(`     ${event.description}`);
      lines.push('');
    });

    if (report.conflicts.total > 0) {
      lines.push('----------------------------------------');
      lines.push('  数据冲突');
      lines.push('----------------------------------------');
      lines.push('');
      lines.push(`总计 ${report.conflicts.total} 条，已解决 ${report.conflicts.resolved} 条，待处理 ${report.conflicts.pending} 条`);
      lines.push('');
      
      report.conflicts.details.forEach(d => {
        lines.push(`• 字段：${d.field}`);
        lines.push(`  课堂计分表：${d.classroomValue}`);
        lines.push(`  导入数据：${d.importedValue}`);
        lines.push(`  裁决结果：${d.resolution}${d.resolvedBy ? ` (${d.resolvedBy})` : ''}`);
        lines.push('');
      });
    }

    if (report.notes.length > 0) {
      lines.push('----------------------------------------');
      lines.push('  备注记录');
      lines.push('----------------------------------------');
      lines.push('');
      
      report.notes.forEach(n => {
        lines.push(`【${n.source}】${n.author} @ ${formatTimestamp(n.timestamp)}`);
        lines.push(`  ${n.content}`);
        lines.push('');
      });
    }

    lines.push('----------------------------------------');
    lines.push('  交接建议');
    lines.push('----------------------------------------');
    lines.push('');
    
    report.recommendations.forEach((rec, i) => {
      lines.push(`${i + 1}. ${rec}`);
    });

    lines.push('');
    lines.push('========================================');
    lines.push('  本报告由黑胶节拍修复赛计分系统自动生成');
    lines.push('========================================');

    return lines.join('\n');
  }

  download(filename: string, format: ReportFormat = 'markdown'): void {
    const content = this.exportAs(format);
    const extensions: Record<ReportFormat, string> = {
      markdown: 'md',
      json: 'json',
      text: 'txt',
    };
    
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.${extensions[format]}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  print(): void {
    const content = this.exportAs('markdown');
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('请允许弹出窗口以打印报告');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>黑胶节拍修复赛 - 交接报告</title>
        <style>
          body { 
            font-family: "Noto Sans SC", -apple-system, sans-serif; 
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 40px;
            color: #333;
          }
          h1 { color: #2C1810; border-bottom: 2px solid #D4AF37; padding-bottom: 10px; }
          h2 { color: #4a2c22; margin-top: 30px; }
          h3 { color: #6b4132; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
          th { background: #faf6f3; }
          blockquote { border-left: 4px solid #D4AF37; padding-left: 20px; color: #666; margin: 20px 0; }
          code { background: #f5f5f5; padding: 2px 6px; border-radius: 4px; font-family: monospace; }
          hr { border: none; border-top: 1px solid #ddd; margin: 30px 0; }
          .footer { color: #999; font-size: 12px; text-align: center; margin-top: 40px; }
        </style>
      </head>
      <body>
        <pre style="white-space: pre-wrap; font-family: inherit;">${content}</pre>
        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `);
    
    printWindow.document.close();
  }

  getQuickSummary(): string {
    const report = this.generate();
    const parts: string[] = [];
    
    parts.push(`【${report.levelName}】${report.playerName}`);
    parts.push(`分数: ${report.finalScore}/${this.round.targetScore}`);
    parts.push(`资源: ${report.finalResources}`);
    parts.push(`风险: ${report.finalRisk}`);
    
    if (report.conflicts.total > 0) {
      parts.push(`冲突: ${report.conflicts.resolved}/${report.conflicts.total}已解决`);
    }
    
    return parts.join(' | ');
  }
}
