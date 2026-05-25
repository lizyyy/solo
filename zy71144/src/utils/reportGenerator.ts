import { jsPDF } from 'jspdf';
import type { TrainingSession, CalculationResult } from '../types';

export const generateReportJSON = (session: TrainingSession): string => {
  const report = {
    id: session.id,
    basicInfo: {
      buildingName: session.buildingName,
      startTime: new Date(session.startTime).toLocaleString('zh-CN'),
      endTime: new Date(session.endTime).toLocaleString('zh-CN'),
      duration: Math.round((session.endTime - session.startTime) / 1000) + '秒',
    },
    path: {
      nodeCount: session.path.length,
      nodes: session.path.map((n) => ({
        type: n.type,
        position: n.position,
        time: new Date(n.timestamp).toLocaleTimeString('zh-CN'),
      })),
    },
    parameters: {
      hoseDiameter: session.params.hoseDiameter + 'mm',
      maxHoseLength: session.params.maxHoseLength + 'm',
      maxCorners: session.params.maxCorners + '个',
      minPressure: session.params.minPressure + 'MPa',
      flowRate: session.params.flowRate + 'L/s',
    },
    results: {
      totalLength: session.result.totalLength.toFixed(2) + 'm',
      cornerCount: session.result.cornerCount + '个',
      stairCount: session.result.stairCount + '处',
      verticalHeight: session.result.verticalHeight.toFixed(2) + 'm',
      pressureLoss: session.result.pressureLoss.toFixed(3) + 'MPa',
      remainingPressure: session.result.remainingPressure.toFixed(3) + 'MPa',
      initialPressure: session.result.initialPressure.toFixed(3) + 'MPa',
      isValid: session.result.isValid ? '合格' : '不合格',
    },
    warnings: session.result.warnings.map((w) => ({
      type: w.type,
      severity: w.severity,
      message: w.message,
    })),
    pressureCurve: session.result.pressureCurve.map((p) => ({
      distance: p.distance + 'm',
      pressure: p.pressure.toFixed(3) + 'MPa',
      nodeType: p.nodeType,
    })),
  };

  return JSON.stringify(report, null, 2);
};

export const downloadReport = (session: TrainingSession): void => {
  const json = generateReportJSON(session);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `消防水带演练报告_${session.buildingName}_${new Date(session.startTime).toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const getReportSummary = (result: CalculationResult): string => {
  const lines = [];
  lines.push('=== 消防水带铺设演练评估报告 ===\n');
  lines.push(`总长度: ${result.totalLength.toFixed(2)}m`);
  lines.push(`转角数量: ${result.cornerCount}个`);
  lines.push(`垂直高度: ${result.verticalHeight.toFixed(2)}m`);
  lines.push(`压力损失: ${result.pressureLoss.toFixed(3)}MPa`);
  lines.push(`剩余压力: ${result.remainingPressure.toFixed(3)}MPa`);
  lines.push(`评估结果: ${result.isValid ? '✅ 合格' : '❌ 不合格'}`);

  if (result.warnings.length > 0) {
    lines.push('\n--- 警告信息 ---');
    result.warnings.forEach((w) => {
      const icon = w.severity === 'error' ? '❌' : '⚠️';
      lines.push(`${icon} ${w.message}`);
    });
  }

  return lines.join('\n');
};

export const generateReportPDF = (session: TrainingSession): jsPDF => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let y = margin;

  doc.setFillColor(220, 38, 38);
  doc.rect(0, 0, pageWidth, 15, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('消防水带铺设演练评估报告', margin, 10);

  y += 15;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);

  doc.setFont('helvetica', 'bold');
  doc.text('基本信息', margin, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  const basicInfo = [
    ['演练ID', session.id],
    ['建筑名称', session.buildingName],
    ['开始时间', new Date(session.startTime).toLocaleString('zh-CN')],
    ['结束时间', new Date(session.endTime).toLocaleString('zh-CN')],
    ['演练时长', Math.round((session.endTime - session.startTime) / 1000) + ' 秒'],
    ['评估结果', session.result.isValid ? '合格' : '不合格'],
  ];

  basicInfo.forEach(([label, value]) => {
    doc.text(`${label}:`, margin, y);
    doc.text(String(value), margin + 40, y);
    y += 6;
  });

  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('演练参数', margin, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  const params = [
    ['水带直径', session.params.hoseDiameter + ' mm'],
    ['额定流量', session.params.flowRate + ' L/s'],
    ['最大长度限制', session.params.maxHoseLength + ' m'],
    ['最小允许压力', session.params.minPressure + ' MPa'],
  ];

  params.forEach(([label, value]) => {
    doc.text(`${label}:`, margin, y);
    doc.text(String(value), margin + 40, y);
    y += 6;
  });

  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('测量结果', margin, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  const results = [
    ['水带总长度', session.result.totalLength.toFixed(2) + ' m'],
    ['转角数量', session.result.cornerCount + ' 个'],
    ['楼梯数量', session.result.stairCount + ' 处'],
    ['垂直高度', session.result.verticalHeight.toFixed(2) + ' m'],
    ['初始压力', session.result.initialPressure.toFixed(3) + ' MPa'],
    ['压力损失', session.result.pressureLoss.toFixed(3) + ' MPa'],
    ['剩余压力', session.result.remainingPressure.toFixed(3) + ' MPa'],
  ];

  results.forEach(([label, value]) => {
    doc.text(`${label}:`, margin, y);
    doc.text(String(value), margin + 40, y);
    y += 6;
  });

  if (session.result.warnings.length > 0) {
    if (y + session.result.warnings.length * 6 + 20 > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }

    y += 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(220, 38, 38);
    doc.text('问题汇总', margin, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);

    session.result.warnings.forEach((warning, i) => {
      const prefix = warning.severity === 'error' ? '[错误]' : '[警告]';
      const line = `${prefix} ${warning.message}`;
      const lines = doc.splitTextToSize(line, pageWidth - margin * 2);
      lines.forEach((lineText: string) => {
        doc.text(lineText, margin, y);
        y += 6;
      });
    });
  }

  if (session.result.pressureCurve.length > 0) {
    if (y + session.result.pressureCurve.length * 6 + 20 > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }

    y += 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(59, 130, 246);
    doc.text('压力变化数据', margin, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);

    doc.text('距离(m)', margin, y);
    doc.text('压力(MPa)', margin + 35, y);
    doc.text('节点类型', margin + 75, y);
    y += 6;

    session.result.pressureCurve.forEach((point) => {
      if (y > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(String(point.distance), margin, y);
      doc.text(String(point.pressure.toFixed(3)), margin + 35, y);
      doc.text(point.nodeType || '-', margin + 75, y);
      y += 6;
    });
  }

  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(
    '生成时间: ' + new Date().toLocaleString('zh-CN'),
    margin,
    pageHeight - 10
  );

  return doc;
};

export const downloadPDFReport = (session: TrainingSession): void => {
  const doc = generateReportPDF(session);
  const filename = `消防水带演练报告_${session.buildingName}_${new Date(session.startTime).toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
};
