import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { Drone, Scheme } from '@/types';
import { STATUS_LABELS, SOURCE_LABELS } from '@/types';

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN');
};

const getDistanceColor = (distance: number): string => {
  if (distance < 0) return '#E53935';
  if (distance < 3) return '#E53935';
  if (distance < 5) return '#FB8C00';
  return '#43A047';
};

export const exportScreenshot = async (
  elementId: string,
  filename: string
): Promise<string | null> => {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error('找不到截图元素:', elementId);
    return null;
  }

  try {
    const canvas = await html2canvas(element, {
      backgroundColor: '#0A1628',
      scale: 2,
      useCORS: true,
      logging: false,
    });

    const dataUrl = canvas.toDataURL('image/png');

    const link = document.createElement('a');
    link.download = `${filename}.png`;
    link.href = dataUrl;
    link.click();

    return dataUrl;
  } catch (e) {
    console.error('截图失败:', e);
    return null;
  }
};

export const exportJSON = (scheme: Scheme): void => {
  const jsonStr = JSON.stringify(scheme, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const link = document.createElement('a');
  link.download = `无人机编队避障舱_${scheme.name}_${dateStr}.json`;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
};

export const exportCSV = (drones: Drone[], schemeName: string): void => {
  const headers = ['编号', '名称', 'X坐标', 'Y坐标', 'Z坐标', '状态', '避障距离(米)', '来源类型', '来源名称', '来源引用', '当前备注', '创建时间', '更新时间'];
  
  const rows = drones.map((d) => [
    d.id,
    d.name,
    d.position.x,
    d.position.y,
    d.position.z,
    STATUS_LABELS[d.status],
    d.obstacleDistance >= 0 ? d.obstacleDistance : '无效',
    SOURCE_LABELS[d.source.type],
    d.source.name,
    d.source.reference,
    d.currentNote,
    formatDate(d.createdAt),
    formatDate(d.updatedAt),
  ]);

  const csvContent = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',') + '\n').join('\n');

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const link = document.createElement('a');
  link.download = `无人机编队避障舱_${schemeName}_${dateStr}.csv`;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
};

export const exportPDF = async (
  scheme: Scheme,
  screenshotElementId: string
): Promise<void> => {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let yPos = margin;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.setTextColor(10, 22, 40);
  pdf.text('无人机编队避障舱 - 研判报告', margin, yPos);
  yPos += 10;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(100, 100, 100);
  pdf.text(`方案名称: ${scheme.name}`, margin, yPos);
  yPos += 5;
  pdf.text(`分析人员: ${scheme.author}`, margin, yPos);
  yPos += 5;
  pdf.text(`生成时间: ${formatDate(scheme.updatedAt)}`, margin, yPos);
  yPos += 5;
  pdf.text(`无人机总数: ${scheme.drones.length}架`, margin, yPos);
  yPos += 5;
  pdf.text(`障碍物总数: ${scheme.obstacles.length}个`, margin, yPos);
  yPos += 10;

  if (scheme.description) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(10, 22, 40);
    pdf.text('方案描述', margin, yPos);
    yPos += 6;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(60, 60, 60);
    const descLines = pdf.splitTextToSize(scheme.description, contentWidth);
    pdf.text(descLines, margin, yPos);
    yPos += descLines.length * 5 + 5;
  }

  const screenshotDataUrl = await exportScreenshot(screenshotElementId, 'temp');
  if (screenshotDataUrl) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(10, 22, 40);
    pdf.text('3D场景截图', margin, yPos);
    yPos += 8;

    const imgWidth = contentWidth;
    const imgHeight = 80;
    pdf.addImage(screenshotDataUrl, 'PNG', margin, yPos, imgWidth, imgHeight);
    yPos += imgHeight + 8;
  }

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.setTextColor(10, 22, 40);
  pdf.text('异常记录清单', margin, yPos);
  yPos += 8;

  const abnormalDrones = scheme.drones.filter(
    (d) => d.status !== 'NORMAL'
  );

  if (abnormalDrones.length === 0) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(60, 60, 60);
    pdf.text('无异常记录', margin, yPos);
    yPos += 6;
  } else {
    for (const drone of abnormalDrones) {
      if (yPos > 260) {
        pdf.addPage();
        yPos = margin;
      }

      pdf.setDrawColor(200, 200, 200);
      pdf.setLineWidth(0.1);
      pdf.roundedRect(margin - 2, yPos - 4, contentWidth + 4, 45, 2, 2, 'S');

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.setTextColor(10, 22, 40);
      pdf.text(`${drone.id} - ${drone.name}`, margin, yPos);
      yPos += 5;

      const statusLabel = STATUS_LABELS[drone.status];
      let statusRgb = [229, 57, 53];
      if (drone.status === 'WARNING') statusRgb = [251, 140, 0];
      if (drone.status === 'CONFIRM') statusRgb = [255, 152, 0];
      if (drone.status === 'HISTORY') statusRgb = [120, 144, 156];
      if (drone.status === 'DUPLICATE') statusRgb = [156, 39, 176];
      pdf.setTextColor(statusRgb[0], statusRgb[1], statusRgb[2]);
      pdf.text(`状态: ${statusLabel}`, margin, yPos);
      yPos += 5;

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(60, 60, 60);

      const distText = drone.obstacleDistance >= 0
        ? `${drone.obstacleDistance.toFixed(1)}米`
        : '无效';
      pdf.text(`避障距离: ${distText}`, margin, yPos);
      yPos += 5;

      pdf.text(
        `来源: ${SOURCE_LABELS[drone.source.type]} - ${drone.source.name} (${drone.source.reference})`,
        margin,
        yPos
      );
      yPos += 5;

      if (drone.currentNote) {
        const noteLines = pdf.splitTextToSize(
          `处理原因: ${drone.currentNote}`,
          contentWidth - 10
        );
        pdf.text(noteLines, margin, yPos);
        yPos += noteLines.length * 5;
      }

      yPos += 2;
    }
  }

  if (abnormalDrones.length > 0) {
    yPos += 5;
  }

  if (yPos > 220) {
    pdf.addPage();
    yPos = margin;
  }

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.setTextColor(10, 22, 40);
  pdf.text('来源追溯清单', margin, yPos);
  yPos += 8;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(60, 60, 60);

  for (const drone of scheme.drones) {
    if (yPos > 260) {
      pdf.addPage();
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(60, 60, 60);
      yPos = margin;
    }

    pdf.text(
      `${drone.id}: ${SOURCE_LABELS[drone.source.type]} - ${drone.source.reference}`,
      margin,
      yPos
    );
    yPos += 5;

    if (drone.historyNotes.length > 0) {
      for (const note of drone.historyNotes) {
        if (yPos > 260) {
          pdf.addPage();
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(10);
          pdf.setTextColor(60, 60, 60);
          yPos = margin;
        }
        pdf.text(
          `  ${note.date} ${note.author}: ${note.content} [${note.source}]`,
          margin + 5,
          yPos
        );
        yPos += 5;
      }
    }
  }

  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  pdf.save(`无人机编队避障舱_${scheme.name}_${dateStr}.pdf`);
};
