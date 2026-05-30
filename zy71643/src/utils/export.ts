import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { CollisionPoint, CollisionDetectionResult, DataIssue } from '../types';
import { collisionTypeLabels, statusLabels } from '../data/config';
import { logger } from './logger';

export async function captureScene(element: HTMLElement): Promise<string> {
  try {
    const canvas = await html2canvas(element, {
      backgroundColor: '#0a1929',
      scale: 2,
      useCORS: true,
      logging: false,
    });
    return canvas.toDataURL('image/png');
  } catch (error) {
    logger.error('report', '场景截图失败', error);
    throw error;
  }
}

export interface ReportData {
  title: string;
  date: string;
  inspector: string;
  detectionResult: CollisionDetectionResult;
  collisions: CollisionPoint[];
  dataIssues: DataIssue[];
  sceneImage?: string;
}

export async function generatePDFReport(reportData: ReportData): Promise<void> {
  logger.info('report', '开始生成PDF报告', {
    collisions: reportData.collisions.length,
    issues: reportData.dataIssues.length,
  });

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let y = margin;

  doc.setFillColor(30, 58, 95);
  doc.rect(0, 0, pageWidth, 30, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('地下管线碰撞检测报告', pageWidth / 2, 20, { align: 'center' });

  y += 25;

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('一、检测概况', margin, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`项目名称：${reportData.title}`, margin, y);
  y += 6;
  doc.text(`检测日期：${reportData.date}`, margin, y);
  y += 6;
  doc.text(`检测人员：${reportData.inspector}`, margin, y);
  y += 6;
  doc.text(`管线总数：${reportData.detectionResult.totalSegments} 段`, margin, y);
  y += 6;
  doc.text(`检测用时：${(reportData.detectionResult.duration / 1000).toFixed(2)} 秒`, margin, y);
  y += 6;
  doc.text(`数据修正：${reportData.detectionResult.correctedCount} 处`, margin, y);
  y += 6;
  doc.text(`跳过检测：${reportData.detectionResult.skippedCount} 处`, margin, y);

  y += 10;

  if (reportData.sceneImage) {
    try {
      const imgWidth = pageWidth - margin * 2;
      const imgHeight = 60;
      doc.addImage(reportData.sceneImage, 'PNG', margin, y, imgWidth, imgHeight);
      y += imgHeight + 8;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100, 100, 100);
      doc.text('图1：管线3D空间分布示意图', pageWidth / 2, y, { align: 'center' });
      y += 10;
      doc.setTextColor(0, 0, 0);
    } catch (e) {
      logger.warning('report', '插入场景图片失败', e);
    }
  }

  if (y > pageHeight - 60) {
    doc.addPage();
    y = margin;
  }

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('二、碰撞检测结果汇总', margin, y);
  y += 8;

  const criticalCount = reportData.collisions.filter((c) => c.severity === 'critical').length;
  const warningCount = reportData.collisions.filter((c) => c.severity === 'warning').length;
  const infoCount = reportData.collisions.filter((c) => c.severity === 'info').length;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`碰撞总数：${reportData.collisions.length} 处`, margin, y);
  y += 6;
  doc.setTextColor(229, 57, 53);
  doc.text(`  严重：${criticalCount} 处`, margin, y);
  y += 6;
  doc.setTextColor(251, 140, 0);
  doc.text(`  警告：${warningCount} 处`, margin, y);
  y += 6;
  doc.setTextColor(67, 160, 71);
  doc.text(`  提示：${infoCount} 处`, margin, y);
  y += 6;
  doc.setTextColor(0, 0, 0);

  y += 4;

  const typeStats: Record<string, number> = {};
  reportData.collisions.forEach((c) => {
    typeStats[c.type] = (typeStats[c.type] || 0) + 1;
  });

  Object.entries(typeStats).forEach(([type, count]) => {
    doc.text(`  ${collisionTypeLabels[type] || type}：${count} 处`, margin, y);
    y += 6;
  });

  if (y > pageHeight - 60) {
    doc.addPage();
    y = margin;
  }

  y += 4;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('三、碰撞点详细信息', margin, y);
  y += 10;

  for (let i = 0; i < reportData.collisions.length; i++) {
    const collision = reportData.collisions[i];

    if (y > pageHeight - 50) {
      doc.addPage();
      y = margin;
    }

    doc.setFillColor(240, 240, 240);
    doc.rect(margin, y - 4, pageWidth - margin * 2, 6, 'F');

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`${i + 1}. ${collisionTypeLabels[collision.type] || collision.type}`, margin, y);

    if (collision.severity === 'critical') {
      doc.setTextColor(229, 57, 53);
    } else if (collision.severity === 'warning') {
      doc.setTextColor(251, 140, 0);
    } else {
      doc.setTextColor(67, 160, 71);
    }
    doc.text(`[${collision.severity === 'critical' ? '严重' : collision.severity === 'warning' ? '警告' : '提示'}]`, pageWidth - margin - 30, y);
    doc.setTextColor(0, 0, 0);

    y += 8;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`位置：${collision.pileNo || '未知桩号'}`, margin + 5, y);
    y += 5;
    doc.text(`管线A：${collision.segmentA.pipelineName}`, margin + 5, y);
    y += 5;
    doc.text(`管线B：${collision.segmentB.pipelineName}`, margin + 5, y);
    y += 5;
    doc.text(
      `净距：${collision.calculatedDistance.toFixed(3)}m（要求：≥${collision.requiredDistance}m）`,
      margin + 5,
      y
    );
    y += 5;
    doc.text(`状态：${statusLabels[collision.status] || collision.status}`, margin + 5, y);
    y += 5;

    if (collision.dataIssues.length > 0) {
      doc.setTextColor(251, 140, 0);
      doc.setFont('helvetica', 'italic');
      doc.text(`数据异常：${collision.dataIssues.length}处`, margin + 5, y);
      y += 5;
      collision.dataIssues.forEach((issue) => {
        doc.text(`  - ${issue.description}`, margin + 8, y);
        y += 5;
        doc.text(`    影响：${issue.impact}`, margin + 10, y);
        y += 5;
      });
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
    }

    y += 4;
  }

  if (reportData.dataIssues.length > 0) {
    if (y > pageHeight - 60) {
      doc.addPage();
      y = margin;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('四、数据质量问题说明', margin, y);
    y += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`本次检测共发现 ${reportData.dataIssues.length} 处数据质量问题，可能影响检测结果的准确性：`, margin, y);
    y += 8;

    reportData.dataIssues.forEach((issue, index) => {
      if (y > pageHeight - 30) {
        doc.addPage();
        y = margin;
      }

      doc.setFont('helvetica', 'bold');
      doc.text(`${index + 1}. ${issue.description}`, margin, y);
      y += 6;
      doc.setFont('helvetica', 'normal');
      doc.text(`   影响：${issue.impact}`, margin + 5, y);
      y += 6;
      if (issue.correctedValue !== undefined) {
        doc.setTextColor(67, 160, 71);
        doc.text(`   已修正：${JSON.stringify(issue.originalValue)} → ${JSON.stringify(issue.correctedValue)}`, margin + 5, y);
        doc.setTextColor(0, 0, 0);
        y += 6;
      }
    });
  }

  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`第 ${i} 页 / 共 ${pageCount} 页`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    doc.text('地下管线碰撞巡检系统', margin, pageHeight - 10);
  }

  const fileName = `管线碰撞检测报告_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);

  logger.info('report', 'PDF报告生成完成', { fileName, pages: pageCount });
}
