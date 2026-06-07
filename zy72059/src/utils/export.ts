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
    const canvas = element.querySelector('canvas');
    if (canvas) {
      const dataUrl = canvas.toDataURL('image/png');
      if (filename !== 'temp') {
        const link = document.createElement('a');
        link.download = `${filename}.png`;
        link.href = dataUrl;
        link.click();
      }
      return dataUrl;
    }

    const fallbackCanvas = await html2canvas(element, {
      backgroundColor: '#0A1628',
      scale: 2,
      useCORS: true,
      logging: false,
      ignoreElements: (el) => {
        if (el.tagName === 'CANVAS') return false;
        return false;
      },
    });

    const dataUrl = fallbackCanvas.toDataURL('image/png');

    if (filename !== 'temp') {
      const link = document.createElement('a');
      link.download = `${filename}.png`;
      link.href = dataUrl;
      link.click();
    }

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

const createReportHTML = (scheme: Scheme, screenshotDataUrl: string | null): string => {
  const abnormalDrones = scheme.drones.filter((d) => d.status !== 'NORMAL');
  
  const statusColors: Record<string, string> = {
    NORMAL: '#43A047',
    WARNING: '#FB8C00',
    CONFIRM: '#FF9800',
    HISTORY: '#78909C',
    ERROR: '#E53935',
    DUPLICATE: '#9C27B0',
    BOUNDARY: '#C62828',
  };

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif;
          width: 210mm;
          padding: 15mm;
          color: #0A1628;
          background: white;
        }
        h1 { font-size: 20px; font-weight: bold; margin-bottom: 8px; }
        h2 { font-size: 14px; font-weight: bold; margin: 16px 0 8px; color: #0A1628; border-bottom: 1px solid #E0E0E0; padding-bottom: 4px; }
        .meta { font-size: 11px; color: #666; margin-bottom: 12px; line-height: 1.6; }
        .screenshot { width: 100%; margin: 8px 0; border: 1px solid #E0E0E0; border-radius: 4px; }
        .screenshot img { width: 100%; display: block; }
        .abnormal-item {
          border: 1px solid #E0E0E0;
          border-radius: 6px;
          padding: 10px;
          margin-bottom: 8px;
        }
        .abnormal-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
        .abnormal-id { font-weight: bold; font-size: 13px; }
        .status-badge {
          padding: 2px 8px;
          border-radius: 10px;
          font-size: 10px;
          font-weight: 500;
          color: white;
        }
        .abnormal-detail { font-size: 11px; color: #555; line-height: 1.6; }
        .source-line { font-size: 11px; color: #666; margin-top: 4px; }
        .note { font-size: 11px; color: #444; margin-top: 4px; padding-left: 8px; border-left: 3px solid #1E88E5; }
        .source-list { font-size: 11px; line-height: 1.8; }
        .source-item { margin-bottom: 4px; }
        .history-note { font-size: 10px; color: #777; margin-left: 12px; }
        .stats { display: flex; gap: 16px; margin: 8px 0; font-size: 11px; }
        .stat-item { padding: 4px 10px; background: #F5F7FA; border-radius: 4px; }
        .stat-value { font-weight: bold; color: #1E88E5; }
      </style>
    </head>
    <body>
      <h1>无人机编队避障舱 - 研判报告</h1>
      <div class="meta">
        <div><strong>方案名称：</strong>${scheme.name}</div>
        <div><strong>分析人员：</strong>${scheme.author}</div>
        <div><strong>生成时间：</strong>${formatDate(scheme.updatedAt)}</div>
      </div>
      
      <div class="stats">
        <div class="stat-item">无人机总数：<span class="stat-value">${scheme.drones.length}架</span></div>
        <div class="stat-item">障碍物总数：<span class="stat-value">${scheme.obstacles.length}个</span></div>
        <div class="stat-item">异常记录：<span class="stat-value" style="color:#E53935">${abnormalDrones.length}条</span></div>
      </div>

      ${scheme.description ? `<div class="meta"><strong>方案描述：</strong>${scheme.description}</div>` : ''}

      ${screenshotDataUrl ? `
        <h2>3D场景截图</h2>
        <div class="screenshot">
          <img src="${screenshotDataUrl}" alt="3D场景" />
        </div>
      ` : ''}

      <h2>异常记录清单</h2>
      ${abnormalDrones.length === 0 ? '<p style="font-size:11px;color:#666">无异常记录</p>' : ''}
      ${abnormalDrones.map((drone) => `
        <div class="abnormal-item">
          <div class="abnormal-header">
            <span class="abnormal-id">${drone.id} - ${drone.name}</span>
            <span class="status-badge" style="background:${statusColors[drone.status]}">${STATUS_LABELS[drone.status]}</span>
          </div>
          <div class="abnormal-detail">
            <div>避障距离：${drone.obstacleDistance >= 0 ? drone.obstacleDistance.toFixed(1) + '米' : '无效'}</div>
            <div class="source-line">
              <strong>来源：</strong>${SOURCE_LABELS[drone.source.type]} - ${drone.source.name}（${drone.source.reference}）
            </div>
            ${drone.currentNote ? `<div class="note"><strong>处理原因：</strong>${drone.currentNote}</div>` : ''}
          </div>
        </div>
      `).join('')}

      <h2>来源追溯清单</h2>
      <div class="source-list">
        ${scheme.drones.map((drone) => `
          <div class="source-item">
            <strong>${drone.id}</strong>：${SOURCE_LABELS[drone.source.type]} - ${drone.source.name}（${drone.source.reference}）
            ${drone.historyNotes.map((note) => `
              <div class="history-note">${note.date} ${note.author}：${note.content} [${note.source}]</div>
            `).join('')}
          </div>
        `).join('')}
      </div>
    </body>
    </html>
  `;
};

export const exportPDF = async (
  scheme: Scheme,
  screenshotElementId: string
): Promise<void> => {
  const screenshotDataUrl = await exportScreenshot(screenshotElementId, 'temp');
  
  const reportHtml = createReportHTML(scheme, screenshotDataUrl);
  
  const reportContainer = document.createElement('div');
  reportContainer.style.position = 'fixed';
  reportContainer.style.left = '-9999px';
  reportContainer.style.top = '0';
  reportContainer.style.width = '210mm';
  reportContainer.style.background = 'white';
  reportContainer.style.zIndex = '-9999';
  
  const innerWrapper = document.createElement('div');
  innerWrapper.innerHTML = reportHtml;
  const bodyContent = innerWrapper.querySelector('body');
  if (bodyContent) {
    while (bodyContent.firstChild) {
      reportContainer.appendChild(bodyContent.firstChild);
    }
  } else {
    reportContainer.innerHTML = reportHtml;
  }
  
  document.body.appendChild(reportContainer);

  try {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageHeight = pdf.internal.pageSize.getHeight();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 15;

    const canvas = await html2canvas(reportContainer, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#FFFFFF',
      allowTaint: true,
    });

    const imgData = canvas.toDataURL('image/png');
    const imgWidth = pageWidth - margin * 2;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = margin;

    pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
    heightLeft -= pageHeight - margin * 2;

    while (heightLeft >= 0) {
      position = heightLeft - imgHeight + margin;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
      heightLeft -= pageHeight - margin * 2;
    }

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    pdf.save(`无人机编队避障舱_${scheme.name}_${dateStr}.pdf`);
  } finally {
    document.body.removeChild(reportContainer);
  }
};
