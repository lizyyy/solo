import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
import type { GameReport, RatingAction, Anomaly } from '@/types';
import { formatCurrency, formatNumber, formatDate, formatPercent, formatTime } from './format';
import { ANOMALY_TYPES } from '@/data/constants';

export class ReportExporter {
  static async exportPDF(report: GameReport, elementId?: string): Promise<void> {
    if (elementId) {
      const element = document.getElementById(elementId);
      if (element) {
        const canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true,
          logging: false,
        });

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4',
        });

        const imgWidth = 210;
        const pageHeight = 297;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        while (heightLeft >= 0) {
          position = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;
        }

        pdf.save(`债券评级报告-${formatDate(report.generatedAt)}.pdf`);
        return;
      }
    }

    this.exportPDFFromData(report);
  }

  static exportPDFFromData(report: GameReport): void {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    let yPos = 20;
    const lineHeight = 7;
    const pageWidth = 210;
    const margin = 20;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.text('债券评级急救室 - 复盘报告', pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`生成时间: ${formatDate(report.generatedAt)}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 15;

    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('一、核心指标', margin, yPos);
    yPos += lineHeight;

    const metrics = [
      ['最终得分', `${report.finalScore} 分`],
      ['最终净值', formatCurrency(report.finalNav)],
      ['净值变化', formatPercent(report.navChangePercent)],
      ['评级准确率', `${formatNumber(report.accuracyRate)}%`],
      ['平均反应时间', `${formatNumber(report.avgReactionTime)} 秒`],
      ['总操作次数', `${report.totalActions} 次`],
      ['正确操作次数', `${report.correctActions} 次`],
    ];

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    metrics.forEach(([label, value]) => {
      pdf.text(label, margin, yPos);
      pdf.text(value, margin + 80, yPos);
      yPos += lineHeight;
    });

    yPos += 5;

    if (yPos > 250) {
      pdf.addPage();
      yPos = 20;
    }

    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('二、异常情况统计', margin, yPos);
    yPos += lineHeight;

    const anomalyStats = [
      ['数据问题 (🔴)', `${report.anomalies.DATA_ISSUE || 0} 次`],
      ['规则问题 (🟠)', `${report.anomalies.RULE_ISSUE || 0} 次`],
      ['材料问题 (🟡)', `${report.anomalies.MATERIAL_ISSUE || 0} 次`],
    ];

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    anomalyStats.forEach(([label, value]) => {
      pdf.text(label, margin, yPos);
      pdf.text(value, margin + 80, yPos);
      yPos += lineHeight;
    });

    yPos += 5;

    if (yPos > 250) {
      pdf.addPage();
      yPos = 20;
    }

    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('三、改进建议', margin, yPos);
    yPos += lineHeight;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    report.suggestions.forEach((suggestion, index) => {
      if (yPos > 270) {
        pdf.addPage();
        yPos = 20;
      }
      pdf.text(`${index + 1}. ${suggestion}`, margin, yPos);
      yPos += lineHeight;
    });

    yPos += 5;

    if (yPos > 240) {
      pdf.addPage();
      yPos = 20;
    }

    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('四、操作时间线', margin, yPos);
    yPos += lineHeight;

    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');

    const tableHeaders = ['时间', '债券', '调整前', '调整后', '结果', '得分'];
    const colWidths = [30, 35, 20, 20, 25, 20];

    pdf.setFont('helvetica', 'bold');
    let xPos = margin;
    tableHeaders.forEach((header, index) => {
      pdf.text(header, xPos, yPos);
      xPos += colWidths[index];
    });
    yPos += lineHeight;

    pdf.setFont('helvetica', 'normal');
    report.actionTimeline.slice(0, 15).forEach((action) => {
      if (yPos > 270) {
        pdf.addPage();
        yPos = 20;
      }

      xPos = margin;
      pdf.text(formatTime(action.reactionTime), xPos, yPos);
      xPos += colWidths[0];
      pdf.text(action.bondCode.substring(0, 8), xPos, yPos);
      xPos += colWidths[1];
      pdf.text(action.oldRating, xPos, yPos);
      xPos += colWidths[2];
      pdf.text(action.newRating, xPos, yPos);
      xPos += colWidths[3];
      pdf.text(action.isCorrect ? '正确' : '错误', xPos, yPos);
      xPos += colWidths[4];
      pdf.text((action.scoreImpact >= 0 ? '+' : '') + action.scoreImpact, xPos, yPos);
      yPos += lineHeight;
    });

    if (report.actionTimeline.length > 15) {
      yPos += 3;
      pdf.text(`... 还有 ${report.actionTimeline.length - 15} 条记录`, margin, yPos);
    }

    pdf.save(`债券评级报告-${formatDate(report.generatedAt)}.pdf`);
  }

  static exportExcel(report: GameReport): void {
    const wb = XLSX.utils.book_new();

    const summaryData = [
      ['指标', '值'],
      ['最终得分', report.finalScore],
      ['最终净值', report.finalNav],
      ['净值变化(%)', report.navChangePercent],
      ['评级准确率(%)', report.accuracyRate],
      ['平均反应时间(秒)', report.avgReactionTime],
      ['总操作次数', report.totalActions],
      ['正确操作次数', report.correctActions],
      ['数据问题次数', report.anomalies.DATA_ISSUE || 0],
      ['规则问题次数', report.anomalies.RULE_ISSUE || 0],
      ['材料问题次数', report.anomalies.MATERIAL_ISSUE || 0],
      ['生成时间', formatDate(report.generatedAt)],
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, ws1, '核心指标');

    const actionsData = [
      ['时间', '债券代码', '债券名称', '调整前评级', '调整后评级', '调整理由', '反应时间(秒)', '是否正确', '得分影响', '净值影响'],
      ...report.actionTimeline.map((action: RatingAction) => [
        formatDate(action.timestamp),
        action.bondCode,
        action.bondName,
        action.oldRating,
        action.newRating,
        action.reason,
        action.reactionTime,
        action.isCorrect ? '是' : '否',
        action.scoreImpact,
        action.navImpact,
      ]),
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(actionsData);
    XLSX.utils.book_append_sheet(wb, ws2, '操作明细');

    const anomalyData = [
      ['时间', '异常类型', '严重程度', '描述', '根本原因', '修复建议', '涉及债券'],
      ...report.anomalyDetails.map((anomaly: Anomaly) => {
        return [
          formatDate(anomaly.timestamp),
          ANOMALY_TYPES[anomaly.type]?.label || anomaly.type,
          anomaly.severity === 'high' ? '严重' : anomaly.severity === 'medium' ? '中等' : '轻微',
          anomaly.description,
          anomaly.rootCause,
          anomaly.suggestion,
          '',
        ];
      }),
    ];
    const ws3 = XLSX.utils.aoa_to_sheet(anomalyData);
    XLSX.utils.book_append_sheet(wb, ws3, '异常明细');

    const suggestionsData = [
      ['序号', '改进建议'],
      ...report.suggestions.map((s: string, i: number) => [i + 1, s]),
    ];
    const ws4 = XLSX.utils.aoa_to_sheet(suggestionsData);
    XLSX.utils.book_append_sheet(wb, ws4, '改进建议');

    XLSX.writeFile(wb, `债券评级报告-${formatDate(report.generatedAt)}.xlsx`);
  }

  static exportJSON(report: GameReport): void {
    const dataStr = JSON.stringify(report, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `债券评级报告-${formatDate(report.generatedAt)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  static generateAuditLog(report: GameReport): string[] {
    const logs: string[] = [];

    logs.push(`=== 债券评级操作审计日志 ===`);
    logs.push(`生成时间: ${formatDate(report.generatedAt)}`);
    logs.push(`游戏ID: ${report.gameId}`);
    logs.push('');

    logs.push(`[游戏概览]`);
    logs.push(`最终得分: ${report.finalScore}`);
    logs.push(`最终净值: ${formatCurrency(report.finalNav)}`);
    logs.push(`净值变化: ${formatPercent(report.navChangePercent)}`);
    logs.push(`准确率: ${formatNumber(report.accuracyRate)}%`);
    logs.push('');

    logs.push(`[操作明细]`);
    report.actionTimeline.forEach((action, index) => {
      const time = formatDate(action.timestamp);
      const result = action.isCorrect ? '✓ 正确' : '✗ 错误';
      const score = action.scoreImpact >= 0 ? `+${action.scoreImpact}` : `${action.scoreImpact}`;
      logs.push(`${index + 1}. [${time}] ${action.bondCode}: ${action.oldRating} → ${action.newRating} | ${result} | 得分: ${score}`);
      if (action.reason) {
        logs.push(`   理由: ${action.reason}`);
      }
      if (action.hasAnomaly) {
        logs.push(`   ⚠ 存在异常`);
      }
    });
    logs.push('');

    if (report.anomalyDetails.length > 0) {
      logs.push(`[异常明细]`);
      report.anomalyDetails.forEach((anomaly, index) => {
        const typeConfig = ANOMALY_TYPES[anomaly.type];
        logs.push(`${index + 1}. ${typeConfig?.icon || ''} [${typeConfig?.label || anomaly.type}] ${anomaly.description}`);
        logs.push(`   根本原因: ${anomaly.rootCause}`);
        logs.push(`   建议: ${anomaly.suggestion}`);
      });
      logs.push('');
    }

    logs.push(`[改进建议]`);
    report.suggestions.forEach((s, i) => {
      logs.push(`${i + 1}. ${s}`);
    });

    return logs;
  }

  static exportAuditLog(report: GameReport): void {
    const logs = this.generateAuditLog(report);
    const content = logs.join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `债券评级审计日志-${formatDate(report.generatedAt)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

export const exportToPDF = (report: GameReport, elementId?: string) => 
  ReportExporter.exportPDF(report, elementId);
export const exportToExcel = (report: GameReport) => 
  ReportExporter.exportExcel(report);
export const exportToJSON = (report: GameReport) => 
  ReportExporter.exportJSON(report);
export const exportAuditLog = (report: GameReport) => 
  ReportExporter.exportAuditLog(report);
