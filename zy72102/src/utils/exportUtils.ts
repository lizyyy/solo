import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import type { EnergyAnalysis } from '../types';
import { formatTimestamp, formatTime, formatEnergy, formatNumber, getAnomalyTypeName, getFieldName, getFieldUnit } from './formatters';

export function exportToExcel(analysis: EnergyAnalysis): void {
  const wb = XLSX.utils.book_new();

  const summaryData = [
    ['分析批次', analysis.batchName],
    ['分析时间', formatTimestamp(analysis.createdAt)],
    ['数据来源', analysis.sourceFiles.join('; ')],
    ['', ''],
    ['分析摘要', ''],
    ['总样本数', analysis.summary.totalSamples],
    ['测试时长', `${(analysis.summary.duration / 1000).toFixed(0)} 秒`],
    ['平均动能', formatEnergy(analysis.summary.avgKineticEnergy)],
    ['平均势能', formatEnergy(analysis.summary.avgPotentialEnergy)],
    ['总能量损失', formatEnergy(analysis.summary.totalEnergyLoss)],
    ['最高温度', `${analysis.summary.maxTemperature.toFixed(1)} °C`],
    ['最大振动', `${analysis.summary.maxVibration.toFixed(2)} mm/s`],
    ['异常总数', analysis.summary.anomalyCount],
    ['严重异常', analysis.summary.criticalAnomalyCount],
    ['', ''],
    ['分析原因', analysis.analysisReason || '滑雪坡道能量分析'],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, '分析摘要');

  const sensorHeaders = ['时间', '速度(m/s)', '加速度(m/s²)', '温度(°C)', '振动(mm/s)', '压力(kPa)'];
  const sensorData = analysis.sensorData.map((d) => [
    formatTime(d.timestamp),
    d.velocity.toFixed(2),
    d.acceleration.toFixed(3),
    d.temperature.toFixed(1),
    d.vibration.toFixed(2),
    d.pressure.toFixed(1),
  ]);
  const wsSensor = XLSX.utils.aoa_to_sheet([sensorHeaders, ...sensorData]);
  XLSX.utils.book_append_sheet(wb, wsSensor, '传感器数据');

  const energyHeaders = ['时间', '动能(J)', '势能(J)', '总能量(J)', '能量损失(J)'];
  const energyData = analysis.totalEnergy.map((_, i) => [
    formatTime(analysis.totalEnergy[i].timestamp),
    analysis.kineticEnergy[i].value.toFixed(2),
    analysis.potentialEnergy[i].value.toFixed(2),
    analysis.totalEnergy[i].value.toFixed(2),
    analysis.energyLoss[i].value.toFixed(2),
  ]);
  const wsEnergy = XLSX.utils.aoa_to_sheet([energyHeaders, ...energyData]);
  XLSX.utils.book_append_sheet(wb, wsEnergy, '能量分析');

  const anomalyHeaders = ['时间', '异常类型', '严重程度', '数值', '阈值', '偏差', '原因'];
  const anomalyData = analysis.anomalies.map((a) => [
    formatTime(a.timestamp),
    getAnomalyTypeName(a.type),
    a.severity === 'critical' ? '严重' : '警告',
    formatNumber(a.value),
    formatNumber(a.threshold),
    formatNumber(a.deviation),
    a.reason,
  ]);
  const wsAnomaly = XLSX.utils.aoa_to_sheet([anomalyHeaders, ...anomalyData]);
  XLSX.utils.book_append_sheet(wb, wsAnomaly, '异常记录');

  const extremeHeaders = ['类型', '字段', '数值', '平均值', '偏差%', '时间'];
  const extremeData = analysis.extremeValues.map((e) => [
    e.type === 'max' ? '最大值' : '最小值',
    getFieldName(e.field),
    `${formatNumber(e.value)} ${getFieldUnit(e.field)}`,
    `${formatNumber(e.avgValue)} ${getFieldUnit(e.field)}`,
    `${e.deviationPercent.toFixed(1)}%`,
    formatTime(e.timestamp),
  ]);
  const wsExtreme = XLSX.utils.aoa_to_sheet([extremeHeaders, ...extremeData]);
  XLSX.utils.book_append_sheet(wb, wsExtreme, '极端值');

  const noteHeaders = ['时间', '内容', '记录人'];
  const noteData = analysis.fieldNotes.map((n) => [
    formatTime(n.timestamp),
    n.content,
    n.author,
  ]);
  const wsNotes = XLSX.utils.aoa_to_sheet([noteHeaders, ...noteData]);
  XLSX.utils.book_append_sheet(wb, wsNotes, '现场备注');

  const corrHeaders = ['数据点', '字段', '原始值', '修正值', '原因', '修改人'];
  const corrData = analysis.manualCorrections.map((c) => [
    c.dataPointIndex,
    getFieldName(c.field),
    c.originalValue,
    c.correctedValue,
    c.reason,
    c.author,
  ]);
  const wsCorr = XLSX.utils.aoa_to_sheet([corrHeaders, ...corrData]);
  XLSX.utils.book_append_sheet(wb, wsCorr, '人工修正');

  XLSX.writeFile(wb, `${analysis.batchName}_滑雪坡道能量分析_${formatDateForFilename(analysis.createdAt)}.xlsx`);
}

function formatDateForFilename(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getFullYear()}${(d.getMonth() + 1).toString().padStart(2, '0')}${d.getDate().toString().padStart(2, '0')}`;
}

export function exportToPDF(analysis: EnergyAnalysis): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('滑雪坡道能量分析报告', pageWidth / 2, y, { align: 'center' });
  y += 10;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`批次: ${analysis.batchName}`, 20, y);
  y += 7;
  doc.text(`分析时间: ${formatTimestamp(analysis.createdAt)}`, 20, y);
  y += 7;
  doc.text(`数据来源: ${analysis.sourceFiles.join('; ')}`, 20, y);
  y += 7;
  doc.text(`分析原因: ${analysis.analysisReason || '滑雪坡道能量分析'}`, 20, y);
  y += 15;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('一、分析摘要', 20, y);
  y += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const summaryItems = [
    [`总样本数: ${analysis.summary.totalSamples}`, `测试时长: ${(analysis.summary.duration / 1000).toFixed(0)} 秒`],
    [`平均动能: ${formatEnergy(analysis.summary.avgKineticEnergy)}`, `平均势能: ${formatEnergy(analysis.summary.avgPotentialEnergy)}`],
    [`总能量损失: ${formatEnergy(analysis.summary.totalEnergyLoss)}`, `最高温度: ${analysis.summary.maxTemperature.toFixed(1)} °C`],
    [`最大振动: ${analysis.summary.maxVibration.toFixed(2)} mm/s`, `异常总数: ${analysis.summary.anomalyCount}`],
    [`严重异常: ${analysis.summary.criticalAnomalyCount}`, ''],
  ];

  summaryItems.forEach((row) => {
    doc.text(row[0], 25, y);
    doc.text(row[1], 105, y);
    y += 7;
  });
  y += 10;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('二、异常记录', 20, y);
  y += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  if (analysis.anomalies.length === 0) {
    doc.text('无异常记录', 25, y);
  } else {
    analysis.anomalies.slice(0, 10).forEach((a, i) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      const severity = a.severity === 'critical' ? '[严重]' : '[警告]';
      doc.text(`${i + 1}. ${severity} ${getAnomalyTypeName(a.type)} - ${formatTime(a.timestamp)}`, 25, y);
      y += 6;
      doc.text(`   数值: ${formatNumber(a.value)}, 阈值: ${formatNumber(a.threshold)}, 偏差: ${formatNumber(a.deviation)}`, 30, y);
      y += 6;
      doc.text(`   原因: ${a.reason}`, 30, y);
      y += 8;
    });
  }

  doc.addPage();
  y = 20;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('三、极端值', 20, y);
  y += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  analysis.extremeValues.forEach((e) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    const typeLabel = e.type === 'max' ? '最大' : '最小';
    doc.text(`${typeLabel}${getFieldName(e.field)}: ${formatNumber(e.value)} ${getFieldUnit(e.field)}`, 25, y);
    y += 6;
    doc.text(`   平均值: ${formatNumber(e.avgValue)} ${getFieldUnit(e.field)}, 偏差: ${e.deviationPercent.toFixed(1)}%`, 30, y);
    y += 6;
    doc.text(`   出现时间: ${formatTime(e.timestamp)}`, 30, y);
    y += 8;
  });
  y += 10;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('四、现场备注', 20, y);
  y += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  analysis.fieldNotes.forEach((n) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    doc.text(`[${formatTime(n.timestamp)}] ${n.author}: ${n.content}`, 25, y);
    y += 7;
  });

  doc.save(`${analysis.batchName}_滑雪坡道能量分析_${formatDateForFilename(analysis.createdAt)}.pdf`);
}

export function downloadJSON(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
