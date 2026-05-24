import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { ShadowRecord } from '../types';
import { formatTime, formatDuration } from '../types';

export const exportToPDF = async (
  date: Date,
  shadowRecords: ShadowRecord[],
  selectedWindows: string[],
  buildings: { id: string; name: string }[]
) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');
  
  doc.setTextColor(251, 191, 36);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('日照遮挡分析报告', pageWidth / 2, 25, { align: 'center' });
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`生成日期：${new Date().toLocaleDateString('zh-CN')}`, pageWidth / 2, 35, { align: 'center' });
  
  doc.setDrawColor(255, 255, 255, 0.2);
  doc.line(20, 45, pageWidth - 20, 45);
  
  doc.setTextColor(251, 191, 36);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('一、基本信息', 20, 60);
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`分析日期：${date.toLocaleDateString('zh-CN')}`, 25, 70);
  doc.text(`选中窗户数量：${selectedWindows.length}个`, 25, 78);
  
  const totalShadowDuration = shadowRecords.reduce((sum, r) => sum + r.duration, 0);
  const avgShadowDuration = selectedWindows.length > 0 ? totalShadowDuration / selectedWindows.length : 0;
  doc.text(`平均遮挡时长：${formatDuration(avgShadowDuration)}`, 25, 86);
  
  doc.setTextColor(251, 191, 36);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('二、遮挡来源分析', 20, 102);
  
  const buildingStats = new Map<string, number>();
  shadowRecords.forEach(record => {
    const current = buildingStats.get(record.buildingId) || 0;
    buildingStats.set(record.buildingId, current + record.duration);
  });
  
  let yPos = 112;
  let index = 1;
  buildingStats.forEach((duration, buildingId) => {
    if (yPos > pageHeight - 30) {
      doc.addPage();
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');
      yPos = 30;
    }
    
    const building = buildings.find(b => b.id === buildingId);
    const buildingName = building?.name || buildingId;
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`${index}. ${buildingName}`, 25, yPos);
    
    const percentage = totalShadowDuration > 0 ? (duration / totalShadowDuration * 100).toFixed(1) : '0';
    doc.text(`遮挡时长：${formatDuration(duration)} (${percentage}%)`, 30, yPos + 6);
    
    yPos += 18;
    index++;
  });
  
  doc.setTextColor(251, 191, 36);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('三、详细遮挡记录', 20, yPos + 10);
  yPos += 20;
  
  shadowRecords.slice(0, 10).forEach(record => {
    if (yPos > pageHeight - 30) {
      doc.addPage();
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');
      yPos = 30;
    }
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    const building = buildings.find(b => b.id === record.buildingId);
    doc.text(
      `${building?.name || record.buildingId}: ${formatTime(record.startTime)} - ${formatTime(record.endTime)} (${formatDuration(record.duration)})`,
      25,
      yPos
    );
    yPos += 8;
  });
  
  doc.setFillColor(255, 255, 255, 0.1);
  doc.roundedRect(20, pageHeight - 30, pageWidth - 40, 15, 3, 3, 'F');
  doc.setTextColor(148, 163, 184);
  doc.setFontSize(9);
  doc.text('报告由公寓日照投诉复盘系统自动生成', pageWidth / 2, pageHeight - 20, { align: 'center' });
  
  doc.save(`日照分析报告_${date.toISOString().split('T')[0]}.pdf`);
};

export const exportToCSV = (
  shadowRecords: ShadowRecord[],
  buildings: { id: string; name: string }[]
) => {
  const headers = ['遮挡楼栋', '开始时间', '结束时间', '持续时长(分钟)'];
  const rows = shadowRecords.map(record => {
    const building = buildings.find(b => b.id === record.buildingId);
    return [
      building?.name || record.buildingId,
      formatTime(record.startTime),
      formatTime(record.endTime),
      record.duration,
    ];
  });
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(',')),
  ].join('\n');
  
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `日照遮挡数据_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
};

export const captureScreenshot = async (): Promise<string> => {
  const canvas = document.querySelector('canvas');
  if (!canvas) return '';
  
  return canvas.toDataURL('image/png');
};
